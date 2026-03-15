import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../pages/context/CartContext';
import { useLocale } from '../pages/context/LocaleContext'; // Added for currency conversion
import { 
  FiMessageSquare, 
  FiShoppingCart, 
  FiUser, 
  FiMail, 
  FiSearch, 
  FiX, 
  FiSend, 
  FiChevronLeft, 
  FiChevronRight, 
  FiInfo, 
  FiLoader, 
  FiRefreshCw, 
  FiImage, 
  FiExternalLink, 
  FiFile, 
  FiPaperclip 
} from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';
import { SOCKET_BASE, apiFetch } from '../utils/api';

import { signInWithPopup, signOut, auth, googleProvider, waitForAuthInit } from '../firebase';

// --- THEME CONFIGURATION ---
const theme = {
  colors: {
    bg: '#050505',
    glassBg: 'rgba(20, 20, 20, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    gold: '#D4AF37', // Fallback solid gold
    textMain: '#FFFFFF',
    textSec: '#B0B0B0',
    accent: '#E74C3C',
    green: '#2ECC71',
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
    glow: '0 0 15px rgba(212, 175, 55, 0.2)',
  }
};

// Helper Styles for Gradients
const goldTextStyle = {
  background: theme.colors.goldGradient,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block'
};

const silverTextStyle = {
  background: theme.colors.silverGradient,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block'
};

const glassContainerStyle = {
  background: theme.colors.glassBg,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: theme.colors.glassBorder,
  boxShadow: theme.shadows.card,
};

// Socket.IO client
const socket = io(SOCKET_BASE, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// File icon mapping
const FILE_ICONS = {
  'image/jpeg': FiImage, 'image/jpg': FiImage, 'image/png': FiImage, 'image/webp': FiImage, 'image/gif': FiImage,
  'application/pdf': FiFile, 'text/plain': FiFile, 'application/msword': FiFile,
  'application/zip': FiFile, 'application/vnd.rar': FiFile
};

// Mobile Detection Hook
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
};

// Safe JSON parser
const safeJsonParse = (str, fallback = null) => {
  if (!str) return fallback;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } 
  catch (error) { return fallback; }
};

// --- COMPONENTS ---

