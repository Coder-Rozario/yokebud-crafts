import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiLock,
  FiUpload,
  FiPlus,
  FiMinus,
  FiTrash2,
  FiImage,
  FiCheck,
  FiDownload,
  FiPackage,
  FiUser,
  FiMapPin,
  FiPhone,
  FiMail,
  FiTruck
} from "react-icons/fi";
import { useCart } from "../pages/context/CartContext";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { jsPDF } from "jspdf";
import logo from "../assades/LOGO.png"; // Ensure this path is correct
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiFetch } from "../utils/api";
import { SOCKET_BASE } from "../utils/api";
import { io } from "socket.io-client";
import { useLocale } from "../pages/context/LocaleContext";

// --- STYLES & HELPERS ---
const isMobile = window.innerWidth <= 768;
const styles = document.createElement("style");
styles.textContent = `
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=text] { -moz-appearance: textfield; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
`;
document.head.appendChild(styles);

const GOLD_GRADIENT_CSS =
  "linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)";

const borderGradientStyle = (active) =>
  active
    ? {
        background:
          "linear-gradient(#111, #111) padding-box, " +
          GOLD_GRADIENT_CSS +
          " border-box",
        border: "2px solid transparent",
      }
    : { border: "1px solid #444", background: "#111" };

const COLOR_MAP = {
  Original: "#BF953F", Black: "#000000", White: "#FFFFFF", Gray: "#808080",
  "Light Gray": "#D3D3D3", "Dark Gray": "#A9A9A9", Charcoal: "#36454F",
  Gold: "#FFD700", Red: "#e74c3c", Orange: "#FFA500", Coral: "#FF7F50",
  Yellow: "#FFD400", Mustard: "#FFDB58", Blue: "#3498db", "Royal Blue": "#4169E1",
  "Sky Blue": "#87CEEB", Navy: "#000080", Teal: "#008080", Cyan: "#00FFFF",
  Green: "#008000", "Forest Green": "#27ae60", Lime: "#32CD32", Olive: "#808000",
  Pink: "#FFC0CB", "Hot Pink": "#FF69B4", Magenta: "#FF00FF", Purple: "#8e44ad",
  Lavender: "#E6E6FA", Brown: "#8B4513", Tan: "#D2B48C", Beige: "#F5F5DC",
  Cream: "#FFFDD0", Midnight: "#2c3e50", Maroon: "#800000", Burgundy: "#800020",
};

const getColorCode = (colorName) => COLOR_MAP[colorName] || colorName;

const getColorName = (colorValue) => {
  if (colorValue === null || typeof colorValue === 'undefined') return '';
  const val = String(colorValue).trim();
  if (val.startsWith('#')) {
    const lower = val.toLowerCase();
    const match = Object.entries(COLOR_MAP).find(([, hex]) => String(hex).trim().toLowerCase() === lower);
    return match ? match[0] : lower;
  }
  return val;
};

const getCategory = (item) => (item.category || item.category_name || "").toLowerCase();
const isApparel = (item) => {
  const c = getCategory(item);
  return c.includes("apparel") || c.includes("clothing");
};
const hasMatch = (item, keywords) => {
  const cat = getCategory(item);
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  return keywords.some((k) => cat.includes(k.toLowerCase()) || tags.some((t) => t.includes(k.toLowerCase())));
};

const shouldShowDesignOptions = (item) => {
  // If the product has explicit is_customizable flag set by admin
  const customizable = item.is_customizable || item.product?.is_customizable;
  return customizable === 1 || customizable === true || customizable === '1';
};

const isFileLike = (f) => {
  try { return !!f && (f instanceof File || f instanceof Blob); } catch (_) { return false; }
};

const getDesignPreviewSrc = (f) => {
  if (!f) return null;
  if (typeof f === "string") return f;
  if (isFileLike(f)) {
    try { return URL.createObjectURL(f); } catch (_) { return null; }
  }
  return null;
};

