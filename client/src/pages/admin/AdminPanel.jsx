import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, FiMessageSquare, FiShoppingBag, FiDollarSign, 
  FiAlertCircle, FiCheck, FiX, FiRefreshCw, FiSearch, FiEye 
} from 'react-icons/fi';
import { apiFetch } from '../../utils/api';

// --- Utility Helpers ---
const formatEUR = (val) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(val || 0));

// --- Modern Loading Spinner ---
const LoadingSpinner = () => (
  <div style={{ 
    height: '100vh', 
    width: '100%', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    background: '#09090b',
    flexDirection: 'column',
    gap: '15px'
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
      Loading Dashboard...
    </motion.span>
  </div>
);

// --- Premium Chart Component ---
const UserActivityChart = ({ data, isMobile }) => {
  const width = 600;
  const height = 300;
  const padding = 40;

  const sorted = Array.isArray(data)
    ? [...data].filter(d => d && d.date != null && d.count != null).sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  const last = sorted.slice(Math.max(0, sorted.length - 14));
  const counts = last.map(d => Number(d.count) || 0);
  const maxCount = counts.length ? Math.max(...counts, 5) : 5;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const xStep = last.length > 1 ? innerW / (last.length - 1) : 0;
  const yScale = v => padding + (1 - v / maxCount) * innerH;

  const points = last.map((d, i) => `${padding + i * xStep},${yScale(Number(d.count))}`).join(' ');
  const areaPath = last.length ? `${points} ${width - padding},${height - padding} ${padding},${height - padding}` : '';

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={padding} x2={width - padding} y1={padding + t * innerH} y2={padding + t * innerH} stroke="#333" strokeDasharray="4 4" />
        ))}
        {last.length > 0 && (
          <>
            <polygon points={areaPath} fill="url(#chartGradient)" />
            <polyline points={points} fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {last.map((d, i) => (
              <circle key={i} cx={padding + i * xStep} cy={yScale(Number(d.count))} r={4} fill="#111" stroke="#F59E0B" strokeWidth={2} />
            ))}
          </>
        )}
        {last.map((d, i) => (
          <text key={i} x={padding + i * xStep} y={height - 15} fill="#666" fontSize="10" textAnchor="middle">
            {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
          </text>
        ))}
      </svg>
    </div>
  );
};

