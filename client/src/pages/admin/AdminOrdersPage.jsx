import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiEye,
  FiRefreshCw,
  FiX,
  FiUser,
  FiMapPin,
  FiTruck,
  FiLayers,
  FiDownload,
  FiImage,
  FiBox,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiExternalLink,
  FiActivity,
  FiMail
} from "react-icons/fi";
import { jsPDF } from "jspdf";
import logo from "../../assades/LOGO.png"; 
import { apiFetch } from '../../utils/api';

// --- Modern Loading Spinner ---
const LoadingSpinner = () => (
  <div style={{ 
    height: '100vh', 
    width: '100%', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'column',
    gap: '15px',
    background: '#121212'
  }}>
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(245, 158, 11, 0.2)',
        borderTop: '3px solid #F59E0B',
        borderRadius: '50%'
      }}
    />
    <motion.span 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }}
      style={{ color: '#A1A1AA', fontSize: '0.9rem', letterSpacing: '0.05em' }}
    >
      Loading Orders...
    </motion.span>
  </div>
);

const AdminOrdersPage = () => {
  // --- Global Styles for Premium Scrollbar ---
  const globalStyles = `
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #18181B; }
    ::-webkit-scrollbar-thumb { background: #3F3F46; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #52525B; }
    * { scrollbar-width: thin; scrollbar-color: #3F3F46 #18181B; }
  `;

  // --- Helper Functions ---
  const formatDDMMYYYY = (input) => {
    const d = new Date(input);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day} / ${month} / ${year}`;
  };

  const getCustomerDisplayName = (order) => {
    const direct = (order.customer_name || "").trim();
    if (direct) return direct;
    const first = (order.customer_info?.firstName || "").trim();
    const last = (order.customer_info?.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const email = (order.customer_info?.email || order.customer_email || "").trim();
    if (email) return email.split("@")[0];
    return "Guest User";
  };

  // --- State Management ---
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch('/api/orders', { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
        setFilteredOrders(data.orders || []);
      } else {
        throw new Error(data.message || "Failed to fetch orders");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    let result = [...orders];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (order) =>
          order.order_id.toLowerCase().includes(term) ||
          getCustomerDisplayName(order).toLowerCase().includes(term) ||
          (order.customer_email || "").toLowerCase().includes(term)
      );
    }
    if (filterStatus) result = result.filter((order) => order.status === filterStatus);
    if (dateRange.start) result = result.filter((order) => new Date(order.created_at) >= new Date(dateRange.start));
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      result = result.filter((order) => new Date(order.created_at) <= endDate);
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = sortConfig.key === "total" ? a.totals?.total || 0 : a[sortConfig.key];
        let bVal = sortConfig.key === "total" ? b.totals?.total || 0 : b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFilteredOrders(result);
    try {
      const viewedMap = JSON.parse(localStorage.getItem("viewed_orders") || "{}");
      const pendingUnviewed = result.filter((o) => {
        const isPending = (o.status || "pending").toLowerCase() === "pending";
        return isPending && !viewedMap[o.order_id];
      }).length;
      localStorage.setItem("new_order_count", String(pendingUnviewed));
    } catch (_) {}
  }, [orders, searchTerm, filterStatus, sortConfig, dateRange]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const viewOrderDetails = async (orderId) => {
    try {
      const viewedKey = "viewed_orders";
      const viewedMap = JSON.parse(localStorage.getItem(viewedKey) || "{}");
      viewedMap[orderId] = true;
      localStorage.setItem(viewedKey, JSON.stringify(viewedMap));
      const order = orders.find((o) => o.order_id === orderId);
      if (order) { setSelectedOrder(order); setShowOrderModal(true); }
    } catch (err) { console.error(err); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`https://api.yokebud.fi/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus, delivered_at: newStatus === "Delivered" ? new Date().toISOString() : undefined }),
      });
      const data = await response.json();
      if (data.success) {
        const updatedOrders = orders.map((o) => o.order_id === orderId ? { ...o, status: newStatus } : o);
        setOrders(updatedOrders);
        if (selectedOrder?.order_id === orderId) setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) { console.error("Failed to update status", err); }
  };

  const COLOR_MAP = {
    Original: "#BF953F",
    Black: "#000000",
    White: "#FFFFFF",
    Gray: "#808080",
    "Light Gray": "#D3D3D3",
    "Dark Gray": "#A9A9A9",
    Charcoal: "36454F",
    Gold: "#FFD700",
    Red: "#e74c3c",
    Orange: "#FFA500",
    Coral: "#FF7F50",
    Yellow: "#FFD400",
    Mustard: "#FFDB58",
    Blue: "#3498db",
    "Royal Blue": "#4169E1",
    "Sky Blue": "#87CEEB",
    Navy: "#000080",
    Teal: "#008080",
    Cyan: "#00FFFF",
    Green: "#008000",
    "Forest Green": "#27ae60",
    Lime: "#32CD32",
    Olive: "#808000",
    Pink: "#FFC0CB",
    "Hot Pink": "#FF69B4",
    Magenta: "#FF00FF",
    Purple: "#8e44ad",
    Lavender: "#E6E6FA",
    Brown: "#8B4513",
    Tan: "#D2B48C",
    Beige: "#F5F5DC",
    Cream: "#FFFDD0",
    Midnight: "#2c3e50",
    Maroon: "#800000",
    Burgundy: "#800020"
  };

  const getColorName = (val) => {
    if (val == null) return "";
    const s = String(val).trim();
    if (s.startsWith("#")) {
      const lower = s.toLowerCase();
      const match = Object.entries(COLOR_MAP).find(([, hex]) => String(hex).trim().toLowerCase() === lower);
      return match ? match[0] : lower;
    }
    return s;
  };

  const createDeliveryPDFBlob = async (order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logoData = await toDataURL(logo);
    if (logoData) doc.addImage(logoData, "PNG", 14, 10, 35, 35);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("DELIVERY NOTE", pageWidth - 14, 22, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Order #: ${order.order_id}`, pageWidth - 14, 30, { align: "right" });
    doc.text(`Date: ${formatDDMMYYYY(new Date())}`, pageWidth - 14, 35, { align: "right" });
    doc.setFontSize(10);
    doc.text("Yokebud Crafts", 14, 50);
    doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Pukinmäenaukio 4", 14, 55);
    doc.text("00720 Helsinki, Finland", 14, 60);
    doc.text("yokebud@gmail.com | +358 440 328 124", 14, 65);
    doc.setTextColor(0, 0, 0);
    let y = 75;
    doc.setDrawColor(220); doc.line(14, y - 5, pageWidth - 14, y - 5);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO:", 14, y);
    doc.text("SHIP TO:", 110, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const custName = getCustomerDisplayName(order);
    const shipAddr = order.shipping_address?.address || order.customer_info?.address || "";
    const shipCity = `${order.shipping_address?.city || ""} ${order.shipping_address?.zip || ""}`;
    doc.text(custName, 14, y); doc.text(custName, 110, y); y += 5;
    doc.text(order.customer_email || "", 14, y); doc.text(shipAddr, 110, y); y += 5;
    doc.text(order.customer_phone || "", 14, y); doc.text(shipCity, 110, y); y += 5;
    doc.text(order.shipping_address?.country || "", 110, y);
    y += 15;
    doc.setFillColor(245, 158, 11);
    doc.rect(14, y, pageWidth - 28, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    doc.text("Item", 18, y + 5.5);
    doc.text("Qty", 130, y + 5.5, { align: "center" });
    doc.text("Price", 160, y + 5.5, { align: "right" });
    doc.text("Total", 190, y + 5.5, { align: "right" });
    y += 8;
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    const items = order.items && order.items.length ? order.items : [{ product_name: "Custom Product", quantity: 1, price: order.totals?.total || 0 }];
    items.forEach((item) => {
      const price = parseFloat(item.price || item.discounted_price || order.totals?.total / (item.quantity || 1) || 0);
      const total = (item.quantity || 1) * price;
      const rowStart = y;
      const descMaxWidth = Math.max(10, 120 - 18);
      const wrapped = doc.splitTextToSize(item.product_name || "Item", descMaxWidth);
      doc.text(wrapped, 18, rowStart + 5);
      doc.text(String(item.quantity || 1), 130, rowStart + 6, { align: "center" });
      doc.text(`${price.toFixed(2)} EUR`, 160, rowStart + 6, { align: "right" });
      doc.text(`${total.toFixed(2)} EUR`, 190, rowStart + 6, { align: "right" });
      const rowHeight = Math.max(10, (Array.isArray(wrapped) ? wrapped.length * 4 : 4) + 6);
      const nextY = rowStart + rowHeight;
      doc.setDrawColor(240); doc.line(14, nextY, pageWidth - 14, nextY);
      y = nextY;
    });
    y += 5;
    const finalTotal = order.totals?.total || 0;
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 160, y + 6, { align: "right" });
    doc.setFontSize(12); doc.setTextColor(245, 158, 11);
    doc.text(`${parseFloat(finalTotal).toFixed(2)} EUR`, 190, y + 6, { align: "right" });
    const signY = pageHeight - 50;
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Received By (Signature):", 14, signY);
    doc.line(60, signY, 120, signY);
    doc.text("Date:", 140, signY);
    doc.line(155, signY, 190, signY);
    const footerY = pageHeight - 20;
    doc.setFillColor(30, 30, 30);
    doc.rect(0, footerY, pageWidth, 20, "F");
    doc.setTextColor(200); doc.setFontSize(8);
    doc.text("Thank you for choosing Yokebud Crafts. All goods remain property of Yokebud until paid in full.", pageWidth / 2, footerY + 8, { align: "center" });
    doc.text("www.yokebud.com | +358 440 328 124 | Pukinmäenaukio 4, 00720 Helsinki", pageWidth / 2, footerY + 14, { align: "center" });
    return doc.output("blob");
  };

  const createInvoicePDFBlob = async (order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const toDataURLLocal = async (url) => {
      try {
        const res = await fetch(url, { mode: "cors" });
        const blob = await res.blob();
        return new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
      } catch { return null; }
    };
    const logoDataUrl = await toDataURLLocal(logo);
    if (logoDataUrl) { doc.addImage(logoDataUrl, "PNG", margin, 10, 30, 30); }
    doc.setFontSize(22); doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth - margin, 20, { align: "right" });
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
    doc.text(`Order ID: #${order.order_id || "N/A"}`, pageWidth - margin, 26, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 31, { align: "right" });
    doc.setTextColor(40, 40, 40); doc.setFontSize(10);
    doc.text("Yokebud Crafts", margin, 45);
    doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Pukinmäenaukio 4", margin, 50);
    doc.text("00720 Helsinki, Finland", margin, 54);
    doc.text("yokebud@gmail.com | +358 440 328 124", margin, 58);
    const cust = order.customer_info || {};
    let yPos = 65;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - margin * 2, 35, "F");
    doc.setFontSize(10); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "bold");
    doc.text("BILL TO / SHIP TO:", margin + 5, yPos + 8);
    doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "bold");
    doc.text(`${(cust.firstName || "")} ${(cust.lastName || "")}`.trim() || " ", margin + 5, yPos + 16);
    doc.setFont("helvetica", "normal");
    doc.text(`${cust.address || ""}` || " ", margin + 5, yPos + 21);
    doc.text(`${cust.city || ""}${cust.state ? ", " + cust.state : ""}${cust.zip ? ", " + cust.zip : ""}` || " ", margin + 5, yPos + 26);
    doc.text(`${cust.country || ""}` || " ", margin + 5, yPos + 31);
    doc.text(order.customer_email || "", pageWidth - margin - 5, yPos + 16, { align: "right" });
    doc.text(order.customer_phone || "", pageWidth - margin - 5, yPos + 21, { align: "right" });
    yPos += 45;
    doc.setDrawColor(220, 220, 220); doc.line(margin, yPos, pageWidth - margin, yPos);
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 100, 100);
    doc.text("ITEM", margin, yPos - 3);
    const itemImgSize = 28;
    const descX = margin + itemImgSize + 22;
    doc.text("DESCRIPTION", descX, yPos - 3);
    doc.text("QTY", pageWidth - 50, yPos - 3, { align: "center" });
    doc.text("TOTAL", pageWidth - margin, yPos - 3, { align: "right" });
    yPos += 5;
    const itemsInv = order.items || [];
    const itemImages = await Promise.all(itemsInv.map(it => { const imgUrl = it.product_photos?.[0] || it.image; return imgUrl ? toDataURLLocal(imgUrl) : null; }));
    for (let i = 0; i < itemsInv.length; i++) {
      const item = itemsInv[i];
      const itemImg = itemImages[i];
      const itemPrice = (item.discounted_price || item.price || 0) * (item.quantity || 1);
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
      if (itemImg) { try { doc.addImage(itemImg, "JPEG", margin, yPos, itemImgSize, itemImgSize); } catch (e) {} }
      const rowStart = yPos;
      doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "bold");
      const descRightX = pageWidth - margin - 60;
      const descMaxWidth = Math.max(10, descRightX - descX);
      const nameLines = doc.splitTextToSize(item.product_name || "Product", descMaxWidth);
      doc.text(nameLines, descX, rowStart + 5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      let variantText = "";
      if ((item.quantity || 1) === 1) {
        if (item.selectedColor) variantText += `Color: ${getColorName(item.selectedColor)} `;
        if (item.selectedSize) variantText += `Size: ${item.selectedSize}`;
        if (variantText) {
          const afterNameY = rowStart + 5 + (Array.isArray(nameLines) ? nameLines.length * 4 : 4) + 2;
          doc.text(variantText, descX, afterNameY);
        }
      }
      doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      doc.text(`${item.quantity || 1}`, pageWidth - 50, rowStart + 8, { align: "center" });
      doc.text(`${Number(itemPrice).toFixed(2)} EUR`, pageWidth - margin, rowStart + 8, { align: "right" });
      let contentBottom = rowStart + 5 + (Array.isArray(nameLines) ? nameLines.length * 4 : 4) + 8;
      if ((item.quantity || 1) > 1 && Array.isArray(item.units) && item.units.length > 0) {
        for (let ui = 0; ui < item.units.length; ui++) {
          const u = item.units[ui];
          if (contentBottom > pageHeight - 30) { doc.addPage(); contentBottom = 20; }
          let imgData = null;
          try { if (typeof u.designFile === "string") imgData = await toDataURLLocal(u.designFile); } catch {}
          if (imgData) { try { doc.addImage(imgData, "JPEG", descX, contentBottom + 2, 20, 20); } catch (e) {} }
          const textX = imgData ? descX + 30 : descX;
          doc.setFontSize(8); doc.setTextColor(60, 60, 60);
          const colorName = getColorName(u.color || item.selectedColor || "");
          const sizeText = u.size || item.selectedSize || "";
          doc.text(`Unit ${u.unit_index || ui + 1}: ${colorName ? `Color: ${colorName} ` : ""}${sizeText ? `Size: ${sizeText}` : ""}`.trim(), textX, contentBottom + 8);
          if (u.note) { doc.setTextColor(100, 100, 100); doc.text(String(u.note).slice(0, 80), textX, contentBottom + 14); }
          contentBottom += imgData ? 22 : 16;
        }
      }
      doc.setDrawColor(240, 240, 240);
      const rowBottom = Math.max(rowStart + (itemImg ? itemImgSize : 0), contentBottom);
      yPos = rowBottom + 8;
      doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    }
    yPos += 5;
    const totals = order.totals || { subtotal: 0, shipping: 0, total: 0 };
    const rightColX = pageWidth - margin - 40;
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text("Subtotal:", rightColX, yPos);
    doc.setTextColor(40, 40, 40); doc.text(`${Number(totals.subtotal || 0).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });
    yPos += 6;
    doc.setTextColor(100, 100, 100); doc.text("Shipping:", rightColX, yPos);
    doc.setTextColor(40, 40, 40); doc.text(`${Number(totals.shipping || 0).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });
    yPos += 10;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0); doc.text("TOTAL:", rightColX, yPos);
    doc.setTextColor(0, 0, 0); doc.text(`${Number(totals.total || 0).toFixed(2)} EUR`, pageWidth - margin, yPos, { align: "right" });
    const footerY = pageHeight - 30;
    doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
    doc.text("Payment Method: " + String(order.payment_method || "N/A").toUpperCase(), margin, footerY);
    doc.text("Thank you for shopping with Yokebud Crafts!", margin, footerY + 5);
    doc.text("For support, please contact us via email.", margin, footerY + 10);
    return doc.output("blob");
  };

  const downloadOrderDetails = async (order) => {
    try {
      const delivBlob = await createDeliveryPDFBlob(order);
      const invBlob = await createInvoicePDFBlob(order);
      const fileNameDeliv = `Delivery_Note_${order.order_id}.pdf`;
      const fileNameInv = `Invoice_${order.order_id}.pdf`;
      const dirPicker = window.showDirectoryPicker ? await window.showDirectoryPicker() : null;
      if (dirPicker) {
        const folder = dirPicker;
        const writeFile = async (name, blob) => { const h = await folder.getFileHandle(name, { create: true }); const w = await h.createWritable(); await w.write(blob); await w.close(); };
        await writeFile(fileNameDeliv, delivBlob);
        await writeFile(fileNameInv, invBlob);
        const dfDir = await folder.getDirectoryHandle('design_files', { create: true });
        const items = Array.isArray(order.items) ? order.items : [];
        let counter = 1;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const units = Array.isArray(it.units) ? it.units : [];
          for (let ui = 0; ui < units.length; ui++) {
            const u = units[ui];
            if (typeof u.designFile === 'string' && u.designFile) {
              try {
                const res = await fetch(u.designFile);
                const blob = await res.blob();
                const ext = (u.designFile.split('.').pop() || 'jpg').split('?')[0];
                const name = `item_${i + 1}_unit_${ui + 1}_${counter}.${ext}`;
                const h = await dfDir.getFileHandle(name, { create: true });
                const w = await h.createWritable();
                await w.write(blob); await w.close();
                counter += 1;
              } catch (_) {}
            }
          }
        }
      } else {
        const trigger = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
        trigger(delivBlob, fileNameDeliv);
        trigger(invBlob, fileNameInv);
        const items = Array.isArray(order.items) ? order.items : [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const units = Array.isArray(it.units) ? it.units : [];
          for (let ui = 0; ui < units.length; ui++) {
            const u = units[ui];
            if (typeof u.designFile === 'string' && u.designFile) {
              try { const r = await fetch(u.designFile); const b = await r.blob(); const ext = (u.designFile.split('.').pop() || 'jpg').split('?')[0]; const name = `design_item_${i + 1}_unit_${ui + 1}.${ext}`; trigger(b, name); } catch (_) {}
            }
          }
        }
      }
    } catch (e) { console.error(e); }
  };

  const getProductUrl = (item) => {
    const pid = (item && (item.id ?? item.product_id ?? item._id ?? item.sku)) || null;
    return pid ? `/products/${pid}` : '#';
  };

  // --- PDF GENERATION LOGIC ---
  const toDataURL = async (url) => {
    if (!url) return null;
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


  const generateDeliveryPDF = async (order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logoData = await toDataURL(logo);

    if (logoData) doc.addImage(logoData, "PNG", 14, 10, 35, 35);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("DELIVERY NOTE", pageWidth - 14, 22, { align: "right" });
    
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Order #: ${order.order_id}`, pageWidth - 14, 30, { align: "right" });
    doc.text(`Date: ${formatDDMMYYYY(new Date())}`, pageWidth - 14, 35, { align: "right" });

    doc.setFontSize(10);
    doc.text("Yokebud Crafts", 14, 50);
    doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Pukinmäenaukio 4", 14, 55);
    doc.text("00720 Helsinki, Finland", 14, 60);
    doc.text("yokebud@gmail.com | +358 440 328 124", 14, 65);
    doc.setTextColor(0, 0, 0);

    let y = 75;
    doc.setDrawColor(220); doc.line(14, y-5, pageWidth - 14, y-5);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO:", 14, y);
    doc.text("SHIP TO:", 110, y);
    y += 6;
    doc.setFont("helvetica", "normal");

    const custName = getCustomerDisplayName(order);
    const shipAddr = order.shipping_address?.address || order.customer_info?.address || "";
    const shipCity = `${order.shipping_address?.city || ""} ${order.shipping_address?.zip || ""}`;
    
    doc.text(custName, 14, y); doc.text(custName, 110, y); y += 5;
    doc.text(order.customer_email || "", 14, y); doc.text(shipAddr, 110, y); y += 5;
    doc.text(order.customer_phone || "", 14, y); doc.text(shipCity, 110, y); y += 5;
    doc.text(order.shipping_address?.country || "", 110, y);

    y += 15;
    doc.setFillColor(245, 158, 11);
    doc.rect(14, y, pageWidth - 28, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    doc.text("Item", 18, y + 5.5);
    doc.text("Qty", 130, y + 5.5, { align: "center" });
    doc.text("Price", 160, y + 5.5, { align: "right" });
    doc.text("Total", 190, y + 5.5, { align: "right" });
    y += 8;
    
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    const items = order.items && order.items.length ? order.items : [{ product_name: "Custom Product", quantity: 1, price: order.totals?.total || 0 }];

    items.forEach((item) => {
      const price = parseFloat(item.price || item.discounted_price || order.totals?.total / (item.quantity||1) || 0);
      const total = (item.quantity||1) * price;
      const rowStart = y;
      const descMaxWidth = Math.max(10, 120 - 18);
      const wrapped = doc.splitTextToSize(item.product_name || "Item", descMaxWidth);
      doc.text(wrapped, 18, rowStart + 5);
      doc.text(String(item.quantity||1), 130, rowStart + 6, { align: "center" });
      doc.text(`${price.toFixed(2)} EUR`, 160, rowStart + 6, { align: "right" });
      doc.text(`${total.toFixed(2)} EUR`, 190, rowStart + 6, { align: "right" });
      const rowHeight = Math.max(10, (Array.isArray(wrapped) ? wrapped.length * 4 : 4) + 6);
      const nextY = rowStart + rowHeight;
      doc.setDrawColor(240); doc.line(14, nextY, pageWidth - 14, nextY);
      y = nextY;
    });

    y += 5;
    const finalTotal = order.totals?.total || 0;
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 160, y + 6, { align: "right" });
    doc.setFontSize(12); doc.setTextColor(245, 158, 11);
    doc.text(`${parseFloat(finalTotal).toFixed(2)} EUR`, 190, y + 6, { align: "right" });

    const signY = pageHeight - 50;
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Received By (Signature):", 14, signY);
    doc.line(60, signY, 120, signY);
    doc.text("Date:", 140, signY);
    doc.line(155, signY, 190, signY);

    const footerY = pageHeight - 20;
    doc.setFillColor(30, 30, 30);
    doc.rect(0, footerY, pageWidth, 20, "F");
    doc.setTextColor(200); doc.setFontSize(8);
    doc.text("Thank you for choosing Yokebud Crafts. All goods remain property of Yokebud until paid in full.", pageWidth/2, footerY + 8, {align: "center"});
    doc.text("www.yokebud.com | +358 440 328 124 | Pukinmäenaukio 4, 00720 Helsinki", pageWidth/2, footerY + 14, {align: "center"});

    doc.save(`Delivery_Note_${order.order_id}.pdf`);
  };

  // --- THEME & STYLES ---
  const theme = {
    bg: "#121212", cardBg: "#1E1E1E", modalBg: "#18181B", border: "#333333",
    textMain: "#E4E4E7", textMuted: "#A1A1AA", accent: "#F59E0B",
    success: "#10B981", danger: "#EF4444", info: "#3B82F6",
  };

  const styles = {
    container: { 
      backgroundColor: theme.bg, 
      height: "100vh",           // FIXED HEIGHT
      color: theme.textMain, 
      fontFamily: "'Inter', sans-serif", 
      overflowX: "hidden",
      overflowY: "auto"          // ENABLE SCROLL INSIDE CONTAINER
    },
    main: { width: isMobile ? "100%" : "100%", padding: isMobile ? "1rem" : "2rem", transition: "margin 0.3s ease" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" },
    title: { fontSize: isMobile ? "1.5rem" : "1.8rem", fontWeight: "700", color: theme.accent, letterSpacing: "-0.5px", margin: 0 },
    
    // Status Badges
    statusBadge: (status) => {
      const map = {
        Pending: { bg: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "rgba(245, 158, 11, 0.3)" },
        Processing: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
        Shipped: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
        Delivered: { bg: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "rgba(16, 185, 129, 0.3)" },
        Cancelled: { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.3)" },
      };
      const s = map[status] || map.Pending;
      return { backgroundColor: s.bg, color: s.color, padding: "4px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", border: `1px solid ${s.border}`, display: "inline-flex", alignItems: "center", gap: "6px", textTransform: "uppercase" };
    },

    // Modal Layout
    modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: isMobile ? "0" : "1rem" },
    modalContent: { backgroundColor: theme.modalBg, width: "90%", height: isMobile ? "100vh" : "90vh", borderRadius: isMobile ? "0" : "16px", border: isMobile ? "none" : `1px solid ${theme.border}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)" },
    modalHeader: { padding: "1rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#202022", flexWrap: "wrap", gap: "1rem" },
    modalBody: { padding: isMobile ? "1rem" : "2rem", overflowY: "auto", flex: 1 },
    
    // Grids
    gridThree: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" },
    infoCard: { backgroundColor: "#27272A", padding: "1.25rem", borderRadius: "12px", border: `1px solid ${theme.border}`, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
    sectionTitle: { color: theme.accent, fontSize: "1.1rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${theme.border}` },
    
    // Typography
    label: { color: theme.textMuted, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block" },
    value: { color: theme.textMain, fontSize: "0.95rem", fontWeight: "500", lineHeight: "1.4" },

    // Buttons
    btn: (variant = "primary") => {
      const base = { padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", transition: "all 0.2s ease", border: "none", outline: "none" };
      if (variant === "primary") return { ...base, backgroundColor: theme.accent, color: "#000" };
      if (variant === "secondary") return { ...base, backgroundColor: "#3F3F46", color: "#fff", border: `1px solid ${theme.border}` };
      if (variant === "icon") return { ...base, backgroundColor: "transparent", padding: "8px", fontSize: "1.2rem", color: "#fff" };
      return base;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={styles.container}>
      <style>{globalStyles}</style>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Order Management</h1>
            <p style={{ color: theme.textMuted, marginTop: "4px", fontSize: "0.9rem" }}>Track and manage all manufacturing orders</p>
          </div>
          <button onClick={fetchOrders} style={styles.btn("secondary")}><FiRefreshCw /> Sync Data</button>
        </header>

        {/* Filters */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ position: "relative" }}>
            <FiSearch style={{ position: "absolute", left: 14, top: 12, color: "#666" }} />
            <input type="text" placeholder="Search by Order ID, Name or Email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px 10px 10px 40px", backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "8px", color: "#fff", outline: "none" }} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "10px", borderRadius: "8px", backgroundColor: theme.cardBg, color: "#fff", border: `1px solid ${theme.border}`, outline: "none", cursor: "pointer" }}>
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ backgroundColor: theme.cardBg, borderRadius: "12px", border: `1px solid ${theme.border}`, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Date</th>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Order ID</th>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Customer</th>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Total</th>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Status</th>
                  <th style={{ padding: "16px", textAlign: "left", backgroundColor: "#27272A", color: theme.textMuted, fontSize: "0.85rem", textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: theme.textMuted }}>No orders found.</td></tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.order_id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}`, fontSize: "0.95rem", color: theme.textMain }}>{formatDDMMYYYY(order.created_at)}</td>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}`, fontSize: "0.95rem" }}><span style={{ fontFamily: "monospace", color: theme.accent, fontWeight: "bold" }}>#{order.order_id}</span></td>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}`, fontSize: "0.95rem" }}><div style={{ fontWeight: "600", color: theme.textMain }}>{getCustomerDisplayName(order)}</div></td>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}`, fontSize: "0.95rem", color: theme.accent, fontWeight: "700" }}>${order.totals?.total}</td>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}` }}><span style={styles.statusBadge(order.status)}>{order.status}</span></td>
                      <td style={{ padding: "16px", borderBottom: `1px solid ${theme.border}` }}><button onClick={() => viewOrderDetails(order.order_id)} style={styles.btn("secondary")}><FiEye /> View</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- PREMIUM MODAL --- */}
      <AnimatePresence>
        {showOrderModal && selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.modalOverlay} onClick={() => setShowOrderModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.2 }} style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              
              <div style={styles.modalHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <h2 style={{ margin: 0, color: theme.accent, fontSize: "1.4rem" }}>Order #{selectedOrder.order_id}</h2>
                  <span style={styles.statusBadge(selectedOrder.status)}>{selectedOrder.status}</span>
                </div>
                <div style={{ display: "flex", gap: "0.8rem", alignItems:'center' }}>
                  <button onClick={() => downloadOrderDetails(selectedOrder)} style={styles.btn("secondary")}> <FiDownload /> Download Order Details</button>
                  <button onClick={() => setShowOrderModal(false)} style={styles.btn("icon")}><FiX /></button>
                </div>
              </div>

              <div style={styles.modalBody}>
                {/* 3-Column Info Grid */}
                <div style={styles.gridThree}>
                  {/* Customer Card */}
                  <div style={styles.infoCard}>
                    <div style={styles.sectionTitle}><FiUser /> Customer Details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                        <div><span style={styles.label}>Name</span><span style={styles.value}>{getCustomerDisplayName(selectedOrder)}</span></div>
                        <div><span style={styles.label}>Email</span><span style={styles.value}>{selectedOrder.customer_email || selectedOrder.customer_info?.email}</span></div>
                        <div><span style={styles.label}>Phone</span><span style={styles.value}>{selectedOrder.customer_phone || selectedOrder.customer_info?.phone || "N/A"}</span></div>
                    </div>
                  </div>

                  {/* Shipping Card */}
                  <div style={styles.infoCard}>
                    <div style={styles.sectionTitle}><FiMapPin /> Shipping Details</div>
                    <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                        <span style={styles.value}>{selectedOrder.shipping_address?.address || selectedOrder.customer_info?.address}</span>
                        <span style={styles.value}>{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} {selectedOrder.shipping_address?.zip}</span>
                        <span style={{ ...styles.value, color: theme.textMuted }}>{selectedOrder.shipping_address?.country}</span>
                    </div>
                    {/* Updated Shipping Method & Status Grid */}
                    <div style={{marginTop:'1rem', paddingTop:'0.5rem', borderTop:`1px dashed ${theme.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                        <div>
                            <span style={styles.label}>Shipping Method</span>
                            <span style={{...styles.value, fontWeight:'600'}}>
                                {selectedOrder.totals?.shippingMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                            </span>
                        </div>
                        <div>
                            <span style={styles.label}>Shipping Status</span>
                            <div style={{display:'flex', alignItems:'center', gap:'6px', color: theme.info}}>
                                <FiTruck /> {selectedOrder.shipping_status || "Pending Shipment"}
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* Payment & Financials Card */}
                  <div style={styles.infoCard}>
                    <div style={styles.sectionTitle}><FiCreditCard /> Payment & Financials</div>
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
                        <div><span style={styles.label}>Total Amount</span><span style={{...styles.value, color: theme.accent, fontSize:'1.1rem'}}>${selectedOrder.totals?.total}</span></div>
                        <div><span style={styles.label}>Payment Method</span><span style={styles.value}>{selectedOrder.payment_method || "N/A"}</span></div>
                    </div>
                    <div style={{marginTop:'1rem'}}>
                        <span style={styles.label}>Payment Status</span>
                        <div style={{display:'flex', alignItems:'center', gap:'6px', color: selectedOrder.status === 'Cancelled' ? theme.danger : theme.success}}>
                            <FiActivity /> {selectedOrder.payment_status || (selectedOrder.status === 'Pending' ? 'Unpaid' : 'Paid')}
                        </div>
                    </div>
                    {/* Status Changer */}
                    <div style={{marginTop:'1rem', paddingTop:'0.5rem', borderTop:`1px dashed ${theme.border}`}}>
                        <span style={styles.label}>Update Order Status</span>
                        <select
                            value={selectedOrder.status}
                            onChange={(e) => updateOrderStatus(selectedOrder.order_id, e.target.value)}
                            style={{ width: '100%', padding: "8px", borderRadius: "6px", background: "#333", color: "#fff", border: `1px solid ${theme.border}`, marginTop:'4px' }}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                  </div>
                </div>

                {/* Unit-wise Customizations */}
                {Array.isArray(selectedOrder.items) && selectedOrder.items.some(it => Array.isArray(it.units) && it.units.length > 0) && (
                    <div style={{ marginTop: "1rem" }}>
                        <div style={styles.sectionTitle}><FiImage /> Unit-wise Customizations</div>
                        {selectedOrder.items.filter(it => Array.isArray(it.units) && it.units.length > 0).map((item, iIdx) => (
                            <div key={iIdx} style={{ background: "#202022", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem", border: `1px solid ${theme.border}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `1px solid ${theme.border}`, flexWrap:'wrap' }}>
                                    <img src={item.product_photos?.[0] || item.image || "https://via.placeholder.com/60"} alt={item.product_name || "Product"} style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${theme.border}` }} loading="lazy" />
                                    <div style={{flex: 1}}>
                                        <div style={{ color: "#fff", fontWeight: "700", fontSize: "1.1rem" }}>{item.product_name}</div>
                                        <div style={{ color: theme.textMuted, fontSize: "0.9rem" }}>Total Units: <span style={{color: theme.accent}}>{item.quantity}</span></div>
                                    </div>
                                    <a href={getProductUrl(item)} target="_blank" rel="noopener noreferrer" style={styles.btn("secondary")}>
                                        <FiExternalLink /> View Product
                                    </a>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                                    {item.units.map((u, ui) => (
                                        <div key={ui} style={{ background: "#27272A", border: `1px solid #333`, borderRadius: "10px", padding: "1rem", display: "flex", gap: "1rem" }}>
                                            <div style={{flexShrink: 0}}>
                                                {typeof u.designFile === "string" ? (<img src={u.designFile} alt="Design" style={{width: "80px", height: "80px", objectFit:"cover", borderRadius: "8px", border: "1px solid #444"}} />) : (<div style={{width: "80px", height: "80px", background: "#333", borderRadius: "8px", display:'flex', alignItems:'center', justifyContent:'center', color: "#555"}}>No Img</div>)}
                                            </div>
                                            <div style={{flex: 1}}>
                                                <div style={{fontSize: "0.85rem", color: theme.textMuted, marginBottom: "4px"}}>Unit {u.unit_index || ui + 1}</div>
                                                <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom: '6px'}}>
                                                    <div style={{width: "14px", height: "14px", borderRadius: "50%", background: u.color || "#fff", border: "1px solid #555"}}></div>
                                                    <span style={{color: "#fff", fontWeight: "600", fontSize: "0.95rem"}}>{u.color || "N/A"}</span>
                                                </div>
                                                <div style={{marginBottom: "6px", fontSize: "0.9rem", color: "#ddd"}}>Size: <strong>{u.size || "N/A"}</strong></div>
                                                {u.note && (<div style={{ background: "#18181B", padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", color: "#aaa", borderLeft: `2px solid ${theme.accent}` }}>{u.note}</div>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Global Note Footer */}
                {selectedOrder.customization_data?.notes && (
                    <div style={{ marginTop: "1rem", padding: "1rem", border: "1px dashed #444", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
                        <strong style={{ color: theme.accent, display:'block', marginBottom:'4px' }}>Order Level Notes:</strong>
                        <p style={{ margin: 0, color: "#ccc", fontSize: "0.95rem" }}>{selectedOrder.customization_data.notes}</p>
                    </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrdersPage;