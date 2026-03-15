import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logo from '../assades/loading logo.png'; // Make sure this path is correct

const Loading = () => {
  const [message, setMessage] = useState('Loading');
  const [showRetry, setShowRetry] = useState(false);
  const messages = ['Loading', 'Please wait', 'Preparing your experience', 'Handcrafting with care'];

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRetry(true);
    }, 12000); // Show retry after 12 seconds

    const interval = setInterval(() => {
      setMessage(prev => {
        const currentIndex = messages.indexOf(prev);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      backgroundColor: '#050505',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      padding: '20px',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000 // High but not blocking everything
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          maxWidth: '90vw'
        }}
      >
        {/* Animated logo with glowing effect */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{
            scale: [0.9, 1.05, 0.95, 1],
            opacity: [0, 1],
          }}
          transition={{
            duration: 3,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'mirror',
          }}
          style={{
            borderRadius: '50%',
            marginBottom: '5vh',
            background: 'radial-gradient(circle, rgba(255,165,0,0.1) 0%, rgba(255,165,0,0) 70%)',
          }}
        >
          <img
            src={logo}
            alt="Loading Logo"
            style={{
              width: 'min(25vw, 170px)',
              height: 'auto',
              borderRadius: '10px',
              filter: `
                drop-shadow(0 0 10px rgba(255, 168, 0, 0.6))
                drop-shadow(0 0 20px rgba(255, 200, 0, 0.4))
                drop-shadow(0 0 30px rgba(255, 168, 0, 0.3))
              `
            }}
          />
        </motion.div>

        {/* Animated gradient progress bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '180px' }}
          transition={{
            duration: 2.5,
            delay: 0.5,
            ease: [0.43, 0.13, 0.23, 0.96]
          }}
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, #FFA500, #FFD700, #FFA500)',
            borderRadius: '4px',
            marginBottom: '15px',
            boxShadow: '0 0 8px rgba(255,165,0,0.6)'
          }}
        />

        {/* Animated text with cycling messages */}
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 'min(4vw, 16px)',
            fontWeight: 500,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '20px'
          }}
        >
          {message}
          {message === 'Loading' && (
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ color: '#FFD700', marginLeft: '5px' }}
            >
              ...
            </motion.span>
          )}
        </motion.div>

        {showRetry && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728)',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '25px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '10px',
              boxShadow: '0 4px 15px rgba(191, 149, 63, 0.4)'
            }}
          >
            Refresh Page
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default Loading;
