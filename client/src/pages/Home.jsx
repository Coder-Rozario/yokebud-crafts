import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Added useNavigate explicitly just in case
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FiHeart, FiShoppingCart, FiCheck, FiArrowRight, FiSearch, FiArrowLeft } from 'react-icons/fi';
import { FaTshirt, FaGem, FaFire, FaStar } from 'react-icons/fa';
const ProductModal = React.lazy(() => import('../components/ProductModal'));
import LoadingAnimation from '../components/LoadingAnimation';
import coverVideo from '../assades/Cover Video-compressed.mp4';
import bglogoimg from '../assades/bglogo.png'; 
import { useCart } from '../pages/context/CartContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Helmet } from "react-helmet-async";
import { apiFetch, absoluteUrl } from '../utils/api';
import { LoginForm } from '../components/Inquiry';
import { useLocale } from './context/LocaleContext';

// --- THEME CONFIGURATION ---
const theme = {
  colors: {
    bg: '#050505',
    glassBg: 'rgba(20, 20, 20, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    gold: 'white',
    textMain: '#FFFFFF',
    textSec: '#B0B0B0',
    accent: '#E74C3C',
    green: '#2ECC71',
  },
  shadows: {
    card: '0 8px 20px rgba(0,0,0,0.5)',
    glow: '0 0 10px rgba(255, 215, 0, 0.2)',
  }
};

const styles = {
  pageContainer: {
    minHeight: '100vh',
    width: '100%',
    fontFamily: "'Poppins', sans-serif",
    color: theme.colors.textMain,
    overflowX: 'hidden',
  },
  
  // --- HERO STYLES ---
  heroPlaceholder: {
    height: '70vh', 
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  heroVideoFixed: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '70vh',
    objectFit: 'cover',
    opacity: 0.5,
    zIndex: 0,
    pointerEvents: 'none',
  },
  heroOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '70vh',
    background: 'linear-gradient(to bottom, rgba(5,5,5,0.4) 0%, rgba(5,5,5,1) 95%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
    textAlign: 'center',
    maxWidth: '800px',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-1px',
    marginBottom: '15px',
    textTransform: 'uppercase',
    background: theme.colors.silverGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 5px 15px rgba(0,0,0,0.5)',
  },
  heroTitleGold: {
    backgroundImage: theme.colors.goldGradient,
    backgroundSize: '200% 200%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block'
  },
  heroSubtitle: {
    fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
    color: '#D4D4D4',
    marginBottom: '2rem',
    fontWeight: 400,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    maxWidth: '550px',
  },
  heroBtn: {
    padding: '12px 35px',
    backgroundImage: theme.colors.goldGradient,
    backgroundSize: '200% 200%',
    backgroundPosition: '0% 50%',
    color: '#121212',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    borderRadius: '9999px',
    position: 'relative',
    boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3)',
    transition: 'all 0.3s ease',
  },

  // --- SHOP SECTION WRAPPER ---
  shopWrapper: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
    width: '100%',
    backgroundImage: `
      linear-gradient(rgba(4, 4, 4, 0.89), rgba(4, 4, 4, 0.89)), 
      url(${bglogoimg})
    `,
    backgroundSize: '50%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    backgroundAttachment: 'fixed',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    boxShadow: '0 -20px 50px rgba(0,0,0,1)',
  },

  seoSection: {
    maxWidth: '1400px',
    margin: '40px auto 0',
    padding: '40px 20px',
    background: 'rgba(15, 15, 15, 0.4)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  seoTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
    fontWeight: 700,
    marginBottom: '25px',
    background: theme.colors.silverGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.2,
  },
  seoContent: {
    color: '#D4D4D4',
    fontSize: '1rem',
    lineHeight: 1.8,
    fontWeight: 400,
  },

  navWrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(5, 5, 5, 0.85)',
    backdropFilter: 'blur(15px)',
    borderBottom: `1px solid ${theme.colors.glassBorder}`,
    padding: '12px 0',
  },
  
  // --- SECTIONS ---
  section: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px 20px',
    position: 'relative',
    zIndex: 2,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '25px',
    borderBottom: `1px solid ${theme.colors.glassBorder}`,
    paddingBottom: '12px',
  },
  sectionTitle: {
    fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '0.5px',
    background: theme.colors.silverGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sectionSubTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '0.5px',
    background: theme.colors.silverGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  viewAllBtn: {
    background: 'none',
    border: 'none',
    color: theme.colors.gold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  // FIXED GRID STYLE: Added default gridTemplateColumns to prevent full-width stacking
  grid: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', // Safety fallback
    width: '100%',
  },
  
  // --- CARD STYLES ---
  card: {
    background: theme.colors.glassBg,
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    border: `1px solid ${theme.colors.glassBorder}`,
    height: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease',
    willChange: 'transform, opacity',
    contain: 'layout paint style',
  },
  cardImgWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: '100%', // 1:1 Aspect Ratio
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    contentVisibility: 'auto',
    containIntrinsicSize: '300px 300px',
  },
  cardImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain', 
  },
  actionOverlay: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    padding: '12px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
    zIndex: 20, 
    display: 'flex',
    justifyContent: 'center',
  },
  tagChips: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
    zIndex: 16
  },
  chip: (label) => {
    const key = String(label || '').toUpperCase();
    const map = {
      NEW: { bg: 'linear-gradient(90deg, #6dd5fa, #3498db)', color: '#fff' },
      SALE: { bg: 'linear-gradient(90deg, #ff6a6a, #e74c3c)', color: '#fff' },
      LIMITED: { bg: 'linear-gradient(90deg, #bc83e6, #9b59b6)', color: '#fff' },
      SUMMER: { bg: 'linear-gradient(90deg, #00b894, #00a389)', color: '#fff' },
      WINTER: { bg: 'linear-gradient(90deg, #0984e3, #4a6cf7)', color: '#fff' },
      CUSTOMIZABLE: { bg: 'linear-gradient(90deg, #4b6cb7, #2c3e50)', color: '#fff' },
      BESTSELLER: { bg: 'linear-gradient(90deg, #f9d423, #FFA500)', color: '#111' }
    };
    const s = map[key] || { bg: 'rgba(255,255,255,0.15)', color: '#fff' };
    return {
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: s.bg,
      color: s.color,
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
    };
  },
  addToCartBtn: {
    width: '100%',
    padding: '10px',
    background: theme.colors.goldGradient,
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.25)',
    textTransform: 'uppercase',
  },
  wishlistBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    zIndex: 15,
  },
  cardDetails: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexGrow: 1,
    background: 'linear-gradient(to bottom, rgba(20,20,20,0), rgba(10,10,10,0.85))',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
};

