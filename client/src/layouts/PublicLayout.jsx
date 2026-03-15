import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import Footer from '../components/Footer';
import '../pages/styles/main.scss';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import { Helmet } from "react-helmet-async";
import axios from 'axios';
import { API_BASE } from '../utils/api';
import { useLocale } from '../pages/context/LocaleContext';
import AOS from 'aos';
import 'aos/dist/aos.css';

const PublicLayout = () => {
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [serverError, setServerError] = useState(false);
  const location = useLocation();
  useLocale();

  // Detect mobile/tablet
  useEffect(() => {
    const checkDevice = () => {
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
      const isTablet = /iPad|Android|Tablet|Silk/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobileDevice(isMobile || isTablet || isSmallScreen);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  // 🟢 FIXED: Route change logic
  useEffect(() => {
    // 1. Immediate scroll to top
    window.scrollTo(0, 0);
    
    // 2. Refresh AOS after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        AOS.refresh();
      } catch (e) {
        console.warn('AOS refresh failed', e);
      }
    }, 100);

    // 3. Mark initial load complete immediately after first mount
    if (!initialLoadComplete) {
      setInitialLoadComplete(true);
    }
    
    return () => clearTimeout(timer);
  }, [location.pathname, initialLoadComplete]);

  // Server health check logic
  useEffect(() => {
    let isMounted = true;
    const checkServer = async () => {
      try {
        await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        if (isMounted) setServerError(false);
      } catch (err) {
        if (isMounted) setServerError(true);
      }
    };
    checkServer();
    return () => { isMounted = false; };
  }, []);

  const canonicalBase = 'https://www.yokebud.fi';
  const canonicalUrl = `${canonicalBase}${location.pathname}`;

  return (
    <div className="public-layout" style={{ minHeight: "100vh", position: "relative", backgroundColor: '#050505' }}>
      <Helmet>
        <title>Yokebud Crafts | Resin Art & Custom Apparel</title>
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      {serverError ? (
        <div className="server-error-overlay" style={{ backgroundColor: 'black', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
          <h1 style={{ fontSize: '2rem' }}>⚠️ Server Unavailable</h1>
          <p>We're having trouble connecting to our servers.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '10px 30px', borderRadius: '25px', background: 'gold', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <Header />
          <div style={{ position: "sticky", top: 0, zIndex: 1000 }}>
            <Navbar />
          </div>

          {isMobileDevice && <MobileNav />}

          <main style={{ minHeight: "calc(100vh - 200px)" }}>
            <Suspense fallback={<Loading />}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Outlet />
              </motion.div>
            </Suspense>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
};

export default PublicLayout;