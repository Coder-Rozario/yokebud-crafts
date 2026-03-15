import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api'; 
// Icons are rendered with react-icons; install if needed: npm install react-icons
// You can also replace the icons with simple text labels if you prefer
import { FiLock, FiShield, FiArrowRight, FiRefreshCw } from 'react-icons/fi';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0); 
  const [resendCount, setResendCount] = useState(0);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Timer Logic
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(p => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async () => {
    if (resendCount >= 5) {
      setMsg({ type: 'error', text: 'Maximum attempts reached. Please wait.' });
      return;
    }

    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const res = await apiFetch('/api/admin/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const data = await res.json();

      if (data.success) {
        try {
          const emailRes = await apiFetch('/api/admin/send-otp-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          const emailData = await emailRes.json();

          if (!emailData.success) {
            setMsg({ type: 'error', text: emailData.message || 'Failed to send security code email.' });
            setLoading(false);
            return;
          }
        } catch (emailError) {
          setMsg({ type: 'error', text: 'Could not send security code email.' });
          setLoading(false);
          return;
        }

        setStep(2);
        setTimer(120);
        setResendCount(p => p + 1);
        setMsg({ type: 'success', text: 'Secure code sent to admin email. Please verify.' });
      } else {
        setMsg({ type: 'error', text: data.message || 'Connection refused' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: 'System is unreachable' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setMsg({ type: 'error', text: 'Invalid code format' });

    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        try {
          const isSecure = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
          const cookie = `adminAuth=authenticated; path=/; max-age=${60 * 60 * 24 * 365}${isSecure ? '; SameSite=None; Secure' : ''}`;
          document.cookie = cookie;
        } catch (_) {}
        localStorage.setItem('isAdminAuthenticated', 'true');
        window.location.href = '/admin/dashboard';
      } else {
        setMsg({ type: 'error', text: data.message || 'Access Denied' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  // --- Premium Styles (CSS-in-JS) ---
  const styles = {
    wrapper: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#fff',
      padding: '20px'
    },
    glassCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)', // Safari support
      border: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '50px 40px',
      borderRadius: '24px',
      width: '100%',
      maxWidth: '420px',
      textAlign: 'center',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    },
    iconWrapper: {
      width: '60px',
      height: '60px',
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 25px auto',
      boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      marginBottom: '8px',
      background: 'linear-gradient(to right, #fff, #94a3b8)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    subtitle: {
      fontSize: '14px',
      color: '#64748b',
      marginBottom: '35px'
    },
    input: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #334155',
      background: '#0f172a',
      color: '#f8fafc',
      textAlign: 'center',
      fontSize: '28px',
      fontWeight: '600',
      letterSpacing: '8px',
      marginBottom: '25px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)'
    },
    btnPrimary: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: 'none',
      background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      color: '#ffffff',
      fontWeight: '600',
      fontSize: '16px',
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'transform 0.1s ease, box-shadow 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      opacity: loading ? 0.7 : 1,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    },
    btnLink: {
      background: 'transparent',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      fontSize: '13px',
      marginTop: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      width: '100%',
      transition: 'color 0.2s'
    },
    statusMsg: {
      fontSize: '13px',
      padding: '10px 15px',
      borderRadius: '8px',
      marginBottom: '20px',
      display: 'inline-block',
      width: '100%'
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.glassCard}>
        
        {/* Header Icon */}
        <div style={styles.iconWrapper}>
           {step === 1 ? <FiShield size={28} color="#fff" /> : <FiLock size={28} color="#fff" />}
        </div>

        {/* Titles */}
        <h2 style={styles.title}>Admin Portal</h2>
        <p style={styles.subtitle}>
          {step === 1 ? 'Secure Verification Required' : 'Enter Security Code'}
        </p>
        
        {/* Messages */}
        {msg.text && (
          <div style={{
            ...styles.statusMsg,
            background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: msg.type === 'error' ? '#f87171' : '#34d399',
            border: msg.type === 'error' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            {msg.text}
          </div>
        )}

        {step === 1 ? (
          // --- STEP 1 ---
          <button 
            style={styles.btnPrimary} 
            onClick={handleSendOtp} 
            disabled={loading}
          >
            {loading ? 'Initializing...' : 'Initiate Secure Access'} 
            {!loading && <FiArrowRight />}
          </button>
        ) : (
          // --- STEP 2 ---
          <form onSubmit={handleVerify}>
             {/* Timer Display */}
            <div style={{ marginBottom: '15px', fontSize: '13px', color: timer > 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
              {timer > 0 ? `Code expires in ${Math.floor(timer/60)}:${(timer%60).toString().padStart(2,'0')}` : 'Security Code Expired'}
            </div>
            
            <input 
              type="text" 
              maxLength="6" 
              value={otp} 
              placeholder="• • • • • •"
              onChange={e => setOtp(e.target.value.replace(/\D/g,''))} 
              style={{
                ...styles.input,
                borderColor: msg.type === 'error' ? '#ef4444' : '#334155'
              }}
              disabled={loading} 
              autoFocus
            />
            
            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? 'Verifying...' : 'Authenticate'}
            </button>

            <button 
              type="button" 
              onClick={handleSendOtp} 
              disabled={loading || resendCount >= 5} 
              style={styles.btnLink}
            >
              <FiRefreshCw size={12} />
              {resendCount >= 5 ? 'Try again later' : 'Regenerate Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