// --- COMPONENT: PRODUCT NAME (ELLIPSIS + TOOLTIP) ---
const MarqueeProductName = ({ productName }) => {
  const name = String(productName || "");
  const MAX_NAME_LENGTH = 30;
  const displayName = name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH) + '...' : name;

  return (
    <div
      title={name}
      style={{
        fontSize: 'clamp(0.8rem, 1.8vw, 0.95rem)',
        fontWeight: 600,
        color: '#f0f0f0',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%'
      }}
    >
      {displayName}
    </div>
  );
};

// --- CUSTOM HOOK FOR LAZY VIDEO LOADING ---
const useLazyVideo = (src, options = {}) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
        }
      },
      { threshold: 0.1, ...options }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [isInView, options]);

  useEffect(() => {
    if (isInView && videoRef.current) {
      const video = videoRef.current;
      const handleLoad = () => setIsLoaded(true);
      video.addEventListener('loadeddata', handleLoad);
      return () => video.removeEventListener('loadeddata', handleLoad);
    }
  }, [isInView]);

  return { videoRef, shouldLoad: isInView, isLoaded };
};
const EnhancedTagChips = ({ tags }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div style={styles.tagChips}>
      {tags.slice(0, 3).map((tag, index) => (
        <motion.span 
          key={index}
          style={styles.chip(tag)}
          variants={{
            hidden: { opacity: 0, y: 15, scale: 0.8 },
            visible: { opacity: 1, y: 0, scale: 1 }
          }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.05, y: -2 }}
        >
          {String(tag).toUpperCase()}
        </motion.span>
      ))}
    </div>
  );
};

