import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiCheck, FiX, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiFetch } from '../utils/api';

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [token] = useState(searchParams.get('token'));

  useEffect(() => {
    // If token is provided in URL, automatically unsubscribe
    if (token) {
      handleUnsubscribeWithToken();
    }
  }, [token]);

  const handleUnsubscribeWithToken = async () => {
    setIsLoading(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await apiFetch('/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        setIsUnsubscribed(true);
        toast.success(data.message || 'Successfully unsubscribed from newsletter.');
        
        // Clear any stored email in localStorage
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
          localStorage.removeItem('userEmail');
        }
      } else {
        toast.error(data.message || 'Unsubscribe failed. Please try again.');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      if (error.name === 'AbortError') {
        toast.error('Request timed out. Please try again later.');
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribeWithEmail = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    toast.info('Processing your unsubscription request...');

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await apiFetch('/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        setIsUnsubscribed(true);
        toast.success(data.message || 'Successfully unsubscribed from newsletter.');
        setEmail('');
        // Remove email from localStorage if it matches
        if (localStorage.getItem('userEmail') === email) {
          localStorage.removeItem('userEmail');
        }
      } else {
        toast.error(data.message || 'Unsubscribe failed. Please try again.');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      if (error.name === 'AbortError') {
        toast.error('Request timed out. Please try again later.');
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}
      >
        {token && isLoading ? (
          <div style={{ color: '#fff' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTop: '4px solid #FFA500',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>Processing...</h2>
            <p style={{ color: '#ccc' }}>Unsubscribing you from our newsletter.</p>
          </div>
        ) : isUnsubscribed ? (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(231, 76, 60, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '2px solid #e74c3c'
            }}>
              <FiX size={40} color="#e74c3c" />
            </div>
            <h2 style={{ color: '#fff', marginBottom: '15px' }}>Successfully Unsubscribed</h2>
            <p style={{ color: '#ccc', marginBottom: '25px', lineHeight: '1.6' }}>
              You have been unsubscribed from Yokebud's newsletter. 
              We're sorry to see you go! You will no longer receive weekly product updates.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'linear-gradient(135deg, #FFA500, #FFD700)',
                color: '#000',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '25px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(255, 165, 0, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <FiArrowLeft size={18} />
              Back to Home
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(255, 165, 0, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '2px solid #FFA500'
            }}>
              <FiMail size={40} color="#FFA500" />
            </div>
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>Unsubscribe from Newsletter</h2>
            <p style={{ color: '#ccc', marginBottom: '25px', lineHeight: '1.6' }}>
              Enter your email address to unsubscribe from Yokebud's weekly newsletter. 
              You'll stop receiving product updates and promotional emails.
            </p>
            
            <form onSubmit={handleUnsubscribeWithEmail}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: isLoading ? '#95a5a6' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  color: '#fff',
                  border: 'none',
                  padding: '15px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  marginBottom: '15px'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 20px rgba(231, 76, 60, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <div style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid #fff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }} />
                    Unsubscribing...
                  </>
                ) : (
                  'Unsubscribe'
                )}
              </button>
            </form>
            
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'transparent',
                color: '#FFA500',
                border: '1px solid #FFA500',
                padding: '12px 30px',
                borderRadius: '25px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(255, 165, 0, 0.1)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <FiArrowLeft size={16} />
              Back to Home
            </button>
          </>
        )}
      </motion.div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default UnsubscribePage;