// --- Stats Grid Component ---
const StatsGrid = ({ isMobile, stats, orders, userActivity, onOrdersClick }) => {
  const computePercent = (current, previous) => {
    const c = Number(current || 0);
    const p = Number(previous || 0);
    if (p === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / p) * 100);
  };

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = (n) => new Date(startOfDay(now).getTime() - n * 24 * 60 * 60 * 1000);
  const within = (date, start, end) => {
    const t = new Date(date).getTime();
    return t >= start.getTime() && t < end.getTime();
  };

  const thisWeekStart = daysAgo(7);
  const lastWeekStart = daysAgo(14);
  const thisWeekEnd = startOfDay(now);

  const ordersThisWeek = (orders || []).filter(o => within(o.created_at, thisWeekStart, thisWeekEnd));
  const ordersLastWeek = (orders || []).filter(o => within(o.created_at, lastWeekStart, thisWeekStart));
  const ordersGrowth = computePercent(ordersThisWeek.length, ordersLastWeek.length);

  const revenueThisWeek = ordersThisWeek.reduce((sum, o) => sum + Number(o.totals?.total || 0), 0);
  const revenueLastWeek = ordersLastWeek.reduce((sum, o) => sum + Number(o.totals?.total || 0), 0);
  const revenueGrowth = computePercent(revenueThisWeek, revenueLastWeek);

  const ua = Array.isArray(userActivity) ? userActivity : [];
  const uaThisWeek = ua.filter(d => within(d.date, thisWeekStart, thisWeekEnd)).reduce((sum, d) => sum + Number(d.count || 0), 0);
  const uaLastWeek = ua.filter(d => within(d.date, lastWeekStart, thisWeekStart)).reduce((sum, d) => sum + Number(d.count || 0), 0);
  const usersGrowth = computePercent(uaThisWeek, uaLastWeek);

  const viewedMap = JSON.parse(localStorage.getItem('viewed_orders') || '{}');
  const newPendingOrders = (orders || []).filter(o => {
    const isPending = String(o.status || '').toLowerCase() === 'pending' || !o.status;
    const isViewed = !!viewedMap[o.order_id];
    return isPending && !isViewed;
  }).length;

  const items = [
    { key: 'revenue', title: 'Total Revenue', val: new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(stats.revenue || 0), color: '#10B981', growth: revenueGrowth },
    { key: 'orders', title: 'Total Orders', val: stats.totalOrders || 0, color: '#3B82F6', growth: ordersGrowth, badge: newPendingOrders },
    { key: 'users', title: 'Total Users', val: stats.totalUsers || 0, color: '#F59E0B', growth: usersGrowth },
    { key: 'products', title: 'Products', val: stats.totalProducts || 0, color: '#8B5CF6', growth: 0 }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
      {items.map((item) => (
        <div key={item.key} style={{ background: 'rgba(24, 24, 27, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '1.5rem', transition: 'all 0.3s ease', cursor: item.key === 'orders' ? 'pointer' : 'default' }} onClick={() => { if (item.key === 'orders' && typeof onOrdersClick === 'function') onOrdersClick(); }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: `${item.color}20`, color: item.color }}>
              {item.key === 'revenue' ? <FiDollarSign /> : item.key === 'orders' ? <FiShoppingBag /> : item.key === 'users' ? <FiUsers /> : <FiCheck />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {item.key === 'orders' && item.badge > 0 && (
                <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: '999px' }}>{item.badge} new</span>
              )}
              <div style={{ fontSize: '0.75rem', color: item.growth >= 0 ? '#10B981' : '#EF4444', background: (item.growth >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'), padding: '2px 6px', borderRadius: '4px' }}>
                {item.growth >= 0 ? `+${item.growth}%` : `${item.growth}%`}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>{item.val}</div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>{item.title}</div>
        </div>
      ))}
    </div>
  );
};

// --- Main Component ---
const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, totalProducts: 0, totalOrders: 0,
    revenue: 0, totalMessages: 0, unreadMessages: 0, unrepliedMessages: 0
  });
  const [growth, setGrowth] = useState({ messages: 0, products: 0, users: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data States
  const [products, setProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  
  // Order Management
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Resize Listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch All Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodRes, msgRes, dashRes, usersSummaryRes, subRes] = await Promise.all([
          apiFetch('/api/products'),
          apiFetch('/api/messages'),
          apiFetch('/api/admin/dashboard', { credentials: 'include' }),
          apiFetch('/api/admin/users/summary', { credentials: 'include' }),
          apiFetch('/api/subscribers', { credentials: 'include' })
        ]);

        const prodData = prodRes.ok ? await prodRes.json() : [];
        const msgData = msgRes.ok ? await msgRes.json() : [];
        const dashData = dashRes.ok ? await dashRes.json() : {};
        const usersSummary = usersSummaryRes.ok ? await usersSummaryRes.json() : {};
        const subData = subRes.ok ? await subRes.json() : { subscribers: [] };

        setProducts(prodData);
        const lowStock = Array.isArray(prodData) ? prodData.filter(p => (p.stock || 0) < 5).slice(0, 5) : [];
        setLowStockProducts(lowStock);

        const dashStats = dashData.stats || dashData || {};
        const activity = Array.isArray(usersSummary.activity) ? usersSummary.activity : [];
        const todayKey = new Date().toISOString().slice(0,10);
        const todayEntry = activity.find(a => String(a.date).slice(0,10) === todayKey);
        const activeToday = todayEntry ? Number(todayEntry.count || 0) : 0;

        setStats(prev => ({
          ...prev,
          totalUsers: usersSummary.totalUsers || prev.totalUsers || 0,
          totalProducts: Array.isArray(prodData) ? prodData.length : 0,
          totalOrders: dashStats.totalOrders || dashStats.pendingOrders || 0,
          revenue: prev.revenue || 0,
          totalMessages: Array.isArray(msgData) ? msgData.length : 0,
          unreadMessages: Array.isArray(msgData) ? msgData.filter(m => !m.is_read).length : 0,
          unrepliedMessages: Array.isArray(msgData) ? msgData.filter(m => !m.is_replied).length : 0,
          activeUsers: activeToday
        }));

        setUserActivity(activity);
        const subsList = Array.isArray(subData) ? subData : (subData.subscribers || subData.data || []);
        setSubscribers(subsList);
        setTotalSubscribers(subsList.length);

        setGrowth({ users: 5, products: 2, messages: 12 });

      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Real-time: users summary and activity
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await apiFetch('/api/admin/users/summary', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const activity = Array.isArray(data.activity) ? data.activity : [];
        const todayKey = new Date().toISOString().slice(0,10);
        const todayEntry = activity.find(a => String(a.date).slice(0,10) === todayKey);
        const activeToday = todayEntry ? Number(todayEntry.count || 0) : 0;
        setStats(prev => ({
          ...prev,
          totalUsers: data.totalUsers || prev.totalUsers,
          activeUsers: activeToday
        }));
        setUserActivity(activity);
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Fetch Orders specifically
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const res = await apiFetch('/api/orders', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = data.orders || [];
          setOrders(list);
          const totalRevenue = list.reduce((sum, o) => sum + Number(o.totals?.total || 0), 0);
          setStats(prev => ({ ...prev, revenue: totalRevenue, totalOrders: data.orders?.length || prev.totalOrders }));
          try {
            const viewedMap = JSON.parse(localStorage.getItem('viewed_orders') || '{}');
            const pendingUnviewed = list.filter(o => {
              const isPending = String(o.status || '').toLowerCase() === 'pending' || !o.status;
              const isViewed = !!viewedMap[o.order_id];
              return isPending && !isViewed;
            }).length;
            localStorage.setItem('new_order_count', String(pendingUnviewed));
          } catch (_) {}
        }
      } catch (e) { console.error(e); }
      finally { setLoadingOrders(false); }
    };
    fetchOrders();
    const id = setInterval(fetchOrders, 15000);
    return () => clearInterval(id);
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await fetch('https://api.yokebud.fi/api/admin/logout', { method: 'POST', credentials: 'include' });
    } catch (err) { console.error(err); }
    try {
      localStorage.removeItem('isAdminAuthenticated');
      document.cookie = 'adminAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    } catch (_) {}
    window.location.href = '/admin/login';
  };

  // --- Styles ---
  const styles = {
    container: {
      height: '100vh',      // CHANGED: Fixed height to viewport
      width: '100%',
      backgroundColor: '#09090b',
      color: '#e4e4e7',
      fontFamily: "'Inter', sans-serif",
      boxSizing: 'border-box',
      overflowY: 'auto',    // CHANGED: Enable vertical scrolling inside container
      overflowX: 'hidden'   // Prevent horizontal scroll
    },
    main: {
      padding: isMobile ? '1.5rem' : '2.5rem',
      background: 'radial-gradient(circle at top right, #1a1a1a 0%, #050505 100%)',
      minHeight: '100%'     // Ensure gradient covers full scrollable height
    },
    headerTitle: {
      fontSize: '2rem', fontWeight: '700', 
      background: 'linear-gradient(to right, #F59E0B, #FBBF24)', 
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      letterSpacing: '-0.02em'
    },
    card: {
      background: 'rgba(24, 24, 27, 0.6)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px',
      padding: '1.5rem', transition: 'all 0.3s ease'
    },
    tableHeader: {
      textAlign: 'left', padding: '1rem', color: '#a1a1aa', fontSize: '0.85rem', 
      textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #27272a'
    },
    tableCell: {
      padding: '1rem', borderBottom: '1px solid #27272a', color: '#e4e4e7', fontSize: '0.95rem'
    },
    badge: (type) => ({
      padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
      backgroundColor: type === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
      color: type === 'critical' ? '#EF4444' : '#10B981',
      border: `1px solid ${type === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
    })
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={styles.headerTitle}>Dashboard</h1>
            <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>Overview of your store's performance</p>
          </div>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff',
            padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500',
            transition: 'background 0.2s'
          }}>Logout</button>
        </header>

        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Stats Grid */}
            <StatsGrid isMobile={isMobile} stats={stats} orders={orders} userActivity={userActivity} onOrdersClick={() => navigate('/admin/orders')} />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '1.5rem' }}>
              
              {/* User Activity Chart */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#fff' }}>User Activity</h3>
                <div style={{ color: '#a1a1aa', marginBottom: '1rem' }}>Active Users: {stats.activeUsers || 0}</div>
                <div style={{ height: '300px' }}>
                  <UserActivityChart data={userActivity} />
                </div>
              </div>

              {/* Stockout Products Section */}
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiAlertCircle color="#EF4444" /> Low Stock Alert
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>&lt; 5 items</span>
                </div>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {lowStockProducts.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {lowStockProducts.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => navigate(`/admin/products/edit/${p.id || p._id || p.sku}`)}>
                            <td style={{ padding: '0.8rem 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src={p.thumbnail || p.images?.[0] || 'https://via.placeholder.com/40'} alt={p.name || "Product thumbnail"} 
                                  style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #333' }} />
                                <div>
                                  <div style={{ color: '#e4e4e7', fontSize: '0.9rem', fontWeight: '500' }}>{p.name}</div>
                                  <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>SKU: {p.sku || 'N/A'}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                    <span style={{ color: '#fff', fontWeight: 700 }}>{formatEUR(Number((p.discounted_price ?? p.price) || 0))}</span>
                                    {Number(p.price || 0) > 0 && Number((p.discounted_price ?? p.price) || 0) < Number(p.price || 0) && (
                                      <>
                                        <span style={{ color: '#a1a1aa', textDecoration: 'line-through' }}>{formatEUR(Number(p.price || 0))}</span>
                                        <span style={{ color: '#10B981', fontWeight: 700 }}>{`-${Math.round(((Number(p.price || 0) - Number((p.discounted_price ?? p.price) || 0)) / Number(p.price || 0)) * 100)}%`}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.8rem 0' }}>
                              <span style={styles.badge(p.stock === 0 ? 'critical' : 'warning')}>
                                {p.stock} left
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#a1a1aa' }}>All products are well stocked!</div>
                  )}
                </div>
              </div>
            </div>

            {/* Subscribers List */}
            <div style={{ ...styles.card, marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>Recent Subscribers</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Email Address</th>
                      <th style={styles.tableHeader}>Join Date</th>
                      <th style={styles.tableHeader}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.slice(0, 5).map((sub, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={styles.tableCell}>{sub.email}</td>
                        <td style={styles.tableCell}>{new Date(sub.created_at).toLocaleDateString()}</td>
                        <td style={styles.tableCell}>
                          <span style={styles.badge('success')}>Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>Order Management</h3>
                <div style={{ position: 'relative' }}>
                  <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#666' }} />
                  <input type="text" placeholder="Search orders..." style={{
                    padding: '8px 10px 8px 35px', borderRadius: '8px', border: '1px solid #333',
                    background: '#09090b', color: '#fff', outline: 'none'
                  }} />
                </div>
              </div>

              {loadingOrders ? <div style={{ color: '#F59E0B' }}>Loading orders...</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeader}>Order ID</th>
                        <th style={styles.tableHeader}>Customer</th>
                        <th style={styles.tableHeader}>Date</th>
                        <th style={styles.tableHeader}>Total</th>
                        <th style={styles.tableHeader}>Status</th>
                        <th style={styles.tableHeader}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.order_id} style={{ borderBottom: '1px solid #27272a', transition: '0.2s', cursor: 'pointer' }} className="hover:bg-white/5">
                          <td style={styles.tableCell}>#{order.order_id}</td>
                          <td style={styles.tableCell}>{order.customer_name || 'Guest'}</td>
                          <td style={styles.tableCell}>{new Date(order.created_at).toLocaleDateString()}</td>
                          <td style={styles.tableCell} className="font-bold text-amber-500">{formatEUR(order.totals?.total)}</td>
                          <td style={styles.tableCell}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                              backgroundColor: order.status === 'Delivered' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: order.status === 'Delivered' ? '#10B981' : '#F59E0B'
                            }}>
                              {order.status}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <button style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                              <FiEye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No orders found.</div>}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
};

export default AdminPanel;
