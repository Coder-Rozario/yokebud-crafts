import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiSun, FiScissors, FiShoppingBag, FiBox, FiDroplet, FiHome, FiAward, FiCamera, FiStar, FiKey, FiSettings, FiTruck, FiShield, FiShoppingCart, FiCheck, FiPlus, FiChevronLeft, FiChevronRight, FiZap, FiPercent, FiEye, FiEdit2, FiHeart } from 'react-icons/fi';
import { FaTshirt, FaGem, FaTree, FaMagic, FaTools, FaPalette, FaFire } from 'react-icons/fa';
import { SiGoogle } from 'react-icons/si';
import coverVideo from '../assades/Cover Video-compressed.mp4';
import bglogoimg from '../assades/bglogo.png';
import SeoContent from '../components/SeoContent';

import { Helmet } from "react-helmet-async";
import { apiFetch, absoluteUrl } from '../utils/api';
import { getSaleCarouselPricing } from '../utils/pricing';
import { useCart } from '../pages/context/CartContext';
import { useLocale } from './context/LocaleContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Loading from '../components/Loading';
import { LoginForm } from '../components/Inquiry';

const ProductModal = React.lazy(() => import('../components/ProductModal'));
const LoadingAnimation = React.lazy(() => import('../components/LoadingAnimation'));

