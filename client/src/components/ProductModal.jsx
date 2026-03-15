import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../pages/context/LocaleContext';
import { 
  FiX, FiShoppingCart, FiHeart, FiShare2, 
  FiChevronLeft, FiChevronRight, FiStar, 
  FiTruck, FiShield, FiPackage, FiRefreshCw,
  FiMinus, FiPlus, FiCheck, FiZap, 
  FiCopy, FiMail, FiMessageSquare, FiFacebook, FiTwitter, FiLinkedin, FiImage, 
  FiMessageCircle, FiCamera, FiUpload
} from 'react-icons/fi';
import { useCart } from '../pages/context/CartContext';
import { apiFetch } from '../utils/api';
import { absoluteUrl } from '../utils/api';
import { SOCKET_BASE } from '../utils/api';
import { io } from 'socket.io-client';
import { auth } from '../firebase';
import { LoginForm } from './Inquiry';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoadingAnimation from './LoadingAnimation';
import Loading from './Loading';

// --- CONSTANTS ---
const GOLD_GRADIENT_CSS = 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)';
const GRADIENT_ID = "gold-gradient-modal"; 

// Helper to get color code for dots
const getColorCode = (colorName) => {
    const map = {
        'Original': '#BF953F',
        'Black': '#000000',
        'White': '#FFFFFF',
        'Gray': '#808080',
        'Light Gray': '#D3D3D3',
        'Dark Gray': '#A9A9A9',
        'Charcoal': '#36454F',
        'Gold': '#FFD700',
        'Red': '#e74c3c',
        'Orange': '#FFA500',
        'Coral': '#FF7F50',
        'Yellow': '#FFD400',
        'Mustard': '#FFDB58',
        'Blue': '#3498db',
        'Royal Blue': '#4169E1',
        'Sky Blue': '#87CEEB',
        'Navy': '#000080',
        'Teal': '#008080',
        'Cyan': '#00FFFF',
        'Green': '#008000',
        'Forest Green': '#27ae60',
        'Lime': '#32CD32',
        'Olive': '#808000',
        'Pink': '#FFC0CB',
        'Hot Pink': '#FF69B4',
        'Magenta': '#FF00FF',
        'Purple': '#8e44ad',
        'Lavender': '#E6E6FA',
        'Brown': '#8B4513',
        'Tan': '#D2B48C',
        'Beige': '#F5F5DC',
        'Cream': '#FFFDD0',
        'Midnight': '#2c3e50',
        'Maroon': '#800000',
        'Burgundy': '#800020'
    };
    return map[colorName] || colorName; 
};

// --- Helper: Get Name from Hex Code ---
const getColorName = (colorValue) => {
    if (!colorValue) return '';
    const hexToNameMap = {
        '#bf953f': 'Original',
        '#000000': 'Black',
        '#ffffff': 'White',
        '#808080': 'Gray',
        '#d3d3d3': 'Light Gray',
        '#a9a9a9': 'Dark Gray',
        '#36454f': 'Charcoal',
        '#ffd700': 'Gold',
        '#e74c3c': 'Red',
        '#ffa500': 'Orange',
        '#ff7f50': 'Coral',
        '#ffd400': 'Yellow',
        '#ffdb58': 'Mustard',
        '#3498db': 'Blue',
        '#4169e1': 'Royal Blue',
        '#87ceeb': 'Sky Blue',
        '#000080': 'Navy',
        '#008080': 'Teal',
        '#00ffff': 'Cyan',
        '#008000': 'Green',
        '#27ae60': 'Forest Green',
        '#32cd32': 'Lime',
        '#808000': 'Olive',
        '#ffc0cb': 'Pink',
        '#ff69b4': 'Hot Pink',
        '#ff00ff': 'Magenta',
        '#8e44ad': 'Purple',
        '#e6e6fa': 'Lavender',
        '#8b4513': 'Brown',
        '#d2b48c': 'Tan',
        '#f5f5dc': 'Beige',
        '#fffdd0': 'Cream',
        '#2c3e50': 'Midnight',
        '#800000': 'Maroon',
        '#800020': 'Burgundy',
        '#27272a': 'Dark Grey'
    };
    if (String(colorValue).startsWith('#')) {
        const lowerHex = String(colorValue).toLowerCase();
        return hexToNameMap[lowerHex] || colorValue;
    }
    return colorValue;
};

const toSlug = (str) => {
  try {
    const s = String(str || '').toLowerCase().trim();
    return s
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  } catch { return ''; }
};

const canonicalBase = 'https://www.yokebud.fi';

