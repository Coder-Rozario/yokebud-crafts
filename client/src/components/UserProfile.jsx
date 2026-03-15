import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUser, FaShoppingBag, FaEdit, FaTimes, FaGoogle, FaEnvelope, 
  FaExclamationTriangle, FaMapMarkerAlt, FaPhone, FaBuilding, 
  FaHeart, FaTrash, FaSignOutAlt, FaSpinner, FaBoxOpen, FaCheckCircle, FaTruck 
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut, auth, googleProvider, waitForAuthInit } from '../firebase';
import { toast, ToastContainer } from 'react-toastify';
import { apiFetch, absoluteUrl } from '../utils/api'; 
import { FiStar, FiCamera, FiUpload, FiMail, FiLoader, FiUser } from 'react-icons/fi';
import 'react-toastify/dist/ReactToastify.css';

// --- THEME CONFIGURATION ---
const THEME = {
  colors: {
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldSolid: '#D4AF37',
    bg: '#050505',
    glass: 'rgba(15, 15, 15, 0.7)', 
    glassBorder: '1px solid rgba(255, 255, 255, 0.08)',
    textMain: '#E0E0E0',
    textMuted: '#9CA3AF',
    danger: '#ff4757',
    success: '#2ed573'
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
    glow: '0 0 15px rgba(191, 149, 63, 0.2)'
  }
};

// --- CUSTOM SCROLLBAR CSS ---
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(191, 149, 63, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #BF953F, #AA771C);
    box-shadow: 0 0 10px rgba(191, 149, 63, 0.5);
  }