// --- COMPONENT: MODERN PRODUCT CARD (ANIMATED SLIDESHOW) ---
const ModernProductCard = React.memo(({ product, onClick, addToCartWithNotification, itemIndex = 0, isMobileView = false, isModalReady = false }) => {
  const { format } = useLocale();
  const reduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const cardRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  
  // Slideshow State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = product.allImages && product.allImages.length > 0 
    ? product.allImages 
    : [product.firstImage || 'placeholder.jpg'];

  const minPrice = product.min_price || product.price || 0;
  const isSale = product.discounted_price || (product.tags && product.tags.includes('SALE'));

  // Use database 'subcategory' field specifically. 
  const subcategoryLabel = product.category;

  // Slideshow Logic: Cycle images continuously
  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    let interval;
    const slideshowEnabled = images.length > 1 && inView && pageVisible && itemIndex < 12;
    if (slideshowEnabled) {
      // Random start delay to prevent all cards flipping exactly in sync
      const delay = Math.random() * 2000;
      const startTimeout = setTimeout(() => {
        interval = setInterval(() => {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, reduceMotion ? 6500 : 3500); // Slow down on reduced motion
      }, delay);
      
      return () => {
        clearTimeout(startTimeout);
        clearInterval(interval);
      };
    }
  }, [images.length, inView, pageVisible, reduceMotion, itemIndex]);

  useEffect(() => {
    const checkWishlist = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) { setIsFavorite(false); return; }
        const res = await apiFetch(`/api/user/wishlist/check/${product.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data && data.success) setIsFavorite(!!data.exists);
      } catch {}
    };
    checkWishlist();
  }, [product.id]);

  // Scroll Entrance Animation
  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        stiffness: 80,
        damping: 15,
        staggerChildren: 0.1 
      } 
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
    <motion.div
      ref={cardRef}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={cardVariants}
      style={{
        ...styles.card,
        borderColor: theme.colors.glassBorder
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(product)}
      whileHover={{ y: -6, boxShadow: '0 15px 30px rgba(0,0,0,0.4)' }}
    >
      <div style={styles.cardImgWrapper}>
        <AnimatePresence mode="popLayout">
          {inView ? (
            <a 
              href={product.sitemap_path || `/products/${product.id}/${String(product.product_name || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)}`}
              style={{ display: 'block', width: '100%', height: '100%' }}
              onClick={(e) => { if (isModalReady) { e.preventDefault(); onClick(product); } }}
            >
              <motion.img 
                key={currentImageIndex}
                src={images[currentImageIndex]} 
                alt={product.product_name}
                width={600}
                height={600}
                decoding="async"
                loading={!isMobileView && itemIndex < 6 ? "eager" : "lazy"}
                fetchpriority={!isMobileView && itemIndex < 6 ? "high" : "low"}
                sizes="(min-width:1200px) 220px, (min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.3 : 0.8, ease: "easeInOut" }}
                style={{
                  ...styles.cardImg,
                transform: isHovered ? (reduceMotion ? 'scale(1.02)' : 'scale(1.08)') : 'scale(1)',
                transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              />
            </a>
          ) : (
            <div
              aria-hidden="true"
              style={{
                ...styles.cardImg,
                background: '#111'
              }}
            />
          )}
        </AnimatePresence>

        <EnhancedTagChips tags={product.tags} />
        
        <motion.button 
          style={styles.wishlistBtn}
          whileHover={{ scale: 1.1, background: '#fff' }}
          whileTap={{ scale: 0.9 }}
          onClick={async (e) => { 
            e.stopPropagation(); 
            const token = localStorage.getItem('userToken');
            if (!token) { setShowLoginPopup(true); return; }
            try {
              if (!isFavorite) {
                const res = await apiFetch('/api/user/wishlist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ product_id: product.id })
                });
                const data = await res.json();
                if (data.success) {
                  setIsFavorite(true);
                  toast.success(
                    (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiHeart size={18} color={theme.colors.accent} />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Added to Wishlist</div>
                          <div style={{ fontSize: '11px', color: '#ccc', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name}</div>
                        </div>
                      </div>
                    ),
                    { style: { background: '#1a1a1a', color: '#fff', border: `1px solid ${theme.colors.glassBorder}` }, progressStyle: { background: theme.colors.gold } }
                  );
                } else { toast.error(data.message || 'Failed to add'); }
              } else {
                const res = await apiFetch(`/api/user/wishlist/${product.id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                  setIsFavorite(false);
                  toast.info(
                    (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiHeart size={18} color={'#999'} />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Removed from Wishlist</div>
                          <div style={{ fontSize: '11px', color: '#ccc', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name}</div>
                        </div>
                      </div>
                    ),
                    { style: { background: '#1a1a1a', color: '#fff', border: `1px solid ${theme.colors.glassBorder}` }, progressStyle: { background: theme.colors.gold } }
                  );
                } else { toast.error(data.message || 'Failed to remove'); }
              }
            } catch { toast.error('Wishlist action failed'); }
          }}
        >
          <FiHeart size={12} color={isFavorite ? theme.colors.accent : (isHovered ? '#000' : '#fff')} fill={isFavorite ? theme.colors.accent : 'none'} />
        </motion.button>

        <AnimatePresence>
          {isHovered && (
            <motion.div 
              style={styles.actionOverlay}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2 }}
            >
              <motion.button
                style={styles.addToCartBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  addToCartWithNotification(product, 1);
                }}
                whileTap={{ scale: 0.95 }}
              >
                <FiShoppingCart size={14} /> Add
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={styles.cardDetails}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: theme.colors.gold, fontWeight: 700, letterSpacing: '0.5px' }}>
            {subcategoryLabel}
          </span>
                    <span style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.75rem)', color: (product.stock || 20) < 10 ? theme.colors.accent : theme.colors.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
            {(product.stock || 20) < 10 ? 'Low' : 'Stock'}
          </span>
          {product.review_count > 0 && product.rating != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: '#FFD700' }}>
              <FaStar /> <span style={{ color: '#fff' }}>{Number(product.rating).toFixed(1)}</span>
            </div>
          )}
        </div>

        <div style={{ margin: '4px 0 0 0', height: '22px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <MarqueeProductName productName={product.product_name} />
        </div>

        <div style={styles.priceRow}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1rem)', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {format(Number((product.discounted_price ?? product.price) || 0), 'EUR')}
            </span>
            {Number(product.price || 0) > 0 && Number((product.discounted_price ?? product.price) || 0) < Number(product.price || 0) && (
              <>
                <span style={{ fontSize: 'clamp(0.7rem, 1.4vw, 0.85rem)', color: theme.colors.textSec, textDecoration: 'line-through' }}>
                  {format(Number(product.price || 0), 'EUR')}
                </span>
                <span style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.75rem)', color: theme.colors.green, fontWeight: 700 }}>
                  {`-${Math.round(((Number(product.price || 0) - Number((product.discounted_price ?? product.price) || 0)) / Number(product.price || 0)) * 100)}%`}
                </span>
              </>
            )}
          </div>

        </div>
      </div>
    </motion.div>
    <AnimatePresence>
      {showLoginPopup && (
        <motion.div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LoginForm onClose={() => setShowLoginPopup(false)} onSuccess={() => { setShowLoginPopup(false); }} isMobile={false} />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
});

