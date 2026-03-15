import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiTrash2, FiPlus, FiImage, FiCopy, FiSearch, FiPackage } from 'react-icons/fi';
import { apiFetch } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Helmet } from "react-helmet-async";
import ProtectedRoute from '../../components/ProtectedRoute';

// --- Modern Loading Spinner (Updated for flex center) ---
const LoadingSpinner = () => (
  <div style={{ 
    height: '100%', 
    width: '100%', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'column',
    gap: '15px',
    flex: 1
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
      style={{ color: '#a1a1aa', fontSize: '0.9rem', letterSpacing: '0.05em' }}
    >
      Loading Inventory...
    </motion.span>
  </div>
);

const AdminProducts = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [expandedStocks, setExpandedStocks] = useState({});
  const [variantsCache, setVariantsCache] = useState({});
  
  const navigate = useNavigate();

  // --- Helpers ---
  const getCategoryColor = (category) => {
    const colors = {
      'Men': 'rgba(52, 152, 219, 0.15)',
      'Women': 'rgba(155, 89, 182, 0.15)',
      'Kids': 'rgba(46, 204, 113, 0.15)',
      'Accessories': 'rgba(241, 196, 15, 0.15)',
      'New Arrivals': 'rgba(231, 76, 60, 0.15)',
      'Best Sellers': 'rgba(230, 126, 34, 0.15)',
      'SALE': 'rgba(39, 174, 96, 0.15)',
      'Customizeable': 'rgba(44, 62, 80, 0.15)'
    };
    return colors[category] || 'rgba(255, 255, 255, 0.1)';
  };

  const getCategoryTextColor = (category) => {
    const colors = {
      'Men': '#5dade2',
      'Women': '#af7ac5',
      'Kids': '#58d68d',
      'Accessories': '#f4d03f',
      'New Arrivals': '#ec7063',
      'Best Sellers': '#f0b27a',
      'SALE': '#45b39d',
      'Customizeable': '#85929e'
    };
    return colors[category] || '#bdc3c7';
  };

  // Force EUR display in admin; amounts are already stored/entered in EUR
  const formatEUR = (amount) => {
    const n = Number(amount || 0);
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
  };

  // --- Effects ---
  useEffect(() => {
    const savedSearchTerm = localStorage.getItem('adminProductsSearch');
    if (savedSearchTerm) setSearchTerm(savedSearchTerm);
  }, []);

  useEffect(() => {
    localStorage.setItem('adminProductsSearch', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const handleContext = (e) => { e.preventDefault(); setShowToast(true); setTimeout(() => setShowToast(false), 3000); };
    const handleKeys = (e) => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault(); setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      }
    };
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('keydown', handleKeys);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKeys);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      
      const processedData = data.map(product => {
        let photos = [];
        try {
          photos = typeof product.product_photos === 'string' ? JSON.parse(product.product_photos) : product.product_photos;
        } catch (e) { photos = []; }
        
        let categories = [];
        if (product.category) {
            if (Array.isArray(product.category)) {
                categories = product.category;
            } else if (typeof product.category === 'string') {
                try {
                    const parsed = JSON.parse(product.category);
                    categories = Array.isArray(parsed) ? parsed : [product.category];
                } catch {
                    categories = product.category.includes(',') ? product.category.split(',').map(c => c.trim()) : [product.category];
                }
            }
        }

        return {
          ...product,
          price: Number(product.price || 0),
          discounted_price: product.discounted_price ? Number(product.discounted_price) : null,
          stock: Number(product.stock || 0),
          firstImage: Array.isArray(photos) && photos.length > 0 ? photos[0] : null,
          allImages: photos || [],
          categories: categories.filter(c => c && c.trim() !== '')
        };
      });
      
      setProducts(processedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(product =>
      product.product_name.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      (product.categories && product.categories.some(cat => cat.toLowerCase().includes(term)))
    );
  }, [products, searchTerm]);

  // --- Handlers ---
  const handleDelete = (productId) => {
    toast.warn(
      <div style={{ padding: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Delete this product permanently?</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { confirmDelete(productId); toast.dismiss(); }} style={styles.confirmBtn}>Yes, Delete</button>
          <button onClick={() => toast.dismiss()} style={styles.cancelBtn}>Cancel</button>
        </div>
      </div>,
      { autoClose: false, closeButton: false, icon: false, style: { background: '#1e1e1e', border: '1px solid #333' } }
    );
  };

  const confirmDelete = async (productId) => {
    try {
      const response = await apiFetch(`/api/products/${productId}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Delete failed');
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Product deleted successfully');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStock = async (product) => {
    const pid = product.id;
    const next = { ...expandedStocks, [pid]: !expandedStocks[pid] };
    setExpandedStocks(next);
    if (!variantsCache[pid] && !expandedStocks[pid]) {
      try {
        const res = await apiFetch(`/api/products/${pid}`);
        if (!res.ok) return;
        const data = await res.json();
        const v = Array.isArray(data?.variants) ? data.variants : (Array.isArray(data?.product_variants) ? data.product_variants : []);
        setVariantsCache((prev) => ({ ...prev, [pid]: v }));
      } catch {}
    }
  };

  const handleDuplicate = (productId) => {
    toast.info(
      <div style={{ padding: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Duplicate this product?</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { confirmDuplicate(productId); toast.dismiss(); }} style={{...styles.confirmBtn, background: '#4CAF50', color: '#fff'}}>Yes, Duplicate</button>
          <button onClick={() => toast.dismiss()} style={styles.cancelBtn}>Cancel</button>
        </div>
      </div>,
      { autoClose: false, closeButton: false, icon: false, style: { background: '#1e1e1e', border: '1px solid #333' } }
    );
  };

  const confirmDuplicate = async (productId) => {
    try {
      setDuplicatingId(productId);
      let original = products.find(p => p.id === productId);
      try {
        const res = await apiFetch(`/api/products/${productId}`);
        if (res.ok) {
          original = await res.json();
        }
      } catch (e) {
      }
      if (!original) throw new Error('Product not found');

      const newSku = `${original.sku || 'SKU'}-COPY-${Date.now()}`;
      const payload = {
        name: 'New Product',
        description: original.product_description || original.product_details || '',
        price: Number(original.price || 0),
        discounted_price: original.discounted_price != null ? Number(original.discounted_price) : null,
        categories: Array.isArray(original.categories) ? original.categories : (original.category ? [original.category] : []),
        stock: Number(original.stock || 0),
        moq: original.moq || null,
        material: original.material || (original.attributes && original.attributes.material) || '',
        care: original.care_instructions || (original.attributes && original.attributes.care) || '',
        sku: newSku,
        shipping: (original.metadata && original.metadata.shipping) || original.shipping_info || '',
        warranty: (original.metadata && original.metadata.warranty) || original.warranty || '',
        bulk_discount: (original.metadata && original.metadata.bulk_discount) || original.bulk_discount || '',
        sizes: [],
        colors: [],
        tags: [],
        features: [],
        imageUrls: Array.isArray(original.allImages) ? original.allImages 
          : (Array.isArray(original.product_photos) ? original.product_photos 
            : (Array.isArray(original.images) ? original.images : [])),
      };

      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Duplicate failed');
      }

      const result = await response.json();

      if (!result?.success || !result?.productId) {
        throw new Error(result?.message || 'Duplicate failed');
      }

      const newId = result.productId;
      const getRes = await apiFetch(`/api/products/${newId}`);
      if (!getRes.ok) throw new Error('Failed to load duplicated product');
      const newProduct = await getRes.json();

      const photos = Array.isArray(newProduct.product_photos)
        ? newProduct.product_photos
        : Array.isArray(newProduct.images)
          ? newProduct.images
          : [];
      const categories = Array.isArray(newProduct.categories)
        ? newProduct.categories
        : (newProduct.category ? [newProduct.category] : []);

      const processed = {
        ...newProduct,
        price: Number(newProduct.price || 0),
        discounted_price: newProduct.discounted_price != null ? Number(newProduct.discounted_price) : null,
        stock: Number(newProduct.stock || 0),
        categories: categories.filter(c => c && String(c).trim() !== ''),
        firstImage: Array.isArray(photos) && photos.length > 0 ? photos[0] : null,
        allImages: Array.isArray(photos) ? photos : []
      };

      setProducts(prev => [processed, ...prev]);

      toast.success('Product duplicated successfully');
      navigate(`/admin/products/edit/${newId}`);
    } catch (err) {
      toast.error(err.message || 'Duplicate failed');
    } finally {
      setDuplicatingId(null);
    }
  };

  // --- Styles ---
  const styles = {
    container: {
      height: '100vh',        // Fixed height
      width: '100%',
      backgroundColor: '#050505',
      color: '#e0e0e0',
      fontFamily: "'Poppins', sans-serif",
      overflow: 'hidden',     // Prevent full page scroll
      boxSizing: 'border-box',
      display: 'flex',        // Flex container
      flexDirection: 'column'
    },
    mainContent: {
      width: '100%',
      padding: isMobile ? '15px' : '30px',
      background: 'radial-gradient(circle at top right, #1a1a1a 0%, #050505 100%)',
      height: '100%',         // Fill container
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',     // Prevent scroll on main content
    },
    header: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      marginBottom: '20px',
      gap: '20px',
      width: '100%',
      flexShrink: 0,          // Prevent header from shrinking
    },
    titleGroup: {
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      fontSize: isMobile ? '1.5rem' : '2rem',
      fontWeight: '700',
      background: 'linear-gradient(90deg, #fff, #999)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      margin: 0,
      letterSpacing: '-0.5px',
    },
    subtitle: {
      fontSize: '0.9rem',
      color: '#666',
      marginTop: '5px',
    },
    controls: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: '15px',
      width: isMobile ? '100%' : 'auto',
      alignItems: 'center',
    },
    searchContainer: {
      position: 'relative',
      width: isMobile ? '100%' : '300px',
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#666',
    },
    input: {
      width: '100%',
      padding: '12px 12px 12px 40px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#fff',
      outline: 'none',
      fontSize: '0.9rem',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box',
    },
    addButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
      border: 'none',
      padding: '0 24px',
      borderRadius: '12px',
      color: '#000',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 15px rgba(255, 165, 0, 0.3)',
      whiteSpace: 'nowrap',
      height: '45px',
      width: isMobile ? '100%' : 'auto',
    },
    
    // Table Styles (Modified for internal scrolling)
    tableCard: {
      background: 'rgba(20, 20, 20, 0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      width: '100%',
      display: 'flex',        // Use flexbox
      flexDirection: 'column',// Stack children vertically
      flex: 1,                // Take remaining height
      minHeight: 0,           // Important for nested flex scroll
    },
    tableWrapper: {
      width: '100%',
      overflow: 'auto',       // Scroll happens here
      flex: 1,                // Fill tableCard height
      WebkitOverflowScrolling: 'touch',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: isMobile ? '100%' : '1000px',
    },
    th: {
      textAlign: 'center',
      padding: isMobile ? '14px 16px' : '18px 24px',
      background: '#111',     // Opaque background for sticky header
      color: '#888',
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      fontWeight: '600',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      whiteSpace: 'nowrap',
      position: 'sticky',     // Make header sticky
      top: 0,
      zIndex: 10,
    },
    td: {
      padding: isMobile ? '12px 16px' : '16px 24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
      verticalAlign: 'middle',
      fontSize: '0.95rem',
      textAlign: 'center',
      color: '#ddd',
    },
    
    // New Column Styles
    idCell: {
      color: '#666',
      fontWeight: '600',
      fontSize: '0.85rem',
      textAlign: 'center',
      width: '60px',
    },
    
    // Product Cell Styles
    productCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
    },
    imgBox: {
      width: '100px',
      height: '100px',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#222',
      flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.1)',
    },
    img: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    productInfo: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: '0',
    },
    productName: {
      fontWeight: '500',
      color: '#fff',
      marginBottom: '4px',
      whiteSpace: 'nowrap',
      textAlign: 'left',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: isMobile ? '150px' : '220px',
    },
    productSku: {
      fontSize: '0.75rem',
      color: '#666',
      textAlign:'left'
    },
    
    // Category Pills
    catPill: (cat) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '50px',
      fontSize: '0.7rem',
      background: getCategoryColor(cat),
      color: getCategoryTextColor(cat),
      marginRight: '6px',
      marginBottom: '4px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    }),

    // Price Styling
    priceTag: {
      fontWeight: '600',
      color: '#fff',
      fontSize: '1rem',
    },
    discountTag: {
      fontSize: '0.8rem',
      color: '#FF6B6B',
      textDecoration: 'line-through',
      marginLeft: '8px',
    },
    
    // Status Badge
    statusBadge: (stock) => {
      let bg = 'rgba(46, 204, 113, 0.15)';
      let col = '#2ecc71';
      
      if (stock === 0) { bg = 'rgba(231, 76, 60, 0.15)'; col = '#e74c3c'; }
      else if (stock < 10) { bg = 'rgba(241, 196, 15, 0.15)'; col = '#f1c40f'; }
      
      return {
        background: bg,
        color: col,
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
      };
    },

    // Actions
    actionGroup: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
    },
    actionBtn: (type) => {
       const colors = {
           edit: { bg: 'rgba(52, 152, 219, 0.1)', color: '#3498db', hover: 'rgba(52, 152, 219, 0.2)' },
           dup: { bg: 'rgba(155, 89, 182, 0.1)', color: '#9b59b6', hover: 'rgba(155, 89, 182, 0.2)' },
           del: { bg: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', hover: 'rgba(231, 76, 60, 0.2)' },
       };
       const c = colors[type];
       return {
           width: '32px',
           height: '32px',
           borderRadius: '8px',
           border: 'none',
           background: c.bg,
           color: c.color,
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           cursor: 'pointer',
           transition: 'all 0.2s',
       };
    },
    
    // Toast Buttons
    confirmBtn: { padding: '6px 16px', borderRadius: '4px', border: 'none', background: '#F44336', color: '#fff', cursor: 'pointer', fontSize: '13px' },
    cancelBtn: { padding: '6px 16px', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '13px' }
  };

  const mobileStyles = {
    list: { 
      display: 'flex',         // Use flex for mobile list
      flexDirection: 'column', 
      gap: '12px', 
      padding: '12px',
      overflowY: 'auto',       // Enable scroll
      flex: 1,                 // Fill space
    },
    card: { background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
    head: { display: 'flex', gap: '12px', alignItems: 'center' },
    imgBox: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: '#222', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    info: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
    name: { color: '#fff', fontWeight: 600, fontSize: '0.95rem' },
    sku: { color: '#777', fontSize: '0.75rem' },
    cats: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    priceRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    stockRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    actions: { display: 'flex', gap: '12px', justifyContent: 'flex-end' }
  };

  return (
    <ProtectedRoute>
      <div style={styles.container}>
        <Helmet>
          <title>Products | Admin Dashboard</title>
        </Helmet>

        {showToast && (
          <div className="toast-restricted">
             <span>⚠️ Action Restricted</span>
          </div>
        )}
        
        <ToastContainer theme="dark" position="bottom-right" />

        <main style={styles.mainContent}>
          <header style={styles.header}>
            <div style={styles.titleGroup}>
               <motion.h1 style={styles.title} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>Products</motion.h1>
               <span style={styles.subtitle}>Manage your inventory and prices</span>
            </div>
            
            <div style={styles.controls}>
              <div style={styles.searchContainer}>
                 <FiSearch style={styles.searchIcon} />
                 <input 
                   type="text" 
                   placeholder="Search..." 
                   style={styles.input}
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
              <motion.button 
                style={styles.addButton}
                whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(255, 165, 0, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/admin/upload')}
              >
                <FiPlus size={18} /> <span>Add Product</span>
              </motion.button>
            </div>
          </header>

          <motion.div 
            style={styles.tableCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
             {loading ? (
                <LoadingSpinner />
             ) : error ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#F44336' }}>Error: {error}</div>
             ) : (
               isMobile ? (
                 <div style={mobileStyles.list}>
                   {filteredProducts.map((product) => (
                     <div key={product.id} style={mobileStyles.card}>
                       <div style={mobileStyles.head}>
                         <div style={mobileStyles.imgBox}>
                           {product.firstImage ? (
                             <img src={product.firstImage} alt={product.product_name || "Product image"} style={mobileStyles.img} loading="lazy" />
                           ) : (
                             <div style={{display:'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',color:'#444'}}><FiImage /></div>
                           )}
                         </div>
                         <div style={mobileStyles.info}>
                           <div style={mobileStyles.name} title={product.product_name}>{product.product_name}</div>
                           <div style={mobileStyles.sku}>{product.sku || 'NO SKU'}</div>
                           <div style={mobileStyles.cats}>
                             {product.categories.slice(0,3).map((cat,i)=> (
                               <span key={i} style={styles.catPill(cat)}>{cat}</span>
                             ))}
                             {product.categories.length > 3 && <span style={{fontSize:'0.7rem', color:'#666'}}>+{product.categories.length - 3}</span>}
                           </div>
                         </div>
                       </div>
                       <div style={mobileStyles.priceRow}>
                         <span style={styles.priceTag}>{formatEUR(Number((product.discounted_price ?? product.price) || 0))}</span>
                         {product.discounted_price && product.discounted_price < product.price && (
                           <span style={styles.discountTag}>{formatEUR(Number(product.price || 0))}</span>
                         )}
                       </div>
                     <div style={mobileStyles.stockRow}>
                       <div style={styles.statusBadge(product.stock)}>
                         <div style={{width: '6px', height:'6px', borderRadius:'50%', background:'currentColor'}}></div>
                         {product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock'}
                         <span style={{opacity: 0.6, fontWeight: 400, marginLeft: '4px'}}>({product.stock})</span>
                       </div>
                       <div style={mobileStyles.actions}>
                           <motion.button 
                             style={styles.actionBtn('edit')} 
                             whileHover={{ scale: 1.05, background: 'rgba(52, 152, 219, 0.2)' }}
                             title="Edit"
                             onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                           >
                             <FiEdit2 size={16} />
                           </motion.button>
                           <motion.button 
                             style={{
                               ...styles.actionBtn('dup'),
                               opacity: duplicatingId === product.id ? 0.6 : 1,
                               cursor: duplicatingId === product.id ? 'wait' : 'pointer'
                             }} 
                             whileHover={{ scale: 1.05, background: 'rgba(155, 89, 182, 0.2)' }}
                             title={duplicatingId === product.id ? 'Duplicating...' : 'Duplicate'}
                             disabled={duplicatingId === product.id}
                             onClick={() => handleDuplicate(product.id)}
                           >
                             {duplicatingId === product.id ? (
                               <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#9b59b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                             ) : (
                               <FiCopy size={16} />
                             )}
                           </motion.button>
                           <motion.button 
                             style={styles.actionBtn('del')} 
                             whileHover={{ scale: 1.05, background: 'rgba(231, 76, 60, 0.2)' }}
                             title="Delete"
                             onClick={() => handleDelete(product.id)}
                           >
                             <FiTrash2 size={16} />
                           </motion.button>
                         </div>
                       </div>
                       <div style={{ marginTop: 10 }}>
                         <button onClick={() => toggleStock(product)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a2a', background: '#111', color: '#ccc' }}>{expandedStocks[product.id] ? 'Hide Stock' : 'View Stock'}</button>
                         {expandedStocks[product.id] && (
                           <div style={{ marginTop: 10 }}>
                             {(() => {
                               const variants = Array.isArray(variantsCache[product.id]) ? variantsCache[product.id] : [];
                               const byColor = new Map();
                               variants.forEach((v) => {
                                 const c = v.color || '';
                                 const s = v.size || '';
                                 const q = Number(v.quantity || 0);
                                 if (!byColor.has(c)) byColor.set(c, new Map());
                                 const m = byColor.get(c);
                                 m.set(s, (m.get(s) || 0) + q);
                               });
                               const colors = Array.from(byColor.keys());
                               if (colors.length === 0) return <div style={{ color: '#888', marginTop: 6 }}>No variant stock data</div>;
                               return (
                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                   {colors.map((c) => {
                                     const sizesMap = byColor.get(c);
                                     const sizes = Array.from(sizesMap.keys());
                                     const total = Array.from(sizesMap.values()).reduce((a,b)=>a+b,0);
                                     return (
                                       <div key={c} style={{ border: '1px solid #2a2a2a', borderRadius: 8, padding: 8, minWidth: 180 }}>
                                         <div style={{ color: '#ccc', marginBottom: 6, fontWeight: 600 }}>{c || '—'} <span style={{ color: '#777', fontWeight: 400 }}>({total})</span></div>
                                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                           {sizes.map((s) => (
                                             <div key={s} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#ddd' }}>
                                               {s || '—'}: <span style={{ color: '#FFD97A', fontWeight: 700 }}>{sizesMap.get(s)}</span>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     );
                                   })}
                                 </div>
                               );
                             })()}
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                   {filteredProducts.length === 0 && !loading && (
                     <div style={{padding: '40px', textAlign: 'center', color: '#666'}}>
                       <FiPackage size={32} style={{marginBottom: '10px', opacity: 0.5}} />
                       <p>No products found</p>
                     </div>
                   )}
                 </div>
               ) : (
                 <div style={styles.tableWrapper}>
                 <table style={styles.table}>
                   <thead>
                     <tr>
                       <th style={{...styles.th, width: '60px', textAlign: 'center'}}>#</th>
                       <th style={styles.th}>Product</th>
                       <th style={styles.th}>Categories</th>
                       <th style={styles.th}>Price</th>
                       <th style={styles.th}>Stock Status</th>
                       <th style={styles.th}>Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filteredProducts.map((product, index) => (
                       <React.Fragment key={product.id}>
                       <tr className="product-row">
                         <td style={{...styles.td, ...styles.idCell}}>
                           {index + 1}
                         </td>
                         <td style={styles.td}>
                            <div style={styles.productCell}>
                               <div style={styles.imgBox}>
                                  {product.firstImage ? (
                                    <img src={product.firstImage} alt={product.product_name || "Product image"} style={styles.img} onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex'}} loading="lazy" />
                                  ) : null}
                                  <div style={{display: product.firstImage ? 'none' : 'flex', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', color:'#444'}}>
                                     <FiImage />
                                  </div>
                               </div>
                               <div style={styles.productInfo}>
                                  <span style={styles.productName} title={product.product_name}>
                                     {product.product_name}
                                  </span>
                                  <span style={styles.productSku}>{product.sku || 'NO SKU'}</span>
                               </div>
                            </div>
                         </td>
                         <td style={styles.td}>
                            <div style={{maxWidth: '200px'}}>
                              {product.categories.length > 0 ? product.categories.slice(0, 3).map((cat, i) => (
                                 <span key={i} style={styles.catPill(cat)}>{cat}</span>
                              )) : <span style={{color:'#444', fontSize:'0.8rem'}}>Uncategorized</span>}
                              {product.categories.length > 3 && <span style={{fontSize:'0.7rem', color:'#666'}}>+{product.categories.length - 3}</span>}
                            </div>
                         </td>
                         <td style={styles.td}>
                            <div>
                               <span style={styles.priceTag}>{formatEUR(Number((product.discounted_price ?? product.price) || 0))}</span>
                               {product.discounted_price && product.discounted_price < product.price && (
                                  <span style={styles.discountTag}>{formatEUR(Number(product.price || 0))}</span>
                               )}
                            </div>
                         </td>
                         <td style={styles.td}>
                            <div style={styles.statusBadge(product.stock)}>
                               <div style={{width: '6px', height:'6px', borderRadius:'50%', background:'currentColor'}}></div>
                               {product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock'}
                               <span style={{opacity: 0.6, fontWeight: 400, marginLeft: '4px'}}>({product.stock})</span>
                            </div>
                         </td>
                         <td style={styles.td}>
                            <div style={styles.actionGroup}>
                               <motion.button 
                                 style={styles.actionBtn('edit')} 
                                 whileHover={{ scale: 1.1, background: 'rgba(52, 152, 219, 0.2)' }}
                                 title="Edit"
                                 onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                               >
                                 <FiEdit2 size={16} />
                               </motion.button>
                               <motion.button 
                                 style={styles.actionBtn('dup')} 
                                 whileHover={{ scale: 1.1, background: 'rgba(52, 152, 219, 0.2)' }}
                                 title={expandedStocks[product.id] ? 'Hide Stock' : 'View Stock'}
                                 onClick={() => toggleStock(product)}
                               >
                                 <FiSearch size={16} />
                               </motion.button>
                               <motion.button 
                                 style={{
                                   ...styles.actionBtn('dup'),
                                   opacity: duplicatingId === product.id ? 0.6 : 1,
                                   cursor: duplicatingId === product.id ? 'wait' : 'pointer'
                                 }} 
                                 whileHover={{ scale: 1.1, background: 'rgba(155, 89, 182, 0.2)' }}
                                 title={duplicatingId === product.id ? 'Duplicating...' : 'Duplicate'}
                                 disabled={duplicatingId === product.id}
                                 onClick={() => handleDuplicate(product.id)}
                               >
                                  {duplicatingId === product.id ? (
                                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#9b59b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                  ) : (
                                    <FiCopy size={16} />
                                  )}
                               </motion.button>
                               <motion.button 
                                 style={styles.actionBtn('del')} 
                                 whileHover={{ scale: 1.1, background: 'rgba(231, 76, 60, 0.2)' }}
                                 title="Delete"
                                 onClick={() => handleDelete(product.id)}
                               >
                                  <FiTrash2 size={16} />
                               </motion.button>
                            </div>
                         </td>
                       </tr>
                       {expandedStocks[product.id] && (
                         <tr>
                           <td colSpan="6" style={{ ...styles.td, textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}>
                             {(() => {
                               const variants = Array.isArray(variantsCache[product.id]) ? variantsCache[product.id] : [];
                               const byColor = new Map();
                               variants.forEach((v) => {
                                 const c = v.color || '';
                                 const s = v.size || '';
                                 const q = Number(v.quantity || 0);
                                 if (!byColor.has(c)) byColor.set(c, new Map());
                                 const m = byColor.get(c);
                                 m.set(s, (m.get(s) || 0) + q);
                               });
                               const colors = Array.from(byColor.keys());
                               if (colors.length === 0) {
                                 return <div style={{ color: '#888' }}>No variant stock data</div>;
                               }
                               return (
                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                   {colors.map((c) => {
                                     const sizesMap = byColor.get(c);
                                     const sizes = Array.from(sizesMap.keys());
                                     const total = Array.from(sizesMap.values()).reduce((a,b)=>a+b,0);
                                     return (
                                       <div key={c} style={{ border: '1px solid #2a2a2a', borderRadius: 8, padding: 10, minWidth: 220 }}>
                                         <div style={{ color: '#ccc', marginBottom: 8, fontWeight: 600 }}>{c || '—'} <span style={{ color: '#777', fontWeight: 400 }}>({total})</span></div>
                                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                           {sizes.map((s) => (
                                             <div key={s} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#ddd' }}>
                                               {s || '—'}: <span style={{ color: '#FFD97A', fontWeight: 700 }}>{sizesMap.get(s)}</span>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     );
                                   })}
                                 </div>
                               );
                             })()}
                           </td>
                         </tr>
                       )}
                       </React.Fragment>
                     ))}
                     {filteredProducts.length === 0 && !loading && (
                       <tr>
                         <td colSpan="6" style={{padding: '60px', textAlign: 'center', color: '#666'}}>
                            <FiPackage size={40} style={{marginBottom: '10px', opacity: 0.5}} />
                            <p>No products found matching "{searchTerm}"</p>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
               )
            )}
          </motion.div>
        </main>
        
        <style>{`
           .product-row { transition: background 0.2s ease; }
           .product-row:hover { background: rgba(255, 255, 255, 0.03); }
           
           .toast-restricted {
             position: fixed; bottom: 30px; right: 30px;
             background: #000; color: #ff4757;
             padding: 12px 20px; border-radius: 8px;
             border-left: 4px solid #ff4757;
             box-shadow: 0 10px 30px rgba(0,0,0,0.5);
             z-index: 9999; animation: slideIn 0.3s ease;
           }
           @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
           
           ::-webkit-scrollbar { width: 6px; height: 6px; }
           ::-webkit-scrollbar-track { background: #050505; }
           ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
           ::-webkit-scrollbar-thumb:hover { background: #555; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
};

export default AdminProducts;