`;

// --- HELPERS ---
const silverTextStyle = {
  background: THEME.colors.silverGradient,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  display: 'inline-block'
};

const UserProfile = () => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [showIncompleteFieldsPopup, setShowIncompleteFieldsPopup] = useState(false);
  const [incompleteFields, setIncompleteFields] = useState([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  const [orderReview, setOrderReview] = useState({ rating: 5, text: '', mediaFiles: [] });
  const [isUploadingReview, setIsUploadingReview] = useState(false);
  const reviewFileInputRef = useRef(null);
  
  // Auth State
  const [loginStep, setLoginStep] = useState('email');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpType, setOtpType] = useState('login');
  const [otpCountdown, setOtpCountdown] = useState(0);
  
  // Registration Form
  const [registerData, setRegisterData] = useState({});

  // Profile Form
  const [profileForm, setProfileForm] = useState({});
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const navigate = useNavigate();
  const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Responsive Check
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isMobile = windowWidth < 768;
  
  useEffect(() => {
    let t;
    if (otpCountdown > 0) t = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const profileImageUrl = useMemo(() => {
    const f = firebaseUser;
    const u = user;
    return (f && f.photoURL) || (u && (u.photoURL || u.photo_url || u.google_photo_url || u.avatar_url)) || '';
  }, [firebaseUser, user]);

  const displayName = useMemo(() => {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
    return name || firebaseUser?.displayName || 'User';
  }, [user, firebaseUser]);

  // --- LOGIC & EFFECTS ---

  // Check incomplete fields logic
  const checkIncompleteFields = (userData) => {
    const fields = [];
    if (!userData.first_name) fields.push('First Name');
    if (!userData.last_name) fields.push('Last Name');
    if (!userData.phone) fields.push('Phone Number');
    if (!userData.address) fields.push('Street Address');
    if (!userData.city) fields.push('City');
    if (!userData.country) fields.push('Country');
    return fields;
  };

  useEffect(() => {
    if (isLoggedIn && user && !showProfileCompletion) {
      const incomplete = checkIncompleteFields(user);
      setIncompleteFields(incomplete);
      if (incomplete.length > 0) setShowIncompleteFieldsPopup(true);
    }
  }, [isLoggedIn, user, showProfileCompletion]);

  // Auth Initialization
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setIsInitializing(true);
      const fbUser = await waitForAuthInit();
      const token = localStorage.getItem('userToken');

      if (token) {
        try {
          const response = await apiFetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setUser(data.user);
            setIsLoggedIn(true);
            setProfileForm(data.user);
            const needsCompletion = !data.user.first_name || !data.user.address;
            setNeedsProfileCompletion(needsCompletion);
          } else if (fbUser) {
            await handleFirebaseLogin(fbUser);
          } else {
            handleCleanLogout();
          }
        } catch (error) {
           handleCleanLogout();
        }
      } else if (fbUser) {
        await handleFirebaseLogin(fbUser);
      } else {
        handleCleanLogout();
      }
      if (mounted) setIsInitializing(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Fetch Data on Tab Change
  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'orders') fetchUserOrders();
      if (activeTab === 'wishlist') fetchUserWishlist();
    }
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    let active = true;
    const hydrateItems = async () => {
      if (!selectedOrder) { setSelectedOrderItems([]); return; }
      const base = (selectedOrder.items && selectedOrder.items.length > 0) ? selectedOrder.items : [selectedOrder.product_details || {}];
      const out = await Promise.all(base.map(async (it) => {
        const raw = it.product_photos?.[0] || it.image;
        if (raw) {
          const url = raw.startsWith('http') ? raw : absoluteUrl(raw);
          return { ...it, _displayImage: url };
        }
        const pid = it.id || it.product_id || it._id || it.sku;
        if (!pid) return { ...it, _displayImage: '' };
        try {
          const res = await apiFetch(`/api/products/${pid}`);
          const data = await res.json();
          const p = data?.product || data || {};
          const photos = Array.isArray(p.product_photos) ? p.product_photos : (Array.isArray(p.images) ? p.images : []);
          const first = photos?.[0] || '';
          const url = first ? (first.startsWith('http') ? first : absoluteUrl(first)) : '';
          return { ...it, _displayImage: url, product_name: it.product_name || p.product_name || it.name };
        } catch (_) {
          return { ...it, _displayImage: '' };
        }
      }));
      if (active) setSelectedOrderItems(out);
    };
    hydrateItems();
    return () => { active = false; };
  }, [selectedOrder]);

  const shippingInfo = useMemo(() => {
    const addr = selectedOrder?.shipping_address || {};
    const cust = selectedOrder?.customer_info || {};
    const name =
      [cust.firstName, cust.lastName].filter(Boolean).join(' ') ||
      addr.name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ');
    const line1 = addr.address_line1 || addr.address || cust.address || '';
    const cityLine = [addr.city || cust.city, addr.state || cust.state, addr.zip || cust.zip || cust.zip_code].filter(Boolean).join(', ');
    const country = addr.country || cust.country || '';
    const phone = cust.phone || addr.phone || selectedOrder?.customer_phone || user?.phone || '';
    const email = cust.email || addr.email || selectedOrder?.customer_email || user?.email || '';
    const available = Boolean(name || line1 || cityLine || country || phone || email);
    return { name, line1, cityLine, country, phone, email, available };
  }, [selectedOrder, user]);
  
  const getProductIdFromItem = (it) => it?.id || it?.product_id || it?._id || it?.sku || '';
  const primaryProductId = useMemo(() => {
    const first = (selectedOrderItems && selectedOrderItems[0]) ? selectedOrderItems[0] : ((selectedOrder?.items && selectedOrder.items[0]) || selectedOrder?.product_details || {});
    return getProductIdFromItem(first) || '';
  }, [selectedOrderItems, selectedOrder]);
  
  const handleOrderReviewImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setOrderReview(prev => ({ ...prev, mediaFiles: [...prev.mediaFiles, ...files] }));
  };
  
  const handleSubmitOrderReview = async (e) => {
    e.preventDefault();
    try {
      if (!primaryProductId) { toast.error('Product not found'); return; }
      setIsUploadingReview(true);
      const form = new FormData();
      form.append('rating', String(orderReview.rating || 5));
      form.append('review_text', orderReview.text || '');
      const userObj = auth?.currentUser || null;
      if (userObj) {
        form.append('google_uid', userObj.uid);
        if (userObj.displayName) form.append('reviewer_name', userObj.displayName);
        if (userObj.photoURL) form.append('reviewer_photo_url', userObj.photoURL);
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
      (orderReview.mediaFiles || []).forEach(f => form.append('media', f));
      const res = await fetch(`/api/products/${primaryProductId}/reviews`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit review');
      }
      await res.json();
      toast.success('Review submitted', { theme: 'dark' });
      setOrderReview({ rating: 5, text: '', mediaFiles: [] });
      setIsUploadingReview(false);
    } catch (err) {
      setIsUploadingReview(false);
      toast.error(err.message || 'Failed to submit review', { theme: 'dark' });
    }
  };

  const handleCleanLogout = () => {
    localStorage.removeItem('userToken');
    setIsLoggedIn(false);
    setUser(null);
    setOrders([]);
    setWishlist([]);
  };

  // --- API ACTIONS ---
  
  const handleFirebaseLogin = async (firebaseUser) => {
    // ... (Keep existing login logic)
    try {
        setLoading(true);
        const response = await apiFetch('/api/user/auth/firebase-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified
            }
          })
        });
        const data = await response.json();
        if (data.success) {
          localStorage.setItem('userToken', data.token);
          setUser(data.user);
          setIsLoggedIn(true);
          setProfileForm(data.user);
          toast.success(`Welcome back!`);
        }
      } catch (e) {
        toast.error("Authentication failed");
      } finally {
        setLoading(false);
      }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const u = result?.user || auth?.currentUser;
      if (u) {
        await handleFirebaseLogin(u);
        setActiveTab('profile');
      }
    } catch (error) {
      toast.error('Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendOtp = async (email, type = 'login') => {
    if (!email) { toast.warning('Please enter an email address'); return; }
    setLoading(true);
    try {
      const endpoint = type === 'registration' ? '/api/user/register/send-otp' : '/api/user/login/send-otp';
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.success) {
        setOtpType(type);
        setLoginStep('otp');
        setOtpCountdown(60);
        toast.success('OTP code sent to your email!');
      } else {
        toast.error(data.message || 'Failed to send OTP');
      }
    } catch (e) {
      toast.error('Network error. Please try again.');
    }
    setLoading(false);
  };
  
  const handleVerifyOtp = async (email, otp, type) => {
    if (otp.length !== 6) { toast.warning('Please enter valid 6-digit OTP'); return; }
    setLoading(true);
    try {
      const endpoint = type === 'login' ? '/api/user/login/verify-otp' : '/api/user/register/verify-otp';
      const body = type === 'login' ? { email, otp } : { email, otp };
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('userToken', data.token);
        setUser(data.user);
        setIsLoggedIn(true);
        setProfileForm(data.user || {});
        setActiveTab('profile');
        setLoginStep('email');
        setLoginEmail('');
        setLoginOtp('');
        setOtpCountdown(0);
        toast.success('Login Successful!');
      } else {
        toast.error(data.message || 'Invalid OTP');
      }
    } catch (e) {
      toast.error('Verification failed');
    }
    setLoading(false);
  };
  
  const handleResendOtp = async () => {
    if (otpCountdown > 0) { toast.info(`Please wait ${otpCountdown} seconds before requesting a new OTP`); return; }
    setLoading(true);
    try {
      const endpoint = otpType === 'login' ? '/api/user/login/send-otp' : '/api/user/register/send-otp';
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail })
      });
      const data = await response.json();
      if (data.success) {
        setOtpCountdown(60);
        toast.success('OTP resent successfully!');
      } else {
        toast.error(data.message || 'Failed to resend OTP');
      }
    } catch (e) {
      toast.error('Failed to resend OTP. Please try again.');
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const response = await apiFetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profileForm)
      });
      const data = await response.json();
      if(data.success) {
        setUser(data.user);
        setIsEditing(false);
        toast.success('Profile updated!');
      }
    } catch(e) {
      toast.error('Update failed');
    }
    setLoading(false);
  };

  const fetchUserOrders = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await apiFetch('/api/user/orders', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if(data.success) setOrders(data.orders);
    } catch(e) { console.error(e); }
  };

  const fetchUserWishlist = async () => {
    try {
        const token = localStorage.getItem('userToken');
        const response = await apiFetch('/api/user/wishlist', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if(data.success) setWishlist(data.wishlist || []);
    } catch(e) {}
  };

  const removeFromWishlist = async (productId) => {
    try {
        const token = localStorage.getItem('userToken');
        await apiFetch(`/api/user/wishlist/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setWishlist(prev => prev.filter(item => item._id !== productId));
        toast.success('Removed from wishlist');
    } catch(e) { toast.error('Failed to remove'); }
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  
  const confirmLogout = async () => {
    await signOut(auth);
    handleCleanLogout();
    setShowLogoutConfirm(false);
    toast.info('Logged out.');
  };

  // --- STYLES ---
  const glassCardStyle = {
    background: THEME.colors.glass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: THEME.colors.glassBorder,
    borderRadius: '16px',
    boxShadow: THEME.shadows.card,
    overflow: 'hidden',
    width: '100%',
    maxWidth: isLoggedIn ? '1200px' : '480px',
    transition: 'all 0.3s ease',
    position: 'relative',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#E0E0E0',
    fontSize: '0.95rem',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block', color: THEME.colors.textMuted, marginBottom: '6px', fontSize: '0.85rem'
  };

  const goldBtnStyle = {
    background: THEME.colors.goldGradient,
    color: '#000', border: 'none', padding: '12px 28px', borderRadius: '8px',
    fontWeight: '700', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
  };

  // --- RENDER ---

  if (isInitializing) {
    return (
      <div style={{ minHeight: '80vh', background: THEME.colors.bg, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <FaSpinner size={40} color={THEME.colors.goldSolid} />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '80vh', background: THEME.colors.bg, padding: isMobile ? '10px' : '40px 20px', display: 'flex', justifyContent: 'center', fontFamily: "'Poppins', sans-serif", color: THEME.colors.textMain }}>
      
      {/* Inject custom scrollbar styles */}
      <style>{scrollbarStyles}</style>

      <ToastContainer position="top-center" theme="dark" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={glassCardStyle}>
        {!isLoggedIn ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{...silverTextStyle, fontSize: '2rem', fontWeight: '800', marginBottom: '10px'}}>Welcome Back</h2>
            <p style={{color: THEME.colors.textMuted, marginBottom: '25px'}}>Experience premium shopping tailored for you.</p>
            
            {loginStep === 'email' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ position: 'relative' }}>
                    <FiMail style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: THEME.colors.goldSolid }} />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@example.com"
                      style={{ width: '100%', padding: '14px 16px 14px 45px', background: 'rgba(0,0,0,0.4)', border: THEME.colors.glassBorder, borderRadius: '8px', color: '#E0E0E0' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleSendOtp(loginEmail, 'login')}
                  disabled={loading}
                  style={{ ...goldBtnStyle, width: '100%', boxShadow: THEME.shadows.glow }}
                >
                  {loading ? <FiLoader className="spin" /> : 'Continue with Email'}
                </button>
                <div style={{ margin: '20px 0', textAlign: 'center', color: THEME.colors.textMuted, fontSize: '0.8rem' }}>OR</div>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#fff', color: '#333', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  <FiUser /> Continue with Google
                </button>
                <p style={{ textAlign: 'center', marginTop: '20px', color: THEME.colors.textMuted, fontSize: '0.85rem' }}>
                  New here? <span onClick={() => { setOtpType('registration'); handleSendOtp(loginEmail, 'registration'); }} style={{ color: THEME.colors.goldSolid, cursor: 'pointer', fontWeight: '600' }}>Create an account</span>
                </p>
              </div>
            )}
            
            {loginStep === 'otp' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', ...silverTextStyle }}>{otpType === 'login' ? 'Sign In Verification' : 'Account Verification'}</h3>
                  <p style={{ color: THEME.colors.textMuted, fontSize: '0.9rem' }}>A 6-digit code was sent to</p>
                  <p style={{ color: THEME.colors.goldSolid, fontWeight: '700' }}>{loginEmail}</p>
                  {otpCountdown > 0 && (
                    <p style={{ color: THEME.colors.textMuted, fontSize: '0.8rem', marginTop: '5px' }}>
                      OTP expires in: {String(Math.floor(otpCountdown / 60)).padStart(2, '0')}:{String(otpCountdown % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  style={{ width: '100%', padding: '15px', background: 'rgba(0,0,0,0.4)', border: THEME.colors.glassBorder, borderRadius: '8px', color: '#E0E0E0', textAlign: 'center', letterSpacing: '10px', fontSize: '1.3rem', fontWeight: '700' }}
                />
                <button
                  onClick={() => handleVerifyOtp(loginEmail, loginOtp, otpType)}
                  disabled={loading || loginOtp.length !== 6}
                  style={{ ...goldBtnStyle, marginTop: '15px', cursor: loading || loginOtp.length !== 6 ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? <FiLoader className="spin" /> : 'Verify Code'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    onClick={handleResendOtp}
                    disabled={loading || otpCountdown > 0}
                    style={{ background: 'transparent', border: THEME.colors.glassBorder, color: otpCountdown > 0 ? THEME.colors.textMuted : THEME.colors.goldSolid, padding: '10px', borderRadius: '8px', cursor: loading || otpCountdown > 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                  >
                    {loading ? 'Sending...' : otpCountdown > 0 ? `Resend OTP (${String(Math.floor(otpCountdown / 60)).padStart(2, '0')}:${String(otpCountdown % 60).padStart(2, '0')})` : 'Resend OTP'}
                  </button>
                  <button
                    onClick={() => setLoginStep('email')}
                    style={{ background: 'transparent', border: THEME.colors.glassBorder, color: THEME.colors.goldSolid, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ← Back to Email
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- DASHBOARD UI --- */
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '70vh' }}>
            
            {/* SIDEBAR */}
            <div style={{ width: isMobile ? '100%' : '260px', borderRight: isMobile ? 'none' : THEME.colors.glassBorder, padding: '30px 20px', background: 'rgba(0,0,0,0.3)' }}>
               <div style={{textAlign: 'center', marginBottom: '30px'}}>
                   <div style={{ width: '100px', height: '100px', margin: '0 auto 15px', borderRadius: '50%', border: `2px solid ${THEME.colors.goldSolid}`, overflow:'hidden', position:'relative' }}>
                       {profileImageUrl ? (
                           <img src={profileImageUrl} alt="Profile" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                       ) : (
                           <div style={{width:'100%', height:'100%', background:'#333', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', fontWeight:'bold'}}>{user?.first_name?.charAt(0)}</div>
                       )}
                   </div>
                   <h3 style={{fontSize: '1.2rem', fontWeight:'700'}}>{displayName}</h3>
               </div>
               
               <div style={{display: isMobile ? 'flex' : 'block', overflowX: 'auto', gap: '5px'}}>
                   {[ {id:'profile', icon:FaUser, label:'Profile'}, {id:'orders', icon:FaShoppingBag, label:'Orders'}, {id:'wishlist', icon:FaHeart, label:'Wishlist'} ].map(tab => (
                       <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                           display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 15px', marginBottom: '8px',
                           background: activeTab === tab.id ? 'rgba(191, 149, 63, 0.15)' : 'transparent',
                           border: 'none', borderLeft: activeTab === tab.id && !isMobile ? `3px solid ${THEME.colors.goldSolid}` : '3px solid transparent',
                           color: activeTab === tab.id ? '#FBF5B7' : '#aaa', cursor: 'pointer', borderRadius: isMobile ? '8px' : '0 8px 8px 0', whiteSpace:'nowrap'
                       }}>
                           <tab.icon /> {tab.label}
                       </button>
                   ))}
               </div>
               
               {!isMobile && (
                   <button onClick={handleLogout} style={{ marginTop: '50px', width: '100%', padding: '12px', background: 'transparent', border: `1px solid rgba(255, 71, 87, 0.3)`, color: THEME.colors.danger, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                       <FaSignOutAlt /> Logout
                   </button>
               )}
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, padding: isMobile ? '20px' : '40px' }}>
                
                {/* PROFILE TAB */}
                {activeTab === 'profile' && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
                            <h2 style={{fontSize:'1.2rem', fontWeight:'700', ...silverTextStyle}}>Personal Information</h2>
                            <button onClick={()=>setIsEditing(!isEditing)} style={{background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', padding:'8px 15px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px'}}>
                                <FaEdit /> {isEditing ? 'Cancel' : 'Edit'}
                            </button>
                        </div>
                        
                        {/* Compact Profile Grid - Reusing your existing logic but styled */}
                        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'20px'}}>
                             {[
                                 {l: 'First Name', k: 'first_name'}, {l: 'Last Name', k: 'last_name'},
                                 {l: 'Phone', k: 'phone'}, {l: 'Email', val: user.email, readOnly: true},
                                 {l: 'Address', k: 'address', full: true}, {l: 'City', k: 'city'},
                                 {l: 'Zip Code', k: 'zip_code'}, {l: 'Country', k: 'country'}
                             ].map((field, i) => (
                                 <div key={i} style={{gridColumn: field.full && !isMobile ? 'span 2' : 'span 1'}}>
                                     <label style={labelStyle}>{field.l}</label>
                                     {isEditing && !field.readOnly ? (
                                         <input style={inputStyle} value={profileForm[field.k] || ''} onChange={e => setProfileForm({...profileForm, [field.k]: e.target.value})} />
                                     ) : (
                                         <div style={{padding:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', color: field.readOnly ? '#888' : '#fff'}}>{field.val || user[field.k] || 'N/A'}</div>
                                     )}
                                 </div>
                             ))}
                        </div>
                        {isEditing && (
                            <button onClick={handleUpdateProfile} style={{marginTop:'20px', ...goldBtnStyle, width:'auto'}}>Save Changes</button>
                        )}
                    </motion.div>
                )}

                {/* ORDERS TAB - UPDATED LIST DESIGN */}
                {activeTab === 'orders' && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <h2 style={{fontSize:'1.8rem', marginBottom:'25px', ...silverTextStyle}}>Order History</h2>
                        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            {orders.map(order => {
                                // Extract first valid image
                                const mainItem = (order.items && order.items.length > 0) ? order.items[0] : (order.product_details || {});
                                const rawImg = (mainItem && (mainItem.product_photos?.[0] || mainItem.image)) || '';
                                const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : absoluteUrl(rawImg)) : '';

                                return (
                                    <div key={order.order_id} onClick={() => setSelectedOrder(order)} style={{
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px',
                                        display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', cursor: 'pointer', transition: 'background 0.2s'
                                    }} className="order-card">
                                        
                                        {/* Image Thumbnail */}
                                        <div style={{
                                            width: isMobile ? '100%' : '80px', height: isMobile ? '150px' : '80px', borderRadius: '8px', overflow: 'hidden',
                                            background: '#222', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {imgUrl ? (
                                                <img src={imgUrl} alt="Product" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                            ) : (
                                                <FaShoppingBag color="#555" size={24} />
                                            )}
                                        </div>

                                        {/* Order Info */}
                                        <div style={{flex: 1}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                                                <h4 style={{fontSize: '1rem', fontWeight: '600', color: '#fff'}}>
                                                    {mainItem.product_name || `Order #${order.order_id.slice(-6)}`}
                                                    {order.items?.length > 1 && <span style={{fontSize:'0.8rem', color:'#888', fontWeight:'400'}}> +{order.items.length - 1} more</span>}
                                                </h4>
                                            </div>
                                            <p style={{color: '#888', fontSize: '0.85rem'}}>ID: {order.order_id}</p>
                                            <p style={{color: '#888', fontSize: '0.85rem'}}>{new Date(order.order_date).toLocaleDateString()}</p>
                                            <div style={{marginTop:'4px', fontSize:'1rem', fontWeight:'bold', color: THEME.colors.goldSolid}}>${order.total_amount}</div>
                                        </div>

                                        {/* Status & Price (Desktop) */}
                                        <div style={{textAlign: isMobile ? 'left' : 'right', minWidth: '120px', width: isMobile ? '100%' : 'auto', display: isMobile ? 'flex' : 'block', justifyContent:'space-between', alignItems:'center'}}>
                                            <span style={{
                                                padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                                                background: order.status === 'delivered' ? 'rgba(46, 213, 115, 0.2)' : 'rgba(191, 149, 63, 0.2)',
                                                color: order.status === 'delivered' ? THEME.colors.success : '#FBF5B7'
                                            }}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {orders.length === 0 && <p style={{textAlign:'center', color:'#666', marginTop:'40px'}}>No orders found.</p>}
                        </div>
                    </motion.div>
                )}

                {/* WISHLIST TAB */}
                {activeTab === 'wishlist' && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <h2 style={{fontSize:'1.8rem', marginBottom:'25px', ...silverTextStyle}}>My Wishlist</h2>
                        <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap:'20px'}}>
                            {wishlist.map(item => (
                                <div key={item._id} style={{background:'rgba(255,255,255,0.03)', borderRadius:'12px', overflow:'hidden', border: '1px solid rgba(255,255,255,0.05)'}}>
                                    <div style={{height:'180px', position:'relative'}}>
                                        <img src={item.image} alt={item.product_name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                        <button onClick={()=>removeFromWishlist(item._id)} style={{position:'absolute', top:'10px', right:'10px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                            <FaTrash size={12} />
                                        </button>
                                    </div>
                                    <div style={{padding:'12px'}}>
                                        <h4 style={{fontSize:'0.9rem', marginBottom:'5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.product_name}</h4>
                                        <div style={{color: THEME.colors.goldSolid, fontWeight:'bold'}}>${item.price}</div>
                                        <button onClick={()=>navigate(`/products/${item._id}`)} style={{marginTop:'10px', width:'100%', padding:'8px', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:'6px', cursor:'pointer', fontSize:'0.8rem'}}>View</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

            </div>
          </div>
        )}
      </motion.div>

      {/* --- ORDER DETAILS POPUP (MODAL) --- */}
      <AnimatePresence>
        {selectedOrder && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000000000,
                        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '20px'
                    }}
                    onClick={() => setSelectedOrder(null)}
                >
                    <motion.div
                    initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%', 
                        maxWidth: isMobile ? '100vw' : '80%', 
                        height: isMobile ? '100vh' : 'auto', 
                        maxHeight: isMobile ? '100vh' : '90vh',
                        background: '#0a0a0a', border: `1px solid ${THEME.colors.goldSolid}`, borderRadius: isMobile ? '0' : '16px',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 50px rgba(191, 149, 63, 0.15)'
                    }}
                >
                    {/* Modal Header */}
                    <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                            <h3 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', fontWeight: '700', color: '#fff' }}>Order Details</h3>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>#{selectedOrder.order_id}</p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: isMobile ? '32px' : '36px', height: isMobile ? '32px' : '36px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaTimes />
                        </button>
                    </div>

                    {/* Scrollable Content - Added custom-scrollbar class here */}
                    <div className="custom-scrollbar" style={{ overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 1fr) minmax(0, 2fr)' }}>
                        
                        {/* LEFT: STATUS TIMELINE */}
                        <div style={{ padding: isMobile ? '16px' : '30px', background: 'rgba(255,255,255,0.02)', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                            <h4 style={{...silverTextStyle, marginBottom:'25px'}}>Status Timeline</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '30px', position: 'relative' }}>
                                {/* Vertical Line */}
                                <div style={{position:'absolute', left:'19px', top:'10px', bottom:'10px', width:'2px', background:'rgba(255,255,255,0.12)', zIndex:0}}></div>
                                {(() => {
                                  const orderMap = ['placed', 'processing', 'shipped', 'delivered'];
                                  const idx = orderMap.indexOf(String(selectedOrder.status || '').toLowerCase());
                                  const stepH = isMobile ? 32 : 40;
                                  const gap = isMobile ? 14 : 20;
                                  const progressH = 10 + Math.max(0, (idx + 1)) * (stepH + gap);
                                  return (
                                    <div style={{
                                      position:'absolute', left:'18px', top:'10px',
                                      width:'4px', height: progressH,
                                      background: 'linear-gradient(180deg, #D4AF37 0%, #FBF5B7 100%)',
                                      borderRadius:'4px', boxShadow:'0 0 12px rgba(212,175,55,0.35)', zIndex:0.5
                                    }} />
                                  );
                                })()}
                                
                                {['placed', 'processing', 'shipped', 'delivered'].map((step, index) => {
                                    const statusOrder = ['placed', 'processing', 'shipped', 'delivered'];
                                    const currentStatusIndex = statusOrder.indexOf(selectedOrder.status.toLowerCase());
                                    const stepIndex = statusOrder.indexOf(step);
                                    const isCompleted = currentStatusIndex >= stepIndex;
                                    const isCurrent = currentStatusIndex === stepIndex;

                                    let Icon = FaBoxOpen;
                                    if(step === 'processing') Icon = FaBuilding;
                                    if(step === 'shipped') Icon = FaTruck;
                                    if(step === 'delivered') Icon = FaCheckCircle;

                                    return (
                                        <div key={step} style={{ display: 'flex', gap: isMobile ? '14px' : '20px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                            <div style={{
                                                width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '50%', 
                                                background: isCompleted ? THEME.colors.goldGradient : '#111',
                                                border: isCompleted ? 'none' : '1px solid #444',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: isCompleted ? '#000' : '#666',
                                                boxShadow: isCurrent ? '0 0 15px rgba(212, 175, 55, 0.5)' : 'none'
                                            }}>
                                                <Icon size={isMobile ? 14 : 16} />
                                            </div>
                                            <div>
                                                <div style={{ color: isCompleted ? '#fff' : '#666', fontWeight: isCompleted ? 'bold' : 'normal', textTransform: 'capitalize' }}>{step}</div>
                                                {isCurrent && <div style={{ fontSize: '0.75rem', color: THEME.colors.goldSolid }}>Current Status</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            
                            {String(selectedOrder.status || '').toLowerCase() === 'delivered' && primaryProductId && (
                              <div style={{ marginTop: '30px' }}>
                                <h4 style={{ ...silverTextStyle, marginBottom: '12px' }}>Write a Review</h4>
                                <form onSubmit={handleSubmitOrderReview} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <FiStar 
                                        key={star}
                                        size={18}
                                        style={{ cursor: 'pointer', stroke: star <= orderReview.rating ? 'none' : '#666', fill: star <= orderReview.rating ? '#FFD700' : 'none' }}
                                        onClick={() => setOrderReview(prev => ({ ...prev, rating: star }))}
                                      />
                                    ))}
                                  </div>
                                  <textarea 
                                    placeholder="Share your experience with this product..."
                                    value={orderReview.text}
                                    onChange={(e) => setOrderReview(prev => ({ ...prev, text: e.target.value }))}
                                    style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', minHeight: '70px', resize: 'vertical', fontSize: '14px' }}
                                    required
                                  />
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="file" accept="image/*,video/*" multiple ref={reviewFileInputRef} onChange={handleOrderReviewImageChange} style={{ display: 'none' }} />
                                    <button type="button" onClick={() => reviewFileInputRef.current?.click()} style={{ background: '#222', border: '1px dashed #555', color: '#ccc', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                      <FiCamera /> Add Photo
                                    </button>
                                    {orderReview.mediaFiles && orderReview.mediaFiles.length > 0 && (
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {orderReview.mediaFiles.map((f, idx) => (
                                          <div key={idx} style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid #333' }}>
                                            <img src={URL.createObjectURL(f)} alt="Profile image preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <button type="submit" disabled={isUploadingReview} style={{ alignSelf: isMobile ? 'stretch' : 'flex-start', padding: '10px 18px', background: THEME.colors.goldGradient, border: 'none', borderRadius: '6px', color: '#000', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiUpload /> {isUploadingReview ? 'Uploading...' : 'Submit Review'}
                                  </button>
                                </form>
                              </div>
                            )}
                        </div>

                        {/* RIGHT: DETAILS */}
                        <div style={{ padding: isMobile ? '16px' : '30px' }}>
                            
                            {/* Key Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: isMobile ? '12px' : '15px', marginBottom: isMobile ? '20px' : '30px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Date Placed</div>
                                    <div style={{ fontWeight: '600', marginTop: '5px' }}>{new Date(selectedOrder.order_date).toLocaleDateString()}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Total Amount</div>
                                    <div style={{ fontWeight: '600', marginTop: '5px', color: THEME.colors.goldSolid }}>${selectedOrder.total_amount}</div>
                                </div>
                            </div>

                            {/* Items List */}
                            <h4 style={{ color: '#fff', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><FaShoppingBag color={THEME.colors.goldSolid} size={14} /> Ordered Items</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                                {(selectedOrderItems && selectedOrderItems.length > 0 ? selectedOrderItems : ((selectedOrder.items && selectedOrder.items.length > 0 ? selectedOrder.items : [selectedOrder.product_details || {}]).map(it => ({...it, _displayImage: (it.product_photos?.[0] || it.image || '')})))).map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '15px', background: 'rgba(255,255,255,0.03)', padding: isMobile ? '10px' : '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: isMobile ? '44px' : '50px', height: isMobile ? '44px' : '50px', background: '#222', borderRadius: '6px', overflow: 'hidden' }}>
                                            {item._displayImage ? <img src={item._displayImage.startsWith('http') ? item._displayImage : absoluteUrl(item._displayImage)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: isMobile ? '0.88rem' : '0.9rem', fontWeight: '600', wordBreak: 'break-word' }}>{item.product_name || item.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>Qty: {item.quantity || 1}</div>
                                        </div>
                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>${item.price}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Shipping Address */}
                            <h4 style={{ color: '#fff', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><FaMapMarkerAlt color={THEME.colors.goldSolid} size={14} /> Shipping Details</h4>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem', color: '#ccc', lineHeight: '1.6' }}>
                                {shippingInfo.available ? (
                                    <>
                                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{shippingInfo.name}</div>
                                        <div>{[shippingInfo.line1, shippingInfo.cityLine].filter(Boolean).join(', ')}</div>
                                        <div>{shippingInfo.country}</div>
                                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px', color: THEME.colors.goldSolid, flexWrap: 'wrap' }}>
                                            {shippingInfo.phone && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FaPhone size={12} /> {shippingInfo.phone}
                                                </span>
                                            )}
                                            {shippingInfo.email && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FaEnvelope size={12} /> {shippingInfo.email}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ fontStyle: 'italic', color: '#666' }}>Shipping details not available</div>
                                )}
                            </div>

                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {showLogoutConfirm && (
           <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000}}>
               <div style={{background:'#111', border:`1px solid ${THEME.colors.goldSolid}`, padding:'30px', borderRadius:'16px', textAlign:'center'}}>
                   <h3 style={{color:'#fff', marginBottom:'15px'}}>Log Out?</h3>
                   <div style={{display:'flex', gap:'10px'}}>
                       <button onClick={()=>setShowLogoutConfirm(false)} style={{padding:'10px 20px', background:'transparent', border:'1px solid #444', color:'#fff', borderRadius:'8px', cursor:'pointer'}}>Cancel</button>
                       <button onClick={confirmLogout} style={{padding:'10px 20px', background:THEME.colors.goldGradient, border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>Log Out</button>
                   </div>
               </div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
         {showIncompleteFieldsPopup && (
             <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed', bottom:'20px', right:'20px', background:'#222', borderLeft:`4px solid ${THEME.colors.goldSolid}`, padding:'20px', borderRadius:'8px', zIndex:2000, maxWidth:'300px', boxShadow:'0 5px 20px rgba(0,0,0,0.5)'}}>
                 <h4 style={{color:'#fff', marginBottom:'5px', display:'flex', alignItems:'center', gap:'10px'}}><FaExclamationTriangle color={THEME.colors.goldSolid}/> Profile Incomplete</h4>
                 <p style={{fontSize:'0.85rem', color:'#aaa', marginBottom:'15px'}}>Please complete your shipping information.</p>
                 <button onClick={()=>{setShowIncompleteFieldsPopup(false); setActiveTab('profile'); setIsEditing(true);}} style={{background:THEME.colors.goldGradient, border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>Update Now</button>
                 <button onClick={()=>setShowIncompleteFieldsPopup(false)} style={{marginLeft:'10px', background:'transparent', border:'none', color:'#aaa', cursor:'pointer', fontSize:'0.8rem'}}>Later</button>
             </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
};

export default UserProfile;
