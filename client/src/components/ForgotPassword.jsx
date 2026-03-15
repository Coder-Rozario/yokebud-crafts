import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiFetch } from '../utils/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/user/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        toast.success(data.message || 'Password reset link sent to your email.');
      } else {
        toast.error(data.message || 'Failed to process request.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="unsubscribe-card"
        style={{ 
          maxWidth: '500px', 
          width: '100%', 
          background: 'white', 
          padding: '40px', 
          borderRadius: '20px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)' 
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ 
            width: '70px', 
            height: '70px', 
            background: '#FFF5F5', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px',
            color: '#E53E3E'
          }}>
            <FiMail size={32} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#2D3748', marginBottom: '10px' }}>
            Forgot Password?
          </h2>
          <p style={{ color: '#718096', fontSize: '16px', lineHeight: '1.6' }}>
            {isSubmitted 
              ? `We've sent a password reset link to ${email}. Please check your inbox and spam folder.`
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                style={{
                  width: '100%',
                  padding: '15px 20px',
                  borderRadius: '12px',
                  border: '2px solid #E2E8F0',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '16px',
                background: '#E53E3E',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {isLoading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setIsSubmitted(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#E53E3E',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '15px'
              }}
            >
              Try another email
            </button>
          </div>
        )}

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link 
            to="/" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              color: '#718096', 
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '15px',
              transition: 'color 0.2s'
            }}
          >
            <FiArrowLeft style={{ marginRight: '8px' }} />
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
