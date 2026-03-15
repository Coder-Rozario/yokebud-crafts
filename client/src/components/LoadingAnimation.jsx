import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// Make sure this asset path is correct relative to the importing component
// If the logo does not load, double-check the '../assades/loading logo.png' path
import logo from '../assades/loading logo.png'; 

const LoadingAnimation = () => {
  const [message, setMessage] = useState('Loading');
  const messages = ['Loading', 'Please wait'];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessage(prev => {
        const currentIndex = messages.indexOf(prev);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [messages]);

  return (
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
          marginBottom: '5vh', // Adjust vertical spacing as needed, for example '20px'
          background: 'radial-gradient(circle, rgba(255,165,0,0.1) 0%, rgba(255,165,0,0) 70%)',
        }}
      >
        <img
          src={logo}
          alt="Loading Logo"
          style={{
            width: 'min(20vw, 160px)', // Reduce this value if you want a smaller logo
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


      {/* Animated text with cycling messages */}
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          height: '30px',
          flexWrap: 'wrap'
        }}
      >
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <motion.span
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 'clamp(10px, 2vw, 15px)',
              fontFamily: '"Helvetica Neue", sans-serif',
              fontWeight: 300,
              letterSpacing: '3px',
              textTransform: 'uppercase'
            }}
          >
            {message}
          </motion.span>

          {/* Animated dots - only show for "Loading" message */}
          {message === 'Loading' && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatDelay: 0.6
                  }}
                  style={{
                    color: '#FFD700',
                    fontSize: 'clamp(20px, 5vw, 28px)',
                    lineHeight: 0
                  }}
                >
                  .
                </motion.span>
              ))}
            </>
          )}
        </motion.div>
      </motion.div>

      
    </motion.div>
  );
};

export default LoadingAnimation;