const ProductModal = ({ product: propProduct = {}, relatedProducts: propRelatedProducts = [], onClose, onRelatedProductClick }) => {
  const { productId, id: routeParamId } = useParams();
  const routeId = productId || routeParamId;
  const location = useLocation();
  const navigate = useNavigate();
   
  // State
  const [product, setProduct] = useState(location.state?.product || propProduct);
  const [loading, setLoading] = useState(!product.id && !!routeId);
  const [error, setError] = useState(null);
  const [fetchedRelatedProducts, setFetchedRelatedProducts] = useState([]);
  const [isFromSharedUrl, setIsFromSharedUrl] = useState(false);
   
  // Safe Product Object
  const safeProduct = {
    id: routeId || propProduct.id || '',
    product_name: '',
    product_details: '',
    product_description: '',
    price: 0,
    min_price: 0,
    max_price: 0,
    discounted_price: null,
    category: '',
    stock: 0,
    material: '',
    rating: typeof product.rating === 'number' ? product.rating : 0,
    review_count: typeof product.review_count === 'number' ? product.review_count : 0,
    product_photos: [],
    sizes: [], 
    colors: [], 
    variants: Array.isArray(propProduct.variants) 
      ? propProduct.variants 
      : (Array.isArray(propProduct.product_variants) ? propProduct.product_variants : []),
    tags: [],
    features: [],
    sku: '', 
    moq: 1, 
    ...product
  };

  if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) safeProduct.sizes = product.sizes;
  else if (Array.isArray(product.attributes?.sizes) && product.attributes.sizes.length > 0) safeProduct.sizes = product.attributes.sizes;

  if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) safeProduct.colors = product.colors;
  else if (Array.isArray(product.attributes?.colors) && product.attributes.colors.length > 0) safeProduct.colors = product.attributes.colors;

  // UI State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
   
  // --- Selections based on Quantity ---
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState([{ 
      size: safeProduct.sizes[0] || '', 
      color: safeProduct.colors[0] || '' 
  }]);

  // Update selections array when quantity changes
  useEffect(() => {
    setSelections(prev => {
        if (quantity > prev.length) {
            const lastSelection = prev[prev.length - 1];
            const newItems = new Array(quantity - prev.length).fill({ ...lastSelection });
            return [...prev, ...newItems];
        } else if (quantity < prev.length) {
            return prev.slice(0, quantity);
        }
        return prev;
    });
  }, [quantity]);

  const handleSelectionChange = (index, field, value) => {
      const newSelections = [...selections];
      newSelections[index] = { ...newSelections[index], [field]: value };
      setSelections(newSelections);
  };

  const [activeTab, setActiveTab] = useState('description');
   
  // Image Interaction State
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [slideShowActive, setSlideShowActive] = useState(true);
   
  // Review Form State
  const [newReview, setNewReview] = useState({ rating: 5, text: '', mediaFiles: [] });
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ avg_rating: null, review_count: 0 });
  const [hasRated, setHasRated] = useState(false);
  const [existingRating, setExistingRating] = useState(null);
  const [editReviewId, setEditReviewId] = useState(null);
  const [editExistingMedia, setEditExistingMedia] = useState([]);
  const [viewer, setViewer] = useState({ open: false, url: null, type: null });
  const [isUploading, setIsUploading] = useState(false);

  // Other State
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [showShareOptions, setShowShareOptions] = useState(false);
   
  const { cartItems, addToCart } = useCart();
  
  // --- Stock awareness (prevent duplicate total beyond stock) ---
  const selectedSize = selections[0]?.size || '';
  const selectedColor = selections[0]?.color || '';
  
  const variantStockMap = React.useMemo(() => {
    const arr = Array.isArray(safeProduct.variants) ? safeProduct.variants : [];
    const m = new Map();
    for (const v of arr) {
      const key = `${v.color ?? ''}|${v.size ?? ''}`;
      m.set(key, Number(v.quantity || 0));
    }
    return m;
  }, [safeProduct.variants]);

  const hasColorStock = React.useCallback((color) => {
    if (!(variantStockMap && variantStockMap.size > 0)) return true;
    const sizes = Array.isArray(safeProduct.sizes) && safeProduct.sizes.length > 0 ? safeProduct.sizes : [''];
    for (const s of sizes) {
      const key = `${color || ''}|${s || ''}`;
      const qty = Number(variantStockMap.get(key) || 0);
      if (qty > 0) return true;
    }
    return false;
  }, [variantStockMap, safeProduct.sizes]);

  // Logic to auto-select next available variant if current is OOS
  React.useEffect(() => {
    const s = selections[0] || {};
    
    // Check if current color has any stock
    if (s.color && !hasColorStock(s.color)) {
      const colors = (safeProduct.colors || []).filter(hasColorStock);
      const sizes = safeProduct.sizes || [];
      let nextColor = colors[0] || '';
      let nextSize = s.size;

      if (!nextColor) return;
      
      // Find a valid size for the new color
      if (variantStockMap.size > 0) {
        const candidates = sizes.length ? sizes : [''];
        const foundSize = candidates.find(sz => Number(variantStockMap.get(`${nextColor}|${sz || ''}`) || 0) > 0);
        if (foundSize != null) nextSize = foundSize;
      }
      setSelections([{ color: nextColor, size: nextSize }]);
    } else {
      // Current color is fine, but check if current SIZE is OOS for this color
      if (variantStockMap.size > 0 && s.color) {
         const currentKey = `${s.color}|${s.size || ''}`;
         const currentQty = Number(variantStockMap.get(currentKey) || 0);
         
         if (currentQty <= 0) {
             // Current size is OOS, find another size for this color
             const sizes = safeProduct.sizes || [];
             const availableSize = sizes.find(sz => Number(variantStockMap.get(`${s.color}|${sz || ''}`) || 0) > 0);
             if (availableSize) {
                 setSelections(prev => {
                     const newSel = [...prev];
                     newSel[0] = { ...newSel[0], size: availableSize };
                     return newSel;
                 });
             }
         }
      }
    }
  }, [selections, hasColorStock, safeProduct.colors, safeProduct.sizes, variantStockMap]);
  
  const existingQtyInCart = React.useMemo(() => {
    try {
      return (cartItems || [])
        .filter(item => item.id === safeProduct.id && (!selectedSize || item.selectedSize === selectedSize) && (!selectedColor || item.selectedColor === selectedColor))
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    } catch (e) {
      return 0;
    }
  }, [cartItems, safeProduct.id, selectedSize, selectedColor]);

  const variantKey = `${selectedColor}|${selectedSize}`;
  const variantAvailable = variantStockMap.has(variantKey) ? Number(variantStockMap.get(variantKey) || 0) : null;
  const baseAvailable = Number(safeProduct.stock || 0);
  const remainingStock = Math.max(0, (variantAvailable != null ? variantAvailable : baseAvailable) - Number(existingQtyInCart || 0));

  // Clamp quantity when stock/selection changes
  useEffect(() => {
    setQuantity(prev => {
      if (remainingStock <= 0) return Math.max(1, prev);
      return Math.min(prev, remainingStock);
    });
  }, [remainingStock, selectedSize, safeProduct.id]);
  
  const imageRef = useRef(null);
  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const imageContainerRef = useRef(null);
  const shareButtonRef = useRef(null);
  const shareMenuRef = useRef(null);

  // --- STYLES HELPERS ---
  const textGradientStyle = {
    background: GOLD_GRADIENT_CSS,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block'
  };

  const borderGradientStyle = (isActive) => ({
    background: isActive 
      ? `linear-gradient(#0a0a0a, #0a0a0a) padding-box, ${GOLD_GRADIENT_CSS} border-box`
      : 'transparent',
    border: `1px solid ${isActive ? 'transparent' : '#333'}`,
    color: isActive ? '#FFD700' : '#ccc'
  });

  const svgGradientUrl = `url(#${GRADIENT_ID})`;

  // --- Data Fetching ---
  const processProductPhotos = (photos) => {
    if (!photos) return [];
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch (e) { photos = []; }
    }
    return (photos || []).map(photo => {
      if (!photo) return '';
      return absoluteUrl(photo);
    });
  };
  const processProductVideos = (videos) => {
    if (!videos) return [];
    if (typeof videos === 'string') {
      try { videos = JSON.parse(videos); } catch (e) { videos = []; }
    }
    return (videos || []).map(v => {
      if (!v) return '';
      return absoluteUrl(v);
    });
  };

  const fetchProductData = async () => {
    const failsafe = setTimeout(() => {
      setLoading(false);
    }, 8000);

    try {
      setLoading(true);
      const productResponse = await apiFetch(`/api/products/${routeId}`);
      if (!productResponse.ok) throw new Error('Failed to fetch product');
      const productPayload = await productResponse.json();
      const productData = productPayload?.product || productPayload;
        
      const priceRange = productData.metadata && productData.metadata.price_range ? productData.metadata.price_range : null;
      const processedProduct = {
        ...productData,
        variants: Array.isArray(productData.variants) ? productData.variants : (Array.isArray(productData.product_variants) ? productData.product_variants : []),
        colors: Array.isArray(productData.colors) && productData.colors.length ? productData.colors : (Array.isArray(productData.attributes?.colors) ? productData.attributes.colors : []),
        sizes: Array.isArray(productData.sizes) && productData.sizes.length ? productData.sizes : (Array.isArray(productData.attributes?.sizes) ? productData.attributes.sizes : []),
        min_price: priceRange && priceRange.min != null ? Number(priceRange.min) : (productData.discounted_price || productData.price),
        max_price: priceRange && priceRange.max != null ? Number(priceRange.max) : productData.price,
        product_photos: (() => {
          const photos = processProductPhotos(productData.images || productData.product_photos || productData.photos || []);
          const videos = processProductVideos(productData.videos || (productData.metadata && productData.metadata.videos) || []);
          return [...photos, ...videos];
        })(),
        rating: productData.rating,
        is_customizable: productData.is_customizable,
      };
        
      setProduct(processedProduct);
        
      // Determine initial selection based on stock availability
      let initialSize = processedProduct.sizes && processedProduct.sizes.length > 0 ? processedProduct.sizes[0] : '';
      let initialColor = processedProduct.colors && processedProduct.colors.length > 0 ? processedProduct.colors[0] : '';
      
      const firstAvailable = Array.isArray(processedProduct.variants) 
        ? processedProduct.variants.find(v => Number(v.quantity || 0) > 0) 
        : null;
        
      if (firstAvailable) {
        initialColor = firstAvailable.color || initialColor;
        initialSize = firstAvailable.size || initialSize;
      }
      
      setSelections([{ size: initialSize, color: initialColor }]);
      setQuantity(1);

      const categoryToFetch = productData.category || (Array.isArray(productData.categories) && productData.categories[0]) || (Array.isArray(productData.attributes?.categories) && productData.attributes.categories[0]);

      try {
        // Fetch more items (15) to allow for randomness and variety
        const query = categoryToFetch ? `category=${encodeURIComponent(categoryToFetch)}&limit=15` : `limit=15`;
        const relatedResponse = await apiFetch(`/api/products?${query}`);
        
        if (relatedResponse.ok) {
          const relatedPayload = await relatedResponse.json();
          const relatedArray = Array.isArray(relatedPayload?.products) ? relatedPayload.products : relatedPayload;
          
          // Filter out current product and randomize the list
          let filtered = (relatedArray || []).filter(p => String(p.id) !== String(routeId));
          
          // Shuffle for variety
          filtered = filtered.sort(() => 0.5 - Math.random());
          
          if (filtered.length > 0) {
            setFetchedRelatedProducts(
              filtered.slice(0, 6).map(p => ({
                ...p,
                product_photos: processProductPhotos(p.product_photos || p.photos || [])
              }))
            );
          } else if (categoryToFetch) {
            // If category search returned nothing (except maybe the current product), try fetching all
            const fallbackResponse = await apiFetch(`/api/products?limit=15`);
            if (fallbackResponse.ok) {
              const fallbackPayload = await fallbackResponse.json();
              const fallbackArray = Array.isArray(fallbackPayload?.products) ? fallbackPayload.products : fallbackPayload;
              let fFiltered = (fallbackArray || []).filter(p => String(p.id) !== String(routeId));
              fFiltered = fFiltered.sort(() => 0.5 - Math.random());
              
              setFetchedRelatedProducts(
                fFiltered.slice(0, 6).map(p => ({
                  ...p,
                  product_photos: processProductPhotos(p.product_photos || p.photos || [])
                }))
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch related products:", err);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    } finally {
      clearTimeout(failsafe);
    }
  };

  const loadReviews = async (pid) => {
    try {
      let anonId = null;
      if (!auth?.currentUser?.uid) {
        try {
          anonId = localStorage.getItem('anonReviewerId');
          if (!anonId && window.crypto?.randomUUID) {
            anonId = `anon-${crypto.randomUUID()}`;
            localStorage.setItem('anonReviewerId', anonId);
          }
        } catch {}
      }
      const googleUid = auth?.currentUser?.uid ? `?google_uid=${encodeURIComponent(auth.currentUser.uid)}` : (anonId ? `?google_uid=${encodeURIComponent(anonId)}` : '');
      const r = await apiFetch(`/api/products/${pid}/reviews${googleUid}`);
      if (r.ok) {
        const payload = await r.json();
        setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
        const sum = payload.summary || {};
        setReviewSummary({ avg_rating: sum.avg_rating ?? null, review_count: sum.review_count ?? 0 });
        setProduct(prev => ({ ...prev, rating: sum.avg_rating ?? prev.rating, review_count: sum.review_count ?? prev.review_count }));
        setHasRated(!!payload.you_have_rated);
        if (payload.you_have_rated) {
          const uid = auth?.currentUser?.uid || null;
          const myFirst = (payload.reviews || []).find(rv => rv.is_first_review && (rv.google_uid === uid));
          setExistingRating(myFirst ? Number(myFirst.rating) : null);
          if (myFirst && typeof myFirst.rating === 'number') setNewReview(prev => ({ ...prev, rating: Number(myFirst.rating) }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (location.pathname.startsWith('/products/') && !propProduct.id) setIsFromSharedUrl(true);
  }, [location.pathname, propProduct.id]);

  useEffect(() => {
    if (routeId) {
      // Check if location state has the product data for this routeId
      const stateProduct = location.state?.product;
      if (stateProduct && String(stateProduct.id) === String(routeId)) {
        setProduct(stateProduct);
        
        // Re-fetch related products for the new product
        const fetchRelatedOnly = async () => {
            const category = stateProduct.category || (Array.isArray(stateProduct.categories) && stateProduct.categories[0]) || (Array.isArray(stateProduct.attributes?.categories) && stateProduct.attributes.categories[0]);
            
            try {
                // Fetch more items (15) to allow for randomness and variety
                const query = category ? `category=${encodeURIComponent(category)}&limit=15` : `limit=15`;
                const relatedResponse = await apiFetch(`/api/products?${query}`);
                
                if (relatedResponse.ok) {
                    const relatedPayload = await relatedResponse.json();
                    const relatedArray = Array.isArray(relatedPayload?.products) ? relatedPayload.products : relatedPayload;
                    
                    // Filter out current product and randomize the list
                    let filtered = (relatedArray || []).filter(p => String(p.id) !== String(routeId));
                    
                    // Shuffle for variety
                    filtered = filtered.sort(() => 0.5 - Math.random());
                    
                    if (filtered.length > 0) {
                        setFetchedRelatedProducts(
                            filtered.slice(0, 6).map(p => ({
                                ...p,
                                product_photos: processProductPhotos(p.product_photos || p.photos || [])
                            }))
                        );
                    } else if (category) {
                        // Fallback shuffle for all products
                        const fallbackResponse = await apiFetch(`/api/products?limit=15`);
                        if (fallbackResponse.ok) {
                            const fallbackPayload = await fallbackResponse.json();
                            const fallbackArray = Array.isArray(fallbackPayload?.products) ? fallbackPayload.products : fallbackPayload;
                            let fFiltered = (fallbackArray || []).filter(p => String(p.id) !== String(routeId));
                            fFiltered = fFiltered.sort(() => 0.5 - Math.random());
                            
                            setFetchedRelatedProducts(
                                fFiltered.slice(0, 6).map(p => ({
                                    ...p,
                                    product_photos: processProductPhotos(p.product_photos || p.photos || [])
                                }))
                            );
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch related products:", err);
            }
        };
        fetchRelatedOnly();
      } else if (!propProduct.id || String(propProduct.id) !== String(routeId)) {
        // Only fetch if data is missing or doesn't match current ID
        fetchProductData();
      }
    }
  }, [routeId, propProduct.id, location.state]);

  // Ensure variants are loaded even when opening from a list item that lacks detailed data
  useEffect(() => {
    const shouldFetch = !Array.isArray(product?.variants) || product.variants.length === 0;
    if (shouldFetch && safeProduct.id && ((safeProduct.colors && safeProduct.colors.length > 0) || (safeProduct.sizes && safeProduct.sizes.length > 0))) {
      fetchProductData();
    }
  }, [product?.variants, safeProduct.id, safeProduct.colors, safeProduct.sizes]);

  useEffect(() => {
    const pid = routeId || product.id || propProduct.id;
    if (pid) loadReviews(pid);
  }, [routeId, product.id, propProduct.id]);

  // --- Real-time stock sync via Socket.IO ---
  useEffect(() => {
    const pid = safeProduct.id;
    if (!pid) return;
    const socket = io(SOCKET_BASE, { transports: ['websocket'], withCredentials: true });
    const onUpdate = (data) => {
      try {
        if (!data || Number(data.productId) !== Number(pid)) return;
        setProduct(prev => ({
          ...prev,
          stock: data.totalStock != null ? Number(data.totalStock) : prev.stock,
          variants: Array.isArray(data.variants) ? data.variants : prev.variants
        }));
        // Adjust selection if current choice becomes unavailable
        const vMap = new Map();
        (Array.isArray(data.variants) ? data.variants : []).forEach(v => {
          vMap.set(`${v.color ?? ''}|${v.size ?? ''}`, Number(v.quantity || 0));
        });
        setSelections(prevSel => {
          const next = [...prevSel];
          const s0 = next[0] || {};
          const k = `${s0.color || ''}|${s0.size || ''}`;
          const currAvail = vMap.size > 0 ? Number(vMap.get(k) || 0) : null;
          if (currAvail != null && currAvail <= 0) {
            // Try find another size for same color
            const sizes = safeProduct.sizes && safeProduct.sizes.length ? safeProduct.sizes : [''];
            const altSize = sizes.find(sz => Number(vMap.get(`${s0.color || ''}|${sz || ''}`) || 0) > 0);
            if (altSize) {
              next[0] = { ...s0, size: altSize };
            } else {
              // Try another color
              const colors = safeProduct.colors || [];
              const sizesCandidates = safeProduct.sizes && safeProduct.sizes.length ? safeProduct.sizes : [''];
              let foundColor = '';
              let foundSize = '';
              for (const c of colors) {
                const sz = sizesCandidates.find(sz => Number(vMap.get(`${c || ''}|${sz || ''}`) || 0) > 0);
                if (sz) { foundColor = c; foundSize = sz; break; }
              }
              if (foundColor) next[0] = { color: foundColor, size: foundSize };
            }
            toast.info('库存更新：当前选项已调整');
          }
          return next;
        });
      } catch {}
    };
    socket.on('stock_update', onUpdate);
    return () => { try { socket.off('stock_update', onUpdate); socket.disconnect(); } catch {} };
  }, [safeProduct.id, safeProduct.colors, safeProduct.sizes]);

  // Slideshow Logic
  useEffect(() => {
    let interval;
    const currentUrl = getImageUrl(safeProduct.product_photos[currentImageIndex]);
    const isVideo = currentUrl && String(currentUrl).match(/\.mp4|\.webm|video\//i);

    if (slideShowActive && !isHoveringImage && safeProduct.product_photos.length > 0 && !isVideo) {
      interval = setInterval(() => {
        setCurrentImageIndex(prev => prev === safeProduct.product_photos.length - 1 ? 0 : prev + 1);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [slideShowActive, isHoveringImage, safeProduct.product_photos.length, currentImageIndex]);

  const nextImage = () => {
    if (safeProduct.product_photos.length === 0) return;
    setCurrentImageIndex(prev => prev === safeProduct.product_photos.length - 1 ? 0 : prev + 1);
    setSlideShowActive(false);
    setTimeout(() => setSlideShowActive(true), 10000);
  };

  const prevImage = () => {
    if (safeProduct.product_photos.length === 0) return;
    setCurrentImageIndex(prev => prev === 0 ? safeProduct.product_photos.length - 1 : prev - 1);
    setSlideShowActive(false);
    setTimeout(() => setSlideShowActive(true), 10000);
  };

  const handleClose = () => {
    if (isFromSharedUrl) navigate(location.state?.backTo || '/', { replace: true });
    else if (onClose) onClose();
    else navigate(-1);
  };

  const handleAddToCart = () => {
    const willAdd = remainingStock > 0 ? Math.min(quantity, remainingStock) : 0;
    if (willAdd <= 0) {
      toast.error('Stock limit reached for this product.', { theme: 'dark' });
      return;
    }
    addToCart({
      ...safeProduct,
      selections: selections, 
      quantity: willAdd,
      selectedSize: selections[0]?.size,
      selectedColor: selections[0]?.color,
    });
    if (willAdd < quantity) {
      toast.info(`Only ${willAdd} added due to stock limit.`, { theme: 'dark' });
    } else {
      toast.success('Added to Cart', { theme: 'dark', progressStyle: { background: '#FFD700' } });
    }
  };

  const handleBuyNow = () => {
      const buyQty = remainingStock > 0 ? Math.min(quantity, remainingStock) : 0;
      if (buyQty <= 0) {
        toast.error('Insufficient stock for Buy Now.', { theme: 'dark' });
        return;
      }
      try {
        const item = {
          ...safeProduct,
          selections: selections,
          quantity: buyQty,
          selectedSize: selections[0]?.size,
          selectedColor: selections[0]?.color,
        };
        sessionStorage.setItem('buy_now_items', JSON.stringify([item]));
      } catch {}
      navigate('/Checkout', { 
          state: { 
            items: [{
              ...safeProduct,
              selections: selections,
              quantity: buyQty,
              selectedSize: selections[0]?.size,
              selectedColor: selections[0]?.color,
            }]
          } 
      });
  };

  const handleInquiry = () => {
    const selectionDetails = selections.map((s, i) => `Item ${i+1}: ${getColorName(s.color) || 'N/A'} / ${s.size || 'N/A'}`).join('\n');
    const structuredMessage = `Product Inquiry: ${safeProduct.product_name}\n\nQuantity: ${quantity}\nDetails:\n${selectionDetails}\n\nPlease provide more information.`;
    navigate('/inquiry', { 
      state: { 
        product: { ...safeProduct, selections, quantity },
        directInquiry: true,
        initialMessage: structuredMessage
      } 
    });
  };

  const getShareUrl = () => {
    // Priority: 1. sitemap_path from DB, 2. Dynamic generated path
    const path = product.sitemap_path || `/products/${safeProduct.id}/${toSlug(safeProduct.product_name || 'product')}`;
    
    // Use the main site URL which is now handled by the backend to inject meta tags
    const shareUrl = `${canonicalBase}${path.startsWith('/') ? '' : '/'}${path}`;
    
    return shareUrl;
  };

  const shareNative = async () => {
    const url = getShareUrl();
    const title = String(safeProduct.product_name || 'Product');
    const text = String(safeProduct.product_description || safeProduct.product_details || '');
    try {
      if (navigator && navigator.share) {
        await navigator.share({ title, text, url });
        toast.success('Shared');
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      } catch {}
    }
    setShowShareOptions(false);
  };

  const copyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {}
    setShowShareOptions(false);
  };

  const shareEmail = () => {
    const url = getShareUrl();
    const subject = encodeURIComponent(String(safeProduct.product_name || 'Product'));
    const body = encodeURIComponent(`${safeProduct.product_name || 'Product'}\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowShareOptions(false);
  };

  const shareWhatsApp = () => {
    const url = getShareUrl();
    const text = encodeURIComponent(`${safeProduct.product_name || 'Product'} ${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    setShowShareOptions(false);
  };

  const shareFacebook = () => {
    const url = getShareUrl();
    const u = encodeURIComponent(url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank');
    setShowShareOptions(false);
  };

  const shareTwitter = () => {
    const url = getShareUrl();
    const text = encodeURIComponent(`${safeProduct.product_name || 'Product'} ${url}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    setShowShareOptions(false);
  };

  const shareLinkedIn = () => {
    const url = getShareUrl();
    const u = encodeURIComponent(url);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`, '_blank');
    setShowShareOptions(false);
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (!showShareOptions) return;
      const btn = shareButtonRef.current;
      const menu = shareMenuRef.current;
      if (menu && menu.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setShowShareOptions(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showShareOptions]);

  const toggleWishlist = async () => {
    setIsWishlisted(!isWishlisted); 
    toast.info(isWishlisted ? "Removed from Wishlist" : "Added to Wishlist", { theme: "dark" });
  };

  const handleRelatedProductClick = (relatedProduct) => {
    if (onRelatedProductClick) {
      onRelatedProductClick(relatedProduct);
    } else {
      navigate(`/products/${relatedProduct.id}`, { replace: true });
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
    setProduct(relatedProduct);
    setFetchedRelatedProducts([]); // Clear existing related products to trigger a fresh fetch
    setCurrentImageIndex(0);
    setQuantity(1);
    
    // Reset selections with variant check for related product
    let initSize = relatedProduct.sizes?.[0] || '';
    let initColor = relatedProduct.colors?.[0] || '';
    
    if (relatedProduct.variants && relatedProduct.variants.length > 0) {
        const avail = relatedProduct.variants.find(v => Number(v.quantity) > 0);
        if (avail) {
            initSize = avail.size;
            initColor = avail.color;
        }
    }
    
    setSelections([{ 
        size: initSize, 
        color: initColor 
    }]);
    try {
      const el = overlayRef.current;
      if (el && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {}
  };

  const handleImageClick = (e) => {
    if (!imageRef.current || safeProduct.product_photos.length === 0) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
    setIsZoomed(!isZoomed);
  };

  const handleMouseMove = (e) => {
    if (isZoomed && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomPosition({ x, y });
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `https://api.yokebud.fi${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  // Review Logic
  const handleReviewImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setNewReview(prev => ({ ...prev, mediaFiles: [...prev.mediaFiles, ...files] }));
    if (files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => { setPreviewImage(reader.result); };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      setIsUploading(true);
      const user = auth?.currentUser || null;
      const form = new FormData();
      if (!hasRated || (existingRating != null && newReview.rating !== existingRating)) {
        form.append('rating', String(newReview.rating));
      }
      form.append('review_text', newReview.text || '');
      form.append('title', '');
      if (user) {
        form.append('google_uid', user.uid);
        if (user.displayName) form.append('reviewer_name', user.displayName);
        if (user.photoURL) form.append('reviewer_photo_url', user.photoURL);
      } else {
        let anonId = null;
        try {
          anonId = localStorage.getItem('anonReviewerId');
          if (!anonId && window.crypto?.randomUUID) {
            anonId = `anon-${crypto.randomUUID()}`;
            localStorage.setItem('anonReviewerId', anonId);
          }
        } catch {}
        if (anonId) {
          form.append('google_uid', anonId);
          const code = String(anonId).replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
          form.append('reviewer_name', `Guest-${code}`);
        } else {
          form.append('reviewer_name', 'Guest');
        }
      }
      (newReview.mediaFiles || []).forEach(f => form.append('media', f));
      if (editReviewId) {
        try { form.append('existing_media_json', JSON.stringify(editExistingMedia || [])); } catch {}
      }
      const url = editReviewId ? `/api/products/${safeProduct.id}/reviews/${editReviewId}` : `/api/products/${safeProduct.id}/reviews`;
      const method = editReviewId ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit review');
      }
      const data = await res.json();
      toast.success('Review submitted successfully!', { theme: 'dark' });
      setNewReview({ rating: hasRated ? (existingRating ?? 5) : 5, text: '', mediaFiles: [] });
      setPreviewImage(null);
      setEditReviewId(null);
      setEditExistingMedia([]);
      try {
        let anonId = null;
        if (!auth?.currentUser?.uid) {
          try { anonId = localStorage.getItem('anonReviewerId'); } catch {}
        }
        const googleUid = auth?.currentUser?.uid ? `?google_uid=${encodeURIComponent(auth.currentUser.uid)}` : (anonId ? `?google_uid=${encodeURIComponent(anonId)}` : '');
      const r = await apiFetch(`/api/products/${safeProduct.id}/reviews${googleUid}`);
        if (r.ok) {
          const payload = await r.json();
          setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
          const sum = payload.summary || {};
          setReviewSummary({ avg_rating: sum.avg_rating ?? null, review_count: sum.review_count ?? 0 });
          setProduct(prev => ({ ...prev, rating: sum.avg_rating ?? prev.rating, review_count: sum.review_count ?? prev.review_count }));
          setHasRated(!!payload.you_have_rated);
          if (payload.you_have_rated) {
            const uid = auth?.currentUser?.uid || null;
            const idForMatch = uid || (anonId || null);
            const myFirst = (payload.reviews || []).find(rv => rv.is_first_review && (rv.google_uid === idForMatch));
            setExistingRating(myFirst ? Number(myFirst.rating) : null);
            if (myFirst && typeof myFirst.rating === 'number') setNewReview(prev => ({ ...prev, rating: Number(myFirst.rating) }));
          }
        }
      } catch {}
      setIsUploading(false);
    } catch (err) {
      setIsUploading(false);
      toast.error(err.message || 'Failed to submit review', { theme: 'dark' });
    }
  };

  const handleRemoveMedia = (index) => {
    setNewReview(prev => ({ ...prev, mediaFiles: prev.mediaFiles.filter((_, i) => i !== index) }));
  };

  const handleStartEditReview = (rev) => {
    setEditReviewId(rev.id);
    let urls = [];
    try { urls = rev.media_json ? JSON.parse(rev.media_json) : []; } catch { urls = []; }
    setEditExistingMedia(Array.isArray(urls) ? urls : []);
    setNewReview({ rating: hasRated ? (existingRating ?? newReview.rating) : newReview.rating, text: rev.review_text || '', mediaFiles: [] });
  };

  const handleDeleteReview = async (rev) => {
    try {
      let idForMatch = auth?.currentUser?.uid || '';
      if (!idForMatch) {
        try { idForMatch = localStorage.getItem('anonReviewerId') || ''; } catch {}
      }
      const qs = idForMatch ? `?google_uid=${encodeURIComponent(idForMatch)}` : '';
      const res = await apiFetch(`/api/products/${safeProduct.id}/reviews/${rev.id}${qs}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete review');
      await loadReviews(safeProduct.id);
      toast.success('Review deleted');
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  const handleRemoveExistingMedia = (index) => {
    setEditExistingMedia(prev => prev.filter((_, i) => i !== index));
  };

  const openViewer = (url) => {
    const isVideo = /\.mp4|\.webm|video\//i.test(url);
    setViewer({ open: true, url, type: isVideo ? 'video' : 'image' });
  };

  const closeViewer = () => setViewer({ open: false, url: null, type: null });

  const { format } = useLocale();

  // FIX: Only return loading if initial data fetch is pending.
  if (loading) return <Loading />;
  
  if (error && !propProduct.id) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#050505', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 100010, color: '#fff'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Product Not Found</h2>
        <p style={{ color: '#ccc', marginBottom: '30px' }}>The product you are looking for might have been removed or the link is incorrect.</p>
        <button 
          onClick={() => navigate('/')}
          style={{
            padding: '12px 30px', background: GOLD_GRADIENT_CSS,
            border: 'none', borderRadius: '30px', color: '#000',
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  const isMobile = windowWidth < 768;
  const finalRelatedProducts = (propRelatedProducts.length > 0 ? propRelatedProducts : fetchedRelatedProducts)
    .filter(p => String(p.id) !== String(safeProduct.id))
    .slice(0, 6);

  // Use a single canonical/SEO URL source: prefer sitemap_path from DB, fallback to slug path
  const seoPath = product.sitemap_path || `/products/${safeProduct.id || routeId}/${toSlug(safeProduct.product_name || 'product')}`;
  const canonicalUrl = `${canonicalBase}${seoPath.startsWith('/') ? '' : '/'}${seoPath}`;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)', 
          display: 'flex', justifyContent: 'center', alignItems: isMobile ? 'flex-start' : 'center', 
          zIndex: 100010, 
          padding: isMobile ? '0' : '20px',
          overflowY: isMobile ? 'auto' : 'visible' 
        }}
        onClick={handleClose}
      >
        <Helmet>
          <title>{safeProduct.product_name ? `${safeProduct.product_name} | Yokebud Crafts` : 'Product | Yokebud Crafts'}</title>
          <meta name="description" content={String(safeProduct.product_description || safeProduct.product_details || '').slice(0, 160)} />
          <meta name="keywords" content={(safeProduct.tags || []).join(', ')} />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={canonicalUrl} />

          {/* Open Graph */}
          <meta property="og:site_name" content="Yokebud Crafts" />
          <meta property="og:title" content={safeProduct.product_name || 'Product'} />
          <meta property="og:description" content={String(safeProduct.product_description || safeProduct.product_details || '').slice(0, 160)} />
          <meta property="og:type" content="product" />
          <meta property="og:url" content={canonicalUrl} />
          {Array.isArray(safeProduct.product_photos) && safeProduct.product_photos[0] && (
            <meta property="og:image" content={getImageUrl(safeProduct.product_photos[0])} />
          )}
          {Array.isArray(safeProduct.product_photos) && safeProduct.product_photos[0] && (
             <meta property="og:image:alt" content={safeProduct.product_name || 'Product Image'} />
          )}

          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@yokebud" />
          <meta name="twitter:title" content={safeProduct.product_name || 'Product'} />
          <meta name="twitter:description" content={String(safeProduct.product_description || safeProduct.product_details || '').slice(0, 160)} />
          {Array.isArray(safeProduct.product_photos) && safeProduct.product_photos[0] && (
            <meta name="twitter:image" content={getImageUrl(safeProduct.product_photos[0])} />
          )}

          <script type="application/ld+json">
            {JSON.stringify({
              '@context': 'https://schema.org/',
              '@type': 'Product',
              name: safeProduct.product_name || 'Product',
              description: String(safeProduct.product_description || safeProduct.product_details || ''),
              sku: safeProduct.sku || String(safeProduct.id || ''),
              mpn: safeProduct.sku || String(safeProduct.id || ''),
              image: (Array.isArray(safeProduct.product_photos) ? safeProduct.product_photos.map((p) => getImageUrl(p)).filter(Boolean) : []).slice(0, 4),
              brand: { '@type': 'Brand', name: 'Yokebud Crafts' },
              offers: {
                '@type': 'Offer',
                priceCurrency: 'EUR',
                price: Number((safeProduct.discounted_price ?? safeProduct.price) || 0),
                availability: Number(remainingStock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: canonicalUrl
              },
              aggregateRating: (safeProduct.review_count || reviewSummary.review_count) > 0 ? {
                '@type': 'AggregateRating',
                ratingValue: Number((reviewSummary.avg_rating ?? safeProduct.rating) || 0),
                reviewCount: Number(safeProduct.review_count || reviewSummary.review_count || 0)
              } : undefined
            })}
          </script>
          <script type="application/ld+json">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: canonicalBase
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: String(safeProduct.category || 'Products') || 'Products',
                  item: `${canonicalBase}/`
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: safeProduct.product_name || 'Product',
                  item: canonicalUrl
                }
              ]
            })}
          </script>
        </Helmet>
        <svg width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
          <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#BF953F" />
            <stop offset="20%" stopColor="#FCF6BA" />
            <stop offset="40%" stopColor="#B38728" />
            <stop offset="60%" stopColor="#FBF5B7" />
            <stop offset="80%" stopColor="#AA771C" />
          </linearGradient>
        </svg>

        <style>{`
          .custom-scroll::-webkit-scrollbar { width: 5px; }
          .custom-scroll::-webkit-scrollbar-track { background: #111; }
          .custom-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
          .custom-scroll::-webkit-scrollbar-thumb:hover { background: #FFD700; }

          .modal-html-content {
            color: #ccc;
            line-height: 1.8;
            font-size: 1.05rem;
          }

          @media (max-width: 768px) {
            .modal-html-content {
              font-size: 0.95rem;
              line-height: 1.6;
            }
            .modal-html-content h1 { font-size: 1.5rem; }
            .modal-html-content h2 { font-size: 1.3rem; }
            .modal-html-content h3 { font-size: 1.1rem; }
          }
          
          .modal-html-content h1, .modal-html-content h2, .modal-html-content h3 {
            color: #fff;
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: 600;
          }

          .modal-html-content h1 { font-size: 1.8rem; }
          .modal-html-content h2 { font-size: 1.5rem; }
          .modal-html-content h3 { font-size: 1.3rem; }

          .modal-html-content p {
            margin-bottom: 15px;
          }

          .modal-html-content ul, .modal-html-content ol {
            margin-bottom: 15px;
            padding-left: 20px;
          }

          .modal-html-content li {
            margin-bottom: 5px;
          }

          .modal-html-content strong {
            color: #fff;
            font-weight: 700;
          }
          
          .modal-html-content a {
            color: #BF953F;
            text-decoration: underline;
          }
        `}</style>

        <motion.div
          ref={modalRef}
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          style={{
            backgroundColor: '#0a0a0a', 
            borderRadius: isMobile ? '0' : '12px',
            width: '100%', maxWidth: '1450px', 
            height: isMobile ? 'auto' : '90vh',
            minHeight: isMobile ? '100%' : 'auto',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            overflow: isMobile ? 'visible' : 'hidden', 
            position: 'relative', border: isMobile ? 'none' : '1px solid #333',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={handleClose} 
            style={{
              ...(isMobile 
                ? { position: 'fixed', top: 8, right: 8 } 
                : { position: 'absolute', top: '15px', right: '15px' }),
              zIndex: 100011,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #333',
              color: 'white',
              borderRadius: '50%',
              width: isMobile ? '44px' : '40px',
              height: isMobile ? '44px' : '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)'
            }}
          >
            <FiX size={20} />
          </button>

          {/* --- LEFT COLUMN: IMAGE GALLERY --- */}
          <div ref={imageContainerRef} style={{ 
              flex: isMobile ? 'none' : '0 0 55%', 
              width: isMobile ? '100%' : 'auto',
              aspectRatio: isMobile ? '1/1' : 'auto', 
              height: isMobile ? 'auto' : '100%',
              position: 'relative', backgroundColor: '#000', 
              display: 'flex', flexDirection: 'column', 
              borderRight: isMobile ? 'none' : '1px solid #222' 
            }} 
            onMouseEnter={() => setIsHoveringImage(true)} onMouseLeave={() => setIsHoveringImage(false)}>
              
             <div ref={imageRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isZoomed ? 'zoom-out' : 'zoom-in', minHeight: isMobile ? '400px' : '0' }} onClick={handleImageClick} onMouseMove={handleMouseMove}>
                <AnimatePresence mode='wait'>
                  {safeProduct.product_photos.length > 0 ? (
                    (() => {
                      const url = getImageUrl(safeProduct.product_photos[currentImageIndex]);
                      if (String(url).match(/\.mp4|\.webm|video\//i)) {
                        return (
                          <motion.video
                            key={currentImageIndex}
                            src={url}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            autoPlay
                            loop={!slideShowActive}
                            onEnded={() => {
                              if (slideShowActive) {
                                setCurrentImageIndex(prev => 
                                  prev === safeProduct.product_photos.length - 1 ? 0 : prev + 1
                                );
                              }
                            }}
                            muted
                            controls
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        );
                      }
                      return (
                        <motion.img 
                          key={currentImageIndex} 
                          src={url} 
                          alt={safeProduct.product_name} 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }} 
                          transition={{ duration: 0.3 }} 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: isZoomed ? 'scale-down' : 'contain', transform: isZoomed ? `scale(2)` : 'scale(1)', transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`, transition: 'transform 0.1s ease-out' }} 
                        />
                      );
                    })()
                  ) : (
                    <FiImage size={64} color="#333" />
                  )}
                </AnimatePresence>
                {!isZoomed && safeProduct.product_photos.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><FiChevronLeft size={24} /></button>
                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><FiChevronRight size={24} /></button>
                  </>
                )}
             </div>
             {safeProduct.product_photos.length > 1 && (
               <div style={{ padding: '15px', background: '#111', display: 'flex', gap: '10px', overflowX: 'auto', justifyContent: 'center' }}>
                 {safeProduct.product_photos.map((photo, idx) => (
                  <div key={idx} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); setSlideShowActive(false); setTimeout(() => setSlideShowActive(true), 10000); }} 
                     style={{ 
                       width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', 
                       background: currentImageIndex === idx ? `linear-gradient(#111, #111) padding-box, ${GOLD_GRADIENT_CSS} border-box` : 'transparent',
                       border: currentImageIndex === idx ? '2px solid transparent' : '2px solid transparent',
                       opacity: currentImageIndex === idx ? 1 : 0.6,
                       flexShrink: 0
                     }}>
                    {String(getImageUrl(photo)).match(/\.mp4|\.webm|video\//i) ? (
                      <video src={getImageUrl(photo)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={getImageUrl(photo)} alt={`${safeProduct.product_name} thumbnail ${idx+1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                 ))}
               </div>
             )}
          </div>

          {/* --- RIGHT COLUMN: DETAILS --- */}
          <div className="custom-scroll" style={{ 
              flex: 1, 
              padding: isMobile ? '20px' : '40px', 
              overflowY: isMobile ? 'visible' : 'auto', 
              display: 'flex', flexDirection: 'column', gap: '24px',
              position: isMobile ? 'static' : 'relative', 
              top: isMobile ? 'auto' : '4vh'
            }}>
              
            {/* Header */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '14px', ...textGradientStyle }}>
                  {safeProduct.category}
                </span>
                {safeProduct.stock > 0 ? (
                  <span style={{ color: '#2ecc71', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><FiCheck /> In Stock</span>
                ) : (
                  <span style={{ color: '#e74c3c', fontSize: '12px' }}>Out of Stock</span>
                )}
              </div>
              <h1 style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: '700', margin: '10px 0', color: '#fff', lineHeight: 1.2 }}>{safeProduct.product_name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex' }}>{[...Array(5)].map((_, i) => <FiStar key={i} style={{ stroke: svgGradientUrl, fill: i < Math.floor((reviewSummary.avg_rating ?? safeProduct.rating) || 0) ? svgGradientUrl : 'none' }} size={16} />)}</div>
                <span style={{ color: '#888', fontSize: '14px' }}>{Number(((reviewSummary.avg_rating ?? safeProduct.rating) || 0)).toFixed(1)} ({safeProduct.review_count} Reviews)</span>
              </div>
            </div>

            {/* Price rendering... */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: '700', ...textGradientStyle }}>{format(Number((safeProduct.discounted_price ?? safeProduct.price) || 0))}</span>
                {Number(safeProduct.price || 0) > 0 && Number((safeProduct.discounted_price ?? safeProduct.price) || 0) < Number(safeProduct.price || 0) && (
                  <>
                    <span style={{ fontSize: '15px', color: '#FF6B6B', textDecoration: 'line-through' }}>{format(Number(safeProduct.price || 0))}</span>
                    <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 700 }}>{`-${Math.round(((Number(safeProduct.price || 0) - Number((safeProduct.discounted_price ?? safeProduct.price) || 0)) / Number(safeProduct.price || 0)) * 100)}%`}</span>
                  </>
                )}
            </div>
            <div style={{ height: '1px', background: '#333', width: '100%' }} />

            {/* Quantity Selector */}
            <div>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '10px', fontSize: '14px' }}>Quantity</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #444', borderRadius: '8px', width: 'fit-content' }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ padding: '10px 15px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><FiMinus /></button>
                    <span style={{ width: '40px', textAlign: 'center', color: '#fff', fontWeight: '600' }}>{quantity}</span>
                    <button 
                      onClick={() => setQuantity(prev => remainingStock > 0 ? Math.min(prev + 1, remainingStock) : prev)} 
                      disabled={remainingStock <= 0 || quantity >= remainingStock}
                      style={{ padding: '10px 15px', background: 'transparent', border: 'none', color: (remainingStock <= 0 || quantity >= remainingStock) ? '#666' : '#fff', cursor: (remainingStock <= 0 || quantity >= remainingStock) ? 'not-allowed' : 'pointer' }}
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>
                    {(() => {
                      const usedCounts = new Map();
                      selections.forEach((s, i) => {
                        if (i === 0) return;
                        const k = `${s.color || ''}|${s.size || ''}`;
                        if (k !== '|' && (s.color || s.size)) usedCounts.set(k, (usedCounts.get(k) || 0) + 1);
                      });
                      const key = `${selections[0]?.color || ''}|${selections[0]?.size || ''}`;
                      const base = variantStockMap.size > 0 ? Number(variantStockMap.get(key) || 0) : Number(safeProduct.stock || 0);
                      const used = Number(usedCounts.get(key) || 0);
                      const avail = Math.max(0, base - used);
                      return (
                        <>
                          Stock: <span style={{ color: '#fff', fontWeight: 600 }}>{Number(safeProduct.stock || 0)}</span>
                          <span style={{ marginLeft: 8 }}>Available now: <span style={{ color: '#fff', fontWeight: 600 }}>{avail}</span></span>
                        </>
                      );
                    })()}
                  </div>
                </div>
            </div>

            {/* Dynamic Selection Loops */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selections.map((selection, index) => (
                  <div key={index} style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333', display: (safeProduct.colors.length > 0 || safeProduct.sizes.length > 0) ? 'block' : 'none' }}>
                    <div style={{ color: '#fff', fontSize: '12px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Item #{index + 1}</div>
                      
                    {safeProduct.colors && safeProduct.colors.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '13px' }}>
                                Color: <span style={{ fontWeight: '600', ...textGradientStyle }}>{getColorName(selection.color)}</span>
                            </label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {(safeProduct.colors || []).filter((color) => {
                                    if (variantStockMap.size === 0) return true;
                                    const usedCounts = new Map();
                                    selections.forEach((s, i2) => {
                                      if (i2 === index) return;
                                      const k2 = `${s.color || ''}|${s.size || ''}`;
                                      if (k2 !== '|' && (s.color || s.size)) usedCounts.set(k2, (usedCounts.get(k2) || 0) + 1);
                                    });
                                    const sizes = safeProduct.sizes?.length ? safeProduct.sizes : [''];
                                    const totalAvail = sizes.reduce((sum, sz) => {
                                      const key2 = `${color || ''}|${sz || ''}`;
                                      const base = Number(variantStockMap.get(key2) || 0);
                                      const used = Number(usedCounts.get(key2) || 0);
                                      return sum + Math.max(0, base - used);
                                    }, 0);
                                    return totalAvail > 0;
                                }).map((color) => {
                                    const isActive = selection.color === color;
                                    const colorCode = getColorCode(color);
                                    const colorName = getColorName(color);
                                    const usedCounts = new Map();
                                    selections.forEach((s, i2) => {
                                      if (i2 === index) return;
                                      const k2 = `${s.color || ''}|${s.size || ''}`;
                                      if (k2 !== '|' && (s.color || s.size)) usedCounts.set(k2, (usedCounts.get(k2) || 0) + 1);
                                    });
                                    const sizes = safeProduct.sizes?.length ? safeProduct.sizes : [''];
                                    const colorAvail = sizes.reduce((sum, sz) => {
                                      const key2 = `${color || ''}|${sz || ''}`;
                                      const base = Number(variantStockMap.get(key2) || 0);
                                      const used = Number(usedCounts.get(key2) || 0);
                                      return sum + Math.max(0, base - used);
                                    }, 0);
                                    const disabled = false;
                                    return (
                                        <button key={color} onClick={() => !disabled && handleSelectionChange(index, 'color', color)} disabled={disabled} style={{ padding: '6px 12px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', ...borderGradientStyle(isActive) }}>
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: colorCode, border: '1px solid #555' }}></span>
                                            {colorName}
                                            {variantStockMap.size > 0 ? (
                                              <span style={{ marginLeft: 8, fontSize: 11, color: '#FFD97A' }}>{colorAvail}</span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {safeProduct.sizes && safeProduct.sizes.length > 0 && (
                        <div>
                            <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '13px' }}>
                                Size: <span style={{ fontWeight: '600', ...textGradientStyle }}>{selection.size}</span>
                            </label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {safeProduct.sizes.filter((size) => {
                                    if (variantStockMap && variantStockMap.size > 0) {
                                      const usedCounts = new Map();
                                      selections.forEach((s, i2) => {
                                        if (i2 === index) return;
                                        const k2 = `${s.color || ''}|${s.size || ''}`;
                                        if (k2 !== '|' && (s.color || s.size)) usedCounts.set(k2, (usedCounts.get(k2) || 0) + 1);
                                      });
                                      const key = `${selection.color || ''}|${size}`;
                                      const base = Number(variantStockMap.get(key) || 0);
                                      const used = Number(usedCounts.get(key) || 0);
                                      const avail = Math.max(0, base - used);
                                      return avail > 0;
                                    }
                                    const hasVariants = Array.isArray(safeProduct.variants) && safeProduct.variants.length > 0;
                                    return !hasVariants;
                                }).map((size) => {
                                    const usedCounts = new Map();
                                    selections.forEach((s, i2) => {
                                      if (i2 === index) return;
                                      const k2 = `${s.color || ''}|${s.size || ''}`;
                                      if (k2 !== '|' && (s.color || s.size)) usedCounts.set(k2, (usedCounts.get(k2) || 0) + 1);
                                    });
                                    const key = `${selection.color || ''}|${size}`;
                                    const base = variantStockMap.size > 0 ? Number(variantStockMap.get(key) || 0) : null;
                                    const used = base != null ? Number(usedCounts.get(key) || 0) : 0;
                                    const avail = base != null ? Math.max(0, base - used) : null;
                                    const disabled = avail != null ? avail <= 0 : false;
                                    return (
                                        <button key={size} onClick={() => !disabled && handleSelectionChange(index, 'size', size)} disabled={disabled} style={{ width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontWeight: '600', fontSize: '12px', transition: 'all 0.2s', position: 'relative', ...borderGradientStyle(selection.size === size) }}>
                                            {size}
                                            <span style={{ position: 'absolute', bottom: -6, right: -6, fontSize: '10px', color: '#FFD97A' }}>{typeof avail === 'number' ? avail : ''}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                  </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleBuyNow} style={{ flex: 2, padding: '14px', background: GOLD_GRADIENT_CSS, border: 'none', color: '#000', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FiZap /> Buy Now
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAddToCart} style={{ flex: 1, padding: '14px', background: `linear-gradient(#0a0a0a, #0a0a0a) padding-box, ${GOLD_GRADIENT_CSS} border-box`, border: '1px solid transparent', color: '#fff', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{...textGradientStyle, display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <FiShoppingCart style={{ stroke: svgGradientUrl }} /> Add to Cart
                  </span>
                </motion.button>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={toggleWishlist} style={{ flex: 1, padding: '12px', background: '#222', border: 'none', color: '#ccc', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiHeart style={{ fill: isWishlisted ? 'red' : 'none' }} /> Wishlist
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleInquiry} style={{ flex: 1, padding: '12px', background: '#222', border: 'none', color: '#ccc', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiMessageCircle  /> Inquiry
                  </motion.button>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <motion.button ref={shareButtonRef} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowShareOptions(!showShareOptions)} style={{ width: '100%', padding: '12px', background: '#222', border: 'none', color: '#ccc', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <FiShare2 /> Share
                    </motion.button>
                    <AnimatePresence>
                      {showShareOptions && (
                        <motion.div
                          ref={shareMenuRef}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          style={{ position: 'absolute', right: 0, top: '110%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: 8, width: 240, zIndex: 10 }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button onClick={shareNative} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiShare2 /> Quick Share
                            </button>
                            <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiCopy /> Copy Link
                            </button>
                            <button onClick={shareEmail} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiMail /> Email
                            </button>
                            <button onClick={shareWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiMessageSquare /> WhatsApp
                            </button>
                            <button onClick={shareFacebook} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiFacebook /> Facebook
                            </button>
                            <button onClick={shareTwitter} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiTwitter /> Twitter
                            </button>
                            <button onClick={shareLinkedIn} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', borderRadius: 6 }}>
                              <FiLinkedin /> LinkedIn
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
              </div>
            </div>

            {/* Information Tabs */}
            <div style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '20px', overflowX: 'auto' }}>
                {['Description', 'Reviews','Shipping'].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === tab.toLowerCase() ? '2px solid transparent' : '2px solid transparent', borderImage: activeTab === tab.toLowerCase() ? `${GOLD_GRADIENT_CSS} 1` : 'none', color: '#888', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.3s', whiteSpace: 'nowrap' }}>
                      <span style={activeTab === tab.toLowerCase() ? textGradientStyle : {}}>{tab}</span>
                  </button>
                ))}
              </div>
               
              <div style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6', minHeight: '150px' }}>
                {activeTab === 'description' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div 
                      className="modal-html-content"
                      style={{ whiteSpace: 'normal' }}
                      dangerouslySetInnerHTML={{ __html: safeProduct.product_description || safeProduct.product_details || "Experience the finest craftsmanship with this handmade piece." }}
                    />
                    {safeProduct.features.length > 0 && (
                      <ul style={{ marginTop: '15px', paddingLeft: '20px' }}>
                        {safeProduct.features.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    )}
                  </motion.div>
                )}
                {activeTab === 'shipping' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p><strong>Processing Time:</strong> 1-3 business days for ready-to-ship items.</p>
                    <p style={{ marginTop: '10px' }}><strong>Estimated Delivery:</strong></p>
                    <ul><li>USA & Canada: 5-10 Days</li><li>Europe: 3-7 Days</li></ul>
                  </motion.div>
                )}
                {activeTab === 'reviews' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                      <div style={{ fontSize: '36px', fontWeight: 'bold', ...textGradientStyle }}>{Number(((reviewSummary.avg_rating ?? safeProduct.rating) || 0)).toFixed(1)}</div>
                      <div>
                        <div style={{ display: 'flex' }}>{[...Array(5)].map((_, i) => <FiStar key={i} style={{ stroke: svgGradientUrl, fill: i < Math.floor((reviewSummary.avg_rating ?? safeProduct.rating) || 0) ? svgGradientUrl : 'none' }} size={14} />)}</div>
                        <div style={{ color: '#888', fontSize: '12px' }}>Based on {(reviewSummary.review_count ?? safeProduct.review_count) || 0} reviews</div>
                      </div>
                    </div>
                      
                    {reviews.length === 0 ? (
                      <div style={{ padding: '15px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', marginBottom: '25px', color: '#ccc' }}>
                        No reviews yet
                      </div>
                    ) : (
                      reviews.map((rev, idx) => (
                        <div key={idx} style={{ padding: '15px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', marginBottom: '25px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {rev.reviewer_photo_url ? (
                              <img src={rev.reviewer_photo_url} alt={rev.reviewer_name || "Reviewer"} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #333' }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2a2a2a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                                {(() => {
                                  const nm = rev.reviewer_name || '';
                                  let initial = (nm.startsWith('Guest-') ? nm.split('Guest-')[1]?.[0] : nm[0]) || 'G';
                                  if (!initial && rev.google_uid && String(rev.google_uid).startsWith('anon-')) {
                                    initial = String(rev.google_uid).replace(/[^a-z0-9]/gi, '').slice(-4)[0] || 'G';
                                  }
                                  return String(initial).toUpperCase();
                                })()}
                              </div>
                            )}
                            <strong style={{ color: '#fff' }}>{rev.reviewer_name || 'Anonymous'}</strong>
                          </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ color: '#666', fontSize: '12px' }}>{new Date(rev.created_at).toLocaleDateString()}</span>
                              {(() => {
                                const uid = auth?.currentUser?.uid || null;
                                const isGuest = String(rev.google_uid || '').startsWith('anon-');
                                const match = uid && rev.google_uid === uid && !isGuest;
                                return match;
                              })() && null}
                            </div>
                          </div>
                           {(() => {
                            const first = (reviews || []).find(r => r.is_first_review && ((rev.google_uid && r.google_uid === rev.google_uid) || (rev.user_id && r.user_id === rev.user_id)));
                            const displayRating = typeof rev.rating === 'number' ? Number(rev.rating) : (first && typeof first.rating === 'number' ? Number(first.rating) : 0);
                            return (
                              <div style={{ display: 'flex', marginBottom: '8px' }}>{[...Array(5)].map((_, i) => <FiStar key={i} style={{ stroke: svgGradientUrl, fill: i < Math.floor(displayRating) ? svgGradientUrl : 'none' }} size={12} />)}</div>
                            );
                          })()}
                          {rev.title ? (<div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{rev.title}</div>) : null}
                          <p style={{ margin: 0, color: '#ccc' }}>{rev.review_text || ''}</p>
                          {(() => {
                            let media = [];
                            try { media = rev.media_json ? JSON.parse(rev.media_json) : []; } catch { media = []; }
                            if (!Array.isArray(media) || media.length === 0) return null;
                            return (
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {media.map((url, i) => (
                                  <div key={i} style={{ width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid #444', cursor: 'pointer' }} onClick={() => openViewer(url)}>
                                    {String(url).match(/\.mp4|\.webm|video\//i) ? (
                                      <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                                    ) : (
                                      <img src={url} alt="Product review image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ))
                    )}

                    

                  </motion.div>
                )}
              </div>
            </div>

            {/* Related Products Section */}
            {finalRelatedProducts.length > 0 && (
              <div style={{ marginTop: '40px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '15px' }}>You Might Also Like</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {finalRelatedProducts.map((rp) => (
                    <div
                      key={rp.id}
                      onClick={() => handleRelatedProductClick(rp)}
                      style={{ cursor: 'pointer', background: '#1a1a1a', borderRadius: '8px', padding: '10px', border: '1px solid #333' }}
                    >
                      <div style={{ aspectRatio: '1/1', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                        <img
                          src={(Array.isArray(rp.product_photos) ? rp.product_photos : processProductPhotos(rp.product_photos || []))[0] || ''}
                          alt={rp.product_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
                        {rp.product_name}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', ...textGradientStyle }}>
                        {format(rp.discounted_price || rp.price || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <ToastContainer position="bottom-right" theme="dark" />
        <AnimatePresence>
          {showLoginPopup && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoginForm onClose={() => setShowLoginPopup(false)} onSuccess={() => { setShowLoginPopup(false); toggleWishlist(); }} isMobile={windowWidth < 480} />
            </motion.div>
          )}
          {viewer.open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeViewer}>
              <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, overflow: 'hidden', border: '1px solid #333' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); closeViewer(); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid #555', color: '#fff', borderRadius: '50%', width: 28, height: 28, fontSize: 18, lineHeight: '24px', cursor: 'pointer', zIndex: 2 }}>×</button>
                {viewer.type === 'video' ? (
                  <video src={viewer.url} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', zIndex: 1 }} />
                ) : (
                  <img src={viewer.url} alt="Product image viewer" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', zIndex: 1 }} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductModal;
