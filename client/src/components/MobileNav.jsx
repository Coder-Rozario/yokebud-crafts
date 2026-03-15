import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaHome, FaPhone, FaShoppingCart, FaArrowLeft, FaFilter, FaGlobe, FaChevronDown, FaCheck } from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../pages/context/CartContext';
import { useLocale } from '../pages/context/LocaleContext';
import { apiFetch } from '../utils/api';
import '../pages/styles/MobileNav.scss';

// --- Premium Theme Constants ---
const GOLD_GRADIENT_CSS = 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)';
const SILVER_GRADIENT_CSS = 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 100%)';
const DARK_BG = 'rgba(10, 10, 10, 0.96)';

const MobileNav = ({ onCategoryClick, onCloseSidebar }) => {
  // --- States ---
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState('all');
  const [subCategory, setSubCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  
  // Translation State
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langDropdownRef = useRef(null);

  const { language, setLanguage, LANGUAGES } = useLocale?.() || { 
    language: 'en', 
    setLanguage: () => {}, 
    LANGUAGES: [
      { code: 'en', name: 'English' },
      { code: 'fi', name: 'Finnish' },
      { code: 'bn', name: 'Bengali' }
    ] 
  };
  
  const MAX_PRICE = 5000;
  const MIN_GAP = 100;
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);

  const navigate = useNavigate();
  const location = useLocation();
  const { getTotalItems = () => 0, totalProductsCount } = useCart?.() || {};
  const cartCount = typeof totalProductsCount === 'number' ? totalProductsCount : getTotalItems();
  const filterBtnRef = useRef(null);

  // --- Handlers ---
  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    if (newState && onCategoryClick) onCategoryClick();
    if (!newState && onCloseSidebar) onCloseSidebar();
  };

  const closeSidebarOnAction = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      setIsLangOpen(false); // Close lang dropdown when sidebar closes
      if (onCloseSidebar) onCloseSidebar();
    }
  };

  // Close Language Dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      if (onCloseSidebar) onCloseSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const { body } = document;
    if (sidebarOpen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const isDefault = section === 'all' && 
                      subCategory === 'All' && 
                      minPrice === 0 && 
                      maxPrice === MAX_PRICE;
    
    // Only navigate if not default, OR if we need to clear an existing navFilter
    if (isDefault && !location.state?.navFilter) return;

    const priceRange = {
      min: minPrice > 0 ? minPrice : null,
      max: maxPrice < MAX_PRICE ? maxPrice : null
    };
    const navFilter = isDefault ? null : { section, subCategory, priceRange };
    
    const t = setTimeout(() => {
      // If it's default, we just want to clear the state
      navigate('/', { state: { ...location.state, navFilter: navFilter }, replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [section, subCategory, minPrice, maxPrice]);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiFetch('/api/categories');
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (err) {
        console.error("Fetch categories error", err);
      }
    };
    fetchCategories();
  }, []);

  // Dynamic category tabs
  const { craftsTabs, apparelTabs } = useMemo(() => {
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
      craftsTabs: combinedCrafts,
      apparelTabs: combinedApparel
    };
  }, [categories]);

  const handleCategorySelect = (sec, sub) => {
    setSection(sec);
    setSubCategory(sub);
  };

  const handleLanguageSelect = (code) => {
    setLanguage(code);
    setIsLangOpen(false);
    const applyViaSelect = () => {
      try {
        const select = document.querySelector('.goog-te-combo');
        if (select) {
          select.value = code;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          if (code === 'en') {
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + document.domain;
          }
          return true;
        }
      } catch {}
      return false;
    };
    if (!applyViaSelect()) {
      let attempts = 0;
      const id = setInterval(() => {
        attempts += 1;
        if (applyViaSelect() || attempts > 15) {
          clearInterval(id);
          if (attempts > 15) {
            try {
              const v = `/en/${code}`;
              document.cookie = `googtrans=${v};path=/;`;
              document.cookie = `googtrans=${v};path=/;domain=${document.domain};`;
            } catch {}
          }
        }
      }, 200);
    }
  };

  useEffect(() => {
    const ensureTranslateOnMobile = () => {
      if (document.querySelector('.goog-te-combo')) return;
      const el = document.getElementById('mobile_google_translate_element');
      if (el && window.google && window.google.translate && window.google.translate.TranslateElement) {
        try {
          new window.google.translate.TranslateElement(
            { pageLanguage: 'en', autoDisplay: false, layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL },
            'mobile_google_translate_element'
          );
        } catch {}
      }
    };
    ensureTranslateOnMobile();
    const id = setInterval(ensureTranslateOnMobile, 500);
    const timeout = setTimeout(() => clearInterval(id), 5000);
    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, [sidebarOpen]);

  // --- Price Slider Logic ---
  const handlePriceInput = (e) => {
    const value = parseInt(e.target.value);
    const type = e.target.name;
    if (type === 'min') {
      if (value < 0) setMinPrice(0);
      else if (value > maxPrice - MIN_GAP) setMinPrice(maxPrice - MIN_GAP);
      else setMinPrice(value);
    } else {
      if (value > MAX_PRICE) setMaxPrice(MAX_PRICE);
      else if (value < minPrice + MIN_GAP) setMaxPrice(minPrice + MIN_GAP);
      else setMaxPrice(value);
    }
  };

  const handleRangeDrag = (e) => {
    const value = parseInt(e.target.value);
    const type = e.target.name;
    if (type === 'min') {
      if (maxPrice - value >= MIN_GAP) setMinPrice(value);
    } else {
      if (value - minPrice >= MIN_GAP) setMaxPrice(value);
    }
  };

  const applyFilters = () => {
    const priceRange = {
      min: minPrice > 0 ? minPrice : null,
      max: maxPrice < MAX_PRICE ? maxPrice : null
    };
    const navFilter = { section, subCategory, priceRange };
    navigate('/', { state: { navFilter }, replace: true });
    setSidebarOpen(false);
    if (onCloseSidebar) onCloseSidebar();
  };

  const isHomePage = location.pathname === '/';
  const percentMin = (minPrice / MAX_PRICE) * 100;
  const percentMax = (maxPrice / MAX_PRICE) * 100;

  // Helper to get current language name
  const currentLangName = LANGUAGES.find(l => l.code === language)?.name || 'Select Language';

  return (
    <>
      {/* Internal Premium Styles */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #BF953F; border-radius: 10px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: #1a1a1a; }

        .premium-sidebar {
          position: absolute; 
          top: 0; left: 0; bottom: 0; width: 100%;height:100vh; max-width: 300px;
          background: ${DARK_BG};
          backdrop-filter: blur(12px);
          border-right: 1px solid transparent;
          border-image: ${GOLD_GRADIENT_CSS} 1;
          display: flex; flex-direction: column; 
          box-shadow: 10px 0 40px rgba(0,0,0,0.8);
          overflow-y: auto; z-index: 30000000003;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }

        .text-gold {
          background: ${GOLD_GRADIENT_CSS};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 700;
        }
        .text-silver {
          background: ${SILVER_GRADIENT_CSS};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 600; letter-spacing: 0.5px;
        }

        /* --- NEW TRANSLATION STYLES --- */
        .lang-dropdown-container {
          position: relative;
          width: 100%;
          z-index: 50;
        }
        
        .lang-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 15px;
          background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);
          border: 1px solid rgba(191, 149, 63, 0.4);
          border-radius: 8px;
          color: #E0E0E0;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .lang-trigger:hover, .lang-trigger.active {
          border-color: #BF953F;
          background: rgba(191, 149, 63, 0.08);
          box-shadow: 0 0 15px rgba(191, 149, 63, 0.1);
        }

        .lang-trigger svg.arrow {
          transition: transform 0.3s ease;
          color: #BF953F;
        }
        
        .lang-trigger.active svg.arrow {
          transform: rotate(180deg);
        }

        .lang-options-list {
          position: absolute;
          top: 110%;
          left: 0;
          width: 100%;
          background: rgba(15, 15, 15, 0.98);
          border: 1px solid rgba(191, 149, 63, 0.3);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.8);
          transform-origin: top;
          animation: dropDown 0.2s ease-out forwards;
          backdrop-filter: blur(10px);
        }

        @keyframes dropDown {
          from { opacity: 0; transform: scaleY(0.9); }
          to { opacity: 1; transform: scaleY(1); }
        }

        .lang-option {
          padding: 12px 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #aaa;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 13px;
        }

        .lang-option:last-child { border-bottom: none; }

        .lang-option:hover {
          background: rgba(191, 149, 63, 0.15);
          color: #fff;
        }

        .lang-option.selected {
          background: linear-gradient(90deg, rgba(191, 149, 63, 0.2) 0%, transparent 100%);
          color: #BF953F;
          font-weight: 700;
        }

        /* Standard Buttons & Inputs */
        .gold-btn {
          padding: 8px 12px; border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(191, 149, 63, 0.3);
          color: #E0E0E0; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.3s ease;
          position: relative; overflow: hidden;
        }
        .gold-btn:hover { border-color: #BF953F; box-shadow: 0 0 8px rgba(191, 149, 63, 0.15); }
        .gold-btn.active { background: ${GOLD_GRADIENT_CSS}; color: #000; font-weight: 700; border: none; box-shadow: 0 2px 10px rgba(191, 149, 63, 0.3); }

        .slider-wrapper { position: relative; width: 100%; height: 3px; margin: 20px 0; background: #333; border-radius: 5px; }
        .slider-progress { position: absolute; height: 100%; background: ${GOLD_GRADIENT_CSS}; border-radius: 5px; z-index: 1; }
        .range-input-slider { position: absolute; width: 100%; height: 5px; top: -1px; background: none; pointer-events: none; -webkit-appearance: none; z-index: 2; }
        .range-input-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${GOLD_GRADIENT_CSS}; border: 2px solid #000; pointer-events: auto; cursor: pointer; box-shadow: 0 0 5px rgba(0,0,0,0.6); }
        
        .gold-input { width: 100%; padding: 8px; background: rgba(0,0,0,0.6); border: 1px solid #BF953F; border-radius: 6px; color: #BF953F; text-align: center; font-size: 13px; font-weight: bold; outline: none; font-family: 'Montserrat', sans-serif; }
      `}</style>

      {/* --- Mobile Nav Bar --- */}
      <div id="mobile_nav" style={{ zIndex: 100001 }}>
        <div id="mobile_google_translate_element" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} />
        <Link to="/" onClick={handleCategorySelect}><FaHome /> Home</Link>
        {!isHomePage ? (
          <button onClick={() => { closeSidebarOnAction(); navigate(-1); }}><FaArrowLeft /> Back</button>
        ) : (
          <button onClick={toggleSidebar} ref={filterBtnRef} className={sidebarOpen ? 'active' : ''}>
            {sidebarOpen ? <FaXmark /> : <FaFilter />} Filter
          </button>
        )}
        <button onClick={() => { closeSidebarOnAction(); navigate('/cart'); }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <FaShoppingCart style={{ fontSize: '1.2rem', marginBottom: '2px' }} />
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: GOLD_GRADIENT_CSS, color: '#000', fontSize: '0.7rem', fontWeight: '700', minWidth: '18px', height: '18px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111', padding: '0 4px', zIndex: 10, lineHeight: 1 }}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px' }}>Cart</span>
        </button>
        <Link to="/contact" onClick={handleCategorySelect}><FaPhone /> Contact</Link>
      </div>

      {/* --- Sidebar Overlay --- */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, zIndex: 30000000002, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSidebarOpen(false); if (onCloseSidebar) onCloseSidebar(); }}}
        >
          <div className="premium-sidebar sidebar-scroll">
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px', borderBottom: '1px solid rgba(191, 149, 63, 0.15)' }}>
              <div className="text-gold" style={{ fontSize: '1.1rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
                <FaFilter size={16} style={{ marginRight: '8px', color: '#BF953F' }}/> FILTERS
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#BF953F', fontSize: '1.3rem', cursor: 'pointer' }}>
                <FaXmark />
              </button>
            </div>

            <div style={{ padding: '20px 20px', flex: 1 }}>
              
              {/* --- PREMIUM TRANSLATION SECTION --- */}


              {/* --- Browse By --- */}
              <div style={{ marginBottom: '25px' }}>
                <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Browse By</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className={`gold-btn ${section === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all', 'All')}>All</button>
                  <button className={`gold-btn ${section === 'new' ? 'active' : ''}`} onClick={() => handleCategorySelect('new', 'All')} style={{ flexGrow: 2 }}>New Arrivals</button>
                </div>
              </div>

              {/* --- Categories --- */}
              <div style={{ marginBottom: '25px' }}>
                <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Apparel</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {apparelTabs.map((tab, idx) => (
                    <button 
                      key={tab} 
                      className={`gold-btn ${subCategory === tab ? 'active' : ''}`} 
                      onClick={() => handleCategorySelect('apparel', tab)}
                      style={tab === 'Show Pieces' ? { gridColumn: 'span 1' } : {}}
                    >
                      {tab === 'Hoodies' ? 'Hoodie' : tab === 'T-shirts' ? 'T-Shirt' : tab}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Crafts & Accessories</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {craftsTabs.map((tab, idx) => (
                    <button 
                      key={tab} 
                      className={`gold-btn ${subCategory === tab ? 'active' : ''}`} 
                      onClick={() => handleCategorySelect('crafts', tab)}
                      style={tab === 'Show Pieces' ? { gridColumn: 'span 1' } : {}}
                    >
                      {tab === 'Key Rings' ? 'Key Ring' : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- Price Range --- */}
              <div style={{ marginBottom: '15px' }}>
                <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '15px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Price Range</h4>
                <div className="slider-wrapper">
                  <div className="slider-progress" style={{ left: `${percentMin}%`, width: `${percentMax - percentMin}%` }}></div>
                  <input type="range" name="min" min="0" max={MAX_PRICE} value={minPrice} onChange={handleRangeDrag} className="range-input-slider" aria-label="Minimum price" />
                  <input type="range" name="max" min="0" max={MAX_PRICE} value={maxPrice} onChange={handleRangeDrag} className="range-input-slider" aria-label="Maximum price" />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><input type="number" name="min" value={minPrice} onChange={handlePriceInput} className="gold-input" aria-label="Minimum price value" /></div>
                  <div style={{ color: '#BF953F', fontWeight: 'bold', fontSize: '14px' }}>—</div>
                  <div style={{ flex: 1 }}><input type="number" name="max" value={maxPrice} onChange={handlePriceInput} className="gold-input" aria-label="Maximum price value" /></div>
                </div>
              </div>
            </div>

            
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNav;