// --- THEME CONFIGURATION ---
const theme = {
  colors: {
    bg: '#050505',
    glassBg: 'rgba(20, 20, 20, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    gold: 'white',
    goldSolid: '#BF953F',
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
    paddingBottom: '60px', // Added padding to ensure footer SEO is visible
  },

  // --- HERO STYLES ---
  heroPlaceholder: {
    minHeight: '70vh',
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'hidden',
    padding: '60px 20px 40px',
    backgroundColor: '#000',
  },
  heroContainer: {
    maxWidth: '1400px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 5,
    position: 'relative',
    marginTop: '-20px',
  },
  heroLeft: {
    maxWidth: '650px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0 20px',
  },
  heroVideoFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.6,
    zIndex: 1,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,1) 100%), 
                linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 100%)`,
    zIndex: 2,
    pointerEvents: 'none',
  },
  heroTitle: {
    fontSize: 'clamp(1.5rem, 6vw, 4rem)', // Reduced min size for better mobile fit
    fontWeight: 700,
    width: '100%',
    lineHeight: 1.1,
    letterSpacing: '-1px',
    marginBottom: '15px',
    color: '#FFFFFF',
    textShadow: '0 4px 20px rgba(0,0,0,0.8)',
  },
  heroTitleGold: {
    background: 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
    fontWeight: 400,
    textShadow: '0px 2px 4px rgba(0,0,0,0.3)',
  },
  heroSubtitle: {
    fontSize: 'clamp(0.6rem, 1vw, 1.1rem)',
    color: '#D1D1D1',
    marginBottom: '2.5rem',
    fontWeight: 300,
    lineHeight: 1.6,
    maxWidth: '550px',
  },
  heroBtnGroup: {
    display: 'flex',
    gap: '12px',
    marginBottom: '45px',
    flexWrap: 'wrap',
  },
  heroBtnPrimary: {
    padding: '12px 30px',
    background: 'linear-gradient(#000, #000) padding-box, linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C) border-box',
    color: '#BF953F',
    border: '1px solid transparent',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: '6px',
  },
  heroBtnSecondary: {
    padding: '12px 30px',
    background: 'transparent',
    color: '#FFF',
    border: '1.5px solid rgba(255,255,255,0.25)',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: '6px',
  },
heroTagRow: {
  display: 'flex',
  gap: '25px',
  flexWrap: 'wrap',
  marginTop: '10px',
  position: 'relative',   // added
  minHeight: '48px',      // added — prevents layout jump between tags
},
  heroTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#E0E0E0',
    fontSize: '0.8rem',
  },
  heroTagIcon: {
    color: '#BF953F',
    fontSize: '1rem',
  },
  heroTagSmall: {
    color: '#999',
    fontSize: '0.7rem',
    display: 'block',
  },

  // --- CATEGORY SECTION ---
  categorySection: {
    backgroundColor: '#050505',
    padding: '100px 20px',
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  categoryTitle: {
    textAlign: 'center',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    fontWeight: 800,
    marginBottom: '60px',
    textTransform: 'uppercase',
    letterSpacing: '4px',
  },
  categoryTitleUnderline: {
    width: '80px',
    height: '4px',
    background: theme.colors.goldGradient,
    margin: '15px auto 0',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '25px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  categoryCard: {
    background: 'rgba(20, 20, 20, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.4s ease',
    textAlign: 'center',
    position: 'relative',
  },
  categoryIcon: {
    fontSize: '2.2rem',
    color: '#BF953F',
    marginBottom: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: {
    width: '55px',
    height: '55px',
    objectFit: 'contain',
  },
  categoryName: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#FFFFFF',
    margin: 0,
  },
  categorySub: {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.5)',
    margin: 0,
    textTransform: 'uppercase',
  },

  // --- SERVICE SECTIONS ---
  section: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '80px 20px',
    position: 'relative',
    zIndex: 2,
  },
  goldText: {
    background: theme.colors.goldGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: '800'
  },
  gridProducts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '20px',
    width: '100%',
  },
  gridProductsSmall: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '15px',
    width: '100%',
  },

  // --- CARD STYLES (from Shop.jsx) ---
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
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    willChange: 'transform',
  },
  // Add desktop override for card width
  desktopCard: {
    width: 'calc(33.333% - 14px)',
  },
  grid: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    width: '100%',
  },
  mobileGridProducts: {
    gap: '10px', // Tighter gap on mobile
  },
  viewMoreLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: '20px',
    color: theme.colors.gold,
    fontSize: '0.9rem',
    fontWeight: '600',
    textDecoration: 'none',
    gap: '5px',
    cursor: 'pointer'
  },
  cardImgWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: '90%',
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
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
      OFFER: { bg: 'linear-gradient(90deg, #ff6a6a, #e74c3c)', color: '#fff' },
      LIMITED: { bg: 'linear-gradient(90deg, #bc83e6, #9b59b6)', color: '#fff' },
      GIFT: { bg: 'linear-gradient(90deg, #ff9a9e, #fad0c4)', color: '#111' },
      SPORTS: { bg: 'linear-gradient(90deg, #a1c4fd, #c2e9fb)', color: '#111' },
      'HOME DECOR': { bg: 'linear-gradient(90deg, #d299c2, #fef9d7)', color: '#111' },
      CELEBRATION: { bg: 'linear-gradient(90deg, #f093fb, #f5576c)', color: '#fff' },
      OCCASION: { bg: 'linear-gradient(90deg, #4facfe, #00f2fe)', color: '#fff' },
      'PERSONAL USE': { bg: 'linear-gradient(90deg, #43e97b, #38f9d7)', color: '#111' },
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
    background: 'linear-gradient(#000, #000) padding-box, linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C) border-box',
    color: '#BF953F',
    border: '1px solid transparent',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.1)',
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
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    cursor: 'pointer',
    borderRadius: '12px',
    border: '1px solid rgba(255, 215, 0, 0.3)',
  },
  blurText: {
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textAlign: 'center',

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px'
  },
  // --- SKELETON ANIMATION ---
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' }
  },
  skeletonCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    height: '320px',
    width: 'calc(50% - 10px)', // Show 2 cards per row on mobile by default
    minWidth: '140px', // Match real card minWidth
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent 25%, rgba(255,215,0,0.05) 50%, transparent 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s infinite linear',
  },
  skeletonCategoryCard: {
    background: 'rgba(20, 20, 20, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '40px 20px',
    height: '200px',
    position: 'relative',
    overflow: 'hidden',
  }
};

const CategorySkeleton = () => (
  <div style={styles.categoryGrid}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} style={styles.skeletonCategoryCard}>
        <div style={styles.skeletonShimmer} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ height: '18px', width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
          <div style={{ height: '12px', width: '40%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
        </div>
      </div>
    ))}
  </div>
);

const SkeletonLoader = ({ isDesktop = false }) => (
  <div style={{ ...styles.gridProducts, gap: isDesktop ? '20px' : '10px' }}>
    {[1, 2, 3, 4].map((i) => (
      <div key={i} style={{ ...styles.skeletonCard, width: '100%' }}>
        <div style={styles.skeletonShimmer} />
        <div style={{ position: 'absolute', bottom: '20px', left: '15px', right: '15px' }}>
          <div style={{ height: '12px', width: '40%', background: 'rgba(255,255,255,0.1)', marginBottom: '10px', borderRadius: '4px' }} />
          <div style={{ height: '18px', width: '80%', background: 'rgba(255,255,255,0.1)', marginBottom: '10px', borderRadius: '4px' }} />
          <div style={{ height: '15px', width: '30%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
        </div>
      </div>
    ))}
  </div>
);

const Reveal = ({ children, direction = 'up', delay = 0 }) => {
  const variants = {
    hidden: {
      opacity: 0,
      x: direction === 'left' ? -50 : direction === 'right' ? 50 : 0,
      y: direction === 'up' ? 50 : direction === 'down' ? -50 : 0
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1.0] }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
};

const GoldIcon = ({ Icon, size = '2rem' }) => (
  <div style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }}>
    <svg width={0} height={0}>
      <linearGradient id="gold-gradient-fill" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop stopColor="#BF953F" offset="0%" />
        <stop stopColor="#FCF6BA" offset="25%" />
        <stop stopColor="#B38728" offset="50%" />
        <stop stopColor="#FBF5B7" offset="75%" />
        <stop stopColor="#AA771C" offset="100%" />
      </linearGradient>
    </svg>
    <Icon style={{ fontSize: size, fill: "url(#gold-gradient-fill)", filter: 'drop-shadow(0 0 8px rgba(191, 149, 63, 0.4))', display: 'inline-block', verticalAlign: 'middle' }} />
  </div>
);

const MarqueeProductName = ({ productName }) => {
  const name = String(productName || "");
  const MAX_NAME_LENGTH = 30;
  const displayName = name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH) + '...' : name;
  return (
    <div title={name} style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
      {displayName}
    </div>
  );
};


const ModernProductCard = React.memo(({ product, onClick, addToCartWithNotification, itemIndex = 0, isMobileView = false, isModalReady = false, isViewMore = false, viewMoreUrl = '/shop' }) => {
  const { format } = useLocale();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [canWishlist, setCanWishlist] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const calculateDiscountPercent = (qty, ranges) => {
    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) return 0;
    // For qty 1, still check if there's a discount range that starts at 1
    const sortedRanges = [...ranges].sort((a, b) => (a.min_qty || 0) - (b.min_qty || 0));
    let matchedRange = null;
    for (const range of sortedRanges) {
      const min = Number(range.min_qty) || 0;
      const max = Number(range.max_qty);
      // If max is not set (or is 0/NaN), treat it as unlimited (Infinity)
      const effectiveMax = (max === 0 || isNaN(max)) ? Infinity : max;

      if (qty >= min && qty <= effectiveMax) {
        matchedRange = range;
        break;
      }
    }
    // Only use the last range if it doesn't have a max_qty set
    if (!matchedRange) {
      const lastRange = sortedRanges[sortedRanges.length - 1];
      const lastMax = Number(lastRange.max_qty);
      if (lastMax === 0 || isNaN(lastMax)) {
        matchedRange = lastRange;
      }
    }
    return Number(matchedRange?.discount_percent) || 0;
  };

  const getDiscountTierMessage = (qty, ranges) => {
    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) return null;

    // Sort ranges by min_qty
    const sortedRanges = [...ranges].sort((a, b) => (a.min_qty || 0) - (b.min_qty || 0));

    // Find current tier
    let currentTierIndex = -1;
    let currentTier = null;
    for (let i = 0; i < sortedRanges.length; i++) {
      const range = sortedRanges[i];
      const min = Number(range.min_qty) || 0;
      const max = Number(range.max_qty);
      const effectiveMax = (max === 0 || isNaN(max)) ? Infinity : max;

      if (qty >= min && qty <= effectiveMax) {
        currentTierIndex = i;
        currentTier = range;
        break;
      }
    }

    // Check if we're above the last tier (only if last tier has no max)
    const lastTier = sortedRanges[sortedRanges.length - 1];
    const lastMax = Number(lastTier?.max_qty);
    const isLastTierUnlimited = lastMax === 0 || isNaN(lastMax);
    if (isLastTierUnlimited && qty >= (Number(lastTier?.min_qty) || 0)) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#F59E0B' }}>
            <FiTag size={16} />
          </div>
          <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.3' }}>
            <div>Congratulations!</div>
            <div>You're getting a <strong>{Number(lastTier?.discount_percent) || 0}%</strong> discount!</div>
          </div>
        </div>
      );
    }

    // Case 1: No discount tier active, show next tier
    if (currentTierIndex === -1) {
      const nextTier = sortedRanges[0];
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#F59E0B' }}>
            <FiTag size={16} />
          </div>
          <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.3' }}>
            <div>Buy <strong>{Number(nextTier?.min_qty) || 0}</strong> or <strong>{Number(nextTier?.min_qty) || 0}+</strong></div>
            <div>to get a <strong>{Number(nextTier?.discount_percent) || 0}%</strong> discount!</div>
          </div>
        </div>
      );
    }

    // Case 2: Inside a discount tier, show current and next tier
    if (currentTierIndex < sortedRanges.length - 1) {
      const nextTier = sortedRanges[currentTierIndex + 1];
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#F59E0B' }}>
            <FiTag size={16} />
          </div>
          <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.3' }}>
            <div>You're getting a <strong>{Number(currentTier?.discount_percent) || 0}%</strong> discount!</div>
            <div>Buy <strong>{Number(nextTier?.min_qty) || 0}</strong> or more to get a <strong>{Number(nextTier?.discount_percent) || 0}%</strong> discount!</div>
          </div>
        </div>
      );
    }

    return null;
  };

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setWindowWidth(window.innerWidth), 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isDesktop = windowWidth >= 1024;

  useEffect(() => {
    try {
      setCanWishlist(!!localStorage.getItem('userToken'));
    } catch {
      setCanWishlist(false);
    }
  }, []);

  useEffect(() => {
    const checkWishlist = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return;
        const res = await apiFetch(`/api/user/wishlist/check/${product.id}`);
        const data = await res.json();
        if (data && data.success) setIsFavorite(!!data.exists);
      } catch { }
    };
    if (!canWishlist) return;
    checkWishlist();
  }, [product.id, canWishlist]);

  const toggleWishlist = async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('userToken');
    if (!token) {
      setShowLoginPopup(true);
      return;
    }

    const next = !isFavorite;
    setIsFavorite(next);

    try {
      const endpoint = next ? '/api/user/wishlist' : `/api/user/wishlist/${product.id}`;
      const res = await apiFetch(endpoint, {
        method: next ? 'POST' : 'DELETE',
        body: next ? { product_id: product.id } : undefined
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Wishlist update failed');
      }
      toast.success(next ? 'Added to wishlist' : 'Removed from wishlist', { theme: 'dark' });
    } catch (err) {
      setIsFavorite(!next);
      toast.error(err.message || 'Wishlist update failed', { theme: 'dark' });
    }
  };

  const handleCardClick = () => {
    if (isViewMore) {
      navigate(viewMoreUrl);
    } else {
      onClick(product);
    }
  };

  return (
    <>
      <motion.div
        style={{ ...styles.card, position: 'relative', width: '100%' }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        onMouseEnter={() => !isViewMore && setIsHovered(true)}
        onMouseLeave={() => !isViewMore && setIsHovered(false)}
        onClick={handleCardClick}
        whileHover={!isViewMore ? { y: -6 } : {}}
      >
        {isViewMore && (
          <div style={styles.blurOverlay}>
            <div style={styles.blurText}>
              <FiArrowRight size={24} />
              View More
            </div>
          </div>
        )}
        <div style={{ ...styles.cardImgWrapper, filter: isViewMore ? 'blur(2px)' : 'none' }}>
          <img
                    src={product.firstImage || (product.allImages && product.allImages[0]) || 'placeholder.jpg'}
                    alt={`Custom laser engraved ${product.product_name} in Finland`}
                    loading="lazy"
                    width="400"
                    height="400"
                    style={{
                      ...styles.cardImg,
                      transition: 'opacity 0.3s ease-in-out',
                      opacity: 1
                    }}
                    onLoad={(e) => {
                      e.target.style.opacity = 1;
                    }}
                    onError={(e) => {
                      e.target.style.opacity = 1;
                    }}
                  />
          {canWishlist && !isViewMore && (
            <button style={styles.wishlistBtn} onClick={toggleWishlist}>
              <FiHeart size={12} color={isFavorite ? theme.colors.accent : (isHovered ? '#000' : '#fff')} fill={isFavorite ? theme.colors.accent : 'none'} />
            </button>
          )}
          <AnimatePresence>
            {isHovered && !isViewMore && (
              <motion.div style={styles.actionOverlay} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}>
                {product.is_customizable ? (
                  <button style={styles.addToCartBtn} onClick={(e) => { e.stopPropagation(); navigate(`/customization/${product.id}`); }}>
                    <FiEdit2 size={14} /> Personalization
                  </button>
                ) : (
                  <button style={styles.addToCartBtn} onClick={(e) => { e.stopPropagation(); addToCartWithNotification(product, 1); }}>
                    <FiShoppingCart size={14} /> Add
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div style={{ ...styles.cardDetails, filter: isViewMore ? 'blur(2px)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.65rem', color: theme.colors.gold, fontWeight: 700 }}>{product.category}</span>
            <span style={{ fontSize: '0.7rem', color: product.is_preorder ? '#3498db' : theme.colors.green }}>{product.is_preorder ? 'Pre-order' : 'In Stock'}</span>
          </div>
          <MarqueeProductName productName={product.product_name} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(() => {
              const originalPrice = Number(product.price || 0);
              const moq = Number(product.moq) || 1;
              const discountRanges = (product.metadata && product.metadata.discount_ranges) || product.discount_ranges || [];
              const quantityDiscountPercent = calculateDiscountPercent(moq, discountRanges);
              const quantityDiscountedPrice = originalPrice * (1 - quantityDiscountPercent / 100);



              // Only show discount if there are discount ranges
              const hasDiscount = discountRanges.length > 0 && quantityDiscountPercent > 0;
              const displayPrice = hasDiscount ? quantityDiscountedPrice : originalPrice;

              return (
                <>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{format(displayPrice, 'EUR')}</span>
                  {hasDiscount && (
                    <>
                      <span style={{ fontSize: '0.85rem', color: '#999', textDecoration: 'line-through' }}>{format(originalPrice, 'EUR')}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00ff88' }}>-{Math.round(quantityDiscountPercent)}%</span>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          <div style={{ fontSize: '0.6rem', color: '#9CA3AF', marginTop: '4px' }}>
            *Price without VAT
          </div>
          {product.review_count > 0 && product.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <FiStar style={{ color: '#FFD700', fontSize: '0.9rem' }} />
              <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{product.rating}</span>
              <span style={{ fontSize: '0.75rem', color: '#999' }}>({product.review_count})</span>
            </div>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {showLoginPopup && (
          <LoginForm
            onClose={() => setShowLoginPopup(false)}
            onSuccess={() => {
              setCanWishlist(true);
              setShowLoginPopup(false);
            }}
            isMobile={false}
          />
        )}
      </AnimatePresence>
    </>
  );
});

const OfferCarousel = ({ products, onClickProduct }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { format } = useLocale();

  const offerProducts = useMemo(() => {
    const filtered = products.filter(p => p.tags && p.tags.some(tag => String(tag).toUpperCase() === 'OFFER'));
    return filtered.sort((a, b) => getSaleCarouselPricing(b).maxDiscountPercent - getSaleCarouselPricing(a).maxDiscountPercent);
  }, [products]);

  const next = useCallback(() => {
    if (offerProducts.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % offerProducts.length);
  }, [offerProducts.length]);

  useEffect(() => {
    if (!isPaused && offerProducts.length > 1) {
      const interval = setInterval(next, 4000);
      return () => clearInterval(interval);
    }
  }, [isPaused, next, offerProducts.length]);

  if (offerProducts.length === 0) return null;

  const currentProduct = offerProducts[currentIndex];
  const { originalPrice, unitPrice, maxDiscountPercent, quantity, hasDiscount } = getSaleCarouselPricing(currentProduct);

  const isFreeShipping = Boolean(currentProduct.free_shipping || (currentProduct.metadata && currentProduct.metadata.free_shipping));
  const promoMeta = currentProduct.metadata && (currentProduct.metadata.promo || currentProduct.metadata.promo_code || currentProduct.metadata.promo_details) ? (currentProduct.metadata.promo || currentProduct.metadata.promo_code || currentProduct.metadata.promo_details) : null;
  const promoPercent = promoMeta && (promoMeta.value || promoMeta.percent) ? (promoMeta.value || promoMeta.percent) : null;

  return (
    <section className="sale-carousel-premium">
      <div className="sale-header">
        <div className="sale-badge">
          <FiZap className="zap-icon" /> FLASH OFFER
        </div>
        <div className="sale-timer">
          Limited Time Offers <FiPercent style={{ marginLeft: '5px' }} />
        </div>
      </div>

      <div
        className="sale-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentProduct.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="sale-slide"
            onClick={() => onClickProduct(currentProduct)}
            style={{
              backgroundImage: `url(${currentProduct.firstImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="sale-overlay"></div>

            <div className="sale-content-wrapper">
              <motion.div
                className="sale-discount-badge"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <div className="discount-badge-ring">
                  <div className="discount-badge-inner">
                    {isFreeShipping ? (
                      <>
                        <span className="discount-label">FREE</span>
                        <span className="discount-percent">
                          <span className="discount-number">SHIP</span>
                        </span>
                        <span className="discount-text">SHIPPING</span>
                      </>
                    ) : promoPercent ? (
                      <>
                        <span className="discount-label">up to</span>
                        <span className="discount-percent">
                          <span className="discount-number">{promoPercent}</span>
                          <span className="discount-symbol">%</span>
                        </span>
                        <span className="discount-text">OFF</span>
                      </>
                    ) : (
                      <>
                        <span className="discount-label">up to</span>
                        <span className="discount-percent">
                          <span className="discount-number">{maxDiscountPercent}</span>
                          <span className="discount-symbol">%</span>
                        </span>
                        <span className="discount-text">OFF</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              <div className="sale-text-content">
                <motion.h3
                  className="sale-item-title"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentProduct.product_name}
                </motion.h3>

                <motion.div
                  className="sale-pricing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <span className="sale-price-new">{format(unitPrice, 'EUR')}</span>
                  {hasDiscount && (
                    <span className="sale-price-old">{format(originalPrice, 'EUR')}</span>
                  )}
                  <span className="sale-price-qty">/ unit · {quantity}+ pcs</span>
                </motion.div>

                <motion.p
                  className="sale-description-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {currentProduct.description ?
                    (currentProduct.description.length > 100 ? currentProduct.description.substring(0, 100) + '...' : currentProduct.description)
                    : 'Exclusive premium collection available for a limited time.'}
                </motion.p>

                {/* Extra details: free shipping or promo info */}
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {isFreeShipping && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 8 }}>
                      <FiTruck />
                      <span style={{ fontSize: 12, color: '#fff' }}>Free shipping for this product</span>
                    </div>
                  )}

                  {promoMeta && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#FFD700' }}>{promoPercent ? `${promoPercent}% OFF` : 'Promo'}</span>
                        {promoMeta.code && <span style={{ fontSize: 12, color: '#ccc' }}>Code: {promoMeta.code}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {promoMeta.valid_until ? `Valid until ${promoMeta.valid_until}` : promoMeta.expires ? `Expires ${promoMeta.expires}` : (promoMeta.max_uses ? `${promoMeta.max_uses} uses` : '')}
                      </div>
                    </div>
                  )}
                </div>

                <motion.button
                  className="sale-buy-btn-modern"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickProduct(currentProduct);
                  }}
                >
                  <FiEye /> VIEW
                </motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="sale-dots">
          {offerProducts.map((_, idx) => (
            <div
              key={idx}
              className={`sale-dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const NewArrivalsCarousel = ({ products, onClickProduct }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { format } = useLocale();
  const [direction, setDirection] = useState(1);

  const newProducts = useMemo(() =>
    products.filter(p => p.tags && p.tags.some(tag => String(tag).toUpperCase() === 'NEW')),
    [products]
  );

  const next = useCallback(() => {
    if (newProducts.length === 0) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % newProducts.length);
  }, [newProducts.length]);

  const prev = useCallback(() => {
    if (newProducts.length === 0) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + newProducts.length) % newProducts.length);
  }, [newProducts.length]);

  useEffect(() => {
    if (!isPaused && newProducts.length > 1) {
      const interval = setInterval(next, 6000);
      return () => clearInterval(interval);
    }
  }, [isPaused, next, newProducts.length]);

  if (newProducts.length === 0) return null;

  const currentProduct = newProducts[currentIndex];

  return (
    <section className="new-arrivals-premium">
      <div className="section-header-modern">
        <div className="header-title-group">
          <FaFire className="fire-icon" />
          <h2>NEW ARRIVALS</h2>
          <div className="carousel-controls-inline">
            <button onClick={prev} className="nav-btn-modern"><FiChevronLeft /></button>
            <button onClick={next} className="nav-btn-modern"><FiChevronRight /></button>
          </div>
        </div>
      </div>

      <div
        className="carousel-wrapper-modern"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentProduct.id}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 50 : -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction > 0 ? -50 : 50, scale: 0.9 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className="modern-carousel-slide"
            onClick={() => onClickProduct(currentProduct)}
            style={{
              backgroundImage: `url(${currentProduct.firstImage})`,
              backgroundSize: 'cover'
            }}
          >
            <div className="modern-slide-overlay"></div>

            <div className="modern-slide-content">
              <motion.span
                className="modern-category-tag"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {currentProduct.category}
              </motion.span>

              <motion.h3
                className="modern-product-title"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                {currentProduct.product_name}
              </motion.h3>

              <motion.div
                className="modern-price-badge"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                {format(currentProduct.discounted_price || currentProduct.price, 'EUR')}
              </motion.div>

              <motion.button
                className="modern-add-btn"
                whileHover={{ scale: 1.1, backgroundColor: '#BF953F', color: '#000' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClickProduct(currentProduct);
                }}
              >
                <FiEye /> VIEW
              </motion.button>
            </div>

            <div className="modern-slide-dots">
              {newProducts.slice(0, 10).map((_, idx) => (
                <div
                  key={idx}
                  className={`modern-dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

const SociableKitWidget = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Remove any existing SociableKit scripts first
    const existingScripts = document.querySelectorAll('script[src*="sociablekit.com"]');
    existingScripts.forEach(script => script.remove());

    // Create and append the script
    const script = document.createElement('script');
    script.src = 'https://widgets.sociablekit.com/google-reviews/widget.js';
    script.defer = true;
    script.async = true;
    containerRef.current.appendChild(script);

    // Cleanup function
    return () => {
      if (containerRef.current) {
        const scripts = containerRef.current.querySelectorAll('script');
        scripts.forEach(s => s.remove());
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '200px',
        position: 'relative',
        zIndex: 999
      }}
    >
      <div className="sk-ww-google-reviews" data-embed-id="25690427"></div>
    </div>
  );
};

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [isFetchingVideos, setIsFetchingVideos] = useState(true);

  // Sort categories: put Craft, Laser first, then Resin, Jewelry, etc. Hide Apparel
  const sortedCategories = useMemo(() => {
    const priorityOrder = [
      'craft Item',
      'Wooden craft',
      'Laser Cutting Products',
      'Key Rings',
      'Show Pieces',
      'Resin craft',
      'Jewelry',
      'Photo magnet',
      'Leather Accessories',
      'Printed Rock',
      'Hoodie',
      'T-Shirt'
    ];

    // Filter out Apparel and sort the rest
    return categories
      .filter(cat => cat.name !== 'Apparel') // Hide Apparel
      .sort((a, b) => {
        const indexA = priorityOrder.indexOf(a.name);
        const indexB = priorityOrder.indexOf(b.name);

        // If both are in priority list, sort by their order
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // If only a is in priority list, a comes first
        if (indexA !== -1) return -1;
        // If only b is in priority list, b comes first
        if (indexB !== -1) return 1;
        // Otherwise, sort alphabetically
        return a.name.localeCompare(b.name);
      });
  }, [categories]);
  const [products, setProducts] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tick, setTick] = useState(0); // For 1-minute update
  const navigate = useNavigate();
  const location = useLocation();
  const heroVideoRef = useRef(null);
  const [tagIndex, setTagIndex] = useState(0);
  const { addToCart } = useCart();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      v.playsInline = true;
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch { }
  }, []);

  const isMobile = windowWidth < 768;
  const isDesktop = windowWidth >= 1024;

  const heroTags = [
    { icon: <FiAward />, title: 'Premium Quality', sub: 'Finest materials' },
    { icon: <FiSettings />, title: 'Custom Made', sub: 'Personalized for you' },
    { icon: <FiTruck />, title: 'Fast Delivery', sub: 'Across Finland' },
    { icon: <FiShield />, title: 'Secure Payment', sub: '100% safe checkout' }
  ];

  const toSlug = (str) => {
    try {
      return String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } catch { return ''; }
  };

  const hasAttributeMatch = (product, keywords, searchInDesc = false) => {
    if (!product || !keywords || keywords.length === 0) return false;
    const name = (product.product_name || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    const tags = (product.tags || []).map(t => String(t).toLowerCase());
    const catsList = (product.categories || []).map(c => String(c).toLowerCase());

    return keywords.some(key => {
      const k = key.toLowerCase();
      const match = name.includes(k) || cat.includes(k) || tags.some(tag => tag.includes(k)) || catsList.some(c => c.includes(k));
      if (searchInDesc) return match || desc.includes(k);
      return match;
    });
  };

  const isProductInTab = (p, tabName) => {
    if (!p || !tabName) return false;
    const t = tabName.toLowerCase();
    if (t === 'laser & engraving' && hasAttributeMatch(p, ['laser', 'engraving', 'printing', 'engraved'], true)) return true;

    // Strict Resin filtering: only if "resin" is in name or description
    if (t === 'resin jewelry') {
      const name = (p.product_name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes('resin') || desc.includes('resin');
    }

    if (t === 'apparel' && hasAttributeMatch(p, ['clothing', 'T-shirt', 'Hoodie', 'apparel', 'wear', 'fashion', 'shirt', 'tshirt'])) return true;
    return false;
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cRes, pRes, vRes] = await Promise.all([
          apiFetch('/api/categories'),
          apiFetch('/api/products?limit=100'),
          apiFetch('/api/videos')
        ]);
        const cData = await cRes.json();
        const pData = await pRes.json();
        const vData = await vRes.json();

        if (cData.success) setCategories(cData.categories || []);
        if (vData.success) setVideos(vData.videos || []);

        const safeParse = (data) => {
          if (!data) return [];
          if (Array.isArray(data)) return data;
          try { return JSON.parse(data); } catch (e) { return []; }
        };

        setProducts(pData.map(p => {
          const tags = safeParse(p.tags);
          const categories = safeParse(p.categories);
          const productPhotos = safeParse(p.product_photos);
          const allImages = productPhotos.map(url => absoluteUrl(url));
          const metadata = typeof p.metadata === 'string' ? safeParse(p.metadata) : (p.metadata || {});

          // Parse discount ranges if they are stringified
          let discountRanges = metadata.discount_ranges || p.discount_ranges || [];
          if (typeof discountRanges === 'string') {
            try {
              discountRanges = JSON.parse(discountRanges);
            } catch (e) {
              discountRanges = [];
            }
          }

          return {
            ...p,
            price: Number(p.price),
            tags,
            categories,
            allImages,
            firstImage: allImages.length > 0 ? allImages[0] : absoluteUrl(p.thumbnail),
            metadata,
            discount_ranges: Array.isArray(discountRanges) ? discountRanges : [],
            moq: Number(p.moq) || 1
          };
        }));
      } catch (err) { console.error(err); }
      finally { 
        setIsFetching(false); 
        setIsFetchingVideos(false); 
      }
    };
    fetchAll();
  }, []);

  // 1-minute timer to update products
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTagIndex((prev) => (prev + 1) % heroTags.length), 4000); // Slow down interval to 4s
    return () => clearInterval(interval);
  }, [heroTags.length]);

  const addToCartWithNotification = (product, qty) => {
    addToCart({ ...product, image: product.firstImage }, qty);
    toast.success('Added to Cart');
  };

  // Helper to shuffle and pick items
  const shuffleAndPick = (array, count) => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const handleProductSelect = (product) => {
    if (product) {
      const slug = toSlug(product.product_name);
      navigate(`/products/${slug}-${product.id}`, { state: { background: location, product } });
    }
  };

  // Helper to get embed URL for YouTube/Vimeo/Facebook
  const getEmbedUrl = (url) => {
    if (!url) return '';
    
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    
    // Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    // Facebook - support multiple URL formats
    try {
      // Encode the full URL for Facebook embed
      const encodedUrl = encodeURIComponent(url);
      return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&width=500`;
    } catch (e) {
      return url;
    }
  };

  const laserProducts = useMemo(() => {
    const allLaser = products.filter(p => isProductInTab(p, 'laser & engraving'));
    if (allLaser.length === 0) return [];

    // Grouping for diversity as requested
    const groups = {
      keychains: allLaser.filter(p => hasAttributeMatch(p, ['key', 'chain', 'ring', 'keyring'], true)),
      wood: allLaser.filter(p => hasAttributeMatch(p, ['wood', 'wooden'], true)),
      craft: allLaser.filter(p => hasAttributeMatch(p, ['craft', 'art'], true)),
      unique: allLaser.filter(p => hasAttributeMatch(p, ['unique', 'knife', 'choku', 'stone', 'leather'], true)),
      gifts: allLaser.filter(p => hasAttributeMatch(p, ['gift', 'personalized'], true))
    };

    let result = [];
    const usedIds = new Set();

    // Pick one from each group if available
    Object.values(groups).forEach(group => {
      if (group.length > 0) {
        const pick = group[Math.floor(Math.random() * group.length)];
        if (!usedIds.has(pick.id)) {
          result.push(pick);
          usedIds.add(pick.id);
        }
      }
    });

    // Fill remaining spots with random laser products
    const remaining = allLaser.filter(p => !usedIds.has(p.id));
    const finalResult = [...result, ...shuffleAndPick(remaining, 6 - result.length)];

    return shuffleAndPick(finalResult, 6);
  }, [products, tick]);

  const resinProducts = useMemo(() => {
    const allResin = products.filter(p => isProductInTab(p, 'resin jewelry'));
    return shuffleAndPick(allResin, 6);
  }, [products, tick]);

  const apparelProducts = useMemo(() => {
    const allApparel = products.filter(p => isProductInTab(p, 'apparel'));
    return shuffleAndPick(allApparel, 6);
  }, [products, tick]);

  const getCategoryIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('laser engraving')) return <FiSun />;
    if (n.includes('laser cutting')) return <FiScissors />;
    if (n.includes('leather')) return <FiShoppingBag />;
    if (n.includes('wooden') || n.includes('wood')) return <FaTree />;
    if (n.includes('resin')) return <FiDroplet />;
    if (n.includes('jewelry')) return <FaGem />;
    if (n.includes('home decor')) return <FiHome />;
    if (n.includes('hoodie') || n.includes('t-shirt') || n.includes('apparel')) return <FaTshirt />;
    if (n.includes('key ring') || n.includes('keyring')) return <FiKey />;
    if (n.includes('photo magnet')) return <FiCamera />;
    if (n.includes('show piece')) return <FiBox />;
    if (n.includes('gift')) return <FiAward />;
    return <FiBox />;
  };

  return (
    <div style={styles.pageContainer}>
      <Helmet>
        <title>Yokebud craft | Laser Engraving, Cutting, 3D Printing & Apparel | Helsinki, Finland | Shipping to Europe</title>
        <meta name="description" content="Yokebud craft is your premier creative studio in Helsinki, Finland. We specialize in custom laser engraving, laser cutting, 3D printing, personalized apparel, custom signage, engraved awards, and corporate gifts. Serving Finland (Helsinki, Espoo, Vantaa, Kerava), Sweden, Norway, Denmark, Germany, and all of Europe with fast shipping, free design service, and no minimum order quantity. Materials include wood, leather, metal, acrylic, glass, fabric, paper, and more!" />
        <meta name="keywords" content="laser engraving Finland, laser engraving Helsinki, laser cutting Finland, laser cutting Helsinki, 3D printing Finland, 3D printing Helsinki, custom apparel printing Finland, personalized gifts Finland, corporate gifts Finland, liikelahjat, laserkaiverrus, laserleikkaus, Helsinki, Espoo, Vantaa, Kerava, Suomi, laser engraving Europe, laser cutting Europe, 3D printing Europe, custom printing Europe, T-shirt printing Finland, personalized hoodies Finland, custom signage Finland, engraved trophies Finland, engraved awards Finland, personalized accessories EU, sustainable gifts Finland, Nordic design gifts, bespoke gifts EU, European craftmanship, custom fridge magnets Finland, engraved keychains Finland, wedding gifts Finland, anniversary gifts Finland, baby gifts Finland, graduation gifts Finland, custom leather engraving Finland, engraved wood products Finland, custom acrylic engraving Finland, custom fabric laser cutting Finland, engraved glass Finland, engraved stone Finland, fast laser services Finland, Yokebud craft Finland, custom laser gifts Europe" />
        <meta name="language" content="English" />
        <meta name="geo.region" content="FI,EU" />
        <meta name="geo.placename" content="Helsinki, Finland, Europe" />
        <meta name="geo.position" content="60.4037;25.1101" />
        <meta name="ICBM" content="60.4037, 25.1101" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href="https://www.yokebud.fi/" />

        {/* International SEO: Hreflang Tags for Target Markets */}
        <link rel="alternate" hreflang="fi-FI" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-FI" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-SE" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-NO" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-DK" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="de-DE" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-GB" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="en-US" href="https://www.yokebud.fi/" />
        <link rel="alternate" hreflang="x-default" href="https://www.yokebud.fi/" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.yokebud.fi/" />
        <meta property="og:title" content="Yokebud craft | Laser Engraving, Cutting, 3D Printing & Custom Apparel | Helsinki, Finland" />
        <meta property="og:description" content="Premium laser engraved, cut, 3D printed products & custom apparel from Helsinki, Finland. Serving all of Europe with personalized gifts, corporate gifts, custom signage, engraved awards, and bespoke accessories with fast shipping." />
        <meta property="og:image" content="https://www.yokebud.fi/LOGO.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Yokebud craft - Laser Engraving, Cutting, 3D Printing & Apparel Finland & Europe" />
        <meta property="og:site_name" content="Yokebud craft" />
        <meta property="og:locale" content="fi_FI" />
        <meta property="og:locale:alternate" content="en_GB" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="sv_SE" />
        <meta property="og:locale:alternate" content="de_DE" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://www.yokebud.fi/" />
        <meta name="twitter:title" content="Yokebud craft | Laser Engraving, Cutting, 3D Printing & Custom Apparel | Helsinki, Finland" />
        <meta name="twitter:description" content="Premium laser engraved, cut, 3D printed products & custom apparel from Helsinki, Finland. Serving all of Europe with personalized gifts, corporate gifts, custom signage, engraved awards, and bespoke accessories with fast shipping." />
        <meta name="twitter:image" content="https://www.yokebud.fi/LOGO.png" />
        <meta name="twitter:image:alt" content="Yokebud craft - Laser Engraving, Cutting, 3D Printing & Apparel Finland & Europe" />
      </Helmet>
      <ToastContainer position="top-right" theme="dark" />
      <style>{`
        /* Carousel Premium Styles */
        .new-arrivals-premium {
          overflow: hidden;
        }
        .carousel-nav-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(191, 149, 63, 0.3);
          color: #BF953F;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .carousel-nav-btn:hover {
          background: #BF953F;
          color: #000;
          box-shadow: 0 0 15px rgba(191, 149, 63, 0.3);
        }
        .carousel-container {
          position: relative;
          min-height: 300px;
          background: rgba(15, 15, 15, 0.4);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 20px;
          backdrop-filter: blur(10px);
        }
        .carousel-slide {
          display: flex;
          gap: 30px;
          align-items: center;
          cursor: pointer;
        }
        .slide-image-wrapper {
          flex: 0.8;
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          max-width: 350px;
          aspect-ratio: 1;
        }
        .slide-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s ease;
        }
        .carousel-slide:hover .slide-image-wrapper img {
          transform: scale(1.05);
        }
        .slide-content {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .slide-category {
          color: #BF953F;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-size: 0.75rem;
        }
        .slide-title {
          font-size: clamp(1.2rem, 3vw, 1.8rem);
          font-weight: 700;
          background: linear-gradient(to right, #fff, #bbb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          line-height: 1.2;
        }
        .slide-description {
          color: #999;
          line-height: 1.5;
          font-size: 0.9rem;
          margin: 0;
        }
        .slide-price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          background: rgba(255,255,255,0.02);
          padding: 12px 15px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .price-group {
          display: flex;
          flex-direction: column;
        }
        .current-price {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
        }
        .old-price {
          text-decoration: line-through;
          color: #555;
          font-size: 0.9rem;
        }
        .slide-add-btn {
          background: linear-gradient(#000, #000) padding-box, linear-gradient(135deg, #BF953F, #FCF6BA, #B38728) border-box;
          color: #BF953F;
          border: 1px solid transparent;
          padding: 8px 18px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .slide-add-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(191, 149, 63, 0.25);
        }
        .carousel-dots {
          display: flex;
          gap: 6px;
          margin-top: 15px;
        }
        .dot {
          width: 20px;
          height: 2px;
          background: rgba(255,255,255,0.05);
          border-radius: 1px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .dot.active {
          background: #BF953F;
          width: 35px;
        }

        /* New Arrivals Carousel Redesign */
        .new-arrivals-premium {
          margin: 0px 0 40px 0;
          padding: 20px;
        }
        .section-header-modern {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          padding: 0 10px;
        }
        .header-title-group {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .header-title-group h2 {
          font-size: 1.2rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
          letter-spacing: 1px;
          white-space: nowrap;
        }
        .carousel-controls-inline {
          display: flex;
          gap: 8px;
        }
        .fire-icon {
          color: #ff4d4d;
          font-size: 1rem;
          filter: drop-shadow(0 0 8px rgba(255, 77, 77, 0.6));
        }
        .nav-btn-modern {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          width: 35px;
          height: 35px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .nav-btn-modern:hover {
          background: #BF953F;
          color: #000;
          border-color: #BF953F;
          transform: translateY(-2px);
        }
        .carousel-wrapper-modern {
          position: relative;
          height: 400px;
          border-radius: 24px;
          overflow: hidden;
        }
        .modern-carousel-slide {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px;
          cursor: pointer;
          background-position: center;
        }
        @media (min-width: 769px) {
          .modern-carousel-slide { background-position: right 20% center; }
        }
        .modern-slide-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 100%);
          z-index: 1;
        }
        .modern-slide-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-width: 500px;
          background: rgba(0, 0, 0, 0);
          padding: 30px;
          border-radius: 24px;
        }
        .modern-category-tag {
          color: #BF953F;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .modern-product-title {
          font-size: 1.8rem;
          font-weight: 900;
          color: #fff;
          margin: 0;
          line-height: 1.2;
        }
        .modern-price-badge {
          backdrop-filter: blur(10px);
          padding: 8px 20px;
          width: fit-content;
          color: red;
          font-weight: 700;
          font-size: 1.5rem;
        }
        .modern-add-btn {
          margin-top: 10px;
          background: #fff;
          color: #000;
          border: none;
          padding: 14px 30px;
          border-radius: 50px;
          font-weight: 800;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          transition: all 0.3s ease;
        }
        .modern-slide-dots {
          position: absolute;
          bottom: 30px;
          right: 40px;
          display: flex;
          gap: 8px;
          z-index: 3;
        }
        .modern-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .modern-dot.active {
          background: #BF953F;
          transform: scale(1.5);
          box-shadow: 0 0 10px rgba(191, 149, 63, 0.5);
        }

        @media (max-width: 768px) {
          .carousel-wrapper-modern { height: 350px; }
          .modern-carousel-slide { padding: 30px; }
          .modern-slide-overlay {
            background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.8) 100%);
          }
          .modern-slide-content {
            justify-content: flex-end;
            height: 100%;
            text-align: center;
            align-items: center;
            padding: 20px;
          }
          .modern-product-title { 
            font-size: 1.1rem; 
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 5px;
          }
          .modern-slide-dots {
            display: none;
          }
          .modern-category-tag { font-size: 0.7rem; }
          .modern-price-badge { font-size: 1.1rem; padding: 5px 15px; }
          .modern-add-btn { padding: 10px 25px; font-size: 0.8rem; }
        }

        /* Sale Carousel Premium Styles Redesign */
        .sale-carousel-premium {
          margin: 0px 0 40px 0;
          padding: 40px;
          border-radius: 30px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0,0,0,0.7);
        }
        .sale-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }
        .sale-badge {
          border:1px solid linear-gradient(135deg, #ff416c, #ff4b2b);
          color: red;
          padding: 10px 20px;
          border-radius: 50px;
          font-weight: 800;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 0 25px rgba(255, 75, 43, 0.5);
          animation: pulse-modern 2s infinite;
        }
        @keyframes pulse-modern {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 75, 43, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(255, 75, 43, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 75, 43, 0); }
        }
        .sale-timer {
          color: gray;
          font-weight: 700;
          font-size: 0.65rem;
          display: flex;
          align-items: center;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .sale-container {
          position: relative;
          min-height: 450px;
        }
        .sale-slide {
          height: 450px;
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          align-items: center;
          position: relative;
          cursor: pointer;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sale-slide:hover {
          transform: translateY(-5px);
        }
        .sale-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.2) 100%);
          z-index: 1;
        }
        .sale-content-wrapper {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          padding: 0 60px;
          gap: 50px;
          width: 100%;
        }
        .sale-discount-badge {
          width: 148px;
          height: 148px;
          flex-shrink: 0;
          filter: drop-shadow(0 10px 28px rgba(191, 149, 63, 0.4));
        }
        .discount-badge-ring {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(145deg, #FBF5B7 0%, #BF953F 35%, #AA771C 65%, #FCF6BA 100%);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.12) inset,
            0 6px 24px rgba(0, 0, 0, 0.45);
        }
        .discount-badge-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #3d1a1f 0%, #1a0a0d 52%, #0a0405 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          position: relative;
          overflow: hidden;
        }
        .discount-badge-inner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 75% 85%, rgba(231, 76, 60, 0.18) 0%, transparent 55%);
          pointer-events: none;
        }
        .discount-badge-inner::after {
          content: '';
          position: absolute;
          top: 8%;
          left: 18%;
          width: 35%;
          height: 22%;
          background: radial-gradient(ellipse, rgba(255, 255, 255, 0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .discount-label {
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(252, 246, 186, 0.9);
          line-height: 1;
          margin-bottom: 3px;
          position: relative;
          z-index: 1;
        }
        .discount-percent {
          display: flex;
          align-items: flex-start;
          line-height: 1;
          position: relative;
          z-index: 1;
        }
        .discount-number {
          font-size: 2.65rem;
          font-weight: 900;
          background: linear-gradient(180deg, #FFFFFF 0%, #FCF6BA 45%, #D4AF37 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.03em;
        }
        .discount-symbol {
          font-size: 1.05rem;
          font-weight: 800;
          color: #FF6B5B;
          margin-top: 5px;
          margin-left: 1px;
          text-shadow: 0 0 12px rgba(255, 107, 91, 0.5);
        }
        .discount-text {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #fff;
          margin-top: 3px;
          text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
          position: relative;
          z-index: 1;
        }
        .sale-text-content {
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-width: 600px;
          background: rgba(0, 0, 0, 0);
          padding: 30px;
          border-radius: 24px;
        }
        .sale-item-title {
          font-size: 2rem;
          font-weight: 900;
          color: #fff;
          margin: 0;
          line-height: 1.1;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .sale-pricing {
          display: flex;
          align-items: baseline;
          gap: 20px;
        }
        .sale-price-new {
          font-size: 2.8rem;
          font-weight: 900;
          color: #2ecc71;
        }
        .sale-price-old {
          font-size: 1.6rem;
          color: rgba(255,255,255,0.5);
          text-decoration: line-through;
        }
        .sale-price-qty {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.65);
          font-weight: 600;
        }
        .sale-description-text {
          color: rgba(255,255,255,0.8);
          font-size: 1.1rem;
          line-height: 1.6;
          margin: 5px 0 15px 0;
        }
        .sale-buy-btn-modern {
          background: #fff;
          color: #000;
          border: none;
          padding: 16px 40px;
          border-radius: 50px;
          font-weight: 800;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          gap: 12px;
          width: fit-content;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .sale-buy-btn-modern:hover {
          background: #BF953F;
          color: #000;
          transform: scale(1.05);
          box-shadow: 0 10px 30px rgba(191, 149, 63, 0.4);
        }
        .sale-dots {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 40px;
        }
        .sale-dot {
          width: 30px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.1);
          cursor: pointer;
          transition: all 0.4s ease;
        }
        .sale-dot.active {
          background: #BF953F;
          width: 60px;
        }

        @media (max-width: 1024px) {
          .sale-content-wrapper { padding: 0 40px; gap: 30px; }
          .sale-item-title { font-size: 2.5rem; }
          .sale-discount-badge { width: 128px; height: 128px; }
          .discount-number { font-size: 2.2rem; }
          .discount-symbol { font-size: 0.9rem; margin-top: 4px; }
        }

        @media (max-width: 768px) {
          .sale-carousel-premium { padding: 0px; margin: 20px 0; border-radius: 20px; }
          .sale-container { min-height: 400px; }
          .sale-slide { height: 400px; }
          .sale-overlay {
            background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.95) 100%);
          }
          .sale-content-wrapper {
            flex-direction: column;
            padding: 30px 0px;
            justify-content: flex-end;
            align-items: center;
            text-align: left;
            gap: 20px;
          }
          .sale-discount-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 72px;
            height: 72px;
            z-index: 5;
          }
          .discount-badge-ring { padding: 2px; }
          .discount-label { font-size: 0.38rem; letter-spacing: 0.12em; margin-bottom: 1px; }
          .discount-number { font-size: 1.35rem; }
          .discount-symbol { font-size: 0.55rem; margin-top: 2px; }
          .discount-text { font-size: 0.42rem; letter-spacing: 0.15em; margin-top: 1px; }
          .sale-item-title { 
            font-size: 1.2rem; 
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
            overflow: hidden;
            max-width: 90%;
          }
          .sale-pricing { gap: 15px; }
          .sale-price-new { font-size: 1.8rem; }
          .sale-price-old { font-size: 1.1rem; }
          .sale-description-text { display: none; }
          .sale-buy-btn-modern { padding: 12px 30px; font-size: 0.9rem;}
          .sale-dots { margin-top: 25px; }
          .sale-dot { width: 20px; }
          .sale-dot.active { width: 40px; }
        }

        @media (max-width: 768px) {
          .carousel-slide {
            flex-direction: column;
            gap: 15px;
            padding: 10px;
          }
          .slide-image-wrapper {
            max-width: 250px;
            width: 100%;
            margin: 0 auto;
          }
          .slide-content {
            width: 100%;
            text-align: center;
            align-items: center;
          }
          .slide-title {
            font-size: 1.3rem;
          }
          .slide-description {
            font-size: 0.8rem;
          }
          .carousel-dots {
            justify-content: center;
          }
          .slide-price-row {
            width: 100%;
            flex-direction: column;
            gap: 10px;
          }
        }

      `}</style>

      {/* Hero Section */}
{/* Hero Section - Fixed Animation */}
<section style={{ ...styles.heroPlaceholder, padding: isMobile ? '32px 12px 22px' : styles.heroPlaceholder.padding }}>
  <video ref={heroVideoRef} src={coverVideo} autoPlay muted loop playsInline preload="auto" style={styles.heroVideoFixed} />
  <div style={styles.heroOverlay} />
  <div style={styles.heroContainer}>
    <motion.div style={{ ...styles.heroLeft, padding: isMobile ? '0' : styles.heroLeft.padding }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ color: '#BF953F', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Premium Laser Engraving
      </div>
      <h1 style={styles.heroTitle}>
        Customizable Gifts <br />
        <span style={styles.heroTitleGold}>Made for You.</span>
      </h1>
      <p style={styles.heroSubtitle}>
        We don't engrave products. We engrave memories, emotions, and special moments. Proudly precision crafted in Finland.
     <br />Business ID: 3477880-6 </p>
      <div style={styles.heroBtnGroup}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={styles.heroBtnPrimary}
          onClick={() => navigate('/shop')}
        >
          Shop Now
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={styles.heroBtnSecondary}
          onClick={() => navigate('/custom-laser-order')}
        >
          Custom Order
        </motion.button>
      </div>
<div style={styles.heroTagRow}>
  <AnimatePresence>
    <motion.div
      key={tagIndex}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, position: 'absolute' }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{ ...styles.heroTag, position: 'absolute', top: 0, left: 0 }}
    >
      <div style={styles.heroTagIcon}>{heroTags[tagIndex].icon}</div>
      <div>
        {heroTags[tagIndex].title}
        <span style={styles.heroTagSmall}>{heroTags[tagIndex].sub}</span>
      </div>
    </motion.div>
  </AnimatePresence>
</div>
    </motion.div>
  </div>
</section>

      {/* Our Philosophy Section */}
      <section style={{ padding: isMobile ? '60px 20px' : '100px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Reveal>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontSize: isMobile ? '1.5rem' : '2.8rem', fontWeight: 800, marginBottom: '25px', color: '#fff' }}>
              Handcrafted with <span style={styles.goldText}>Soul & Story</span>
            </h2>
            <p style={{ color: '#ccc', fontSize: isMobile ? '0.6rem' : '0.9rem', lineHeight: '1.8', fontStyle: 'italic', marginBottom: '25px' }}>
              At Yokebud craft, we believe that products should be more than ordinary items. Every design should have meaning. Every engraving should tell a story.
            </p>
            <div style={{ width: '60px', height: '3px', background: theme.colors.goldGradient, margin: '0 auto 25px' }} />
            <p style={{ color: '#aaa', fontSize: isMobile ? '0.95rem' : '1.2rem', lineHeight: '1.8', maxWidth: '750px', margin: '0 auto' }}>
              Based in Kerava, Finland, we combine traditional craftmanship with modern laser technology to create personalized keepsakes that carry real emotional value. Whether it's wood, leather, acrylic, or resin, every piece is made in small batches with meticulous attention to detail.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Shop by Category - Visible on Desktop only here */}
      {isDesktop && (
        <section style={{ ...styles.categorySection, padding: isMobile ? '40px 12px' : styles.categorySection.padding }}>
          <h2 style={styles.categoryTitle}>Shop by Category<div style={styles.categoryTitleUnderline}></div></h2>
          {isFetching ? (
            <CategorySkeleton />
          ) : (
            <div style={styles.categoryGrid}>
              {sortedCategories.map((cat, idx) => (
                <motion.div
                  key={cat.id || idx}
                  style={{ ...styles.categoryCard, padding: isMobile ? '18px 12px' : styles.categoryCard.padding }}
                  whileHover={{ y: -15 }}
                  onClick={() => navigate(`/shop?category=${toSlug(cat.name)}`)}
                >
                  <div style={styles.categoryIcon}>{cat.image_url ? <img src={cat.image_url.startsWith('http') ? cat.image_url : `https://api.yokebud.fi${cat.image_url}`} alt={cat.name} style={styles.categoryImage} loading="lazy" width={55} height={55} /> : getCategoryIcon(cat.name)}</div>
                  <h3 style={styles.categoryName}>{cat.name}</h3>
                  <p style={styles.categorySub}>Premium & Custom</p>
                  <FiArrowRight style={{ position: 'absolute', bottom: '20px', color: '#BF953F' }} />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Categories Section removed from here */}

      {/* --- NEW SERVICE SECTIONS FROM ABOUT PAGE --- */}
      <section style={{ padding: isMobile ? '40px 20px 10px' : '80px 20px 20px' }}>
        <h2 style={styles.categoryTitle}>Our craftmanship<div style={styles.categoryTitleUnderline}></div></h2>
      </section>

      {/* --- LASER ENGRAVING & CUSTOMIZED PRODUCTS --- */}
      <section style={{ ...styles.section, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '50px', alignItems: 'center' }}>
          {/* Text Content - Left */}
          <div>
            <Reveal direction="left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <GoldIcon Icon={FaMagic} size="1.5rem" />
                <span style={{ color: theme.colors.goldSolid, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Laser & Engraving</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                Precision <span style={styles.goldText}>Laser Engraving & Printing</span>
              </h2>
              <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                Experience the art of precision! Our primary focus is professional laser engraving and printing on natural wood, premium leather, and high-quality stones.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
                {[
                  'Wooden Engraved Jewellery', 'Personalized Wooden Gifts',
                  'Custom Keyrings & Charms', 'Laser Engraved Stone Art',
                  'Custom Phone Cases', 'Engraved Desk Decor'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0', fontSize: '0.85rem' }}>
                    <FiCheck style={{ color: theme.colors.goldSolid }} /> {item}
                  </li>
                ))}
              </ul>
              <button
                style={styles.heroBtnPrimary}
                onClick={() => navigate('/shop?category=laser-engraving')}
              >
                Explore Collection
              </button>
            </Reveal>
          </div>

          {/* Dynamic Products Grid - Right */}
          <div style={{ width: '100%', minHeight: '350px' }}>
            {isFetching ? (
              <SkeletonLoader isDesktop={isDesktop} />
            ) : (
              <Reveal direction="right">
                <div
                  style={{
                    ...styles.gridProducts,
                    gridTemplateColumns: isMobile
                      ? 'repeat(2, 1fr)'
                      : isDesktop
                        ? 'repeat(3, 1fr)'
                        : 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: isMobile ? '10px' : '20px'
                  }}
                >
                  {laserProducts.map((p, idx) => (
                    <ModernProductCard
                      key={p.id}
                      product={p}
                      onClick={handleProductSelect}
                      addToCartWithNotification={addToCartWithNotification}
                      isViewMore={idx === 5}
                      viewMoreUrl="/shop?category=laser-engraving"
                    />
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* Shop Page New Arrivals Carousel */}
      <section style={{ ...styles.section, paddingTop: '0px', paddingBottom: '20px' }}>
        <NewArrivalsCarousel
          products={products}
          onClickProduct={handleProductSelect}
        />
      </section>

      {/* --- HANDCRAFTED RESIN JEWELLERY --- */}
      <section style={styles.section}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '50px',
          alignItems: 'center'
        }}>
          {/* Dynamic Products Grid - Left (on desktop) / Bottom (on mobile) */}
          <div style={{ width: '100%', minHeight: '350px', order: isMobile ? 2 : 1 }}>
            {isFetching ? (
              <SkeletonLoader isDesktop={isDesktop} />
            ) : (
              <Reveal direction="left">
                <div
                  style={{
                    ...styles.gridProductsSmall,
                    gridTemplateColumns: isMobile
                      ? 'repeat(2, 1fr)'
                      : 'repeat(auto-fill, minmax(180px, 1fr))'
                  }}
                >
                  {resinProducts.map((p, idx) => (
                    <ModernProductCard
                      key={p.id}
                      product={p}
                      onClick={handleProductSelect}
                      addToCartWithNotification={addToCartWithNotification}
                      isViewMore={idx === 5}
                      viewMoreUrl="/shop?category=resin-art"
                    />
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          {/* Text Content - Right (on desktop) / Top (on mobile) */}
          <div style={{ order: isMobile ? 1 : 2 }}>
            <Reveal direction="right">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <GoldIcon Icon={FaGem} size="1.5rem" />
                <span style={{ color: theme.colors.goldSolid, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>The Collection</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                Artisan <span style={styles.goldText}>Resin Jewelry</span>
              </h2>
              <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                In addition to our engraving services, we continue to create delicate, one-of-a-kind resin pieces using real dried flowers.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
                {[
                  'Hand-poured Resin Earrings', 'Resin Keyrings',
                  'Necklace & Pendant Sets', 'Initial Keychains',
                  'Real Dried Flower Jewellery', 'Custom Collections'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0', fontSize: '0.85rem' }}>
                    <FiCheck style={{ color: theme.colors.goldSolid }} /> {item}
                  </li>
                ))}
              </ul>
              <button
                style={styles.heroBtnPrimary}
                onClick={() => navigate('/shop?category=resin-art')}
              >
                Shop Resin Art
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Offer Carousel */}
      <section style={{ ...styles.section, paddingTop: '0px', paddingBottom: '20px' }}>
        <OfferCarousel
          products={products}
          onClickProduct={handleProductSelect}
        />
      </section>

      {/* --- CUSTOM CLOTHING & DESIGN --- */}
      <section style={{ ...styles.section, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '50px', alignItems: 'center' }}>
          {/* Text Content - Left */}
          <div>
            <Reveal direction="left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <GoldIcon Icon={FaTshirt} size="1.5rem" />
                <span style={{ color: theme.colors.goldSolid, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>Apparel Design</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                Custom <span style={styles.goldText}>Luxury Apparel</span>
              </h2>
              <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                We also offer custom design services for t-shirts and hoodies. Bring your ideas to life with high-quality prints and premium fabrics.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '30px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                  <FiCheck style={{ color: theme.colors.goldSolid }} /> Personal Wear & Styling
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                  <FiCheck style={{ color: theme.colors.goldSolid }} /> Custom Gift Printing
                </li>
              </ul>
              <button
                style={styles.heroBtnPrimary}
                onClick={() => navigate('/shop?section=apparel')}
              >
                Design Your Own
              </button>
            </Reveal>
          </div>

          {/* Dynamic Products Grid - Right */}
          <div style={{ width: '100%', minHeight: '350px' }}>
            {isFetching ? (
              <SkeletonLoader />
            ) : (
              <Reveal direction="right">
                <div
                  style={{
                    ...styles.gridProductsSmall,
                    gridTemplateColumns: isMobile
                      ? '1fr'
                      : 'repeat(auto-fill, minmax(180px, 1fr))'
                  }}
                >
                  {apparelProducts.map((p, idx) => (
                    <ModernProductCard
                      key={p.id}
                      product={p}
                      onClick={handleProductSelect}
                      addToCartWithNotification={addToCartWithNotification}
                      isViewMore={idx === 5}
                      viewMoreUrl="/shop?section=apparel"
                    />
                  ))}
                </div>
              </Reveal>
            )}
            {!isFetching && apparelProducts.length === 0 && (
              <Reveal direction="right">
                <div style={{ textAlign: 'center' }}>
                  <GoldIcon Icon={FaTshirt} size="10rem" />
                  <div style={{ marginTop: '20px', color: theme.colors.goldSolid, fontWeight: 'bold', letterSpacing: '2px' }}>PREMIUM CUSTOM APPAREL</div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>




      {/* Categories Section moved here - Visible on Mobile only */}
      {!isDesktop && (
        <section style={{ ...styles.categorySection, padding: isMobile ? '40px 12px' : styles.categorySection.padding }}>
          <h2 style={styles.categoryTitle}>Shop by Category<div style={styles.categoryTitleUnderline}></div></h2>
          <div style={{ ...styles.categoryGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : styles.categoryGrid.gridTemplateColumns, gap: isMobile ? '12px' : styles.categoryGrid.gap }}>
            {sortedCategories.map((cat, idx) => (
              <motion.div
                key={cat.id || idx}
                style={{ ...styles.categoryCard, padding: isMobile ? '25px 10px' : styles.categoryCard.padding, borderRadius: isMobile ? '16px' : styles.categoryCard.borderRadius }}
                whileHover={{ y: -15 }}
                onClick={() => navigate(`/shop?category=${toSlug(cat.name)}`)}
              >
                <div style={{ ...styles.categoryIcon, fontSize: isMobile ? '1.8rem' : styles.categoryIcon.fontSize }}>
                  {cat.image_url ? (
                    <img
                      src={cat.image_url.startsWith('http') ? cat.image_url : `https://api.yokebud.fi${cat.image_url}`}
                      alt={cat.name}
                      style={{ ...styles.categoryImage, width: isMobile ? '45px' : styles.categoryImage.width, height: isMobile ? '45px' : styles.categoryImage.height }}
                      loading="lazy"
                      width={isMobile ? 45 : 55}
                      height={isMobile ? 45 : 55}
                    />
                  ) : (
                    getCategoryIcon(cat.name)
                  )}
                </div>
                <h3 style={{ ...styles.categoryName, fontSize: isMobile ? '0.95rem' : styles.categoryName.fontSize }}>{cat.name}</h3>
                <p style={{ ...styles.categorySub, fontSize: isMobile ? '0.65rem' : styles.categorySub.fontSize }}>Premium & Custom</p>
                <FiArrowRight style={{ position: 'absolute', bottom: isMobile ? '10px' : '20px', color: '#BF953F', fontSize: isMobile ? '0.8rem' : '1rem' }} />
              </motion.div>
            ))}
          </div>
        </section>
      )}



      <AnimatePresence>
        {selectedProduct && (
          <React.Suspense fallback={<LoadingAnimation />}>
            <ProductModal
              product={selectedProduct}
              onClose={() => {
                setSelectedProduct(null);
                if (location.state?.background) {
                  navigate(-1);
                }
              }}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
      {/* Google Reviews Section */}
      <section style={{ padding: isMobile ? '60px 20px' : '100px 20px' }}>
        <h2 style={styles.categoryTitle}>What Our Customers Say<div style={styles.categoryTitleUnderline}></div></h2>
        <div style={{ maxWidth: '1300px', margin: '0 auto', marginTop: '40px' }}>
          <SociableKitWidget />
        </div>
        {/* Write a Review Button */}
        <div style={{ textAlign: 'center', marginTop: '1px' }}>
          <a 
            href="https://search.google.com/local/writereview?placeid=ChIJpanlNQj07GYRYCWE9SzBEN0" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '18px 45px',
              background: 'linear-gradient(#000, #000) padding-box, linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C) border-box',
              border: '1px solid transparent',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 800,
              cursor: 'pointer',
              borderRadius: '6px',
              textDecoration: 'none',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(191, 149, 63, 0.4)',
              animation: 'pulse 2s infinite',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1) translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(191, 149, 63, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(191, 149, 63, 0.4)';
            }}
          >
            <SiGoogle size="1.3rem" />
            Write a Review
          </a>
        </div>
      </section>

      {/* --- VIDEO SECTION --- */}
      {videos.length > 0 && (
        <section style={{ padding: isMobile ? '60px 20px' : '100px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: isMobile ? '2rem' : '3rem', fontWeight: 800, marginBottom: '20px', color: '#fff' }}>
              Watch Our <span style={{ background: theme.colors.goldGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>craftmanship</span>
            </h2>
            <p style={{ color: '#aaa', fontSize: isMobile ? '0.9rem' : '1.1rem', marginBottom: '50px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              See how we bring our designs to life with precision and care
            </p>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '30px' 
            }}>
              {videos.map((video, idx) => (
                <motion.div 
                  key={video.id} 
                  style={{ 
                    background: 'linear-gradient(145deg, rgba(20,20,20,0.6) 0%, rgba(0,0,0,0.8) 100%)', 
                    borderRadius: '24px', 
                    padding: isMobile ? '20px' : '30px', 
                    border: '1px solid rgba(191, 149, 63, 0.3)', 
                    boxShadow: '0 15px 40px rgba(0,0,0,0.5)' 
                  }} 
                  initial={{ opacity: 0, y: 30 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: idx * 0.1 }}
                >
                  <div style={{ 
                    position: 'relative', 
                    paddingBottom: '56.25%', 
                    height: 0, 
                    overflow: 'hidden', 
                    borderRadius: '16px', 
                    marginBottom: '20px' 
                  }}>
                    <iframe 
                      src={getEmbedUrl(video.embed_url)} 
                      title={video.title} 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        border: 0 
                      }} 
                    />
                  </div>
                  {video.title && (
                    <h3 style={{ 
                      fontSize: isMobile ? '1.2rem' : '1.5rem', 
                      color: '#fff', 
                      marginBottom: '10px', 
                      fontWeight: '700' 
                    }}>{video.title}</h3>
                  )}
                  {video.description && (
                    <p style={{ 
                      color: '#aaa', 
                      lineHeight: '1.6', 
                      fontSize: isMobile ? '0.85rem' : '0.95rem' 
                    }}>{video.description}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <SeoContent pageName="home" />

      <style>{`
        /* SociableKit Widget Custom Styles */
        .sk-ww-google-reviews,
        .sk-ww-google-reviews * {
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        
        .sk-ww-google-reviews .sk-review-image,
        .sk-ww-google-reviews img {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Hide SociableKit branding/link */
        .sk-ww-google-reviews .sk-branding,
        .sk-ww-google-reviews [class*="branding"],
        .sk-ww-google-reviews [class*="powered"],
        .sk-ww-google-reviews a[href*="sociablekit"],
        .sk-ww-google-reviews a[target*="_blank"]:not([href*="google"]) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }

        /* Write a Review Button Animations */
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
