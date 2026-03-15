import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SOCKET_BASE } from '../utils/api';
import { apiFetch } from '../utils/api';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../pages/context/LocaleContext';
import { FaSearch, FaSignInAlt, FaShoppingCart, FaSignOutAlt, FaBars, FaTimes, FaEnvelope, FaUserCircle, FaFilter } from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from '../assades/logo.jpg';
import { auth, waitForAuthInit } from '../firebase';
import { useCart } from '../pages/context/CartContext';
import io from 'socket.io-client';
import { absoluteUrl } from '../utils/api';
import MobileNav from '../components/MobileNav'; 

const socket = io(SOCKET_BASE, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

const GOLD_GRADIENT = 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)';

const Navbar = () => {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [ignoreBlinkUntil, setIgnoreBlinkUntil] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  
  const { totalProductsCount = 0 } = useCart?.() || {};

  const isMobile = windowWidth < 850;
  const isHomePage = location.pathname === '/'; 

  const getUserIdFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const checkUnreadMessages = useCallback(async (token) => {
    try {
      const response = await apiFetch('/api/user/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(data.totalUnread);
          setHasUnreadMessages(data.totalUnread > 0);
          
          if (data.totalUnread > 0) {
            setIsBlinking(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const fbUser = await waitForAuthInit();
      const token = localStorage.getItem('userToken');
      if (token) {
        try {
          const response = await apiFetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setCurrentUser(data.user);
            checkUnreadMessages(token);
            const userId = getUserIdFromToken(token);
            if (userId) {
              socket.emit('user_join', userId);
              socket.emit('join_user_room', userId);
              socket.emit('get_unread_count', { userId });
            }
            return;
          } else {
            localStorage.removeItem('userToken');
          }
        } catch (error) {
          localStorage.removeItem('userToken');
        }
      }
      if (fbUser) {
        try {
          const resp = await apiFetch('/api/user/auth/firebase-google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              emailVerified: fbUser.emailVerified
            } })
          });
          const d = await resp.json();
          if (d.success) {
            localStorage.setItem('userToken', d.token);
            setCurrentUser(d.user);
            checkUnreadMessages(d.token);
            const userId = getUserIdFromToken(d.token);
            if (userId) {
              socket.emit('user_join', userId);
              socket.emit('join_user_room', userId);
              socket.emit('get_unread_count', { userId });
            }
          }
        } catch (_) {}
      }
    };
    init();
  }, [checkUnreadMessages]);

  const profileImageUrl = useMemo(() => {
    try {
      const fUser = auth?.currentUser;
      const u = currentUser || {};
      const raw = (fUser && fUser.photoURL) 
        || u.photoURL 
        || u.photo_url 
        || u.google_photo_url 
        || u.avatar_url 
        || u.profile_image 
        || u.profileImageUrl;
      if (!raw || typeof raw !== 'string') return '';
      if (raw.startsWith('http')) return raw;
      return absoluteUrl(raw);
    } catch (_) {
      return '';
    }
  }, [currentUser]);

  useEffect(() => {
    const handleUnreadCountUpdate = (data) => {
      setUnreadCount(data.totalUnread);
      setHasUnreadMessages(data.totalUnread > 0);
      
      if (data.totalUnread > 0) {
        if (Date.now() < ignoreBlinkUntil) {
          return;
        }
        setIsBlinking(true);
      } else {
        setIsBlinking(false);
      }
    };

    const handleNewAdminMessage = (data) => {
      const msg = data?.message || data?.msg || {};
      const text = msg?.message || msg?.text || data?.messageText || '';
      const isAuto = data?.isAuto || msg?.is_auto || msg?.is_automatic || (
        typeof text === 'string' && text.startsWith('Thank you for your inquiry!')
      );

      if (isAuto) {
        setIgnoreBlinkUntil(Date.now() + 5000);
        return;
      }

      setUnreadCount(data.unreadCount);
      setHasUnreadMessages(data.unreadCount > 0);
      setIsBlinking(true);

      toast.info({
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    };

    socket.on('unread_count_update', handleUnreadCountUpdate);
    socket.on('new_admin_message', handleNewAdminMessage);

    return () => {
      socket.off('unread_count_update', handleUnreadCountUpdate);
      socket.off('new_admin_message', handleNewAdminMessage);
    };
  }, [ignoreBlinkUntil]);

  const handleMessageClick = async () => {
    try {
      const token = localStorage.getItem('userToken');
      if (token) {
        const userId = getUserIdFromToken(token);
        
        await apiFetch('/api/inquiries/mark-all-read', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        socket.emit('mark_all_messages_read', { userId });
        
        setIsBlinking(false);
        setHasUnreadMessages(false);
        setUnreadCount(0);
      }
      
      navigate('/MessagesPage');
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      toast.error('Failed to mark messages as read');
    }
  };

  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 50);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim() === '') return;

    if (location.pathname !== '/') {
      navigate('/', { 
        state: { searchQuery },
        replace: true
      });
    } else {
      navigate('.', { 
        state: { searchQuery },
        replace: true
      });
    }
    
    setSearchQuery('');
    setIsMobileMenuOpen(false);
  };

  const handleLogoutConfirm = async () => {
    try {
      const token = localStorage.getItem('userToken');
      if (token) {
        await apiFetch('/api/user/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        socket.disconnect();
      }
      
      localStorage.removeItem('userToken');
      setCurrentUser(null);
      setHasUnreadMessages(false);
      setUnreadCount(0);
      setIsBlinking(false);
      setIsMobileMenuOpen(false);
      
      toast.success('Successfully logged out!');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed.');
    }
  };

  const handleLogout = () => {
    toast.info(
      <div style={{ padding: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Confirm Logout</h4>
        <p style={{ margin: '0 0 15px 0', color: '#666' }}>Are you sure you want to logout?</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss();
              handleLogoutConfirm();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#FFD700',
              color: '#111',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            Yes
          </button>
          <button
            onClick={() => toast.dismiss()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            No
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        closeButton: false,
        style: { background: 'white', color: 'black' }
      }
    );
  };

  const handleCartClick = () => {
    navigate('/cart');
    setIsMobileMenuOpen(false);
  };

  const handleProfileClick = () => {
    navigate('/UserProfile');
    setIsMobileMenuOpen(false);
  };

  const handleNavLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  const handleDesktopFilterClick = () => {
    setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
  };

  useEffect(() => {
    if (!isHomePage) {
      setIsDesktopSidebarOpen(false);
    }
  }, [location.pathname, isHomePage]);


  const mobileMenuVariants = {
    open: {
      opacity: 1,
      height: "auto",
      transition: { opacity: { duration: 0.2, ease: "easeOut" }, height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }
    },
    closed: {
      opacity: 0,
      height: 0,
      transition: { opacity: { duration: 0.15, ease: "easeIn" }, height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }
    }
  };

  const navItemVariants = {
    open: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
    closed: { opacity: 0, y: -8, transition: { duration: 0.15 } }
  };

  const MessageNotificationDot = () => (
    <motion.div
      style={{
        position: 'absolute',
        top: '-4px', // Adjusted for smaller size
        right: '-4px', // Adjusted for smaller size
        background: '#e74c3c',
        borderRadius: '50%',
        width: isMobile ? '14px' : '16px', // Reduced Size
        height: isMobile ? '14px' : '16px', // Reduced Size
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isBlinking ? '0 0 15px rgba(231, 76, 60, 1)' : '0 0 8px rgba(231, 76, 60, 0.8)',
        border: '1.5px solid #1a1a1a', // Thinner border
        zIndex: 10
      }}
      animate={{
        scale: isBlinking ? [1, 1.2, 1] : 1,
        opacity: isBlinking ? [0.7, 1, 0.7] : 1,
      }}
      transition={{ duration: 0.8, repeat: isBlinking ? Infinity : 0, ease: "easeInOut" }}
    >
      <span style={{ color: 'white', fontSize: isMobile ? '8px' : '9px', fontWeight: 'bold', lineHeight: 1 }}>
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </motion.div>
  );

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{
        width: '100%',
        background: 'rgba(17,17,17,0.65)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 2147483647,
        borderBottom: '1px solid rgba(255, 215, 0, 0.06)'
      }}
    >
      <svg width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BF953F" />
          <stop offset="20%" stopColor="#FCF6BA" />
          <stop offset="40%" stopColor="#B38728" />
          <stop offset="60%" stopColor="#FBF5B7" />
          <stop offset="80%" stopColor="#AA771C" />
        </linearGradient>
      </svg>

      <div style={{
        width: '100%',
        margin: '0 auto',
        // FIX: Removed vertical padding almost entirely to make it narrow like the image
        padding: isMobile ? '0px 0' : (scrolled ? '0px 0' : '4px 0'), 
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        gap: '0'
      }}>
        {/* Left Section - Logo, Desktop Filter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : (scrolled ? '20px' : '30px'),
          marginLeft: isMobile ? '3vw' : '1.5vw',
          transition: 'gap 0.4s ease'
        }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
          > 
            <Link to="/">
              <img
                src={logo}
                alt="Yokebud Crafts Logo" 
                style={{
                  // FIX: Reduced logo height to match the narrow reference image
                  height: isMobile ? '35px' : (scrolled ? '40px' : '45px'),
                  filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.3))',
                  transition: 'all 0.5s ease',
                  position: 'relative',
                  top: isMobile ? '4px' : '2px',
                  marginLeft: isMobile ? '0px' : '5px',
                }}
              />
            </Link>
          </motion.div>

          {!isMobile && isHomePage && (
             <motion.button
               onClick={handleDesktopFilterClick}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               style={{
                 display: 'flex',
                 alignItems: 'center',
                 gap: '6px',
                 background: 'rgba(255, 255, 255, 0.1)',
                 border: '1px solid rgba(255, 215, 0, 0.3)',
                 borderRadius: '20px',
                 padding: '4px 12px',
                 color: 'white',
                 cursor: 'pointer',
                 fontSize: '0.8rem',
                 fontWeight: '500',
                 transition: 'all 0.3s ease'
               }}
             >
               {isDesktopSidebarOpen ? <FaXmark /> : <FaFilter />}
               <span>Filter</span>
             </motion.button>
          )}
          
          {/* Desktop Icons - Adjusted size */}
          {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: scrolled ? '10px' : '15px',
              transition: 'gap 0.4s ease'
            }}>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleProfileClick}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  // FIX: Reduced to 32px for a slimmer look
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {profileImageUrl && !avatarError ? (
                  <img 
                    src={profileImageUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <FaUserCircle style={{ color: 'white', fontSize: '1rem', transition: 'all 0.3s ease' }} />
                )}
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCartClick}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px', // Reduced
                  height: '32px', // Reduced
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                <FaShoppingCart style={{ color: 'white', fontSize: '1rem', transition: 'all 0.3s ease' }} />
                {totalProductsCount > 0 && (
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: GOLD_GRADIENT, 
                      color: '#111',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 'bold',
                      boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
                      border: '1.5px solid #1a1a1a'
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    {totalProductsCount > 9 ? '9+' : totalProductsCount}
                  </motion.div>
                )}
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMessageClick}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px', // Reduced
                  height: '32px', // Reduced
                  borderRadius: '50%',
                  background: hasUnreadMessages ? 'rgba(231, 76, 60, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: hasUnreadMessages ? '1px solid rgba(231, 76, 60, 0.5)' : '1px solid rgba(255, 215, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                <FaEnvelope style={{ color: hasUnreadMessages ? '#e74c3c' : 'white', fontSize: '1rem', transition: 'all 0.3s ease' }} />
                {hasUnreadMessages && <MessageNotificationDot />}
              </motion.div>
            </div>
          )}

          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleProfileClick}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px', 
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {profileImageUrl && !avatarError ? (
                  <img 
                    src={profileImageUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <FaUserCircle style={{ color: 'white', fontSize: '0.9rem', transition: 'all 0.3s ease' }} />
                )}
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMessageClick}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px', 
                  height: '28px',
                  borderRadius: '50%',
                  background: hasUnreadMessages ? 'rgba(231, 76, 60, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: hasUnreadMessages ? '1px solid rgba(231, 76, 60, 0.5)' : '1px solid rgba(255, 215, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                <FaEnvelope style={{ color: hasUnreadMessages ? '#e74c3c' : 'white', fontSize: '0.9rem', transition: 'all 0.3s ease' }} />
                {hasUnreadMessages && <MessageNotificationDot />}
              </motion.div>
            </div>
          )}
        </div>
        
        {/* Right Section */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '6px' : (scrolled ? '0.8rem' : '1.2rem'),
          // FIX: Changed 'margin' to 'marginRight' to prevent vertical spacing issue
          marginRight: isMobile ? '3vw' : '1.5vw', 
          transition: 'gap 0.4s ease, margin-right 0.4s ease'
        }}>
          {!isMobile && (
            <nav style={{ width: 'fit-content' }}>
              <ul style={{
                display: 'flex',
                listStyle: 'none',
                margin: '0',
                padding: '0',
                marginLeft: scrolled ? '3vw' : '5vw',
                gap: scrolled ? '0.8rem' : '1.2rem',
                justifyContent: 'flex-end',
                transition: 'gap 0.4s ease, margin-left 0.4s ease'
              }}>
                {['/', '/about', '/contact'].map((path) => (
                  <motion.li
                    key={path}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ position: 'relative' }}
                  >
                    <Link 
                      to={path} 
                      style={{ 
                        textDecoration: 'none',
                        padding: '4px 4px',
                        display: 'block'
                      }}
                    >
                      <motion.div
                        className={`nav-link ${location.pathname === path ? 'active' : ''}`}
                        style={{
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          borderRadius: '8px'
                        }}
                      >
                        {path === '/' ? ('Shop') : path === '/about' ? ('About') : ('Contact')}
                      </motion.div>
                    </Link>
                    {(location.pathname === path) && (
                      <motion.div 
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          width: '100%',
                          height: '2px',
                          background: GOLD_GRADIENT,
                          borderRadius: '50px',
                          boxShadow: '0 0 8px rgba(212, 175, 55, 0.6)',
                          pointerEvents: 'none'
                        }}
                        layoutId="underline"
                      />
                    )}
                  </motion.li>
                ))}
              </ul>
            </nav>
          )}

          {isMobile && (
            <motion.form 
              onSubmit={handleSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                width: 'clamp(120px, 45vw, 200px)',
                flex: '0 0 auto',
                transition: 'none',
              }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div style={{
                width: '100%',
                padding: '1.5px',
                background: GOLD_GRADIENT,
                borderRadius: '20px',
                display: 'flex'
              }}>
                <input
                  type="search"
                  placeholder={('Search...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '3px 25px 3px 10px',
                    border: 'none',
                    borderRadius: '19px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '0.7rem',
                    outline: 'none',
                  }}
                />
              </div>
              <button 
                type="submit"
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <FaSearch size={10} style={{ fill: "url(#gold-gradient)" }} />
              </button>
            </motion.form>
          )}

          {isMobile && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FaTimes size={16} style={{ color: '#FFD700' }} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FaBars size={16} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {!isMobile && (
            <motion.form 
              onSubmit={handleSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                width: scrolled ? '200px' : '260px',
                transition: 'width 0.45s ease'
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div style={{
                width: '100%',
                padding: '1.5px',
                background: GOLD_GRADIENT,
                borderRadius: '25px',
                display: 'flex',
                boxShadow: '0 0 12px rgba(255, 215, 0, 0.15)',
              }}>
                <input
                  type="search"
                  placeholder={('Search products...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 12px',
                    border: 'none',
                    borderRadius: '23px',
                    background: 'rgba(20, 20, 20, 0.8)',
                    color: 'white',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>
              <button 
                type="submit"
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <FaSearch size={12} style={{ fill: "url(#gold-gradient)" }} />
              </button>
            </motion.form>
          )}
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobile && isMobileMenuOpen && (
          <motion.div 
            initial="closed"
            animate="open"
            exit="closed"
            variants={mobileMenuVariants}
            style={{
              width: '100%',
              background: 'rgba(17, 17, 17, 0.98)',
              borderTop: '1px solid rgba(255, 215, 0, 0.2)',
              padding: '10px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              overflow: 'hidden',
            }}
          >
            <nav style={{ width: '100%' }}>
              <ul style={{
                display: 'flex',
                flexDirection: 'column',
                listStyle: 'none',
                margin: '0',
                padding: '0',
                alignItems: 'center',
                gap: '8px'
              }}>
                {['/', '/about', '/contact'].map((path, index) => (
                  <motion.li
                    key={path}
                    variants={navItemVariants}
                    custom={index}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                      width: '100%',
                      textAlign: 'center',
                      position: 'relative'
                    }}
                  >
                    <Link 
                      to={path} 
                      onClick={handleNavLinkClick}
                      style={{ 
                        textDecoration: 'none',
                        padding: '8px 0',
                        display: 'block',
                        width: '100%'
                      }}
                    >
                      <motion.div
                        className={`nav-link ${location.pathname === path ? 'active' : ''}`}
                        style={{
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          borderRadius: '8px',
                          padding: '4px 12px',
                          margin: '0 15px'
                        }}
                      >
                        {path === '/' ? ('Shop') : path === '/about' ? ('About') : ('Contact')}
                      </motion.div>
                    </Link>
                    
                    {(location.pathname === path) && (
                      <motion.div 
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '50%',
                          height: '2px',
                          background: GOLD_GRADIENT,
                          borderRadius: '50px',
                          boxShadow: '0 0 8px rgba(212, 175, 55, 0.6)'
                        }}
                        layoutId="mobile-underline"
                      />
                    )}
                  </motion.li>
                ))}
              </ul>
            </nav>

            {currentUser ? (
              <motion.div
                variants={navItemVariants}
                style={{
                  width: '100%',
                  margin: '0 auto',
                  maxWidth: '400px',
                  background: 'rgba(30, 30, 30, 0.7)',
                  borderRadius: '8px',
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleProfileClick();
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: 'white',
                    padding: '6px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <FaUserCircle /> Profile
                </motion.button>
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: 'white',
                    padding: '6px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <FaSignOutAlt /> Logout
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                variants={navItemVariants}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '6px 0'
                }}
              >
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleProfileClick}
                  style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: '5px',
                    margin: '0 auto',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <FaSignInAlt /> Login/Signup
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDesktopSidebarOpen && !isMobile && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '100vh',
                zIndex: 2147483640, 
                pointerEvents: 'none' 
            }}>
                <div style={{ pointerEvents: 'auto' }}>
                   <MobileNav />
                   <DesktopSidebar 
                     isOpen={isDesktopSidebarOpen} 
                     onClose={() => setIsDesktopSidebarOpen(false)} 
                   />
                </div>
            </div>
        )}
      </AnimatePresence>

      <style>
        {`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .blinking-dot {
            animation: blink 1s infinite;
          }
          .nav-link {
            display: inline-block;
            color: #ffffff;
            -webkit-text-fill-color: initial;
            background: none;
            transition: color 0.2s ease, text-shadow 0.25s ease, transform 0.2s ease;
            will-change: color, transform;
            -webkit-font-smoothing: antialiased;
          }
          .nav-link:hover {
            background: ${GOLD_GRADIENT};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            text-shadow: 0px 0px 6px rgba(212, 175, 55, 0.35);
          }
          .nav-link.active {
            background: ${GOLD_GRADIENT};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
          }
        `}
      </style>
    </motion.div>
  );
};

