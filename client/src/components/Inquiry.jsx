import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSend, FiPaperclip, FiShoppingCart, FiX, FiMessageSquare, 
  FiClock, FiUser, FiMail, FiPhone, FiMapPin, FiEdit, FiCheck, 
  FiImage, FiChevronLeft, FiChevronRight, FiCheckCircle, 
  FiAlertCircle, FiLoader, FiExternalLink, FiDownload,
  FiFile, FiRefreshCw, FiSearch, FiShoppingBag
} from 'react-icons/fi';
import { useCart } from '../pages/context/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import { SOCKET_BASE, apiFetch, absoluteUrl } from '../utils/api';
import { useLocale } from '../pages/context/LocaleContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { signInWithPopup, signOut, auth, googleProvider, waitForAuthInit } from '../firebase';

// Initialize Socket.IO client
const socket = io(SOCKET_BASE, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// --- PREMIUM THEME CONFIGURATION ---
const theme = {
  colors: {
    bg: '#050505',
    glassBg: 'rgba(20, 20, 20, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    silverGradient: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
    goldGradient: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    gold: '#D4AF37',
    textMain: '#FFFFFF',
    textSec: '#B0B0B0',
    accent: '#E74C3C',
    green: '#2ECC71',
    inputBg: 'rgba(0, 0, 0, 0.3)'
  },
  shadows: {
    card: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    glow: '0 0 15px rgba(212, 175, 55, 0.3)',
  },
  textStyles: {
    silverTitle: {
      background: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 'bold',
      display: 'inline-block'
    },
    goldTitle: {
      background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 'bold',
      display: 'inline-block'
    }
  }
};

// Helper styles for gradients (adapted from MessagesPage)
const goldTextStyle = {
  background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block'
};

const silverTextStyle = {
  background: 'linear-gradient(to right, #E0E0E0 0%, #FFFFFF 50%, #A0A0A0 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block'
};

const glassContainerStyle = {
  background: 'rgba(20, 20, 20, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: 'rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
};

// File icon mapping
const FILE_ICONS = {
  'image/jpeg': FiImage,
  'image/jpg': FiImage,
  'image/png': FiImage,
  'image/webp': FiImage,
  'image/gif': FiImage,
  'application/pdf': FiFile,
  'text/plain': FiFile,
  'application/msword': FiFile,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FiFile,
  'application/vnd.ms-excel': FiFile,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FiFile,
  'application/zip': FiFile,
  'application/vnd.rar': FiFile
};

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", 
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", 
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", 
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", 
  "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", 
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", 
  "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", 
  "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", 
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", 
  "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea North", "Korea South", "Kosovo", "Kuwait", "Kyrgyzstan", 
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", 
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", 
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", 
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", 
  "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", 
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", 
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", 
  "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", 
  "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", 
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", 
  "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", 
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// --- Login form section (adapted from MessagesPage) ---
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

// Profile completion form (inspired by MessagesPage)
const ProfileCompletionForm = ({ user, onComplete, onSkip, isMobile }) => {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    country: user?.country || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.country) newErrors.country = 'Country is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const response = await apiFetch('/api/user/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Profile updated successfully!');
        onComplete({ ...user, ...formData });
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        ...glassContainerStyle,
        borderRadius: '24px',
        padding: isMobile ? '25px' : '40px',
        maxWidth: '500px',
        width: '100%'
      }}
    >
      <h2 style={{ ...goldTextStyle, fontSize: '1.8rem', marginBottom: '10px', textAlign: 'center' }}>
        Complete Your Profile
      </h2>
      <p style={{ ...silverTextStyle, fontSize: '0.9rem', marginBottom: '30px', textAlign: 'center' }}>
        Please provide your details to continue
      </p>

      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: theme.colors.textSec, marginBottom: '8px', fontSize: '0.9rem' }}>
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              style={{
                width: '100%',
                padding: '12px 15px',
                background: 'rgba(0,0,0,0.4)',
                border: errors.first_name ? `1px solid ${theme.colors.accent}` : theme.colors.glassBorder,
                borderRadius: '8px',
                color: '#E0E0E0'
              }}
              placeholder="John"
            />
            {errors.first_name && <p style={{ color: theme.colors.accent, fontSize: '0.8rem', marginTop: '5px' }}>{errors.first_name}</p>}
          </div>

          <div>
            <label style={{ display: 'block', color: theme.colors.textSec, marginBottom: '8px', fontSize: '0.9rem' }}>
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              style={{
                width: '100%',
                padding: '12px 15px',
                background: 'rgba(0,0,0,0.4)',
                border: errors.last_name ? `1px solid ${theme.colors.accent}` : theme.colors.glassBorder,
                borderRadius: '8px',
                color: '#E0E0E0'
              }}
              placeholder="Doe"
            />
            {errors.last_name && <p style={{ color: theme.colors.accent, fontSize: '0.8rem', marginTop: '5px' }}>{errors.last_name}</p>}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', color: theme.colors.textSec, marginBottom: '8px', fontSize: '0.9rem' }}>
            Phone Number *
          </label>
          <div style={{ position: 'relative' }}>
            <FiPhone style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.gold }} />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              style={{
                width: '100%',
                padding: '12px 15px 12px 45px',
                background: 'rgba(0,0,0,0.4)',
                border: errors.phone ? `1px solid ${theme.colors.accent}` : theme.colors.glassBorder,
                borderRadius: '8px',
                color: '#E0E0E0'
              }}
              placeholder="+1 234 567 8900"
            />
          </div>
          {errors.phone && <p style={{ color: theme.colors.accent, fontSize: '0.8rem', marginTop: '5px' }}>{errors.phone}</p>}
        </div>

        <div>
          <label style={{ display: 'block', color: theme.colors.textSec, marginBottom: '8px', fontSize: '0.9rem' }}>
            Country *
          </label>
          <div style={{ position: 'relative' }}>
            <FiMapPin style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.gold }} />
            <select
              value={formData.country}
              onChange={(e) => setFormData({...formData, country: e.target.value})}
              style={{
                width: '100%',
                padding: '12px 15px 12px 45px',
                background: 'rgba(0,0,0,0.4)',
                border: errors.country ? `1px solid ${theme.colors.accent}` : theme.colors.glassBorder,
                borderRadius: '8px',
                color: '#E0E0E0',
                appearance: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Select a country</option>
              {countries.map((country) => (
                <option key={country} value={country} style={{ background: '#1a1a1a', color: '#fff' }}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          {errors.country && <p style={{ color: theme.colors.accent, fontSize: '0.8rem', marginTop: '5px' }}>{errors.country}</p>}
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              background: theme.colors.goldGradient,
              color: '#000',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: theme.shadows.glow
            }}
          >
            {loading ? <FiLoader className="spin" /> : 'Complete Profile'}
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: '14px 20px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.glassBorder}`,
              background: 'transparent',
              color: theme.colors.textSec,
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Auto-expanding TextArea Component
const AutoExpandingTextarea = ({ value, onChange, placeholder, disabled, onSend }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend) {
        onSend();
      }
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyPress={handleKeyPress}
      style={{
        width: '100%',
        padding: '12px 15px',
        background: theme.colors.inputBg,
        border: `1px solid ${theme.colors.glassBorder}`,
        borderRadius: '25px',
        color: '#fff',
        fontSize: '15px',
        overflow: 'hidden',
        outline: 'none',
        resize: 'none',
        minHeight: '20px',
        maxHeight: '120px',
        fontFamily: 'inherit',
        lineHeight: '1.4',
        transition: 'all 0.3s ease'
      }}
      rows={1}
      onFocus={(e) => e.target.style.borderColor = theme.colors.gold}
      onBlur={(e) => e.target.style.borderColor = theme.colors.glassBorder}
    />
  );
};

// Optimized File Preview Component
const FilePreview = ({ file, onRemove, isUploaded = false }) => {
  const FileIcon = FILE_ICONS[file.type] || FiFile;
   
  // Memoize the object URL creation to prevent flickering/re-creation on render
  const previewUrl = useMemo(() => {
    if (file.type && file.type.startsWith('image/') && !isUploaded) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file, isUploaded]);

  const handleDownload = () => {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '20px',
      fontSize: '12px',
      border: `1px solid ${theme.colors.glassBorder}`,
      maxWidth: '200px'
    }}>
      {previewUrl ? (
        <img 
          src={previewUrl} 
          alt="Preview" 
          style={{
            width: '24px',
            height: '24px',
            objectFit: 'cover',
            borderRadius: '4px'
          }}
        />
      ) : (
        <FileIcon size={14} color={theme.colors.gold} />
      )}
       
      <span style={{ 
        maxWidth: '120px', 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: theme.colors.textSec
      }}>
        {file.name}
      </span>
       
      {isUploaded ? (
        <button 
          onClick={handleDownload}
          style={{
            background: 'none',
            border: 'none',
            color: '#3498db',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Download file"
        >
          <FiDownload size={12} />
        </button>
      ) : (
        <button 
          onClick={() => onRemove(file)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff6b6b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Remove file"
        >
          <FiX size={12} />
        </button>
      )}
    </div>
  );
};

// File Message Component
const FileMessage = ({ files, sender }) => {
  return (
    <div style={{ marginTop: '8px' }}>
      {files.map((file, index) => {
        const FileIcon = FILE_ICONS[file.type] || FiFile;
        const isImage = file.type && file.type.startsWith('image/');
        
        return (
          <div key={index} style={{ 
            padding: '8px 12px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '8px',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            maxWidth: '300px',
            border: `1px solid ${theme.colors.glassBorder}`
          }}
          onClick={() => window.open(file.url, '_blank')}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
            e.currentTarget.style.borderColor = theme.colors.gold;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
            e.currentTarget.style.borderColor = theme.colors.glassBorder;
          }}>
              
            {isImage ? (
              <img
                src={file.url}
                alt={file.name}
                loading="lazy"
                style={{
                  width: '40px',
                  height: '40px',
                  objectFit: 'cover',
                  borderRadius: '4px'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : (
              <FileIcon size={16} color={theme.colors.gold} />
            )}
            
            <div style={{ 
              display: isImage ? 'none' : 'flex',
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              <FiImage size={16} />
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: theme.colors.textMain }}>{file.name}</div>
              <div style={{ fontSize: '11px', color: theme.colors.textSec }}>
                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'File'}
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.open(file.url, '_blank');
              }}
              style={{
                background: theme.colors.goldGradient,
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: '#000',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FiExternalLink size={10} />
              Open
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Image Message Component
const ImageMessage = ({ files }) => {
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '8px',
        maxWidth: '300px'
      }}>
        {files.map((file, index) => (
          <div key={index} style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            cursor: 'pointer',
            border: `1px solid ${theme.colors.glassBorder}`
          }}
          onClick={() => window.open(file.url, '_blank')}>
            <img
              src={file.url}
              alt={file.name}
              loading="lazy"
              style={{
                width: '100%',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div style={{
              display: 'none',
              width: '100%',
              height: '80px',
              background: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              <FiImage size={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Product photo processing function
const processProductPhotos = (photos) => {
  if (!photos) return [];
  let processedPhotos = [];
  try {
    if (typeof photos === 'string') {
      processedPhotos = JSON.parse(photos);
    } else if (Array.isArray(photos)) {
      processedPhotos = photos;
    }
    if (!Array.isArray(processedPhotos)) {
      processedPhotos = [];
    }
    return processedPhotos.map(photo => {
      if (!photo) return '';
      if (photo.startsWith('http')) return photo;
      return absoluteUrl(photo);
    });
  } catch (e) {
    console.error('Error parsing product photos:', e);
    return [];
  }
};

const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  return absoluteUrl(imagePath);
};

// Product Gallery Component
const ProductGallery = ({ product, isMobile }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const safeProduct = {
    product_photos: [],
    ...product
  };

  const processedPhotos = processProductPhotos(safeProduct.product_photos);

  if (processedPhotos.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: isMobile ? '150px' : '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        borderRadius: '8px',
        color: '#333',
        border: `1px solid ${theme.colors.glassBorder}`
      }}>
        <FiImage size={32} color={theme.colors.gold} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: isMobile ? '150px' : '200px',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#111',
      border: `1px solid ${theme.colors.glassBorder}`
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        <img
          src={getImageUrl(processedPhotos[currentImageIndex])}
          alt={product.product_name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      {processedPhotos.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '4px'
        }}>
          {processedPhotos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              style={{
                width: '10px',
                height: '10px',
                margin: '0 3px',
                borderRadius: '50%',
                border: 'none',
                background: currentImageIndex === index ? theme.colors.gold : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                boxShadow: currentImageIndex === index ? '0 0 5px rgba(0,0,0,0.5)' : 'none'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Product Details Component
const ProductDetails = ({ product, isMobile }) => {
  const { format } = useLocale();
  const safeProduct = {
    id: '',
    product_name: '',
    product_details: '',
    price: 0,
    min_price: 0,
    category: '',
    subcategory: '',
    stock: 0,
    moq: 500,
    material: '',
    care_instructions: '',
    sku: '',
    shipping_info: '',
    warranty: '',
    bulk_discount: '',
    rating: 0,
    product_photos: [],
    sizes: [],
    colors: [],
    tags: [],
    features: [],
    ...product
  };

  const processedTags = Array.isArray(safeProduct.tags) ? safeProduct.tags : [];
  const processedFeatures = Array.isArray(safeProduct.features) ? safeProduct.features : [];

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '8px',
      padding: isMobile ? '10px' : '15px',
      marginBottom: '10px',
      border: `1px solid ${theme.colors.glassBorder}`
    }}>
      {/* Product Tags */}
      {processedTags.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }}>
          {processedTags.map((tag, index) => (
            <span 
              key={index}
              style={{
                padding: '2px 5px',
                borderRadius: '3px',
                fontSize: isMobile ? '9px' : '10px',
                fontWeight: '700',
                color: '#000',
                textTransform: 'uppercase',
                background: 
                  tag === 'NEW' ? '#3498db' : 
                  tag === 'SALE' ? '#e74c3c' : 
                  tag === 'BESTSELLER' ? '#f39c12' : 
                  tag === 'LIMITED' ? '#9b59b6' : theme.colors.goldGradient,
                border: tag === 'LIMITED' ? 'none' : `1px solid ${theme.colors.glassBorder}`
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
       
      <h3 style={{
        margin: '0 0 6px 0',
        fontSize: isMobile ? '16px' : '18px',
        fontWeight: '700',
        ...theme.textStyles.silverTitle,
        lineHeight: '1.3'
      }}>
        {safeProduct.product_name}
      </h3>
       
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        fontSize: isMobile ? '11px' : '12px',
        color: theme.colors.textSec
      }}>
        <span>SKU: {safeProduct.sku || 'N/A'}</span>
      </div>
       
      <div style={{ marginBottom: '8px' }}>
        {(() => {
          const parseNumeric = (value) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const parsed = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : NaN;
            return Number.isFinite(parsed) ? parsed : null;
          };

          const discounted = parseNumeric(safeProduct?.discounted_price);
          const min = parseNumeric(safeProduct?.min_price);
          const price = parseNumeric(safeProduct?.price);
          
          const finalPrice = discounted || min || price || 0;
          
          const fmt = (val) => format(val, 'EUR');

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '700', 
                background: theme.colors.goldGradient, 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent', 
                display: 'inline-block' 
              }}>
                {finalPrice > 0 ? fmt(finalPrice) : 'Price on request'}
              </span>
              
              {discounted !== null && min !== null && discounted < min && (
                <>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#95a5a6', textDecoration: 'line-through' }}>
                    {fmt(min)}
                  </span>
                  <span style={{ padding: '2px 6px', background: '#e74c3c', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: '#fff' }}>
                    {Math.round((1 - discounted / min) * 100)}% OFF
                  </span>
                </>
              )}
            </div>
          );
        })()}
      </div>
       
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '8px',
        fontSize: isMobile ? '11px' : '12px',
        fontWeight: '600',
        color: theme.colors.textMain
      }}>
        <span>Availability:</span>
        <span style={{
          color: safeProduct.stock > 0 ? theme.colors.green : theme.colors.accent
        }}>
          {safeProduct.stock > 0 ? `${safeProduct.stock} in stock` : 'Out of stock'}
        </span>
      </div>
       
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '8px',
        fontSize: isMobile ? '11px' : '12px',
        color: theme.colors.textSec
      }}>
        <span>Minimum Order: {safeProduct.moq} units</span>
      </div>
       
      {safeProduct.product_details && (
        <div style={{
          fontSize: isMobile ? '11px' : '12px',
          lineHeight: '1.4',
          color: theme.colors.textSec,
          marginBottom: '8px',
          maxHeight: isMobile ? '45px' : '60px',
          overflow: 'hidden'
        }}>
          {safeProduct.product_details.substring(0, isMobile ? 100 : 150)}
          {safeProduct.product_details.length > (isMobile ? 100 : 150) ? '...' : ''}
        </div>
      )}
       
      {processedFeatures.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            fontSize: isMobile ? '11px' : '12px',
            fontWeight: '600',
            color: theme.colors.gold,
            marginBottom: '4px'
          }}>Key Features:</div>
          <ul style={{
            margin: 0,
            paddingLeft: '12px',
            fontSize: isMobile ? '10px' : '11px',
            color: theme.colors.textSec,
            lineHeight: '1.3'
          }}>
            {processedFeatures.slice(0, 3).map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
            {processedFeatures.length > 3 && (
              <li>+ {processedFeatures.length - 3} more features</li>
            )}
          </ul>
        </div>
      )}
       
      {(safeProduct.material || safeProduct.care_instructions) && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '4px',
          fontSize: isMobile ? '10px' : '11px',
          color: theme.colors.textSec,
          border: `1px solid ${theme.colors.glassBorder}`
        }}>
          {safeProduct.material && <div><strong>Material:</strong> {safeProduct.material}</div>}
          {safeProduct.care_instructions && <div><strong>Care:</strong> {safeProduct.care_instructions}</div>}
        </div>
      )}
    </div>
  );
};

// Product Loader Component
const ProductLoader = ({ isMobile }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    padding: isMobile ? '10px' : '15px',
    border: `1px solid ${theme.colors.glassBorder}`,
    display: 'flex',
    gap: isMobile ? '10px' : '15px',
    alignItems: 'center'
  }}>
    <div style={{
      width: isMobile ? '80px' : '100px',
      height: isMobile ? '80px' : '100px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.gold
    }}>
      <FiLoader size={24} className="spin" />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{
        height: isMobile ? '16px' : '18px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px',
        marginBottom: '8px',
        width: '80%'
      }}></div>
      <div style={{
        height: isMobile ? '12px' : '14px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px',
        marginBottom: '6px',
        width: '60%'
      }}></div>
      <div style={{
        height: isMobile ? '10px' : '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px',
        marginBottom: '6px',
        width: '40%'
      }}></div>
    </div>
  </div>
);

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

