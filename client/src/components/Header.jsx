import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/styles/Header.scss';
import {
  FaFacebook, FaWhatsapp, FaYoutube, FaInstagram, FaTiktok,
  FaPhone, FaEnvelope
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { SiGoogletranslate } from 'react-icons/si';
import { FiChevronDown } from 'react-icons/fi';
import { useLocale } from '../pages/context/LocaleContext';
import { auth } from '../firebase';

const Header = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const { language, setLanguage } = useLocale();
  const [openLangDropdown, setOpenLangDropdown] = useState(false);

  const isMobile = useMemo(() => windowWidth < 768, [windowWidth]);
  const isTablet = useMemo(() => windowWidth >= 768 && windowWidth < 1024, [windowWidth]);
  const isDesktop = useMemo(() => windowWidth >= 1024, [windowWidth]);

  const handleResize = useCallback(() => setWindowWidth(window.innerWidth), []);

  const handlePhoneClick = useCallback(() => window.location.href = 'tel:+358440328124', []);
  const handleEmailClick = useCallback(() => window.location.href = 'mailto:info@yokebud.com', []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.AOS) {
      window.AOS.init({
        duration: 1000, easing: 'ease-in-out', once: true
      });
    }

    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    }, error => {
      console.error('Auth state error:', error);
    });

    // --- GOOGLE TRANSLATE SCRIPT ---
    if (!document.querySelector('#google-translate-script')) {
      const googleTranslateScript = document.createElement('script');
      googleTranslateScript.id = 'google-translate-script';
      googleTranslateScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      googleTranslateScript.async = true;
      document.body.appendChild(googleTranslateScript);

      window.googleTranslateElementInit = () => {
        if (window.google && window.google.translate) {
          new window.google.translate.TranslateElement({
            pageLanguage: 'en',
            autoDisplay: false,
            // includedLanguages: 'en,fi,bn,id', // REMOVED to include ALL languages
            layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL
          }, 'google_translate_element');
        }
      };
    }

    // --- AUTO-CLOSE DROPDOWN & HIDE BAR LOGIC ---
    const checkForGoogleSelect = setInterval(() => {
        const googleSelect = document.querySelector('.goog-te-combo');
        
        // Force hide the banner if it appears
        const bannerFrame = document.querySelector('.goog-te-banner-frame');
        if(bannerFrame) bannerFrame.style.display = 'none';
        
        const body = document.body;
        if(body.style.top !== "0px") body.style.top = "0px";

        if (googleSelect) {
            googleSelect.removeEventListener('change', handleLanguageChange);
            googleSelect.addEventListener('change', handleLanguageChange);
            clearInterval(checkForGoogleSelect);
        }
    }, 1000);

    const handleLanguageChange = () => {
        setOpenLangDropdown(false); // Close dropdown
        
        // Force Body top 0 again
        setTimeout(() => {
             const iframe = document.querySelector('iframe.goog-te-banner-frame');
             if(iframe) iframe.style.display = 'none';
             document.body.style.top = '0px';
        }, 500);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      clearInterval(checkForGoogleSelect);
      const googleSelect = document.querySelector('.goog-te-combo');
      if (googleSelect) googleSelect.removeEventListener('change', handleLanguageChange);
    };
  }, [handleResize]);

  // --- FIXED FUNCTION: Handles Language Switching Logic ---
  const handleLanguageClick = (langCode) => {
    setLanguage(langCode); // Update Context State

    const googleSelect = document.querySelector('.goog-te-combo');
    
    if (googleSelect) {
        // Step 1: Set the value
        googleSelect.value = langCode;

        // Step 2: Trigger the change event properly (with bubbles: true)
        googleSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // Step 3: Special Fix for 'EN' (Restoring Original)
        if (langCode === 'en') {
            // Clear the Google Translate cookie to force "original" mode
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + document.domain;
            
            // Sometimes a reload is needed to fully clear the DOM injection if 'change' event fails
            // But usually clearing cookie + dispatching 'change' works.
            // If it still sticks, we force a reload (Optional, uncomment if needed):
            // window.location.reload(); 
        }
    }
  };

  const textVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };
  const socialVariants = {
    hidden: { opacity: 0 },
    visible: (i) => ({ opacity: 1, transition: { delay: 0.3 + i * 0.1, duration: 0.5 } })
  };
  const nameVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.4, duration: 0.8 } }
  };
  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.175, 0.885, 0.32, 1.275] } },
    hover: { scale: 1.2, y: -5, color: '#FFD700', textShadow: "0 0 10px rgba(255, 215, 0, 0.8)", transition: { duration: 0.3 } }
  };
  const floatAnimation = {
    scale: [1, 1.05, 1],
    color: ['#FFFFFF', '#FFD700', '#FFFFFF'],
    textShadow: ['0 0 0px rgba(255, 215, 0, 0)', '0 0 15px rgba(255, 215, 0, 0.7)', '0 0 0px rgba(255, 215, 0, 0)'],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  };

  const socialLinks = [
    { icon: <FaFacebook size={isMobile ? 16 : 20} />, url: "https://www.facebook.com/share/1D9o7CoZB7/" },
    { icon: <FaWhatsapp size={isMobile ? 16 : 20} />, url: "https://wa.me/+358440328124" },
    { icon: <FaYoutube size={isMobile ? 16 : 20} />, url: "https://www.youtube.com/@yokebud" },
    { icon: <FaInstagram size={isMobile ? 16 : 20} />, url: "https://www.instagram.com/yokebud/" },
    { icon: <FaTiktok size={isMobile ? 16 : 20} />, url: "https://www.tiktok.com/@yokebud" }
  ];

  return (
    <>
      <style>{`
        /* --- 1. NUCLEAR REMOVAL OF GOOGLE TOP BAR --- */
        .goog-te-banner-frame { display: none !important; visibility: hidden !important; height: 0 !important; }
        .VIpgJd-ZVi9od-ORHb-OEVmcd { display: none !important; visibility: hidden !important; }
        body { top: 0px !important; position: static !important; }
        .goog-tooltip, #goog-gt-tt { display: none !important; visibility: hidden !important; }

        /* --- 2. HIDE GOOGLE BRANDING BUT KEEP DROPDOWN VISIBLE --- */
        .goog-te-gadget-icon { display: none !important; width: 0 !important; height: 0 !important; }
        .goog-te-gadget { color: transparent !important; font-size: 0px !important; }

        /* Make sure the DROPDOWN itself is VISIBLE and has correct size */
        .goog-te-combo {
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
            font-size: 14px !important;
            color: #fff !important;
            background-color: #1a1a1a !important;
            border: 1px solid #FFD700 !important;
            padding: 8px !important;
            border-radius: 4px !important;
            width: 100%;
            height: auto !important;
            margin: 0 !important;
            cursor: pointer;
        }
        
        .goog-te-combo option { color: #fff !important; background-color: #000 !important; font-size: 14px !important; }

        /* --- 3. CUSTOM CONTAINER STYLES --- */
        .premium-header { position: relative; z-index: 5000 !important; }
        .header-top-bar { overflow: visible !important; }
        
        .language-dropdown-custom {
            position: absolute;
            top: 130%;
            right: 0;
            background: #000;
            border: 1px solid #FFD700;
            padding: 10px;
            border-radius: 8px;
            z-index: 9999 !important;
            min-width: 180px;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
        }

        .language-tabs { display: flex; align-items: center; gap: 0.5rem; }
        .language-tabs .tab {
            background: transparent;
            border: 1px solid rgba(255, 215, 0, 0.3);
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .language-tabs .tab.active, .language-tabs .tab:hover {
            border-color: #FFD700; color: #FFD700; box-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
        }
        
        .dropdown-trigger-btn {
            background: transparent;
            border: 1px solid rgba(255, 215, 0, 0.3);
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            display: flex; align-items: center; gap: 5px;
            cursor: pointer; transition: all 0.3s ease;
        }
        .dropdown-trigger-btn:hover { border-color: #FFD700; color: #FFD700; }
      `}</style>

      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="premium-header"
      >
        <div className={`header-top-bar ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
          <motion.div className="contact-info" initial="hidden" animate="visible" variants={textVariants}>
            
            {/* --- CENTRAL TRANSLATION SYSTEM (Always in DOM for MobileNav) --- */}
            {!isDesktop && (
              <div className="translator-hidden-container" style={{ display: 'none' }}>
                <div id="google_translate_element"></div>
              </div>
            )}

            {isDesktop && (
              <>
                {/* Left Side: Contact Info + Translator */}
                <div className="left-section" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                  <motion.div className="contact-items-container" style={{ display: 'flex', gap: '1rem' }}>
                    <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handlePhoneClick} style={{ cursor: 'pointer' }}> 
                      <FaPhone className="contact-icon" /> <span>+358 440 328 124</span>
                    </motion.div>
                    <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleEmailClick} style={{ cursor: 'pointer' }}>
                      <FaEnvelope className="contact-icon" /> <span data-keep="true">info@yokebud.com</span>
                    </motion.div>
                  </motion.div>

                  <div className="translator" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 6000 }}>
                    <div className="language-tabs">
                       <button className={`${language === 'en' ? 'tab active' : 'tab'} notranslate`} translate="no" onClick={() => handleLanguageClick('en')}>EN</button>
                       <button className={`${language === 'fi' ? 'tab active' : 'tab'} notranslate`} translate="no" onClick={() => handleLanguageClick('fi')}>FI</button>
                    </div>

                    <button className="dropdown-trigger-btn" onClick={() => setOpenLangDropdown(v => !v)} aria-label="Select language">
                      <SiGoogletranslate size={14} />
                      <FiChevronDown size={12} style={{ transform: openLangDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }} />
                    </button>

                    <div className="language-dropdown-custom" style={{ display: openLangDropdown ? 'block' : 'none' }}>
                      <div id="google_translate_element"></div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '5px', textAlign: 'center', borderTop: '1px solid #333', paddingTop: '5px' }}>
                        Select Language
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Side: Logo */}
                <motion.div 
                  className="company-name notranslate" 
                  data-keep="true" 
                  translate="no" 
                  initial="hidden" 
                  animate="visible" 
                  variants={nameVariants}
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '5px', left: 0 }}
                >
                  <span style={{ fontWeight: 600, letterSpacing: '4px' }}>YOKEBUD</span>
                  <span style={{ fontSize: '0.45em', fontWeight: 500 }}>Crafts</span>
                </motion.div>

                {/* Right Side: Social Links */}
                <motion.div className="social-links" initial="hidden" animate="visible" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {socialLinks.map((item, i) => (
                    <motion.a key={i} href={item.url} target="_blank" rel="noopener noreferrer" custom={i} variants={socialVariants} whileHover={{ scale: 1.2, rotate: [0, 10, -10, 0], transition: { duration: 0.5 } }} whileTap={{ scale: 0.9 }}>{item.icon}</motion.a>
                  ))}
                </motion.div>
              </>
            )}

            {isTablet && (
              <div className="tablet-container">
                 <motion.div className="contact-items-container">
                  <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handlePhoneClick} style={{ marginBottom: '0rem', cursor: 'pointer' }}>
                    <FaPhone className="contact-icon" /> <span>+358440328124</span>
                  </motion.div>
                  <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleEmailClick} style={{ marginBottom: '0rem', cursor: 'pointer' }}>
                    <FaEnvelope className="contact-icon" /> <span data-keep="true">info@yokebud.com</span>
                  </motion.div>
                </motion.div>
                <motion.div className="company-name notranslate" data-keep="true" translate="no" initial="hidden" animate="visible" variants={nameVariants} style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>
                  {["Yokebud Crafts"].map((word, wordIndex) => (
                    <motion.span key={wordIndex} className="name-part">
                      {word.split('').map((letter, letterIndex) => (
                        <motion.span key={letterIndex} variants={letterVariants} style={{ display: 'inline-block' }} animate={{ scale: [1, 1.05, 1], y: [0, -2, 0], color: ['#FFFFFF', '#FFD700', '#FFFFFF'], textShadow: ['0 0 0px rgba(255, 215, 0, 0)', '0 0 5px rgba(255, 215, 0, 0.6)', '0 0 0px rgba(255, 215, 0, 0)'], transition: { duration: 2.5, delay: letterIndex * 0.05, repeat: Infinity, ease: "easeInOut" } }}>{letter}</motion.span>
                      ))}
                    </motion.span>
                  ))}
                  <motion.span style={{ display: 'inline-block', fontSize: '0.6em', verticalAlign: 'top', marginLeft: '1px' }} animate={{ scale: [1, 1.05, 1], y: [0, -1, 0], color: ['#FFFFFF', '#FFD700', '#FFFFFF'], textShadow: ['0 0 0px rgba(255, 215, 0, 0)', '0 0 3px rgba(255, 215, 0, 0.6)', '0 0 0px rgba(255, 215, 0, 0)'], transition: { duration: 2.5, delay: 0.3, repeat: Infinity, ease: "easeInOut" } }}>.Ltd</motion.span>
                </motion.div>
                <motion.div className="social-links" initial="hidden" animate="visible" style={{ gap: '0.5rem' }}>
                  {socialLinks.map((item, i) => (
                    <motion.a key={i} href={item.url} target="_blank" rel="noopener noreferrer" custom={i} variants={socialVariants} whileHover={{ scale: 1.1, rotate: [0, 10, -10, 0], transition: { duration: 0.5 } }} whileTap={{ scale: 0.9 }} style={{ fontSize: '0.9rem' }}>{item.icon}</motion.a>
                  ))}
                </motion.div>
              </div>
            )}

            {isMobile && (
              <div className="mobile-container">
                <motion.div className="contact-items-container" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handlePhoneClick} style={{ cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FaPhone className="contact-icon" size={10} /> <span>+358 440 328 124</span>
                  </motion.div>
                  <motion.div className="contact-item" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleEmailClick} style={{ cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FaEnvelope className="contact-icon" size={10} /> <span data-keep="true">info@yokebud.com</span>
                  </motion.div>
                </motion.div>
                <motion.div className="company-name notranslate" data-keep="true" translate="no" initial="hidden" animate="visible" variants={nameVariants} style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>
                  {["Yokebud Crafts"].map((word, wordIndex) => (
                    <motion.span key={wordIndex} className="name-part">
                      {word.split('').map((letter, letterIndex) => (
                        <motion.span key={letterIndex} variants={letterVariants} style={{ display: 'inline-block' }} animate={{ scale: [1, 1.05, 1], y: [0, -2, 0], color: ['#FFFFFF', '#FFD700', '#FFFFFF'], textShadow: ['0 0 0px rgba(255, 215, 0, 0)', '0 0 5px rgba(255, 215, 0, 0.6)', '0 0 0px rgba(255, 215, 0, 0)'], transition: { duration: 2.5, delay: letterIndex * 0.05, repeat: Infinity, ease: "easeInOut" } }}>{letter}</motion.span>
                      ))}
                    </motion.span>
                  ))}
                  <motion.span style={{ display: 'inline-block', fontSize: '0.6em', verticalAlign: 'top', marginLeft: '1px' }} animate={{ scale: [1, 1.05, 1], y: [0, -1, 0], color: ['#FFFFFF', '#FFD700', '#FFFFFF'], textShadow: ['0 0 0px rgba(255, 215, 0, 0)', '0 0 3px rgba(255, 215, 0, 0.6)', '0 0 0px rgba(255, 215, 0, 0)'], transition: { duration: 2.5, delay: 0.3, repeat: Infinity, ease: "easeInOut" } }}>.Ltd</motion.span>
                </motion.div>
                <motion.div className="social-links" initial="hidden" animate="visible" style={{ gap: '0.5rem' }}>
                  {socialLinks.map((item, i) => (
                    <motion.a key={i} href={item.url} target="_blank" rel="noopener noreferrer" custom={i} variants={socialVariants} whileHover={{ scale: 1.1, rotate: [0, 10, -10, 0], transition: { duration: 0.5 } }} whileTap={{ scale: 0.9 }} style={{ fontSize: '0.9rem' }}>{item.icon}</motion.a>
                  ))}
                </motion.div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.header>
    </>
  );
};

export default Header;