// --- COMPONENT: ANIMATED SECTION ---
const CategorySection = ({ title, products, icon: Icon, addToCartWithNotification, onClickProduct, compactTitle, isModalReady = false, isMobileView = false }) => {
  const hasProducts = Array.isArray(products) && products.length > 0;
  
  // Use products as is to respect the newest-first order from the parent
  const sortedProducts = hasProducts ? products : [];

  return (
    <motion.section 
      style={styles.section}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
    >
      <div style={styles.sectionHeader}>
        <h2 style={compactTitle ? styles.sectionSubTitle : styles.sectionTitle}>
          {Icon && <Icon style={{ color: theme.colors.gold, fontSize: '0.9em' }} />}
          {title}
        </h2>

      </div>

      {/* REMOVED 'layout' prop here to fix the stretching bug */}
      {hasProducts ? (
        <motion.div style={isMobileView ? { ...styles.grid, gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' } : styles.grid} className="grid-container">
          {sortedProducts.map((product, idx) => (
            <ModernProductCard 
              key={product.id} 
              product={product} 
              onClick={onClickProduct} 
              addToCartWithNotification={addToCartWithNotification}
              itemIndex={idx}
              isModalReady={isModalReady}
            />
          ))}
        </motion.div>
      ) : (
        <div style={{
          padding: '20px',
          color: theme.colors.textSec,
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>No products yet</div>
      )}
    </motion.section>
  );
};

// --- COMPONENT: SECTION TAB HEADER ---
const SectionTabHeader = ({ title, icon: Icon, tabs, activeTab, onTabChange }) => {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 20px 0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${theme.colors.glassBorder}`, paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {Icon && <Icon style={{ color: theme.colors.gold, fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)' }} />}
          <span style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)', fontWeight: 700, letterSpacing: '0.5px', background: theme.colors.silverGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</span>
        </div>
        <div style={{ height: 1, flex: 1, marginLeft: '20px', background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), transparent)' }} />
      </div>
      
      {tabs && tabs.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
          {tabs.map((tab, idx) => (
            <motion.button 
              key={idx} 
              onClick={() => onTabChange(tab)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                padding: '6px 16px',
                borderRadius: '999px', 
                border: activeTab === tab ? 'none' : `1px solid ${theme.colors.glassBorder}`, 
                background: activeTab === tab 
                  ? theme.colors.goldGradient 
                  : 'rgba(255,255,255,0.05)', 
                color: activeTab === tab ? '#000' : theme.colors.gold, 
                fontSize: '0.8rem', 
                fontWeight: activeTab === tab ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                boxShadow: activeTab === tab ? '0 4px 12px rgba(255, 215, 0, 0.3)' : 'none'
              }}>
              {tab}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN HOME COMPONENT ---
const Home = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Added categories state
  const [isFetching, setIsFetching] = useState(true);

  // --- SYNC URL WITH MODAL STATE ---
  const selectProduct = (product) => {
    if (product) {
      const slug = toSlug(product.product_name);
      const newPath = `/products/${product.id}/${slug}`;
      // Use navigate with background state to keep Home in background
      navigate(newPath, { state: { background: location, product } });
    }
  };
  const location = useLocation();
  const navigate = useNavigate(); // Added useNavigate
  const [navFilter, setNavFilter] = useState(null);
  const [seoContent, setSeoContent] = useState(null);
  
  // Main Page Filters
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Section Specific Filters
  const [craftsTab, setCraftsTab] = useState('All');
  const [apparelTab, setApparelTab] = useState('All');

  // --- SYNC CATEGORY TABS WITH URL QUERY ---
  const handleCraftsTabChange = (tab) => {
    setCraftsTab(tab);
    try {
      const params = new URLSearchParams(location.search);
      if (tab && tab !== 'All') {
        params.set('crafts', toSlug(tab));
      } else {
        params.delete('crafts');
      }
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      );
    } catch {}
  };

  const handleApparelTabChange = (tab) => {
    setApparelTab(tab);
    try {
      const params = new URLSearchParams(location.search);
      if (tab && tab !== 'All') {
        params.set('apparel', toSlug(tab));
      } else {
        params.delete('apparel');
      }
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      );
    } catch {}
  };

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showHeroVideo, setShowHeroVideo] = useState(false);
  const { videoRef: heroVideoRef, shouldLoad: shouldLoadHeroVideo } = useLazyVideo(coverVideo);
  useEffect(() => {
    const flag = sessionStorage.getItem('refreshHomeAfterAuth');
    if (flag === '1') {
      sessionStorage.removeItem('refreshHomeAfterAuth');
      window.location.reload();
    }
  }, []);

  // Preload ProductModal chunk on idle so modal opens instantly in production
  const [modalReady, setModalReady] = useState(false);
  useEffect(() => {
    const preload = () => {
      try {
        import('../components/ProductModal').then(() => setModalReady(true)).catch(() => {});
      } catch {
        setModalReady(false);
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(preload, { timeout: 2000 });
    } else {
      setTimeout(preload, 1200);
    }
  }, []);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiFetch('/api/categories');
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error("Fetch categories error", err);
      }
    };
    fetchCategories();
  }, []);
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 480);
      setIsTablet(w > 480 && w < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (!isMobile) {
      const idle = typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb) => setTimeout(cb, 1200);
      idle(() => setShowHeroVideo(true));
    } else {
      setShowHeroVideo(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const q = location.state && location.state.searchQuery;
    if (typeof q === 'string' && q.trim() !== '') {
      setSearchQuery(q.trim());
      const el = document.getElementById('shop-start');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (searchQuery) {
      setSearchQuery('');
    }

    const nf = location.state && location.state.navFilter;
    if (nf) {
      setNavFilter(nf);
      const el = document.getElementById('shop-start');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (navFilter) {
      setNavFilter(null);
    }
  }, [location.state]);

  const { addToCart } = useCart();

  const addToCartWithNotification = (product, qty) => {
    addToCart({ ...product, image: product.firstImage }, qty);
    toast.success(
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FiCheck size={18} color={theme.colors.green} />
        <div>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Added to Cart</div>
            <div style={{ fontSize: '11px', color: '#ccc', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name}</div>
        </div>
      </div>,
      {
        style: { background: '#1a1a1a', color: '#fff', border: `1px solid ${theme.colors.glassBorder}` },
        progressStyle: { background: theme.colors.gold }
      }
    );
  };

  const canonicalBase = import.meta.env.VITE_CANONICAL_BASE_URL || 'https://www.yokebud.fi';
  const toSlug = (s) => {
    try {
      return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
    } catch { return ''; }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      // Failsafe timer: if fetching takes too long, stop loading anyway
      const failsafe = setTimeout(() => {
        setIsFetching(false);
      }, 8000);

      try {
        const response = await apiFetch('/api/products?limit=48');
        const data = await response.json();
        const processed = data.map(p => {
          const safeParse = (str) => {
            if (typeof str !== 'string') return str;
            try { return JSON.parse(str); } catch { return []; }
          };
          let photos = safeParse(p.product_photos) || [];
          const formattedPhotos = Array.isArray(photos) ? photos.map(photo => absoluteUrl(photo)) : [];
          const imageOnly = formattedPhotos.filter(url => !/\.mp4|\.webm|video\//i.test(String(url)));
          return {
            ...p,
            price: Number(p.price),
            min_price: Number(p.min_price || p.price),
            tags: safeParse(p.tags) || [],
            categories: safeParse(p.categories) || [p.category],
            firstImage: imageOnly[0] || null,
            allImages: imageOnly
          };
        });

        // Sort by date (newest first) before setting state
        const sorted = processed.sort((a, b) => {
          const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
          const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setProducts(sorted);
        setIsFetching(false);
      } catch (err) {
        console.error("Fetch error", err);
        setIsFetching(false);
      } finally {
        clearTimeout(failsafe);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchSeoContent = async () => {
      try {
        const response = await apiFetch('/api/seo/home');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSeoContent(result.data);
          }
        }
      } catch (err) {
        console.error("Fetch SEO content error", err);
      }
    };
    fetchSeoContent();
  }, []);

  // --- HELPER FUNCTION FOR STRICT ATTRIBUTE CHECKING ---
  const hasAttributeMatch = (product, keywords) => {
    if (!product || !keywords || keywords.length === 0) return false;
    
    // Convert all attributes to lowercase for checking
    const cat = (product.category || '').toLowerCase();
    const tags = (product.tags || []).map(t => String(t).toLowerCase());
    const catsList = (product.categories || []).map(c => String(c).toLowerCase());

    return keywords.some(key => {
        const k = key.toLowerCase();
        return cat.includes(k) || 
               tags.some(tag => tag.includes(k)) || 
               catsList.some(c => c.includes(k));
    });
  };

  // --- DYNAMIC CATEGORY TABS ---
  const { craftsTabs, apparelTabs, craftsCatNames, apparelCatNames } = useMemo(() => {
      // Robustly find root categories (handle singular/plural and case)
      const craftsRoot = categories.find(c => {
        const n = c.name.trim().toLowerCase();
        return n === 'crafts items' || n === 'crafts item' || n === 'crafts' || n === 'craft' || n.includes('craft') || n.includes('accessories');
      });
      const apparelRoot = categories.find(c => {
        const n = c.name.trim().toLowerCase();
        return n === 'apparel' || n === 'apparels' || n === 'customize appriales' || n === 'customize apparel' || n === 'clothing' || n === 'apprial' || n === 'apprials' || n.includes('apparel') || n.includes('clothing');
      });

      // Use String() comparison for IDs to avoid type mismatches
      const craftsSub = categories.filter(c => craftsRoot && String(c.parent_id) === String(craftsRoot.id));
      const apparelSub = categories.filter(c => apparelRoot && String(c.parent_id) === String(apparelRoot.id));

      const craftsNames = new Set(craftsSub.map(c => c.name.toLowerCase()));
      const apparelNames = new Set(apparelSub.map(c => c.name.toLowerCase()));

      // Merge defaults with dynamic categories (deduplicating by name)
      // This ensures "existing" tabs remain while adding new ones
      const defaultCrafts = ['Jewelry', 'Show Pieces', 'Key Rings'];
      const defaultApparel = ['Hoodies', 'T-shirts'];

      const combinedCrafts = [...defaultCrafts];
      craftsSub.forEach(c => {
        if (!combinedCrafts.some(existing => existing.toLowerCase() === c.name.toLowerCase())) {
            combinedCrafts.push(c.name);
        }
      });

      const combinedApparel = [...defaultApparel];
      apparelSub.forEach(c => {
        if (!combinedApparel.some(existing => existing.toLowerCase() === c.name.toLowerCase())) {
            combinedApparel.push(c.name);
        }
      });

      return {
          craftsTabs: ['All', ...combinedCrafts],
          apparelTabs: ['All', ...combinedApparel],
          craftsCatNames: craftsNames,
          apparelCatNames: apparelNames
      };
  }, [categories]);

  // Initialize category tabs from URL (if present)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const craftsSlug = params.get('crafts');
      const apparelSlug = params.get('apparel');

      if (craftsSlug && craftsTabs && craftsTabs.length) {
        const match = craftsTabs.find((t) => toSlug(t) === craftsSlug);
        if (match) setCraftsTab(match);
      }

      if (apparelSlug && apparelTabs && apparelTabs.length) {
        const match = apparelTabs.find((t) => toSlug(t) === apparelSlug);
        if (match) setApparelTab(match);
      }
    } catch {}
  }, [location.search, craftsTabs, apparelTabs]);

  // Initialize / sync navFilter from URL (desktop Filter sidebar)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const sectionFromUrl = params.get('section');
      const categorySlug = params.get('category');
      const min = params.get('min');
      const max = params.get('max');

      if (sectionFromUrl || categorySlug || min || max) {
        let resolvedSection = sectionFromUrl || 'all';
        let resolvedSubCategory = 'All';

        if (categorySlug) {
          const candidateTabs =
            resolvedSection === 'crafts'
              ? craftsTabs
              : resolvedSection === 'apparel'
              ? apparelTabs
              : [...craftsTabs, ...apparelTabs];

          const match = (candidateTabs || []).find((t) => toSlug(t) === categorySlug);
          if (match) {
            resolvedSubCategory = match;
          }
        }

        const priceRange = {
          min: min !== null && min !== '' ? Number(min) : null,
          max: max !== null && max !== '' ? Number(max) : null,
        };

        setNavFilter({
          section: resolvedSection,
          subCategory: resolvedSubCategory,
          priceRange,
        });
      } else if (navFilter) {
        setNavFilter(null);
      }
    } catch {}
  }, [location.search, craftsTabs, apparelTabs]);

  // --- HELPER TO CHECK IF PRODUCT BELONGS TO CATEGORY ---
  const isProductInTab = (p, tabName) => {
      if (!p || !tabName) return false;
      const t = tabName.toLowerCase();
      const pCats = (p.categories || []).concat(p.category ? [p.category] : []).map(s => String(s).toLowerCase());
      // Also check if matches keyword for legacy support
      if (t === 'jewelry' && hasAttributeMatch(p, ['jewelry', 'earring', 'necklace'])) return true;
      if (t === 'show pieces' && hasAttributeMatch(p, ['show piece', 'showpiece', 'decor'])) return true;
      if (t === 'key rings' && hasAttributeMatch(p, ['key', 'chain', 'ring', 'keyring'])) return true;
      if (t === 'hoodies' && hasAttributeMatch(p, ['hoodie', 'sweatshirt'])) return true;
      if (t === 't-shirts' && hasAttributeMatch(p, ['t-shirt', 'tshirt', 'polo'])) return true;
      
      return pCats.includes(t);
  };

  // --- UPDATED CATEGORIZATION LOGIC ---
  const categorized = useMemo(() => {
    if (!products.length) return { new: [], crafts: [], apparel: [] };

    // products state is already sorted by newest first (LIFO)
    const newArrivals = products.slice(0, 25);

    return {
      new: newArrivals,
      
      crafts: products.filter(p => {
          const pCats = (p.categories || []).concat(p.category ? [p.category] : []).map(s => String(s).toLowerCase());
          if (pCats.some(c => craftsCatNames.has(c))) return true;
          return hasAttributeMatch(p, ['resin', 'craft', 'art', 'decor', 'jewelry', 'show piece', 'key ring', 'gift', 'keyring']);
      }),
      
      apparel: products.filter(p => {
           const pCats = (p.categories || []).concat(p.category ? [p.category] : []).map(s => String(s).toLowerCase());
           if (pCats.some(c => apparelCatNames.has(c))) return true;
          return hasAttributeMatch(p, ['clothing', 'T-shirt', 'Hoodie', 'apparel', 'wear', 'jacket', 'fashion']);
      })
    };
  }, [products, craftsCatNames, apparelCatNames]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => {
      const name = (p.product_name || '').toLowerCase();
      const cat = JSON.stringify(p.categories || []).toLowerCase();
      const tags = JSON.stringify(p.tags || []).toLowerCase();
      return name.includes(q) || cat.includes(q) || tags.includes(q);
    });
  }, [products, searchQuery]);

  // In 'All' tab, we will hide empty subcategory sections. In specific tabs, we show the section with a message.

  const filteredByNav = useMemo(() => {
    if (!navFilter) return null;
    let base = products;
    if (navFilter.section === 'new') base = categorized.new;
    if (navFilter.section === 'crafts') base = categorized.crafts;
    if (navFilter.section === 'apparel') base = categorized.apparel;
    
    if (navFilter.section === 'crafts' || navFilter.section === 'apparel') {
      if (navFilter.subCategory) {
         base = base.filter(p => isProductInTab(p, navFilter.subCategory));
      }
    }

    const pr = navFilter.priceRange || {};
    const min = typeof pr.min === 'number' ? pr.min : null;
    const max = typeof pr.max === 'number' ? pr.max : null;
    if (min != null || max != null) {
      base = base.filter(p => {
        const price = Number(p.discounted_price || p.min_price || p.price || 0);
        if (min != null && price < min) return false;
        if (max != null && price > max) return false;
        return true;
      });
    }
    return base;
  }, [navFilter, products, categorized]);

  return (
    <div style={styles.pageContainer}>
      <Helmet>
        <title>Yokebud Crafts | Premium Resin Art & Custom Apparel</title>
        <meta name="description" content="Shop premium handcrafted resin art, customizable gift items, and luxury apparel at Yokebud Crafts." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Yokebud Crafts | Premium Resin Art & Custom Apparel" />
        <meta property="og:description" content="Discover artisan-made goods, curated collections, and unique gifts designed for everyday luxury." />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: products.slice(0, 12).map((p, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              url: `${canonicalBase}${p.sitemap_path || `/products/${p.id}/${toSlug(p.product_name)}`}`
            }))
          })}
        </script>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://api.yokebud.fi" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <style>{`
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-track { background: #050505; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #FFD700; }

          .marquee-animate {
            animation: productNameScroll 15s linear infinite;
          }
          
          .product-name-container:hover .marquee-animate {
            animation-play-state: paused;
          }

          @keyframes productNameScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          /* RESPONSIVE GRID CONFIGURATION */
          .grid-container { gap: 20px; }
          .grid-container > * { min-width: 0; }

          /* Big Screens: 5 columns */
          @media (min-width: 1200px) {
            .grid-container { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
          }
          
          /* Laptops: 4 columns */
          @media (min-width: 1024px) and (max-width: 1199px) {
            .grid-container { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          }

          /* Tablets: 3 columns */
          @media (min-width: 768px) and (max-width: 1023px) {
            .grid-container { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          }

          /* Mobile: 2 columns (As requested) */
          @media (max-width: 767px) {
            .grid-container { 
                grid-template-columns: repeat(2, 1fr) !important; 
                gap: 12px !important; 
            }
            .hero-title { font-size: 2.2rem !important; }
          }
          
          /* Extra Small Mobile */
          @media (max-width: 360px) {
             .grid-container { gap: 8px !important; }
          }
        `}</style>
      </Helmet>

      <ToastContainer position="bottom-right" theme="dark" />

      {/* --- HERO SECTION --- */}
      {!isMobile && showHeroVideo && (
        <video 
          ref={heroVideoRef}
          src={shouldLoadHeroVideo ? coverVideo : undefined}
          autoPlay 
          muted 
          loop 
          playsInline 
          preload="metadata"
          poster={bglogoimg}
          style={{
            ...styles.heroVideoFixed,
            height: isTablet ? '70vh' : '70vh'
          }}
          loading="lazy"
        />
      )}
      <div style={{
        ...styles.heroOverlay,
        height: isMobile ? '70vh' : (isTablet ? '70vh' : '70vh')
      }} />

      <section style={{
        ...styles.heroPlaceholder,
        height: isMobile ? '70vh' : (isTablet ? '70vh' : '70vh')
      }} id="hero">
        <motion.div 
          style={{
            ...styles.heroContent,
            padding: isMobile ? '0 12px' : (isTablet ? '0 16px' : '0 20px')
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          <motion.h1 style={styles.heroTitle} className="hero-title">Yokebud<br/><span style={styles.heroTitleGold}>Crafts</span></motion.h1>
          <motion.p 
            style={styles.heroSubtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Premium Handcrafted Art & Custom Luxury Apparel
          </motion.p>
          <motion.button 
            style={styles.heroBtn}
            whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(255, 215, 0, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById('shop-start').scrollIntoView({ behavior: 'smooth' })}
          >
            Start Shopping
          </motion.button>
        </motion.div>
      </section>

      {/* --- SHOP SECTION --- */}
      <div style={styles.shopWrapper}>
        <div style={styles.navWrapper} id="shop-start">
        </div>

        {isFetching ? (
          <div style={{ height: '50vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <LoadingAnimation />
          </div>
        ) : (
          <div style={{ paddingBottom: '0', position: 'relative', zIndex: 5 }}>
              {(activeFilter !== 'All' || searchQuery) ? (
                  <motion.section 
                    style={styles.section}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <h2 style={{...styles.sectionTitle, marginBottom: 0}}>
                            {searchQuery ? `Results: "${searchQuery}"` : `${activeFilter} Collection`}
                        </h2>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setSearchQuery(''); setActiveFilter('All'); }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '999px',
                            border: `1px solid ${theme.colors.glassBorder}`,
                            background: theme.colors.goldGradient,
                            color: '#000',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                          }}
                        >
                          <FiArrowLeft /> Back to All
                        </motion.button>
                      </div>
                      {/* REMOVED layout prop */}
          <motion.div style={{ ...styles.grid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : styles.grid.gridTemplateColumns, gap: isMobile ? '12px' : styles.grid.gap }} className="grid-container">
              {(filteredProducts.length ? filteredProducts : products).map((p, idx) => (
                          <ModernProductCard 
                              key={p.id} 
                              product={p} 
                              onClick={selectProduct} 
                              addToCartWithNotification={addToCartWithNotification}
                              itemIndex={idx}
                              isMobileView={isMobile}
                              isModalReady={modalReady}
                          />
                      ))}
              {!filteredProducts.length && searchQuery && (
                <div style={{ color: theme.colors.textSec, padding: '10px 0' }}>No products found</div>
              )}
          </motion.div>
      </motion.section>
          ) : navFilter ? (
              <motion.section 
                id="shop-start"
                style={styles.section}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <h2 style={{...styles.sectionTitle, marginBottom: 0}}>
                            {`${navFilter.section === 'all' ? 'All' : navFilter.section.charAt(0).toUpperCase() + navFilter.section.slice(1)} ${navFilter.subCategory && navFilter.subCategory !== 'All' ? '— ' + navFilter.subCategory : ''}`}
                        </h2>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { 
                            setNavFilter(null); 
                            navigate(
                              { pathname: location.pathname, search: '' },
                              { state: {}, replace: true }
                            ); 
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '999px',
                            border: `1px solid ${theme.colors.glassBorder}`,
                            background: theme.colors.goldGradient,
                            color: '#000',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                          }}
                        >
                          <FiArrowLeft /> Back to All
                        </motion.button>
                      </div>
                      {/* REMOVED layout prop */}
                      <motion.div style={{ ...styles.grid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : styles.grid.gridTemplateColumns, gap: isMobile ? '12px' : styles.grid.gap }} className="grid-container">
                          {(filteredByNav || []).map((p, idx) => (
                              <ModernProductCard 
                                  key={p.id} 
                                  product={p} 
                                  onClick={selectProduct} 
                                  addToCartWithNotification={addToCartWithNotification}
                                  itemIndex={idx}
                                  isMobileView={isMobile}
                                  isModalReady={modalReady}
                              />
                          ))}
                          {!filteredByNav?.length && (
                            <div style={{ color: theme.colors.textSec, padding: '10px 0' }}>No products found</div>
                          )}
                      </motion.div>
                  </motion.section>
              ) : (
                  <>
                      {/* --- NEW ARRIVALS (Based on tags/dates) --- */}
                      <CategorySection 
                            title="NEW Arrivals" 
                            icon={FaFire} 
                            products={categorized.new} 
                            addToCartWithNotification={addToCartWithNotification}
                          onClickProduct={selectProduct}
                          isModalReady={modalReady}
                          isMobileView={isMobile}
                        />

                      {/* --- Resin CRAFTS (Based on Category/Tags ONLY) --- */}
                      <SectionTabHeader 
                        title="Crafts Items" 
                        icon={FaGem} 
                        tabs={craftsTabs}
                      activeTab={craftsTab}
                      onTabChange={handleCraftsTabChange}
                      />

                      {craftsTab === 'All' ? (
                        <>
                          {craftsTabs.slice(1).map(tabName => {
                             const prods = categorized.crafts.filter(p => isProductInTab(p, tabName));
                             if (prods.length === 0) return null;
                             return (
                                <CategorySection 
                                  key={tabName}
                                  title={tabName} 
                                  products={prods} 
                                  compactTitle
                                  addToCartWithNotification={addToCartWithNotification}
                                  onClickProduct={selectProduct}
                                  isModalReady={modalReady}
                                  isMobileView={isMobile}
                                />
                             );
                          })}
                          {categorized.crafts.length === 0 && (
                             <div style={{ padding: '20px', color: theme.colors.textSec, fontSize: '0.9rem', textAlign: 'center' }}>No Crafts Yet</div>
                          )}
                        </>
                      ) : (
                        <CategorySection 
                          title={craftsTab} 
                          products={categorized.crafts.filter(p => isProductInTab(p, craftsTab))}
                          compactTitle
                          addToCartWithNotification={addToCartWithNotification}
                          onClickProduct={selectProduct}
                          isModalReady={modalReady}
                          isMobileView={isMobile}
                        />
                      )}

                      {/* --- CUSTOMIZABLE APPAREL (Based on Category/Tags ONLY) --- */}
                      <SectionTabHeader 
                        title="Customizable Apparel" 
                        icon={FaTshirt} 
                        tabs={apparelTabs}
                      activeTab={apparelTab}
                      onTabChange={handleApparelTabChange}
                      />

                      {apparelTab === 'All' ? (
                        <>
                          {apparelTabs.slice(1).map(tabName => {
                             const prods = categorized.apparel.filter(p => isProductInTab(p, tabName));
                             if (prods.length === 0) return null;
                             return (
                                <CategorySection 
                                  key={tabName}
                                  title={tabName} 
                                  products={prods} 
                                  compactTitle
                                  addToCartWithNotification={addToCartWithNotification}
                                  onClickProduct={selectProduct}
                                  isModalReady={modalReady}
                                  isMobileView={isMobile}
                                />
                             );
                          })}
                          {categorized.apparel.length === 0 && (
                            <div style={{ padding: '20px', color: theme.colors.textSec, fontSize: '0.9rem', textAlign: 'center' }}>No Apparel Yet</div>
                          )}
                        </>
                      ) : (
                        <CategorySection 
                          title={apparelTab} 
                          products={categorized.apparel.filter(p => isProductInTab(p, apparelTab))}
                          compactTitle
                          addToCartWithNotification={addToCartWithNotification}
                          onClickProduct={selectProduct}
                          isModalReady={modalReady}
                          isMobileView={isMobile}
                        />
                      )}
                  </>
              )}
          </div>
        )}
      </div>

      {/* --- SEO FOOTER SECTION --- */}
      {seoContent && (
        <section style={styles.section}>
          <div style={styles.seoSection}>
            {seoContent.title && <h2 style={styles.seoTitle}>{seoContent.title}</h2>}
            <div 
              style={styles.seoContent} 
              className="seo-html-content"
              dangerouslySetInnerHTML={{ __html: seoContent.content }} 
            />
          </div>
          <style>{`
            .seo-html-content p { margin-bottom: 20px; }
            .seo-html-content a { color: #F59E0B; text-decoration: underline; }
            .seo-html-content strong { color: #fff; }
            .seo-html-content h3 { color: #fff; margin: 30px 0 15px; font-size: 1.5rem; }
            .seo-html-content ul { margin-bottom: 20px; padding-left: 20px; }
            .seo-html-content li { margin-bottom: 10px; }
          `}</style>
        </section>
      )}

    </div>
  );
};

export default Home;