const Inquiry = () => {
  const { cartItems, clearCart, setInquiryCheckoutProduct } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  
  const directInquiryProduct = location.state?.product;
  const isDirectInquiry = location.state?.directInquiry;
  
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showProfileCompletionPopup, setShowProfileCompletionPopup] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inquiryInfo, setInquiryInfo] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    userId: ''
  });
  const [activeTab, setActiveTab] = useState('chat');
  const [currentInquiry, setCurrentInquiry] = useState(null);
  const [isChatEnabled, setIsChatEnabled] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isCheckoutActive, setIsCheckoutActive] = useState(true); 
  const [priceData, setPriceData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasAutoSentInitialMessage, setHasAutoSentInitialMessage] = useState(false);
  
  const [processedMessageIds, setProcessedMessageIds] = useState(new Set());
  const [hasInitializedInquiry, setHasInitializedInquiry] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const sentInitialMessageRef = useRef(new Set());

  // Ref to track if user is currently at bottom
  const isUserAtBottomRef = useRef(true);

  const isMobile = useIsMobile();
  const isTablet = useIsMobile() ? false : window.innerWidth < 1024;

  // --- SEO Optimization ---
  useEffect(() => {
    if (directInquiryProduct) {
        document.title = `Inquiry: ${directInquiryProduct.product_name || 'Product'} | Yokebud`;
    } else if (cartItems.length > 0) {
        document.title = `Bulk Inquiry (${cartItems.length} items) | Yokebud`;
    } else {
        document.title = 'Inquiry Center | Yokebud';
    }
  }, [directInquiryProduct, cartItems]);

  // --- Smart Scroll Logic ---
  const handleChatScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      isUserAtBottomRef.current = isAtBottom;
    }
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleChatScroll);
      return () => container.removeEventListener('scroll', handleChatScroll);
    }
  }, [handleChatScroll, activeTab]);

  // Effect to scroll to bottom ONLY if user was already there or it's the first load
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage?.sender_type === 'user';

      if (isUserAtBottomRef.current || isMyMessage || messages.length < 5) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages]);

  // --- Data Initialization Logic ---
  const checkExistingInquiry = async (userData) => {
    if (hasInitializedInquiry) return;
    
    const product = directInquiryProduct || cartItems[0];
    if (!product?.id) return;

    try {
      const response = await apiFetch(`/api/inquiries/user/${userData.user_id}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.inquiries) {
          const existingInquiry = data.inquiries.find(inq => {
            const pId = inq.product_data?.id;
            return pId === product.id;
          });

          if (existingInquiry) {
             setCurrentInquiry(existingInquiry);
             setMessages(existingInquiry.messages || []);
             setIsCheckoutActive(existingInquiry.is_checkout_active);
             setPriceData(existingInquiry.price_data);
             setHasInitializedInquiry(true);
             
             if (socket.connected) {
               socket.emit('join_inquiry', existingInquiry.id);
             }
             
             setTimeout(() => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
             }, 100);
             
             return existingInquiry;
          }
        }
      }
      
      setHasInitializedInquiry(true);
      
    } catch (error) {
      console.error('Error checking existing inquiry:', error);
      setHasInitializedInquiry(false);
    }
    return null;
  };

  const initializeInquiry = async (userData, initialMessage = '') => {
    if (hasInitializedInquiry) {
      return;
    }

    if (!directInquiryProduct && cartItems.length === 0) {
      return;
    }

    const product = directInquiryProduct || cartItems[0];
    
    if (!product.id) return;

    try {
      setHasInitializedInquiry(true);
      
      const response = await apiFetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.user_id,
          product: {
            ...product,
            id: product.id,
            product_name: product.product_name || product.name,
            price: product.min_price || product.discounted_price || product.price,
            min_price: product.min_price || product.discounted_price || product.price,
            max_price: product.max_price || product.price,
            product_photos: product.product_photos || [],
            quantity: product.quantity || 1,
            selectedSize: product.selectedSize || 'Customizable'
          },
          customerInfo: {
            name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            email: userData.email,
            phone: userData.phone,
            country: userData.country,
            userId: userData.user_id
          },
          initialMessage: initialMessage
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      
      if (data.success && data.inquiry) {
        setCurrentInquiry(data.inquiry);
        setMessages(data.inquiry.messages || []);
        setIsCheckoutActive(data.inquiry.is_checkout_active);
        setPriceData(data.inquiry.price_data);
        
        if (socket.connected && data.inquiry.id) {
          socket.emit('join_inquiry', data.inquiry.id);
        }
        
        setTimeout(() => {
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        }, 100);

        return data.inquiry;
      }
    } catch (error) {
      console.error('Error initializing inquiry:', error);
      setHasInitializedInquiry(false); 
    }
    return null;
  };

  // Socket Event Listeners
  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message.inquiryId === currentInquiry?.id) {
        setMessages(prev => {
          const messageExists = prev.some(msg => 
            msg.id === message.id || 
            (msg.temporaryId && msg.temporaryId === message.temporaryId) ||
            (msg.message === message.message && msg.sender_type === message.sender_type && 
              Math.abs(new Date(msg.timestamp) - new Date(message.timestamp)) < 1000)
          );
          
          if (!messageExists) {
            const updatedMessages = [...prev, message];
            if (message.sender_type === 'admin' && !processedMessageIds.has(message.id)) {
              setProcessedMessageIds(prev => new Set([...prev, message.id]));
            }
            return updatedMessages;
          }
          return prev;
        });
      }
    };

    const handleMessageSent = (data) => {
      if (data.success && data.message && data.message.inquiryId === currentInquiry?.id) {
        setMessages(prev => {
          return prev.map(msg => 
            msg.temporaryId === data.temporaryId 
              ? { ...data.message, id: data.message.id }
              : msg
          );
        });
      }
    };

    const handleMessageError = (data) => {
      if (data.temporaryId) {
        setMessages(prev => prev.filter(msg => msg.temporaryId !== data.temporaryId));
      }
    };

    socket.on('connect', () => {
      if (currentInquiry) socket.emit('join_inquiry', currentInquiry.id);
    });

    socket.on('new_message', handleNewMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_error', handleMessageError);
    socket.on('admin_typing', () => setIsTyping(true));
    socket.on('admin_stop_typing', () => setIsTyping(false));

    return () => {
      socket.off('connect');
      socket.off('new_message', handleNewMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_error', handleMessageError);
      socket.off('admin_typing');
      socket.off('admin_stop_typing');
    };
  }, [currentInquiry, processedMessageIds]);

  // Auth check and Init
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setIsInitializing(true);
      const fbUser = await waitForAuthInit();
      const token = localStorage.getItem('userToken');

      const finishLogin = (dataUser) => {
        setUser(dataUser);
        setIsLoggedIn(true);
        setInquiryInfo(prev => ({
          ...prev,
          name: `${dataUser.first_name || ''} ${dataUser.last_name || ''}`.trim(),
          email: dataUser.email || '',
          phone: dataUser.phone || '',
          country: dataUser.country || '',
          userId: dataUser.user_id
        }));
        const needsCompletion = !dataUser.first_name || !dataUser.last_name || !dataUser.phone;
        setNeedsProfileCompletion(needsCompletion);
        if (needsCompletion) {
          setShowProfileCompletionPopup(true);
        } else {
          setIsChatEnabled(true);
          checkExistingInquiry(dataUser);
        }
        setShowLoginPopup(false);
      };

      if (token) {
        try {
          const response = await apiFetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) finishLogin(data.user);
            else setShowLoginPopup(true);
          } else {
             setShowLoginPopup(true);
          }
        } catch (error) {
            setShowLoginPopup(true);
        }
      } else {
        setShowLoginPopup(true);
      }
      if (mounted) setIsInitializing(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Product Data Logic
  useEffect(() => {
    if (isDirectInquiry && directInquiryProduct && isLoggedIn) {
      setProductsData([{ ...directInquiryProduct, quantity: directInquiryProduct.quantity || 1 }]);
      setLoadingProducts(false);
    }
  }, [isDirectInquiry, directInquiryProduct, isLoggedIn]);

  useEffect(() => {
    if (isDirectInquiry || !isLoggedIn) return;
    const fetchProductDetails = async () => {
      if (cartItems.length === 0) return;
      setLoadingProducts(true);
      try {
        const productPromises = cartItems.map(async (item) => {
          try {
            const response = await apiFetch(`/api/products/${item.id}`);
            if (!response.ok) throw new Error('Fetch failed');
            const productData = await response.json();
            return { ...item, ...productData };
          } catch (error) {
            return item;
          }
        });
        const updatedProducts = await Promise.all(productPromises);
        setProductsData(updatedProducts);
      } catch (error) {
        setProductsData(cartItems);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProductDetails();
  }, [cartItems, isDirectInquiry, isLoggedIn]);

  const uploadFiles = async (files) => {
    if (!currentInquiry) throw new Error('No inquiry available');
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const token = localStorage.getItem('userToken');
    const response = await apiFetch(`/api/inquiries/${currentInquiry.id}/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      body: formData
    });
    if (!response.ok) throw new Error('Upload failed');
    const data = await response.json();
    return data.files || [];
  };

  const handleFileAttach = useCallback(() => {
    if (!isChatEnabled) return;
    fileInputRef.current?.click();
  }, [isChatEnabled]);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024); // 10MB limit
      setAttachedFiles(prev => [...prev, ...validFiles]);
      e.target.value = '';
    }
  }, []);

  const removeFile = useCallback((fileToRemove) => {
    setAttachedFiles(prev => prev.filter(file => file !== fileToRemove));
  }, []);

  const sendMessage = useCallback(async (messageText, files = []) => {
    const trimmed = (messageText || '').trim();
    if ((trimmed.length === 0 && files.length === 0) || !isChatEnabled) return;

    if (!currentInquiry) {
      const created = await initializeInquiry(user, trimmed);
      if (created && created.id) {
        if (socket.connected) socket.emit('join_inquiry', created.id);
        setCurrentInquiry(created);
        
        const msgs = created.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && 
            lastMsg.message === trimmed && 
            lastMsg.sender_type === 'user' &&
            (new Date().getTime() - new Date(lastMsg.timestamp).getTime() < 10000)) {
            setNewMessage('');
            setAttachedFiles([]);
            return;
        }
      } else {
        return;
      }
    }

    let uploadedFiles = [];
    if (files.length > 0) {
      setIsUploading(true);
      try {
        uploadedFiles = await uploadFiles(files);
      } catch (error) {
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const temporaryId = `temp-${Date.now()}`;
    const userMessage = {
      id: temporaryId,
      temporaryId: temporaryId,
      inquiry_id: currentInquiry?.id,
      sender_type: 'user',
      message: trimmed,
      files: uploadedFiles,
      timestamp: new Date().toISOString(),
      is_read: true,
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setAttachedFiles([]);
    
    setTimeout(() => {
        if(messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, 50);

    try {
      socket.emit('send_message', {
        inquiryId: currentInquiry?.id,
        message: trimmed,
        senderType: 'user',
        files: uploadedFiles,
        temporaryId: temporaryId
      });
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.temporaryId !== temporaryId));
    }
  }, [currentInquiry, isChatEnabled, user]);

  const handleMessageChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing_start', { inquiryId: currentInquiry?.id, userId: user?.user_id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { inquiryId: currentInquiry?.id, userId: user?.user_id });
      }, 1000);
    } else {
        socket.emit('typing_stop', { inquiryId: currentInquiry?.id, userId: user?.user_id });
    }
  };

  const handleSendMessage = () => {
    sendMessage(newMessage, attachedFiles);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setShowLoginPopup(false);
    setInquiryInfo(prev => ({
      ...prev,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: userData.email || '',
      phone: userData.phone || '',
      country: userData.country || '',
      userId: userData.user_id
    }));
    const needsCompletion = !userData.first_name || !userData.last_name || !userData.phone;
    setNeedsProfileCompletion(needsCompletion);
    if (needsCompletion) setShowProfileCompletionPopup(true);
    else setIsChatEnabled(true);
  };

  const handleProfileCompletion = (userData) => {
    setUser(userData);
    setNeedsProfileCompletion(false);
    setShowProfileCompletionPopup(false);
    setIsChatEnabled(true);
    setInquiryInfo(prev => ({
      ...prev,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      phone: userData.phone || '',
      country: userData.country || '',
      userId: userData.user_id
    }));
  };

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      setShowLoginPopup(true);
      return;
    }
    const displayProducts = isDirectInquiry ? productsData : (productsData.length > 0 ? productsData : cartItems);
    if (displayProducts.length === 0) return;

    try {
      setIsLoading(true);
      setInquiryCheckoutProduct(displayProducts[0], priceData, currentInquiry?.inquiry_number, currentInquiry?.id);
      setTimeout(() => {
        if (!isDirectInquiry) clearCart();
        window.location.href = `/Checkout?source=inquiry&inquiryId=${currentInquiry?.id}&inquiryNumber=${currentInquiry?.inquiry_number}`;
      }, 500);
    } catch (error) {
      console.error('Checkout error', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageBubbleStyle = (type) => ({
    padding: isMobile ? '12px' : '15px',
    borderRadius: '18px',
    marginBottom: '12px',
    maxWidth: isMobile ? '85%' : '70%',
    alignSelf: type === 'user' ? 'flex-end' : 'flex-start',
    wordWrap: 'break-word',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    position: 'relative',
    backdropFilter: 'blur(5px)',
    background: type === 'user' ? 'rgba(52, 152, 219, 0.1)' : 'rgba(255, 255, 255, 0.05)',
    border: type === 'user' ? '1px solid rgba(52, 152, 219, 0.3)' : `1px solid ${theme.colors.glassBorder}`,
    borderRight: type === 'user' ? `2px solid ${theme.colors.gold}` : undefined,
    borderLeft: type === 'admin' ? '2px solid silver' : undefined,
    color: '#fff'
  });

  const renderMessageContent = (msg) => {
    const hasImages = msg.files && msg.files.some(file => file.type && file.type.startsWith('image/'));
    const hasFiles = msg.files && msg.files.some(file => !file.type.startsWith('image/'));
    return (
      <>
        {msg.message && (
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: msg.files && msg.files.length > 0 ? '8px' : '0', fontSize: isMobile ? '14px' : '15px', lineHeight: '1.4' }}>
            {msg.message}
          </div>
        )}
        {hasImages && <ImageMessage files={msg.files.filter(file => file.type && file.type.startsWith('image/'))} />}
        {hasFiles && <FileMessage files={msg.files.filter(file => !file.type.startsWith('image/'))} sender={msg.sender_type} />}
      </>
    );
  };

  const displayProducts = isDirectInquiry ? productsData : (productsData.length > 0 ? productsData : cartItems);

  const manualRefresh = () => {
    setIsManualRefresh(true);
    setLastRefresh(Date.now());
    setTimeout(() => setIsManualRefresh(false), 1000);
  };

  const styles = {
    container: { 
      minHeight: '100vh', 
      marginBottom: '5vh', 
      background: theme.colors.bg, 
      color: '#fff', 
      margin: 0, 
      padding: isMobile ? '10px' : isTablet ? '15px' : '20px', 
      fontFamily: "'Poppins', sans-serif", 
      boxSizing: 'border-box',
      backgroundImage: `radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 80%)`
    },
    overlay: { 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0, 0, 0, 0.8)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 9999, 
      padding: isMobile ? '10px' : '20px', 
      backdropFilter: 'blur(5px)' 
    },
    header: { 
      background: theme.colors.glassBg, 
      backdropFilter: 'blur(20px)', 
      borderRadius: isMobile ? '8px' : '15px', 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row', 
      alignItems: isMobile ? 'flex-start' : 'center', 
      justifyContent: 'space-between', 
      width: '100%', 
      margin: '0 auto 20px auto', 
      padding: isMobile ? '12px' : '20px', 
      border: `1px solid ${theme.colors.glassBorder}`, 
      boxShadow: theme.shadows.card, 
      marginBottom: '20px', 
      gap: isMobile ? '10px' : '0' 
    },
    inquiryNumber: { 
      fontSize: isMobile ? '9px' : '11px', 
      fontWeight: '700', 
      ...silverTextStyle, 
      letterSpacing: '1px' 
    },
    refreshButton: { 
      padding: '8px 12px', 
      borderRadius: '6px', 
      border: `1px solid ${theme.colors.gold}`, 
      backgroundColor: 'transparent', 
      color: theme.colors.gold, 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '6px', 
      fontWeight: '600', 
      fontSize: '8px', 
      boxShadow: theme.shadows.glow 
    },
    content: { 
      display: 'grid', 
      gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 350px' : '1fr 400px', 
      gap: isMobile ? '15px' : '20px', 
      margin: '0 auto', 
      marginBottom: '8vh' 
    },
    chatContainer: { 
      background: theme.colors.glassBg, 
      backdropFilter: 'blur(20px)', 
      borderRadius: '15px', 
      padding: isMobile ? '15px' : '20px', 
      border: `1px solid ${theme.colors.glassBorder}`, 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative', 
      boxShadow: theme.shadows.card, 
      height: isMobile ? '65vh' : '70vh', 
      minHeight: '500px' 
    },
    messagesContainer: { 
      flex: 1, 
      overflowY: 'auto', 
      padding: '10px', 
      marginBottom: '15px', 
      display: 'flex', 
      flexDirection: 'column' 
    },
    messageHeader: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: '8px', 
      fontSize: isMobile ? '8px' : '10px', 
      gap: '6px', 
      opacity: '0.6', 
      fontWeight: '500', 
      textTransform: 'capitalize', 
      letterSpacing: '0.5px' 
    },
    inputContainer: { 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'flex-end', 
      paddingTop: '15px', 
      borderTop: `1px solid ${theme.colors.glassBorder}` 
    },
    attachmentButton: { 
      background: 'rgba(255, 255, 255, 0.05)', 
      border: `1px solid ${theme.colors.glassBorder}`, 
      borderRadius: '50%', 
      width: isMobile ? '35px' : '45px', 
      height: isMobile ? '35px' : '45px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      cursor: isChatEnabled ? 'pointer' : 'not-allowed', 
      color: theme.colors.gold, 
      flexShrink: 0, 
      transition: 'all 0.3s ease' 
    },
    sendButton: { 
      background: isChatEnabled ? theme.colors.goldGradient : 'rgba(255, 255, 255, 0.1)', 
      border: 'none', 
      borderRadius: '50%', 
      width: isMobile ? '45px' : '50px', 
      height: isMobile ? '45px' : '50px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      cursor: isChatEnabled ? 'pointer' : 'not-allowed', 
      flexShrink: 0, 
      boxShadow: isChatEnabled ? theme.shadows.glow : 'none' 
    },
    sidebar: { 
      background: theme.colors.glassBg, 
      backdropFilter: 'blur(20px)', 
      borderRadius: '15px', 
      padding: isMobile ? '15px' : '25px', 
      border: `1px solid ${theme.colors.glassBorder}`, 
      height: 'fit-content', 
      position: 'sticky', 
      top: '70px', 
      boxShadow: theme.shadows.card 
    },
    tabContainer: { 
      display: 'flex', 
      gap: '12px', 
      marginBottom: '15px' 
    },
    tabButton: (isActive) => ({ 
      flex: 1, 
      padding: isMobile ? '10px' : '14px', 
      background: isActive ? theme.colors.goldGradient : 'rgba(255, 255, 255, 0.05)', 
      border: isActive ? 'none' : `1px solid ${theme.colors.glassBorder}`, 
      borderRadius: '10px', 
      color: isActive ? '#000' : '#fff', 
      cursor: 'pointer', 
      textAlign: 'center', 
      fontWeight: 'bold', 
      fontSize: isMobile ? '13px' : '14px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '8px', 
      transition: 'all 0.3s ease', 
      boxShadow: isActive ? '0 4px 15px rgba(191, 149, 63, 0.4)' : 'none' 
    }),
    chatDisabledOverlay: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0, 0, 0, 0.8)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      borderRadius: '15px', 
      zIndex: 10, 
      padding: '20px', 
      backdropFilter: 'blur(5px)' 
    },
    statusIndicator: { 
      display:  'inline-flex', 
      alignItems: 'center', 
      padding: '6px 12px', 
      borderRadius: '20px', 
      fontSize: isMobile ? '10px' : '8px', 
      fontWeight: '600', 
      border: `1px solid ${theme.colors.glassBorder}` 
    },
    filePreviewContainer: { 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '8px', 
      marginBottom: '10px', 
      padding: '10px', 
      background: 'rgba(255, 255, 255, 0.02)', 
      borderRadius: '10px', 
      border: `1px solid ${theme.colors.glassBorder}` 
    },
    infoOverview: { 
      background: 'rgba(0, 0, 0, 0.2)', 
      borderRadius: '10px', 
      padding: isMobile ? '12px' : '15px', 
      marginBottom: '20px', 
      border: `1px solid ${theme.colors.glassBorder}` 
    },
    infoItem: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginBottom: '10px', 
      fontSize: isMobile ? '13px' : '14px', 
      borderBottom: '1px solid rgba(255,255,255,0.05)', 
      paddingBottom: '5px' 
    },
    editButton: { 
      background: 'transparent', 
      border: `1px solid ${theme.colors.gold}`, 
      borderRadius: '5px', 
      padding: '6px 12px', 
      color: theme.colors.gold, 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '6px', 
      fontSize: isMobile ? '11px' : '12px', 
      fontWeight: '600' 
    },
    productsGrid: { 
      display: 'grid', 
      gap: '15px', 
      overflowY: 'auto' 
    },
    productCard: { 
      background: 'rgba(255, 255, 255, 0.02)', 
      borderRadius: '12px', 
      padding: isMobile ? '12px' : '20px', 
      border: `1px solid ${theme.colors.glassBorder}`, 
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
    },
    typingIndicator: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      padding: '10px 15px', 
      background: 'rgba(255, 255, 255, 0.05)', 
      borderRadius: '18px', 
      alignSelf: 'flex-start', 
      maxWidth: '150px', 
      marginBottom: '12px', 
      fontSize: '12px', 
      color: 'rgba(255, 255, 255, 0.6)' 
    },
    sendingIndicator: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      padding: '10px 15px', 
      background: 'rgba(52, 152, 219, 0.1)', 
      borderRadius: '18px', 
      alignSelf: 'flex-end', 
      maxWidth: '120px', 
      marginBottom: '12px', 
      fontSize: '12px', 
      color: 'rgba(255, 255, 255, 0.6)' 
    }
  };

  if (isInitializing) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.colors.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            filter: `drop-shadow(${theme.shadows.glow})`
          }}
        >
          <FiLoader size={50} color={theme.colors.gold} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          style={{
            ...silverTextStyle,
            fontSize: '18px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}
        >
          Loading Inquiry Page...
        </motion.p>
      </div>
    );
  }

  return (
    <div style={styles.container} ref={containerRef}>
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      <AnimatePresence>
        {showLoginPopup && (
          <motion.div 
            style={styles.overlay} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <LoginForm 
              onClose={() => setShowLoginPopup(false)} 
              onSuccess={handleLoginSuccess} 
              isMobile={isMobile} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileCompletionPopup && (
          <motion.div 
            style={styles.overlay} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <ProfileCompletionForm 
              user={user} 
              onComplete={handleProfileCompletion} 
              onSkip={() => setShowProfileCompletionPopup(false)} 
              isMobile={isMobile} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={styles.inquiryNumber}>
            {isLoggedIn && currentInquiry ? `Inquiry #: ${currentInquiry.inquiry_number}` : isLoggedIn ? 'Setting up your inquiry..' : 'Please Sign In to Continue'}
          </div>
          <button style={styles.refreshButton} onClick={manualRefresh} disabled={isManualRefresh}>
            <FiRefreshCw className={isManualRefresh ? 'spin' : ''} />
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '15px', flexWrap: 'wrap', marginTop: isMobile ? '10px' : '0' }}>
          {isTyping && (
            <div style={styles.typingIndicator}>
              <div className="typing-dots"><span></span><span></span><span></span></div>
              Admin is typing...
            </div>
          )}
        </div>
      </div>

      {isLoggedIn ? (
        <div style={styles.content}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={styles.tabContainer}>
              <button style={styles.tabButton(activeTab === 'chat')} onClick={() => setActiveTab('chat')}>
                <FiMessageSquare size={isMobile ? 14 : 16} /> {isMobile ? 'Chat' : 'Chat'} {!isChatEnabled && '🔒'}
              </button>
              <button style={styles.tabButton(activeTab === 'products')} onClick={() => setActiveTab('products')}>
                <FiShoppingCart size={isMobile ? 14 : 16} /> {isMobile ? 'Products' : (isDirectInquiry ? 'Product Details' : `Products (${displayProducts.length})`)}
              </button>
            </div>

            {activeTab === 'chat' && (
              <div style={styles.chatContainer}>
                {!isChatEnabled && (
                  <div style={styles.chatDisabledOverlay}>
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <FiMessageSquare size={isMobile ? 36 : 48} style={{ marginBottom: '10px', opacity: 0.7, color: theme.colors.gold }} />
                      <h3 style={silverTextStyle}>Complete Your Profile</h3>
                      <p style={{color: theme.colors.textSec, marginBottom: '20px'}}>Please complete your profile information to enable chat</p>
                      <button 
                        style={{ 
                          background: theme.colors.goldGradient, 
                          color: 'black', 
                          border: 'none', 
                          padding: '12px 20px', 
                          borderRadius: '8px', 
                          fontSize: '14px', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          marginTop: '10px', 
                          boxShadow: theme.shadows.glow 
                        }} 
                        onClick={() => setShowProfileCompletionPopup(true)}
                      >
                        Complete Profile
                      </button>
                    </div>
                  </div>
                )}
                  
                <div ref={messagesContainerRef} style={styles.messagesContainer}>
                  {messages.map((msg) => (
                    <motion.div 
                      key={msg.id || msg.temporaryId} 
                      style={getMessageBubbleStyle(msg.sender_type)} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ duration: 0.3 }}
                    >
                      {renderMessageContent(msg)}
                      <div style={styles.messageHeader}>
                        <span>{msg.sender_type === 'user' ? 'You' : 'Admin'}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </motion.div>
                  ))}
                    
                  {isTyping && (
                    <div style={styles.typingIndicator}>
                      <div className="typing-dots"><span></span><span></span><span></span></div>
                      Admin is typing...
                    </div>
                  )}
                    
                  {(isLoading || isUploading) && (
                    <motion.div style={styles.sendingIndicator} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>{isUploading ? 'Uploading...' : 'Sending...'}</span>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {attachedFiles.length > 0 && (
                  <div style={styles.filePreviewContainer}>
                    {attachedFiles.map((file, index) => (
                      <FilePreview key={index} file={file} onRemove={removeFile} />
                    ))}
                  </div>
                )}

                <div style={styles.inputContainer}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileSelect} 
                    accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip,.rar" 
                    multiple 
                  />
                  <button 
                    style={styles.attachmentButton} 
                    onClick={handleFileAttach} 
                    title="Attach files" 
                    disabled={!isChatEnabled}
                  >
                    <FiPaperclip />
                  </button>
                  <AutoExpandingTextarea 
                    value={newMessage} 
                    onChange={handleMessageChange} 
                    placeholder={isChatEnabled ? "Type your message..." : "Complete your profile to enable chat"} 
                    disabled={!isChatEnabled || isUploading} 
                    onSend={handleSendMessage} 
                  />
                  <button 
                    style={styles.sendButton} 
                    onClick={handleSendMessage} 
                    disabled={!isChatEnabled || isLoading || isUploading || (newMessage.trim() === '' && attachedFiles.length === 0)}
                  >
                    <FiSend color={isChatEnabled ? '#000' : '#fff'} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div style={{...styles.chatContainer, height: 'auto', minHeight: isMobile ? '400px' : '500px'}}>
                <h3 style={{ marginBottom: '15px', ...goldTextStyle, fontSize: '1.2rem' }}>
                  {isDirectInquiry ? 'Product Details' : `Inquiry Items (${displayProducts.length})`}
                </h3>
                {displayProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', opacity: 0.7 }}>
                    <FiShoppingCart size={isMobile ? 36 : 48} style={{ marginBottom: '10px' }} />
                    <p>No products in inquiry</p>
                  </div>
                ) : (
                  <div style={styles.productsGrid}>
                    {loadingProducts && !isDirectInquiry ? (
                      Array.from({ length: cartItems.length }).map((_, index) => <ProductLoader key={index} isMobile={isMobile} />)
                    ) : (
                      displayProducts.map((item, index) => (
                        <motion.div 
                          key={`${item.id}-${index}`} 
                          style={styles.productCard} 
                          initial={{ opacity: 0, y: 20 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ delay: index * 0.1 }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: '12px' }}>
                            <div><ProductGallery product={item} isMobile={isMobile} /></div>
                            <div>
                              <ProductDetails product={item} isMobile={isMobile} />
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginTop: '8px', 
                                paddingTop: '8px', 
                                borderTop: '1px solid rgba(255,255,255,0.1)' 
                              }}>
                                <div style={{ fontSize: isMobile ? '11px' : '12px', color: theme.colors.textSec }}>
                                  <div>Size: {item.selectedSize || 'Customizable'}</div>
                                  <div>Quantity: {item.quantity || 1} units</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.sidebar}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', ...goldTextStyle }}>Your Information</h3>
              <button style={styles.editButton} onClick={() => setShowProfileCompletionPopup(true)}>
                <FiEdit size={isMobile ? 12 : 14} /> Edit
              </button>
            </div>
              
            <div style={styles.infoOverview}>
              <div style={styles.infoItem}>
                <span style={{color: theme.colors.textSec}}>Name:</span>
                <span style={{ fontWeight: '600', color: theme.colors.textMain }}>{inquiryInfo.name || 'Not provided'}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={{color: theme.colors.textSec}}>Email:</span>
                <span style={{ fontWeight: '600', color: theme.colors.textMain }}>{inquiryInfo.email || 'Not provided'}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={{color: theme.colors.textSec}}>Phone:</span>
                <span style={{ fontWeight: '600', color: theme.colors.textMain }}>{inquiryInfo.phone || 'Not provided'}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={{color: theme.colors.textSec}}>Country:</span>
                <span style={{ fontWeight: '600', color: theme.colors.textMain }}>{inquiryInfo.country || 'Not provided'}</span>
              </div>
            </div>

            <div style={{ 
              marginTop: '15px', 
              padding: isMobile ? '12px' : '15px', 
              borderRadius: '8px', 
              background: 'rgba(255,255,255,0.02)', 
              border: `1px solid ${theme.colors.glassBorder}` 
            }}>
              <h4 style={{ marginBottom: '8px', fontSize: isMobile ? '14px' : '16px', ...silverTextStyle }}>
                Inquiry Summary
              </h4>
              <div style={{ fontSize: isMobile ? '13px' : '14px', lineHeight: '1.5', color: theme.colors.textSec }}>
                <div>Items: <span style={{color:'#fff'}}>{displayProducts.length}</span> {isDirectInquiry ? 'product' : 'products'}</div>
                <div>Total Quantity: <span style={{color:'#fff'}}>{displayProducts.reduce((sum, item) => sum + (item.quantity || 500), 0)}</span> units</div>
              </div>
            </div>

            <div style={{ 
              marginTop: '25px', 
              padding: '20px', 
              borderRadius: '15px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              position: 'relative', 
              overflow: 'hidden' 
            }}>
              <button 
                style={{ 
                  background: theme.colors.goldGradient, 
                  color: '#000', 
                  border: 'none', 
                  borderRadius: '30px', 
                  padding: '12px 30px', 
                  fontSize: '15px', 
                  fontWeight: '800', 
                  width: '100%', 
                  marginTop: '5px', 
                  cursor: 'pointer', 
                  transition: 'all 0.3s ease', 
                  boxShadow: '0 4px 15px rgba(191, 149, 63, 0.3)', 
                  opacity: (!isChatEnabled || isLoading || displayProducts.length === 0) ? 0.6 : 1, 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px' 
                }}
                onClick={handleCheckout}
                disabled={!isChatEnabled || isLoading || displayProducts.length === 0}
                onMouseOver={e => { 
                  e.currentTarget.style.transform = 'scale(1.02)'; 
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(191, 149, 63, 0.5)'; 
                }}
                onMouseOut={e => { 
                  e.currentTarget.style.transform = 'scale(1)'; 
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(191, 149, 63, 0.3)'; 
                }}
              >
                {isLoading ? 'Processing...' : 'Proceed to Checkout'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <FiUser size={isMobile ? 48 : 64} style={{ marginBottom: '20px', color: theme.colors.gold }} />
          <h2 style={{ ...silverTextStyle, marginBottom: '15px', fontSize: '24px' }}>Authentication Required</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '40px', fontSize: '16px' }}>
            Please sign in or create an account to access the inquiry system
          </p>
          <button 
            style={{ 
              background: theme.colors.goldGradient, 
              color: 'black', 
              border: 'none', 
              padding: '15px 40px', 
              borderRadius: '30px', 
              fontSize: '16px', 
              fontWeight: 'bold', 
              cursor: 'pointer', 
              boxShadow: theme.shadows.glow 
            }}
            onClick={() => setShowLoginPopup(true)}
          >
            Sign In / Sign Up
          </button>
        </div>
      )}

      <style>
        {`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; }
          .typing-dots { display: inline-flex; align-items: center; margin-right: 8px; }
          .typing-dots span { height: 6px; width: 6px; background: ${theme.colors.gold}; border-radius: 50%; display: block; margin: 0 2px; animation: typing 1s infinite ease-in-out; }
          .typing-dots span:nth-child(1) { animation-delay: 0.2s; }
          .typing-dots span:nth-child(2) { animation-delay: 0.4s; }
          .typing-dots span:nth-child(3) { animation-delay: 0.6s; }
          @keyframes typing { 0%, 100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(-4px); opacity: 1; } }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.3); }
          ::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.3); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.6); }
          input:disabled, textarea:disabled, button:disabled { cursor: not-allowed; opacity: 0.6; }
          select option { background: #1a1a1a; color: #fff; }
          textarea { font-family: inherit; }
        `}
      </style>
    </div>
  );
};

export default Inquiry;
export { LoginForm };