// Login Form
const LoginForm = ({ onClose, onSuccess, isMobile }) => {
  const [loginStep, setLoginStep] = useState('email');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpType, setOtpType] = useState('login');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        await handleFirebaseLogin(user);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let t;
    if (otpCountdown > 0) t = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const handleFirebaseLogin = async (fbUser) => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/user/auth/firebase-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            emailVerified: fbUser.emailVerified
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('userToken', data.token);
        onSuccess(data.user);
        toast.success('Login successful!');
        onClose();
      } else {
        await signOut(auth);
        toast.error(data.message || 'Authentication failed. Please try again.');
      }
    } catch (error) {
      await signOut(auth);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
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
        onSuccess(data.user);
        setLoginStep('email');
        setLoginEmail('');
        setLoginOtp('');
        setOtpCountdown(0);
        toast.success('Login Successful!');
        onClose();
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        ...glassContainerStyle,
        borderRadius: '24px',
        padding: isMobile ? '25px' : '40px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}
    >
      <h2 style={{ ...goldTextStyle, fontSize: '2rem', marginBottom: '10px', fontWeight: '800' }}>
        {loginStep === 'email' ? 'Welcome Back' : loginStep === 'otp' ? 'Verification' : 'Join Us'}
      </h2>
      <p style={{ ...silverTextStyle, fontSize: '0.9rem', marginBottom: '30px' }}>Experience premium shopping tailored for you.</p>

      {loginStep === 'email' && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <FiMail style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.gold }} />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ width: '100%', padding: '14px 16px 14px 45px', background: 'rgba(0,0,0,0.4)', border: theme.colors.glassBorder, borderRadius: '8px', color: '#E0E0E0' }}
              />
            </div>
          </div>
          <button
            onClick={() => handleSendOtp(loginEmail, 'login')}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: theme.colors.goldGradient, color: '#000', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: theme.shadows.glow
            }}
          >
            {loading ? <FiLoader className="spin" /> : 'Continue with Email'}
          </button>
          <div style={{ margin: '20px 0', textAlign: 'center', color: theme.colors.textSec, fontSize: '0.8rem' }}>OR</div>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#fff', color: '#333', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <FiUser /> Continue with Google
          </button>
          <p style={{ textAlign: 'center', marginTop: '20px', color: theme.colors.textSec, fontSize: '0.85rem' }}>
            New here? <span onClick={() => { setOtpType('registration'); handleSendOtp(loginEmail, 'registration'); }} style={{ color: theme.colors.gold, cursor: 'pointer', fontWeight: '600' }}>Create an account</span>
          </p>
        </motion.div>
      )}

      {loginStep === 'otp' && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', ...silverTextStyle }}>{otpType === 'login' ? 'Sign In Verification' : 'Account Verification'}</h3>
            <p style={{ color: theme.colors.textSec, fontSize: '0.9rem' }}>A 6-digit code was sent to</p>
            <p style={{ color: theme.colors.gold, fontWeight: '700' }}>{loginEmail}</p>
            {otpCountdown > 0 && (
              <p style={{ color: theme.colors.accent, fontSize: '0.8rem', marginTop: '5px' }}>
                OTP expires in: {String(Math.floor(otpCountdown / 60)).padStart(2, '0')}:{String(otpCountdown % 60).padStart(2, '0')}
              </p>
            )}
          </div>
          <input
            type="text"
            value={loginOtp}
            onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            style={{ width: '100%', padding: '15px', background: 'rgba(0,0,0,0.4)', border: theme.colors.glassBorder, borderRadius: '8px', color: '#E0E0E0', textAlign: 'center', letterSpacing: '10px', fontSize: '1.3rem', fontWeight: '700' }}
          />
          <button
            onClick={() => handleVerifyOtp(loginEmail, loginOtp, otpType)}
            disabled={loading || loginOtp.length !== 6}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: theme.colors.goldGradient, color: '#000', fontWeight: '700', fontSize: '1rem', cursor: loading || loginOtp.length !== 6 ? 'not-allowed' : 'pointer', marginTop: '15px' }}
          >
            {loading ? <FiLoader className="spin" /> : 'Verify Code'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              onClick={handleResendOtp}
              disabled={loading || otpCountdown > 0}
              style={{ background: 'transparent', border: theme.colors.glassBorder, color: otpCountdown > 0 ? theme.colors.textSec : theme.colors.gold, padding: '10px', borderRadius: '8px', cursor: loading || otpCountdown > 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
            >
              {loading ? 'Sending...' : otpCountdown > 0 ? `Resend OTP (${String(Math.floor(otpCountdown / 60)).padStart(2, '0')}:${String(otpCountdown % 60).padStart(2, '0')})` : 'Resend OTP'}
            </button>
            <button
              onClick={() => setLoginStep('email')}
              style={{ background: 'transparent', border: theme.colors.glassBorder, color: theme.colors.gold, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ← Back to Email
            </button>
          </div>
        </motion.div>
      )}

      <button 
        onClick={onClose}
        style={{ marginTop: '20px', background: 'transparent', border: 'none', color: theme.colors.textSec, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </motion.div>
  );
};

// Chat List Item
const ChatListItem = ({ inquiry, isSelected, unreadCount, onSelect, hasNewMessage, hasAdminReply }) => {
  const productData = safeJsonParse(inquiry.product_data);
  const productName = productData?.product_name || 'Product Inquiry';
  const lastMessage = inquiry.messages?.[inquiry.messages.length - 1];

  return (
    <motion.div
      layout
      onClick={() => onSelect(inquiry)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        cursor: 'pointer',
        borderBottom: theme.colors.glassBorder,
        background: isSelected 
          ? 'linear-gradient(90deg, rgba(212, 175, 55, 0.15), transparent)' 
          : 'transparent',
        borderLeft: isSelected 
          ? `3px solid ${theme.colors.gold}` 
          : '3px solid transparent',
        transition: 'all 0.3s ease'
      }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      {/* Product Thumb */}
      <div style={{
        width: '48px', height: '48px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.3)',
        border: theme.colors.glassBorder,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: '15px', overflow: 'hidden'
      }}>
        {productData?.product_photos?.[0] ? (
          <img src={productData.product_photos[0]} alt={productData.product_name || "Product"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : <FiShoppingCart color={theme.colors.gold} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ ...silverTextStyle, fontWeight: '600', fontSize: '0.95rem' }}>
            {productName.substring(0, 20)}{productName.length > 20 ? '...' : ''}
          </span>
          {unreadCount > 0 && (
            <span style={{ background: theme.colors.goldGradient, color: '#000', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: hasAdminReply ? theme.colors.green : theme.colors.textSec, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {hasAdminReply && <FiMessageSquare size={10} />}
            {lastMessage ? (lastMessage.message.substring(0, 25) + (lastMessage.message.length > 25 ? '...' : '')) : 'No messages'}
          </span>
          <span style={{ color: theme.colors.textSec, fontSize: '0.7rem' }}>
            {new Date(inquiry.last_activity).toLocaleDateString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Product Gallery
const ProductGallery = ({ product }) => {
  const safeProduct = { product_photos: [], ...product };
  const photos = Array.isArray(safeProduct.product_photos) ? safeProduct.product_photos : [];

  if (photos.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: theme.colors.textSec }}><FiImage /></div>;

  return (
    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: theme.colors.glassBorder }}>
      <img src={photos[0]} alt="Product photo" style={{ width: '50%', height: 'auto', display: 'block' }} />
    </div>
  );
};

// File Preview
const FilePreview = ({ files, onRemove }) => (
  <div style={{ display: 'flex', gap: '10px', padding: '10px', flexWrap: 'wrap' }}>
    {files.map((file, index) => (
      <div key={index} style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff' }}>
        <FiFile /> {file.name.substring(0, 10)}...
        <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', color: theme.colors.accent, cursor: 'pointer' }}><FiX /></button>
      </div>
    ))}
  </div>
);

// --- MAIN PAGE COMPONENT ---
const MessagesPage = () => {
  const { format } = useLocale(); // Use locale context for currency formatting
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  
  // Auth
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isMobile = useIsMobile();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- EFFECTS & LOGIC ---
  
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setIsInitializing(true);
      const fbUser = await waitForAuthInit();
      const token = localStorage.getItem('userToken');
      if (token) {
        try {
          const response = await apiFetch('/api/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setUser(data.user);
              setIsLoggedIn(true);
              fetchUserInquiries(token);
            } else if (fbUser) {
              // silently reissue token via firebase
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
                setUser(d.user);
                setIsLoggedIn(true);
                fetchUserInquiries(d.token);
                setShowLoginPopup(false);
              } else {
                setShowLoginPopup(true);
              }
            } else { setShowLoginPopup(true); }
          } else if (fbUser) {
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
              setUser(d.user);
              setIsLoggedIn(true);
              fetchUserInquiries(d.token);
              setShowLoginPopup(false);
            } else { setShowLoginPopup(true); }
          } else { setShowLoginPopup(true); }
        } catch (error) {
          if (fbUser) {
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
              setUser(d.user);
              setIsLoggedIn(true);
              fetchUserInquiries(d.token);
              setShowLoginPopup(false);
            } else { setShowLoginPopup(true); }
          } else {
            setShowLoginPopup(true);
          }
        }
      } else if (fbUser) {
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
          setUser(d.user);
          setIsLoggedIn(true);
          fetchUserInquiries(d.token);
          setShowLoginPopup(false);
        } else { setShowLoginPopup(true); }
      } else {
        setShowLoginPopup(true);
      }
      if (mounted) setIsInitializing(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Simplified fetch for display
  const fetchUserInquiries = async (token) => {
    setIsLoading(true);
    try {
        // Mocking user ID logic for snippet
        const userId = JSON.parse(atob(token.split('.')[1])).userId;
        const response = await apiFetch('/api/inquiries/user/' + userId, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if(data.success) setInquiries(data.inquiries);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    socket.connect();
    return () => { socket.disconnect(); };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!selectedInquiry || !socket.connected) return;
    socket.emit('join_inquiry', selectedInquiry.id);
    const onNewMessage = (message) => {
      if (message.inquiryId !== selectedInquiry.id) return;
      setSelectedInquiry(prev => {
        const existing = prev?.messages || [];
        const exists = existing.some(m => m.id === message.id || (m.temporaryId && m.temporaryId === message.temporaryId));
        if (exists) return prev;
        return { ...prev, messages: [...existing, message] };
      });
    };
    const onMessageSent = (data) => {
      if (!data?.message || data.message.inquiryId !== selectedInquiry.id) return;
      setSelectedInquiry(prev => {
        const existing = prev?.messages || [];
        const updated = existing.map(m => (m.temporaryId && m.temporaryId === data.temporaryId) ? data.message : m);
        const hadTemp = existing.some(m => m.temporaryId && m.temporaryId === data.temporaryId);
        return { ...prev, messages: hadTemp ? updated : [...existing, data.message] };
      });
    };
    socket.on('new_message', onNewMessage);
    socket.on('message_sent', onMessageSent);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_sent', onMessageSent);
    };
  }, [selectedInquiry]);

  // Handle Send
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachedFiles.length === 0) || !selectedInquiry) return;
    setIsSending(true);
    const temporaryId = `user-temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempMsg = { id: temporaryId, temporaryId, inquiryId: selectedInquiry.id, message: newMessage.trim(), sender_type: 'user', files: [], timestamp: new Date().toISOString(), is_read: false };
    setSelectedInquiry(prev => ({ ...prev, messages: [...(prev.messages || []), tempMsg] }));
    try {
      socket.emit('send_message', { inquiryId: selectedInquiry.id, message: newMessage.trim(), senderType: 'user', files: [], temporaryId });
      setNewMessage('');
    } catch (e) {
      setSelectedInquiry(prev => ({ ...prev, messages: (prev.messages || []).filter(m => m.temporaryId !== temporaryId) }));
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Filter Logic
  const filteredInquiries = inquiries.filter(inq => {
      const prodName = safeJsonParse(inq.product_data)?.product_name || '';
      return prodName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // --- RENDER ---

  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
        <FiLoader className="spin" size={40} color={theme.colors.gold} style={{ marginBottom: '20px' }} />
        <h2 style={{ ...silverTextStyle, fontSize: '1.2rem', margin: 0 }}>Loading Messages...</h2>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', height: '100vh', 
      background: theme.colors.bg, 
      backgroundImage: `radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 80%)`,
      color: theme.colors.textMain, 
      display: 'flex', 
      fontFamily: "'Poppins', sans-serif",
      overflow: 'hidden'
    }}>
      <ToastContainer theme="dark" />

      {/* Login Popup */}
      <AnimatePresence>
        {showLoginPopup && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoginForm 
              onClose={() => setShowLoginPopup(false)} 
              isMobile={isMobile} 
              onSuccess={(u)=>{
                setUser(u); 
                setIsLoggedIn(true); 
                const token = localStorage.getItem('userToken');
                if (token) { fetchUserInquiries(token); }
                setShowLoginPopup(false);
              }} 
            />
          </div>
        )}
      </AnimatePresence>

      {/* --- SIDEBAR (INQUIRY LIST) --- */}
      <motion.div 
        style={{
          width: isMobile ? '100%' : '380px',
          height: '100%',
          display: isMobile && selectedInquiry ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: theme.colors.glassBorder,
          background: 'rgba(0,0,0,0.2)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '25px', borderBottom: theme.colors.glassBorder }}>
          <h1 style={{ ...goldTextStyle, fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Messages</h1>
          <p style={{ ...silverTextStyle, fontSize: '0.85rem', marginTop: '5px' }}>Manage your inquiries & support</p>
        </div>

        {/* Search & Filter */}
        <div style={{ padding: '15px 25px', display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <FiSearch style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.gold }} />
            <input 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 15px 12px 40px',
                borderRadius: '50px',
                border: theme.colors.glassBorder,
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
          </div>
          <button style={{ background: theme.colors.glassBg, border: theme.colors.glassBorder, borderRadius: '50%', width: '45px', color: theme.colors.gold, cursor: 'pointer' }}>
            <FiRefreshCw />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredInquiries.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.textSec }}>
              <FiMessageSquare size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p>No messages found</p>
            </div>
          ) : (
            filteredInquiries.map(inq => (
              <ChatListItem 
                key={inq.id} 
                inquiry={inq} 
                isSelected={selectedInquiry?.id === inq.id}
                onSelect={setSelectedInquiry}
                unreadCount={inq.unread_count || 0}
              />
            ))
          )}
        </div>
      </motion.div>

      {/* --- CHAT AREA --- */}
      <motion.div style={{
        flex: 1,
        display: isMobile && !selectedInquiry ? 'none' : 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(0,0,0,0.4)'
      }}>
        {selectedInquiry ? (
          <>
            {/* Chat Header */}
            <div style={{ 
              padding: '15px 25px', 
              borderBottom: theme.colors.glassBorder, 
              background: 'rgba(255,255,255,0.02)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {isMobile && <button onClick={()=>setSelectedInquiry(null)} style={{ background: 'none', border: 'none', color: '#fff' }}><FiChevronLeft size={24}/></button>}
                <div>
                  <h3 style={{ ...goldTextStyle, margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                    {safeJsonParse(selectedInquiry.product_data)?.product_name || 'Inquiry'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.75rem', color: theme.colors.textSec }}>#{selectedInquiry.inquiry_number}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowDetails(!showDetails)}
                style={{ 
                  background: showDetails ? theme.colors.goldGradient : 'rgba(255,255,255,0.1)', 
                  border: 'none', borderRadius: '50%', width: '40px', height: '40px', 
                  color: showDetails ? '#000' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}
              >
                <FiInfo size={18} />
              </button>
            </div>

            {/* Messages Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {selectedInquiry.messages?.map((msg, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ 
                        alignSelf: msg.sender_type === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '75%'
                      }}
                    >
                      <div style={{ 
                        padding: '12px 18px', 
                        borderRadius: '18px',
                        background: msg.sender_type === 'user' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.1)',
                        border: msg.sender_type === 'user' ? `1px solid ${theme.colors.gold}40` : theme.colors.glassBorder,
                        color: theme.colors.textMain,
                        borderBottomRightRadius: msg.sender_type === 'user' ? '4px' : '18px',
                        borderBottomLeftRadius: msg.sender_type === 'admin' ? '4px' : '18px',
                      }}>
                        <p style={{ margin: 0, lineHeight: 1.5, ...silverTextStyle }}>{msg.message}</p>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'block', textAlign: msg.sender_type === 'user' ? 'right' : 'left' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderTop: theme.colors.glassBorder }}>
                  {attachedFiles.length > 0 && <FilePreview files={attachedFiles} onRemove={(i)=>setAttachedFiles(prev=>prev.filter((_,x)=>x!==i))} />}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <button onClick={()=>fileInputRef.current.click()} style={{ padding: '12px', borderRadius: '50%', border: theme.colors.glassBorder, background: 'transparent', color: theme.colors.gold, cursor: 'pointer' }}>
                      <FiPaperclip size={20} />
                    </button>
                    <textarea 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      style={{ 
                        flex: 1, 
                        background: 'rgba(255,255,255,0.05)', 
                        border: theme.colors.glassBorder, 
                        borderRadius: '25px', 
                        padding: '12px 20px', 
                        color: '#fff', 
                        outline: 'none', 
                        resize: 'none', 
                        height: '46px',
                        ...silverTextStyle // Applying silver text to input
                      }}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isSending}
                      style={{ 
                        padding: '12px', 
                        borderRadius: '50%', 
                        border: 'none', 
                        background: theme.colors.goldGradient, 
                        color: '#000', 
                        cursor: 'pointer',
                        boxShadow: theme.shadows.glow 
                      }}
                    >
                      {isSending ? <FiLoader className="spin" /> : <FiSend size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details Sidebar */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: isMobile ? '100%' : '320px', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    style={{ 
                      borderLeft: theme.colors.glassBorder, 
                      background: 'rgba(0,0,0,0.2)', 
                      overflowY: 'auto',
                      height:'max-content',
                      position: isMobile ? 'absolute' : 'relative',
                      right: 0, top: 0, bottom: 0, zIndex: 10
                    }}
                  >
                    <div style={{ padding: '25px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ ...goldTextStyle, margin: 0, fontSize: '1.2rem' }}>Details</h3>
                        {isMobile && <button onClick={()=>setShowDetails(false)} style={{background:'none', border:'none', color:'#fff'}}><FiX/></button>}
                      </div>

                      {/* Product Card */}
                      <div style={{ ...glassContainerStyle, padding: '15px', borderRadius: '16px', marginBottom: '20px' }}>
                        <h4 style={{ color: theme.colors.textSec, fontSize: '0.8rem', marginBottom: '10px', textTransform: 'uppercase' }}>Product</h4>
                        <ProductGallery product={safeJsonParse(selectedInquiry.product_data)} />
                        <h3 style={{ ...silverTextStyle, fontSize: '1rem', marginTop: '10px', fontWeight: '600' }}>
                          {safeJsonParse(selectedInquiry.product_data)?.product_name}
                        </h3>
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ ...goldTextStyle, fontWeight: '700', fontSize: '1.1rem' }}>
                            {format(safeJsonParse(selectedInquiry.product_data)?.price || 0)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: theme.colors.textSec }}>
                            Qty: {safeJsonParse(selectedInquiry.product_data)?.quantity || 1}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button style={{ 
                          width: '100%', padding: '12px', borderRadius: '12px', border: 'none', 
                          background: theme.colors.goldGradient, color: '#000', fontWeight: 'bold', cursor: 'pointer' 
                        }}>
                          Proceed to Checkout
                        </button>
                        <button style={{ 
                          width: '100%', padding: '12px', borderRadius: '12px', 
                          border: `1px solid ${theme.colors.gold}`, background: 'transparent', color: theme.colors.gold, fontWeight: 'bold', cursor: 'pointer' 
                        }}>
                          View Product Page
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: theme.colors.textSec }}>
            <FiMessageSquare size={60} style={{ opacity: 0.2, marginBottom: '20px' }} />
            <h2 style={{ ...silverTextStyle, fontSize: '1.5rem', margin: 0 }}>Select a conversation</h2>
            <p>Choose an inquiry from the sidebar to start chatting</p>
          </div>
        )}
      </motion.div>

      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} style={{display:'none'}} multiple onChange={(e)=>setAttachedFiles([...e.target.files])} />
      
      {/* Global Styles for Animations */}
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.3); borderRadius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.6); }
      `}</style>
    </div>
  );
};

export default MessagesPage;