const DesktopSidebar = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [section, setSection] = useState('all');
    const [subCategory, setSubCategory] = useState('All');
    const [minPrice, setMinPrice] = useState(0);
    const [maxPrice, setMaxPrice] = useState(5000);
    const [categories, setCategories] = useState([]);
    const MAX_PRICE = 5000;

    const toSlug = (s) => {
        try {
            return String(s || '')
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .slice(0, 80);
        } catch {
            return '';
        }
    };

    const handleCategorySelect = (sec, sub) => {
        setSection(sec);
        setSubCategory(sub);
    };

    const handleMinPriceChange = (e) => {
        const val = Math.max(0, parseInt(e.target.value) || 0);
        setMinPrice(val);
    };

    const handleMaxPriceChange = (e) => {
        const val = Math.min(MAX_PRICE, parseInt(e.target.value) || 0);
        setMaxPrice(val);
    };

    const handleSliderChange = (e) => {
        setMaxPrice(parseInt(e.target.value));
    }

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

    // Realtime filter application (desktop behaves like mobile)
    useEffect(() => {
        if (!isOpen) return;

        const isDefault =
            section === 'all' &&
            subCategory === 'All' &&
            minPrice === 0 &&
            maxPrice === MAX_PRICE;

        const params = new URLSearchParams(location.search);
        // Clear previous filter-related params
        params.delete('section');
        params.delete('category');
        params.delete('min');
        params.delete('max');

        if (!isDefault) {
            if (section && section !== 'all') {
                params.set('section', section);
            }
            if (subCategory && subCategory !== 'All') {
                params.set('category', toSlug(subCategory));
            }
            if (minPrice > 0) {
                params.set('min', String(minPrice));
            }
            if (maxPrice < MAX_PRICE) {
                params.set('max', String(maxPrice));
            }
        }

        const nextSearch = params.toString();
        const currentSearch = location.search.startsWith('?')
            ? location.search.slice(1)
            : location.search;

        if (nextSearch === currentSearch) return;

        const timer = setTimeout(() => {
            navigate(
                { pathname: '/', search: nextSearch },
                { replace: true }
            );
        }, 250);

        return () => clearTimeout(timer);
    }, [section, subCategory, minPrice, maxPrice, isOpen, location.search, navigate, MAX_PRICE]);

    if (!isOpen) return null;

    return (
        <div
          style={{ 
            position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, 
            zIndex: 2147483640,
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(3px)' 
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="premium-sidebar sidebar-scroll" style={{ bottom: 0, position: 'relative', zIndex: 2147483640 }}>
              <MobileNav />
              
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px', borderBottom: '1px solid rgba(191, 149, 63, 0.15)' }}>
                  <div className="text-gold" style={{ fontSize: '1.1rem', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
                    <FaFilter size={16} style={{ marginRight: '8px', color: '#BF953F' }}/> FILTERS
                  </div>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#BF953F', fontSize: '1.3rem', cursor: 'pointer' }}>
                    <FaXmark />
                  </button>
                </div>

                <div style={{ padding: '0px 20px', flex: 1 }}>
                  <div style={{ marginBottom: '25px' }}>
                    <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Browse By</h4>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button className={`gold-btn ${section === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all', 'All')}>All</button>
                      <button className={`gold-btn ${section === 'new' ? 'active' : ''}`} onClick={() => handleCategorySelect('new', 'All')} style={{ flexGrow: 2 }}>New Arrivals</button>
                    </div>
                  </div>


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
                </div>
                
                  <div style={{ marginBottom: '25px', padding: '0 20px' }}>
                      <h4 className="text-silver" style={{ fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Price Range</h4>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: '#888', display: 'block', marginBottom: '4px' }}>Min</label>
                            <input 
                                type="number" 
                                value={minPrice} 
                                onChange={handleMinPriceChange}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid #BF953F',
                                    color: '#fff',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <span style={{ color: '#BF953F', marginTop: '15px' }}>-</span>
                        <div style={{ flex: 1 }}>
                             <label style={{ fontSize: '0.7rem', color: '#888', display: 'block', marginBottom: '4px' }}>Max</label>
                             <input 
                                type="number" 
                                value={maxPrice} 
                                onChange={handleMaxPriceChange}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid #BF953F',
                                    color: '#fff',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                      </div>

                      <div style={{ padding: '0 5px' }}>
                        <input 
                            type="range" 
                            min="0" 
                            max="500" 
                            value={maxPrice} 
                            onChange={handleSliderChange}
                            style={{
                                width: '100%',
                                cursor: 'pointer',
                                accentColor: '#BF953F'
                            }}
                        />
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                            <span>0</span>
                            <span>500+</span>
                         </div>
                      </div>
                  </div>

                <div style={{ padding: '5px 20px', borderTop: '1px solid rgba(191, 149, 63, 0.15)', marginTop: 'auto' }}>
                  <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)', color: '#000', fontSize: '0.9rem', fontWeight: '800', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(191, 149, 63, 0.3)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                    Close
                  </button>
                </div>
          </div>
        </div>
    );
};

export default Navbar;
