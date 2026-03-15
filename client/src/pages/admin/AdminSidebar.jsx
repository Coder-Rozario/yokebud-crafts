import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiGrid, FiShoppingCart, FiBox, FiUpload, FiMail, FiMessageSquare, FiTrendingUp, FiLock, FiLogOut } from 'react-icons/fi';
import { apiFetch } from '../../utils/api';

const AdminSidebar = ({ activeTab, setActiveTab, messagesUnreadCount, inquiriesUnreadCount, unreadCount }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localUnread, setLocalUnread] = useState({ messages: 0, inquiries: 0 });
  const [newOrderCount, setNewOrderCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-set activeTab based on current path
  useEffect(() => {
    const currentItem = navItems.find((item) => location.pathname === item.path);
    if (currentItem && currentItem.key !== activeTab) {
      setActiveTab(currentItem.key);
    }
  }, [location.pathname]);

  // Unread counts logic (kept exactly as before)
  useEffect(() => {
    let isCancelled = false;
    const fetchUnread = async () => {
      try {
        const messagesRes = await apiFetch('/api/messages', { credentials: 'include' });
        const messagesData = messagesRes.ok ? await messagesRes.json() : [];
        const messagesUnread = Array.isArray(messagesData) ? messagesData.filter((m) => !m.is_read).length : 0;

        let inquiriesUnread = 0;
        try {
          const inquiriesRes = await apiFetch('/api/inquiries', { credentials: 'include' });
          const inquiriesData = inquiriesRes.ok ? await inquiriesRes.json() : [];
          if (Array.isArray(inquiriesData)) {
            const attentionIds = new Set();
            inquiriesData.forEach((inq) => {
              const hasUnread = (inq && (inq.admin_unread_count || 0) > 0);
              const isNew = (inq && (inq.status === 'new'));
              if (hasUnread || isNew) attentionIds.add(inq.id);
            });
            inquiriesUnread = attentionIds.size;
          }
        } catch {
          inquiriesUnread = typeof inquiriesUnreadCount === 'number' ? inquiriesUnreadCount : 0;
        }

        if (!isCancelled) {
          setLocalUnread({ messages: messagesUnread, inquiries: inquiriesUnread });
        }
      } catch {
        if (!isCancelled) setLocalUnread((prev) => ({ ...prev }));
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => { isCancelled = true; clearInterval(interval); };
  }, [inquiriesUnreadCount]);

  useEffect(() => {
    const readCount = () => {
      try {
        const raw = localStorage.getItem('new_order_count');
        const parsed = raw ? parseInt(raw, 10) : 0;
        setNewOrderCount(Number.isNaN(parsed) ? 0 : parsed);
      } catch { setNewOrderCount(0); }
    };
    readCount();
    const interval = setInterval(readCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAdminAuthenticated');
    document.cookie = 'adminAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/admin/login';
  };

  const resolvedMessagesUnread = typeof messagesUnreadCount === 'number' ? messagesUnreadCount : typeof unreadCount === 'number' ? unreadCount : localUnread.messages;
  const resolvedInquiriesUnread = typeof inquiriesUnreadCount === 'number' ? inquiriesUnreadCount : localUnread.inquiries;

  const navItems = [
    { label: 'Dashboard', icon: <FiGrid />, path: '/admin/dashboard', key: 'dashboard' },
    { label: 'Orders', icon: <FiShoppingCart />, path: '/admin/orders', key: 'orders' },
    { label: 'Inquiries', icon: <FiMessageSquare />, path: '/admin/AdminInquiry', key: 'inquiries' },
    { label: 'Messages', icon: <FiMail />, path: '/admin/messages', key: 'messages' },
    { label: 'Products', icon: <FiBox />, path: '/admin/products', key: 'products' },
    { label: 'Upload', icon: <FiUpload />, path: '/admin/upload', key: 'upload' },
    { label: 'Upload Blog', icon: <FiUpload />, path: '/admin/blog', key: 'blog' },
    { label: 'SEO Footer', icon: <FiTrendingUp />, path: '/admin/seo', key: 'seo' },
    { label: 'Sitemap', icon: <FiBox />, path: '/admin/sitemap', key: 'sitemap' },
    { label: 'Analytics', icon: <FiTrendingUp />, path: 'https://analytics.google.com/analytics/web/', key: 'analytics', external: true },
  ];

  // --- Premium Styles ---
  const styles = {
    sidebar: {
      background: 'rgba(20, 20, 23, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      height: '100vh',
      width: isMobile ? '280px' : '260px',
      padding: isMobile && !sidebarOpen ? '0' : '2rem 1.2rem',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 1000,
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '4px 0 30px rgba(0, 0, 0, 0.4)',
      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
      pointerEvents: isMobile && !sidebarOpen ? 'none' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    logoContainer: {
      marginBottom: '3rem',
      padding: '0 0.5rem',
      opacity: sidebarOpen || !isMobile ? 1 : 0,
      transition: 'opacity 0.3s ease',
    },
    logoText: {
      background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', // Golden gradient
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontSize: '1.5rem',
      fontWeight: '800',
      letterSpacing: '-0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    navContainer: {
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      opacity: sidebarOpen || !isMobile ? 1 : 0,
      transition: 'opacity 0.2s ease 0.1s',
    },
    menuToggle: {
      position: 'fixed',
      top: '1.2rem',
      right: '1.2rem',
      zIndex: 1100,
      background: 'rgba(245, 158, 11, 0.15)', // Tinted bg
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '12px',
      padding: '0.6rem',
      display: isMobile ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#F59E0B',
      cursor: 'pointer',
      backdropFilter: 'blur(4px)',
    },
    overlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', 
        zIndex: 999, display: isMobile && sidebarOpen ? 'block' : 'none'
    }
  };

  // Function to generate dynamic link styles
  const getLinkStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '0.9rem 1.1rem',
    borderRadius: '12px',
    textDecoration: 'none',
    color: isActive ? '#fff' : '#a1a1aa', // Zinc-400 for inactive
    background: isActive 
      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)' 
      : 'transparent',
    border: '1px solid',
    borderColor: isActive ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
    position: 'relative',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '500',
  });

  const badgeStyle = {
    marginLeft: 'auto', // Push to right
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    borderRadius: '99px',
    background: '#EF4444', // Red-500
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: '700',
    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
  };

  return (
    <>
      {/* Global Admin Scrollbar Styles - Ensures consistency across all tabs */}
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #18181B; }
        ::-webkit-scrollbar-thumb { background: #3F3F46; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525B; }
        * { scrollbar-width: thin; scrollbar-color: #3F3F46 #18181B; }
      `}</style>

      {/* Mobile Overlay */}
      <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />

      {/* Mobile Toggle */}
      {isMobile && (
        <motion.div 
            style={styles.menuToggle} 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            whileTap={{ scale: 0.95 }}
        >
          {sidebarOpen ? <FiX size={22} /> : <FiMenu size={22} />}
        </motion.div>
      )}

      {/* Sidebar */}
      <nav style={styles.sidebar}>
        {/* Logo Area */}
        <div style={styles.logoContainer}>
          <div style={styles.logoText}>
            <div style={{ width: 8, height: 24, background: '#F59E0B', borderRadius: 4 }}></div>
            ADMIN PANEL
          </div>
        </div>

        {/* Navigation Items */}
        <div style={styles.navContainer}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            
            // Determine badge count
            let badgeCount = 0;
            if (item.key === 'orders') badgeCount = newOrderCount;
            if (item.key === 'messages') badgeCount = resolvedMessagesUnread;
            if (item.key === 'inquiries') badgeCount = resolvedInquiriesUnread;

            const LinkComponent = item.external ? 'a' : Link;
            const linkProps = item.external 
              ? { href: item.path, target: '_blank', rel: 'noopener noreferrer' } 
              : { to: item.path };

            return (
              <LinkComponent
                key={item.key}
                {...linkProps}
                style={getLinkStyle(isActive)}
                onClick={() => {
                  if (!item.external) setActiveTab(item.key);
                  if (isMobile) setSidebarOpen(false);
                }}
                onMouseEnter={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.color = '#e4e4e7';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#a1a1aa';
                    }
                }}
              >
                {/* Active Indicator Line */}
                {isActive && (
                    <div style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: '4px', height: '60%', background: '#F59E0B',
                        borderTopRightRadius: '4px', borderBottomRightRadius: '4px',
                        boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)'
                    }} />
                )}

                <span style={{ fontSize: '1.2rem', display: 'flex', color: isActive ? '#F59E0B' : 'inherit' }}>
                    {item.icon}
                </span>
                <span style={{ marginLeft: '1rem' }}>{item.label}</span>
                
                {badgeCount > 0 && (
                  <span style={badgeStyle}>{badgeCount}</span>
                )}
              </LinkComponent>
            );
          })}
        </div>

        {/* Logout Button */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', opacity: sidebarOpen || !isMobile ? 1 : 0 }}>
          <button
            onClick={handleLogout}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '0.9rem 1.1rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FiLogOut style={{ fontSize: '1.2rem', marginRight: '0.8rem' }} />
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
};

// Add Framer Motion Wrapper for basic animation if not using 'framer-motion' elsewhere
const motion = {
    div: ({ children, style, onClick, whileTap }) => (
        <div 
            style={{...style, transition: 'transform 0.1s'}} 
            onClick={onClick}
            onMouseDown={(e) => e.currentTarget.style.transform = `scale(${whileTap?.scale || 1})`}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            {children}
        </div>
    )
};

export default AdminSidebar;
