// src/components/CartItem.jsx
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMessageCircle, FiTrash2 } from 'react-icons/fi';
import { useCart } from '../pages/context/CartContext';
import { useNavigate } from 'react-router-dom';

const CartItem = ({ item, index }) => {
  const { removeFromCart } = useCart();
  const navigate = useNavigate();

  const handleRemove = () => {
    removeFromCart(item.id);
  };

  const handleInquiry = () => {
    // Navigate to inquiry page with product data
    navigate('/inquiry', { 
      state: { 
        product: {
          ...item,
          selectedSize: item.selectedSize || 'Customizable',
          quantity: item.quantity || 1,
          // Ensure all necessary fields are included
          name: item.name,
          product_name: item.name,
          price: item.price,
          min_price: item.price,
          max_price: item.price
        }
      } 
    });
  };

  const nameContainerRef = useRef(null);
  const nameTextRef = useRef(null);
  const [marquee, setMarquee] = useState({ enabled: false, duration: 0, distance: 0 });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHoveringImage, setIsHoveringImage] = useState(false);

  const rawPhotos = Array.isArray(item.product_photos) ? item.product_photos.filter(Boolean) : [];
  const photos = rawPhotos.length > 0 ? rawPhotos : [item.image].filter(Boolean);
  const normalizeUrl = (p) => {
    if (!p) return '';
    if (typeof p !== 'string') return '';
    if (p.startsWith('http')) return p;
    return `https://api.yokebud.fi${p.startsWith('/') ? '' : '/'}${p}`;
  };

  useEffect(() => {
    const measure = () => {
      if (!nameContainerRef.current || !nameTextRef.current) return;
      const containerWidth = nameContainerRef.current.clientWidth;
      const textWidth = nameTextRef.current.scrollWidth;
      const distance = Math.max(textWidth - containerWidth, 0);

      if (distance <= 2) {
        setMarquee({ enabled: false, duration: 0, distance: 0 });
        return;
      }

      const length = (item.name || '').length;
      const base = 30; // px/s
      const perChar = 1.2; // px/s per char
      const minSpeed = 40; // readability floor
      const maxSpeed = 180; // readability ceiling
      const speed = Math.min(maxSpeed, Math.max(minSpeed, base + length * perChar));
      const movingDuration = distance / speed;

      setMarquee({ enabled: true, duration: movingDuration, distance });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [item.name]);

  useEffect(() => {
    const el = nameTextRef.current;
    if (!el || !marquee.enabled) return;

    el.style.setProperty('--cart-marquee-distance', `${marquee.distance}px`);

    el.style.animationPlayState = 'paused';
    const startTimer = setTimeout(() => {
      el.style.animationPlayState = 'running';
    }, 500);

    const onIter = () => {
      el.style.animationPlayState = 'paused';
      setTimeout(() => {
        el.style.animationPlayState = 'running';
      }, 500);
    };

    el.addEventListener('animationiteration', onIter);
    return () => {
      clearTimeout(startTimer);
      el.removeEventListener('animationiteration', onIter);
    };
  }, [marquee]);

  useEffect(() => {
    if (photos.length <= 1) return;
    let interval;
    if (!isHoveringImage) {
      interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % photos.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [photos.length, isHoveringImage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      style={{
        display: 'flex',
        background: 'rgba(30, 30, 30, 0.8)',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 215, 0, 0.1)',
        boxShadow: '0 5px 20px rgba(0, 0, 0, 0.2)',
        gap: '1.5rem',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '8px',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#000',
          position: 'relative'
        }}
        onMouseEnter={() => setIsHoveringImage(true)}
        onMouseLeave={() => setIsHoveringImage(false)}
      >
        <motion.img
          key={photos[currentImageIndex]}
          src={normalizeUrl(photos[currentImageIndex])}
          alt={item.name}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: isHoveringImage ? 1.02 : 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center'
          }}
          onError={(e) => {
            e.target.style.backgroundColor = '#2a2a2a';
            e.target.style.display = 'flex';
            e.target.style.alignItems = 'center';
            e.target.style.justifyContent = 'center';
            e.target.style.color = '#FFA500';
          }}
        />
        {photos.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4,
              padding: '2px 6px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.35)'
            }}
          >
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === currentImageIndex ? '#FFD700' : 'rgba(255,255,255,0.5)'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Details */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div ref={nameContainerRef} style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <h3
            ref={nameTextRef}
            style={{
              color: '#fff',
              fontSize: '1.2rem',
              fontWeight: '600',
              margin: 0,
              lineHeight: '1.3',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              willChange: 'transform',
              animationName: marquee.enabled ? 'cart-marquee' : 'none',
              animationDuration: marquee.enabled ? `${Math.max(marquee.duration, 0.1)}s` : '0s',
              animationTimingFunction: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
              animationIterationCount: 'infinite',
              animationFillMode: 'both'
            }}
          >
            {item.name}
          </h3>
        </div>

        {item.selectedSize && (
          <div style={{
            display: 'inline-block',
            background: 'rgba(255, 215, 0, 0.1)',
            color: '#FFD700',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}>
            Size: {item.selectedSize}
          </div>
        )}

        {/* Price Range Display - Min and Max Price */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {item.priceRange ? (
            <span style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}>
              {item.priceRange}
            </span>
          ) : (item.min_price && item.max_price) ? (
            <span style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}>
              ${item.min_price} - ${item.max_price}
            </span>
          ) : item.price ? (
            <span style={{
              fontSize: '1rem',
              fontWeight: '700',
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}>
              ${item.price}
            </span>
          ) : (
            <span style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}>
              Price on inquiry
            </span>
          )}
        </div>

        {/* Product Specifications */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          fontSize: '0.9rem',
          color: '#ccc'
        }}>
          {item.moq && (
            <span>MOQ: {item.moq} pieces</span>
          )}
          {item.quantity && (
            <span>Quantity: {item.quantity} pieces</span>
          )}
          {item.specifications && (
            <span>Specs: {item.specifications}</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        alignItems: 'center'
      }}>
        {/* Inquiry Button */}
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 215, 0, 0.2)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleInquiry}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(255, 215, 0, 0.1)',
            color: '#FFD700',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            minWidth: '140px',
            justifyContent: 'center'
          }}
        >
          <FiMessageCircle style={{ fontSize: '1.1rem' }} />
          Inquire Now
        </motion.button>

        {/* Remove Button */}
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRemove}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            minWidth: '140px',
            justifyContent: 'center'
          }}
        >
          <FiTrash2 style={{ fontSize: '1.1rem' }} />
          Remove
        </motion.button>
      </div>

      
      <style>
        {`
          @keyframes cart-marquee {
            from { transform: translateX(calc(-1 * var(--cart-marquee-distance))); }
            to { transform: translateX(0); }
          }
        `}
      </style>
    </motion.div>
  );
};

export default CartItem;