const uploadDesignFilesForItems = async (finalItems) => {
  const files = [];
  finalItems.forEach((item) => {
    (item.units || []).forEach((u) => { if (isFileLike(u.designFile)) files.push(u.designFile); });
  });
  if (files.length === 0) return { uploaded: [], items: finalItems };
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const response = await apiFetch('/api/checkout/upload-design', { method: 'POST', body: form });
  const data = await response.json();
  const uploaded = Array.isArray(data.files) ? data.files : [];
  let idx = 0;
  const itemsWithUrls = finalItems.map((item) => ({
    ...item,
    units: (item.units || []).map((u) => {
      if (isFileLike(u.designFile) && uploaded[idx]) {
        const info = uploaded[idx];
        idx += 1;
        return { ...u, designFile: info.url };
      }
      return u;
    })
  }));
  return { uploaded, items: itemsWithUrls };
};

const downloadInvoicePDF = async () => {
  let store = window.__CHECKOUT_CONF__ || {};
  try {
    if (!store.items || !store.totals) {
      const params = new URLSearchParams(window.location.search || '');
      const qOrderId = params.get('orderId') || params.get('order_id');
      const ssRaw = sessionStorage.getItem('checkout_pending');
      const ss = ssRaw ? JSON.parse(ssRaw) : null;
      if (ss) store = { ...ss, orderId: ss.orderId || store.orderId };
      if ((!store.items || !store.totals) && qOrderId) {
        try {
          const res = await apiFetch(`/api/orders/${encodeURIComponent(qOrderId)}`);
          const data = await res.json();
          if (data?.success && data.order) {
            const o = data.order;
            store = {
              items: o.items || [],
              totals: o.totals || {},
              orderId: qOrderId,
              paymentMethod: o.payment_method || 'stripe',
              customer: o.customer_info || {}
            };
          }
        } catch (_) {}
      }
    }
  } catch {}
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  
  const toDataURL = async (url) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  };

  const fileToDataURL = async (file) => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } catch (e) { resolve(null); }
    });
  };

  const getImageData = async (src) => {
    if (!src) return null;
    if (typeof src === "string") return await toDataURL(src);
    if (src && (src instanceof File || src.name)) return await fileToDataURL(src);
    return null;
  };

  const logoDataUrl = await toDataURL(logo);
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 10, 30, 30);
  }

  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - margin, 20, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Order ID: #${store.orderId || "N/A"}`, pageWidth - margin, 26, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 31, { align: "right" });

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text("Yokebud Crafts", margin, 45);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Pukinmäenaukio 4", margin, 50);
  doc.text("00720 Helsinki, Finland", margin, 54);
  doc.text("yokebud@gmail.com | +358 440 328 124", margin, 58);

  const cust = store.customer || {};
  let yPos = 65;
  
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, pageWidth - (margin * 2), 35, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO / SHIP TO:", margin + 5, yPos + 8);
  
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(`${cust.firstName || ''} ${cust.lastName || ''}`.trim() || ' ', margin + 5, yPos + 16);
  
  doc.setFont("helvetica", "normal");
  doc.text(`${cust.address || ''}` || ' ', margin + 5, yPos + 21);
  doc.text(`${cust.city || ''}${cust.state ? ', ' + cust.state : ''}${cust.zip ? ', ' + cust.zip : ''}` || ' ', margin + 5, yPos + 26);
  doc.text(`${cust.country || ''}` || ' ', margin + 5, yPos + 31);
  
  doc.text(cust.email || '', pageWidth - margin - 5, yPos + 16, { align: "right" });
  doc.text(cust.phone || '', pageWidth - margin - 5, yPos + 21, { align: "right" });

  yPos += 45;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  
  doc.text("ITEM", margin, yPos - 3);
  const itemImgSize = 28;
  const descX = margin + itemImgSize + 22;
  doc.text("DESCRIPTION", descX, yPos - 3);
  doc.text("QTY", pageWidth - 50, yPos - 3, { align: "center" });
  doc.text("TOTAL", pageWidth - margin, yPos - 3, { align: "right" });

  yPos += 5;

  const items = store.items || [];
  const itemImages = await Promise.all(items.map(item => {
    const imgUrl = item.product_photos?.[0] || item.image;
    return imgUrl ? toDataURL(imgUrl) : null;
  }));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemImg = itemImages[i];
    const itemPrice = (item.discounted_price || item.price || 0) * item.quantity;
    
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }

    if (itemImg) {
      try { doc.addImage(itemImg, "JPEG", margin, yPos, itemImgSize, itemImgSize); } catch (e) {}
    }

    const rowStart = yPos;
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    const descRightX = pageWidth - margin - 60;
    const descMaxWidth = Math.max(10, descRightX - descX);
    const nameLines = doc.splitTextToSize(item.product_name || "Product", descMaxWidth);
    doc.text(nameLines, descX, rowStart + 5);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    if (item.quantity === 1) {
      let variantText = "";
      if (item.selectedColor) variantText += `Color: ${getColorName(item.selectedColor)} `;
      if (item.selectedSize) variantText += `Size: ${item.selectedSize}`;
      if (variantText) {
        const afterNameY = rowStart + 5 + (Array.isArray(nameLines) ? nameLines.length * 4 : 4) + 2;
        doc.text(variantText, descX, afterNameY);
      }
    }

    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`${item.quantity}`, pageWidth - 50, rowStart + 8, { align: "center" });
    doc.text(`${itemPrice.toFixed(2)} EUR`, pageWidth - margin, rowStart + 8, { align: "right" });

    let contentBottom = rowStart + 5 + (Array.isArray(nameLines) ? nameLines.length * 4 : 4) + 8;

    if (item.quantity > 1 && Array.isArray(item.units) && item.units.length > 0) {
      for (let ui = 0; ui < item.units.length; ui++) {
        const u = item.units[ui];
        if (contentBottom > pageHeight - 30) { doc.addPage(); contentBottom = 20; }
        const imgData = shouldShowDesignOptions(item) ? await getImageData(u.designFile) : null;
        if (imgData) { try { doc.addImage(imgData, "JPEG", descX, contentBottom + 2, 20, 20); } catch (e) {} }
        const textX = (imgData ? descX + 30 : descX);
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const colorName = getColorName(u.color || item.selectedColor || "");
        const sizeText = u.size || item.selectedSize || "";
        doc.text(`Unit ${u.unit_index || ui + 1}: ${colorName ? `Color: ${colorName} ` : ""}${sizeText ? `Size: ${sizeText}` : ""}`.trim(), textX, contentBottom + 8);
        if (u.note) {
          doc.setTextColor(100, 100, 100);
          doc.text(String(u.note).slice(0, 80), textX, contentBottom + 14);
        }
        contentBottom += imgData ? 22 : 16;
      }
    }

    doc.setDrawColor(240, 240, 240);
    const rowBottom = Math.max(rowStart + (itemImg ? itemImgSize : 0), contentBottom);
    yPos = rowBottom + 8;
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
  }

  yPos += 5;
  const totals = store.totals || { subtotal: 0, shipping: 0, total: 0 };
  const rightColX = pageWidth - margin - 40;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Subtotal:", rightColX, yPos);
  doc.setTextColor(40, 40, 40);
  doc.text(`${Number(totals.subtotal).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });

  yPos += 6;
  doc.text("Shipping:", rightColX, yPos);
  doc.text(`${Number(totals.shipping).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });

  yPos += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL:", rightColX, yPos);
  doc.text(`${Number(totals.total).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });

  const footerY = pageHeight - 30;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Payment Method: " + (store.paymentMethod || "N/A").toUpperCase(), margin, footerY);
  doc.text("Thank you for shopping with Yokebud Crafts!", margin, footerY + 5);
  doc.text("For support, please contact us via email.", margin, footerY + 10);

  doc.save(`Invoice_${store.orderId || "Order"}.pdf`);
};

const Checkout = () => {
  const { cartItems, clearCart, updateQuantity: updateCartQty } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const { format } = useLocale();

  const [items, setItems] = useState([]);
  const [isBuyNow, setIsBuyNow] = useState(() => {
    if (location.state?.items) return true;
    try {
      const raw = sessionStorage.getItem('buy_now_items');
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length > 0;
    } catch { return false; }
  });
  const [itemCustomizations, setItemCustomizations] = useState({});
  const customRef = useRef(itemCustomizations);
  useEffect(() => { customRef.current = itemCustomizations; }, [itemCustomizations]);

  useEffect(() => {
    if (isBuyNow) {
      let ss = null;
      try {
        const raw = sessionStorage.getItem('buy_now_items');
        ss = raw ? JSON.parse(raw) : null;
      } catch {}
      setItems(location.state?.items || ss || []);
    } else {
      setItems(cartItems);
    }
  }, [cartItems, isBuyNow, location.state]);

  useEffect(() => {
    const socket = io(SOCKET_BASE, { transports: ["websocket"], withCredentials: true });
    const onUpdate = (data) => {
      if (!data || data.productId == null) return;
      setItems((prevItems) => {
        let changed = false;
        const nextItems = prevItems.map((it) => {
          const pid = it.id || it.product_id || it._id || it.sku;
          if (Number(pid) === Number(data.productId)) {
            changed = true;
            return {
              ...it,
              stock: data.totalStock != null ? Number(data.totalStock) : it.stock,
              variants: Array.isArray(data.variants) ? data.variants : it.variants
            };
          }
          return it;
        });
        return changed ? nextItems : prevItems;
      });
    };
    socket.on('stock_update', onUpdate);
    return () => { socket.off('stock_update', onUpdate); socket.disconnect(); };
  }, []);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [shippingMethod, setShippingMethod] = useState("delivery");
  const [confirmedItems, setConfirmedItems] = useState([]);
  const [confirmedTotals, setConfirmedTotals] = useState(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState(null);
  const [confirmedCustomer, setConfirmedCustomer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "",
    city: "", zip: "", country: "", customizationNotes: "",
  });

  useEffect(() => {
    const newCustoms = { ...itemCustomizations };
    let hasUpdate = false;
    items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        const key = `${item.id || "temp"}_${i}`;
        if (!newCustoms[key]) {
          const sel = Array.isArray(item.selections) ? item.selections[i] : null;
          newCustoms[key] = { color: (sel?.color || item.selectedColor || ""), size: (sel?.size || item.selectedSize || ""), designFile: null, note: "" };
          hasUpdate = true;
        }
      }
    });
    if (hasUpdate) setItemCustomizations(newCustoms);
  }, [items]);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) { setProfileLoading(false); return; }
    const fetchProfile = async () => {
      try {
        const res = await apiFetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data?.success && data?.user) {
          const u = data.user;
          setFormData((prev) => ({
            ...prev,
            firstName: u.first_name || prev.firstName, lastName: u.last_name || prev.lastName,
            email: u.email || prev.email, phone: u.phone || prev.phone,
            address: u.address || prev.address, city: u.city || prev.city,
            zip: u.zip_code || prev.zip, country: u.country || prev.country,
          }));
        }
      } catch (e) {} finally { setProfileLoading(false); }
    };
    fetchProfile();
  }, []);

  const handleCustomizationChange = (itemId, index, field, value) => {
    const key = `${itemId}_${index}`;
    setItemCustomizations((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleFileChange = (itemId, index, e) => {
    const file = e.target.files[0];
    if (file) handleCustomizationChange(itemId, index, "designFile", file);
  };

  const handleRemoveUnit = (itemIndex, unitIndex) => {
    const newItems = [...items];
    const item = newItems[itemIndex];
    if (item.quantity <= 1) { toast.error("Minimum 1 unit required."); return; }
    item.quantity -= 1;
    setItems(newItems);
    if (!isBuyNow && updateCartQty) updateCartQty(item.id, item.quantity);
  };

  const updateItemQuantity = (index, delta) => {
    const newItems = [...items];
    const item = newItems[index];
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    item.quantity = newQty;
    setItems(newItems);
    if (!isBuyNow && updateCartQty) updateCartQty(item.id, newQty);
  };

  const totals = (() => {
    const subtotal = items.reduce((sum, item) => sum + (item.discounted_price || item.price || 0) * item.quantity, 0);
    const country = String(formData.country || "").toLowerCase();
    const baseShipping = country.includes("finland") ? 7 : 20;
    const shipping = shippingMethod === "pickup" ? 0 : baseShipping;
    return { subtotal, shipping, total: subtotal + shipping, shippingMethod };
  })();

  const validateCustomization = () => {
    for (const item of items) {
      if (!shouldShowDesignOptions(item)) continue;

      const hasColors = Array.isArray(item.colors || item.product?.colors) && (item.colors || item.product?.colors)?.length > 0;
      const hasSizes = Array.isArray(item.sizes || item.product?.sizes) && (item.sizes || item.product?.sizes)?.length > 0;
      
      for (let i = 0; i < item.quantity; i++) {
        const custom = itemCustomizations[`${item.id}_${i}`];
        if (!custom) return `Please confirm selections for ${item.product_name}.`;
        
        // Color/Size validation if they exist for the product
        if (hasColors && !custom.color) return `Please select Color for ${item.product_name} (Unit ${i + 1}).`;
        if (hasSizes && !custom.size) return `Please select Size for ${item.product_name} (Unit ${i + 1}).`;
        
        // Instruction validation - MANDATORY for customizable items
        if (!custom.note || !String(custom.note).trim()) {
          return `Please provide customization instructions for ${item.product_name} (Unit ${i + 1}).`;
        }
        
        // Image validation - OPTIONAL (Removed from here as per user request)
      }
    }
    return null;
  };

  const getMissingShippingFields = () => {
    const common = ["firstName", "lastName", "email", "phone"];
    const addressFields = ["address", "city", "zip", "country"];
    const required = shippingMethod === "pickup" ? common : [...common, ...addressFields];
    return required.filter((f) => !String(formData[f] || "").trim());
  };

  const handleProceedToPayment = async (methodOverride) => {
    const currentPaymentMethod = typeof methodOverride === 'string' ? methodOverride : paymentMethod;
    if (step === 1) {
      const missing = getMissingShippingFields();
      if (missing.length) { toast.error(`Please fill: ${missing.join(", ")}`); return; }
      const customError = validateCustomization();
      if (customError) { toast.error(customError); return; }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    try {
      setLoading(true);
      const finalItems = items.map((item) => {
        const units = [];
        for (let i = 0; i < item.quantity; i++) {
          units.push({ ...itemCustomizations[`${item.id}_${i}`], unit_index: i + 1 });
        }
        return { ...item, type: isApparel(item) ? "apparel" : "custom_standard", units };
      });
      const uploadResult = await uploadDesignFilesForItems(finalItems);
      const pending = { items: uploadResult.items, totals, customer: formData, paymentMethod: currentPaymentMethod };
      sessionStorage.setItem('checkout_pending', JSON.stringify(pending));
      
      const response = await apiFetch('/api/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, currency: 'eur', customer: formData, shipping: totals.shipping, successUrl: `${window.location.origin}/Checkout?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${window.location.origin}/cart` })
      });
      const data = await response.json();
      if (data?.success && data.url) window.location.href = data.url;
      else toast.error(data.message || 'Failed to initialize payment');
    } catch (e) { toast.error('Payment failed'); } finally { setLoading(false); }
  };

  const handlePlaceOrder = async (paymentId = null, itemsOverride = null, totalsOverride = null, customerOverride = null) => {
    try {
      setLoading(true);
      const sourceItems = Array.isArray(itemsOverride) ? itemsOverride : items;
      const finalItems = sourceItems.map((item) => {
        let units = (Array.isArray(item.units) && item.units.length > 0) ? item.units : Array.from({ length: item.quantity }).map((_, i) => ({ ...itemCustomizations[`${item.id}_${i}`], unit_index: i + 1 }));
        return { ...item, type: isApparel(item) ? "apparel" : "custom_standard", units };
      });
      const uploadResult = await uploadDesignFilesForItems(finalItems);
      const response = await apiFetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerInfo: customerOverride || formData, paymentMethod, paymentId, items: uploadResult.items, customizationNotes: formData.customizationNotes, totals: totalsOverride || totals })
      });
      const data = await response.json();
      if (!data?.success) throw new Error(data?.message || 'Order failed');
      setConfirmedOrderId(data.orderId); setConfirmedItems(uploadResult.items); setConfirmedTotals(totalsOverride || totals); setConfirmedCustomer(customerOverride || formData);
      setOrderPlaced(true); setStep(3);
      if (!isBuyNow) clearCart();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      const pendingRaw = sessionStorage.getItem('checkout_pending');
      const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
      if (pending) handlePlaceOrder(sessionId, pending.items, pending.totals, pending.customer);
      else handlePlaceOrder(sessionId);
    }
  }, [location.search]);

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#e0e0e0", paddingBottom: 80 }}>
      <ToastContainer theme="dark" />
      <div style={{ padding: "20px 5%", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a0a0a" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#FFA500", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><FiArrowLeft /> Back</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888" }}><FiLock color="#4CAF50" /> Secure SSL Encryption</div>
      </div>

      <div style={{ maxWidth: 1200, margin: "40px auto",flexWrap:"wrap", padding: "0 20px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 30 : 50 }}>
        <div style={{ flex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 30, borderBottom: "1px solid #222", paddingBottom: 15, flexWrap: "nowrap", gap: 16 }}>
            <StepIndicator active={step === 1} number={1} title="Details" onClick={() => setStep(1)} />
            <div style={{ height: 1, width: 20, background: "#333" }} />
            <StepIndicator active={step === 2} number={2} title="Payment" onClick={() => step === 2 && setStep(2)} />
            <div style={{ height: 1, width: 20, background: "#333" }} />
            <StepIndicator active={step === 3} number={3} title="Confirmation" />
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SectionHeader title="Shipping Information" />
              {/* Responsive Grid for Input Fields */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", 
                gap: 15, 
                marginBottom: 40 
              }}>
                <Input placeholder="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                <Input placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                <Input placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                <Input fullWidth placeholder="Street Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                <Input placeholder="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                <Input placeholder="ZIP / Postal Code" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} />
                <Input placeholder="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
              </div>

              <SectionHeader title="Shipping Option" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 15, marginBottom: 30 }}>
                <PaymentOption active={shippingMethod === "pickup"} onClick={() => setShippingMethod("pickup")} icon={<FiMapPin />} label="Store Pickup (Free)" />
                <PaymentOption active={shippingMethod === "delivery"} onClick={() => setShippingMethod("delivery")} icon={<FiTruck />} label="Home Delivery" />
              </div>

              <SectionHeader title="Customization" />
              <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
                {items.filter(item => shouldShowDesignOptions(item)).map((item, itemIndex) => (
                  <div key={itemIndex} style={{ border: "1px solid #333", borderRadius: 12, background: "#111", overflow: "hidden" }}>
                    <div style={{ background: "#1a1a1a", padding: 15, display: "flex", gap: 15, alignItems: "center" }}>
                      <img src={item.product_photos?.[0] || item.image} alt="product" style={{ width: 50, borderRadius: 6 }} />
                      <div style={{ flex: 1 }}><div style={{ fontWeight: "bold" }}>{item.product_name}</div></div>
                      <div style={{ fontWeight: "bold" }}>x{item.quantity}</div>
                    </div>
                    <div style={{ padding: 15 }}>
                      {Array.from({ length: item.quantity }).map((_, ui) => (
                        <div key={ui} style={{ background: "#161616", border: "1px solid #222", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>UNIT {ui + 1}</div>
                          {/* Unit Configuration Inputs */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {shouldShowDesignOptions(item) && (
                              <div>
                                <label style={labelStyle}>Upload Design (Optional)</label>
                                <div style={{ border: "1px dashed #444", padding: 10, textAlign: "center", borderRadius: 6 }}>
                                  <input type="file" hidden id={`f-${itemIndex}-${ui}`} onChange={(e) => handleFileChange(item.id, ui, e)} />
                                  <label htmlFor={`f-${itemIndex}-${ui}`} style={{ cursor: "pointer", fontSize: 12 }}><FiUpload /> {itemCustomizations[`${item.id}_${ui}`]?.designFile?.name || "Upload Image"}</label>
                                </div>
                              </div>
                            )}
                            <textarea placeholder="Special instructions for this unit * (Mandatory)" style={inputStyle} onChange={(e) => handleCustomizationChange(item.id, ui, "note", e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {items.filter(item => shouldShowDesignOptions(item)).length === 0 && (
                  <div style={{ color: "#888", textAlign: "center", padding: "20px", border: "1px dashed #333", borderRadius: "12px" }}>
                    No customizable items in your cart.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
                <button onClick={() => handleProceedToPayment()} style={primaryBtnStyle}>Continue to Payment</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SectionHeader title="Payment Method" />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                <div onClick={() => handleProceedToPayment("stripe")} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, padding: 25, textAlign: "center", cursor: "pointer" }}>
                  <FiCreditCard size={30} color="#FFA500" style={{ marginBottom: 10 }} />
                  <div>Credit / Debit Card</div>
                </div>
                <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, padding: 25 }}>
                   <PayPalScriptProvider options={{ "client-id": "test", currency: "EUR" }}>
                      <PayPalButtons style={{ layout: "horizontal" }} onApprove={(data, actions) => actions.order.capture().then(d => handlePlaceOrder(d.id))} />
                   </PayPalScriptProvider>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 40, background: "#1a1a1a", borderRadius: 16 }}>
              <FiCheckCircle size={60} color="#4CAF50" style={{ marginBottom: 20 }} />
              <h2>Order Placed!</h2>
              <p>ID: #{confirmedOrderId}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                <button onClick={downloadInvoicePDF} style={primaryBtnStyle}>Download Invoice</button>
                <button onClick={() => navigate("/")} style={{ ...primaryBtnStyle, background: "#333" }}>Back to Home</button>
              </div>
            </motion.div>
          )}
        </div>

        {step !== 3 && (
          <div style={{ flex: 1 }}>
            <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 20, position: "sticky", top: 20 }}>
              <h3 style={{ borderBottom: "1px solid #333", paddingBottom: 10 }}>Summary</h3>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                  <img src={item.product_photos?.[0] || item.image} style={{ width: 40, height: 40, borderRadius: 4 }} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div>{item.product_name}</div>
                    <div style={{ color: "#888" }}>{item.quantity} x {format(item.discounted_price || item.price, "EUR")}</div>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #333", paddingTop: 10, marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{format(totals.subtotal, "EUR")}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "5px 0" }}><span>Shipping</span><span>{format(totals.shipping, "EUR")}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 16, marginTop: 10 }}><span>Total</span><span style={{ color: "#FFA500" }}>{format(totals.total, "EUR")}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SectionHeader = ({ title }) => <h3 style={{ fontSize: 18, color: "#fff", marginBottom: 20 }}>{title}</h3>;
const StepIndicator = ({ number, title, active, onClick }) => (
  <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: active ? 1 : 0.4 }}>
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? "#FFA500" : "#333", color: active ? "#000" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>{number}</div>
    <span style={{ fontSize: 13 }}>{title}</span>
  </div>
);
const PaymentOption = ({ active, onClick, icon, label }) => (
  <div onClick={onClick} style={{ padding: 15, borderRadius: 8, border: active ? "1px solid #FFA500" : "1px solid #333", background: active ? "rgba(255,165,0,0.1)" : "#1a1a1a", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
    {icon} <span style={{ fontSize: 14 }}>{label}</span>
  </div>
);

const inputStyle = { 
  background: "#000", 
  border: "1px solid #333", 
  color: "#fff", 
  padding: "12px", 
  borderRadius: 6, 
  outline: "none", 
  fontSize: "14px", 
  width: "100%", 
  boxSizing: "border-box" 
};
const labelStyle = { display: "block", marginBottom: 6, fontSize: "12px", color: "#888" };
const primaryBtnStyle = { padding: "12px 24px", background: GOLD_GRADIENT_CSS, color: "#000", fontWeight: "bold", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 };

const Input = ({ fullWidth, ...props }) => (
  <input 
    style={{ 
      ...inputStyle, 
      // মোবাইলে সবসময় ফুল উইডথ (span 2), ডেস্কটপে props অনুযায়ী।
      gridColumn: isMobile ? "span 2" : (fullWidth ? "span 2" : "span 1") 
    }} 
    {...props} 
  />
);

export default Checkout;