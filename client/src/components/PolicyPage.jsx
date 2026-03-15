import React, { useEffect } from 'react';
import { Helmet } from "react-helmet-async";
import { FaChevronRight, FaShieldAlt, FaFileContract, FaExchangeAlt, FaLock, FaEnvelope, FaPhone, FaHandSparkles, FaShippingFast } from 'react-icons/fa';
import { FaTshirt } from 'react-icons/fa'; 
import AOS from 'aos';
import 'aos/dist/aos.css';
import logo from '../assades/logo.jpg';

const PolicyPage = () => {
  // Initialize AOS
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: false,
      mirror: true
    });
  }, []);

  // --- CONSTANTS ---
  const GOLD_GRADIENT = 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)';

  // Main container style
  const pageStyle = {
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: "'Montserrat', sans-serif",
    position: 'relative',
    overflowX: 'hidden',
    minHeight: '100vh', // Minimum full viewport height
    height: 'auto',      // Grow as much as needed
    padding: '0',
  };

  // Background logo style
  const backgroundLogoStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 0,
    opacity: 0.10, 
    width: '100%',
    maxWidth: '800px',
    height: '100%',
    backgroundImage: `url(${logo})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    backgroundPositionY: '70px',
    pointerEvents: 'none'
  };

  // Styles
  const sectionStyle = {
    padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1rem, 5vw, 5%)',
    position: 'relative',
    zIndex: 1,
  };

  // UPDATED: Title Style with Gold Gradient
  const sectionTitleStyle = {
    fontSize: 'clamp(1.3rem, 4vw, 1.5rem)',
    marginBottom: 'clamp(1rem, 3vw, 2rem)',
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    position: 'relative',
    display: 'inline-block',
    fontWeight: '700'
  };

  const heroStyle = {
    height: 'clamp(25vh, 30vw, 30vh)',
    minHeight: '200px',
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    background: 'linear-gradient(to bottom, #000000, #1a1a1a)'
  };

  const heroContentStyle = {
    textAlign: 'center',
    maxWidth: '800px',
    padding: 'clamp(1rem, 3vw, 2rem)',
  };

  const heroTitleStyle = {
    fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
    fontWeight: '600',
    marginBottom: 'clamp(0.8rem, 2vw, 1rem)',
    color: '#fff',
    textShadow: '0 0 15px rgba(255, 215, 0, 0.3)',
  };

  // UPDATED: Hero Subtitle with Gradient
  const heroSubtitleStyle = {
    fontSize: 'clamp(1rem, 3vw, 1.2rem)',
    fontWeight: '300',
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block'
  };

  const cardStyle = {
    background: 'rgba(20, 20, 20, 0.8)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: 'clamp(1.2rem, 3vw, 2rem)',
    marginBottom: 'clamp(1.2rem, 3vw, 2rem)',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)'
  };

  const listItemStyle = {
    marginBottom: 'clamp(0.8rem, 2vw, 1rem)',
    display: 'flex',
    fontSize: 'clamp(0.85rem, 3vw, 1rem)',
    alignItems: 'flex-start',
    gap: '0.5rem',
    lineHeight: '1.6'
  };

  // UPDATED: Icon Style with Gold Gradient
  const iconStyle = {
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
    marginTop: '0.3rem',
    flexShrink: '0',
    display: 'inline-block' 
  };

  const contactCardStyle = {
    background: 'rgba(255, 215, 0, 0.05)',
    border: '1px solid #B38728', 
    borderRadius: '12px',
    padding: 'clamp(1.2rem, 3vw, 2rem)',
    textAlign: 'center',
  };

  return (
    <div style={pageStyle} className="policy-page-container">
      {/* NO SCROLLBAR CSS:
        Hides the visual scrollbar/slider for HTML, Body, and Container 
        while keeping the scrolling functionality active.
      */}
      <style>{`
        /* For Firefox */
        html, body, #root, .policy-page-container {
          scrollbar-width: none !important;
        }
        
        /* For Chrome, Safari, and Opera */
        html::-webkit-scrollbar, 
        body::-webkit-scrollbar, 
        #root::-webkit-scrollbar, 
        .policy-page-container::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }

        /* Ensure content flows correctly */
        body {
          -ms-overflow-style: none;  /* IE and Edge */
          overflow-y: auto; /* Allows scrolling */
        }
      `}</style>

      {/* Background logo */}
      <div style={backgroundLogoStyle} />

      <Helmet>
        <title>Yokebud Crafts - Store Policies</title>
        <meta name="description" content="Yokebud Crafts policies including shipping, handmade disclaimers, custom orders, and returns." />
      </Helmet>

      {/* Hero Section */}
      <div style={heroStyle} data-aos="fade-down">
        <div style={heroContentStyle}>
          <h1 style={heroTitleStyle} data-aos="fade-up" data-aos-delay="100">Store Policies</h1>
          <p style={heroSubtitleStyle} data-aos="fade-up" data-aos-delay="200">Transparency, Quality & Craftsmanship</p>
        </div>
      </div>

      {/* Handmade & Customization Disclaimer */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(255, 215, 0, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Handmade & Custom Products</h2>
        <div style={cardStyle} data-aos="fade-up">
          <p style={{fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', marginBottom: '1.5rem'}}>
            At Yokebud Crafts, every resin piece and custom apparel item is handcrafted with care.
          </p>
          
          <div style={{marginBottom: 'clamp(1.2rem, 3vw, 2rem)'}} data-aos="fade-up" data-aos-delay="100">
            <h3 style={{...sectionTitleStyle, fontSize: '1.2rem', margin: '0 0 1rem'}}>Resin Art Uniqueness:</h3>
            <ul style={{paddingLeft: '0', listStyle: 'none'}}>
              <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><strong>Unique Variations:</strong> Due to the fluid nature of resin, no two designs will be exactly identical. Small bubbles or slight color variations are natural characteristics of handmade resin art.</li>
              <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><strong>Care Instructions:</strong> Resin items should be kept away from direct prolonged sunlight and extreme heat to prevent yellowing or softening.</li>
            </ul>
          </div>

          <div data-aos="fade-up" data-aos-delay="150">
            <h3 style={{...sectionTitleStyle, fontSize: '1.2rem', margin: '0 0 1rem'}}>Custom Apparel:</h3>
            <ul style={{paddingLeft: '0', listStyle: 'none'}}>
              <li style={listItemStyle}><span style={iconStyle}><FaTshirt /></span><strong>Production Time:</strong> Custom printed or embroidered items require 3-7 business days for production before shipping.</li>
              <li style={listItemStyle}><span style={iconStyle}><FaTshirt /></span><strong>Color Accuracy:</strong> Actual product colors may vary slightly from what appears on your screen due to monitor settings and fabric dyeing processes.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Shipping Policy */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(255, 215, 0, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Shipping & Delivery</h2>
        <div style={cardStyle} data-aos="fade-up">
          <ul style={{paddingLeft: '0', listStyle: 'none'}} data-aos="fade-up" data-aos-delay="100">
            <li style={listItemStyle}><span style={iconStyle}><FaShippingFast /></span><strong>Processing Time:</strong> Ready-made items ship within 1-3 business days. Custom orders ship within 5-10 business days.</li>
            <li style={listItemStyle}><span style={iconStyle}><FaShippingFast /></span><strong>International Shipping:</strong> We ship worldwide. International customers are responsible for any customs or import duties that may apply.</li>
            <li style={listItemStyle}><span style={iconStyle}><FaShippingFast /></span><strong>Tracking:</strong> Once your order is dispatched, you will receive a tracking number via email.</li>
            <li style={listItemStyle}><span style={iconStyle}><FaShippingFast /></span><strong>Delays:</strong> Yokebud Crafts is not responsible for delays caused by customs or courier services.</li>
          </ul>
        </div>
      </div>

      {/* Return & Refund Policy */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(255, 215, 0, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Returns & Refunds</h2>
        <div style={cardStyle} data-aos="fade-up">
          <div style={{marginBottom: '1.5rem'}}>
            <h3 style={{...sectionTitleStyle, fontSize: '1.2rem'}}>Custom & Personalized Items:</h3>
            <p style={listItemStyle}>Due to the personalized nature of custom apparel and resin art, <strong>we cannot accept returns or exchanges</strong> unless the item arrives damaged or defective.</p>
          </div>

          <div>
            <h3 style={{...sectionTitleStyle, fontSize: '1.2rem'}}>Ready-to-Ship Items:</h3>
            <ul style={{paddingLeft: '0', listStyle: 'none'}}>
              <li style={listItemStyle}><span style={iconStyle}><FaExchangeAlt /></span>Returns accepted within 14 days of delivery.</li>
              <li style={listItemStyle}><span style={iconStyle}><FaExchangeAlt /></span>Items must be unused and in original packaging.</li>
              <li style={listItemStyle}><span style={iconStyle}><FaExchangeAlt /></span>Buyers are responsible for return shipping costs.</li>
              <li style={listItemStyle}><span style={iconStyle}><FaExchangeAlt /></span><strong>Damaged Items:</strong> Please contact us within 48 hours of delivery with photos if your item arrives damaged.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(255, 215, 0, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Privacy & Data Security</h2>
        <div style={cardStyle} data-aos="fade-up">
          <p style={{marginBottom: '1rem'}}>Your trust is essential to our craft.</p>
          <ul style={{paddingLeft: '0', listStyle: 'none'}} data-aos="fade-up" data-aos-delay="150">
            <li style={listItemStyle}><span style={iconStyle}><FaLock /></span>We only collect information necessary to process your order (Name, Shipping Address, Email).</li>
            <li style={listItemStyle}><span style={iconStyle}><FaLock /></span>All payments are processed through secure, encrypted gateways (Stripe/PayPal). We do not store your credit card details.</li>
            <li style={listItemStyle}><span style={iconStyle}><FaLock /></span>We do not sell or share your personal data with third parties for marketing purposes.</li>
          </ul>
        </div>
      </div>

      {/* Contact Information */}
      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Contact Us</h2>
        <div style={contactCardStyle} data-aos="zoom-in">
          <p style={{marginBottom: 'clamp(1rem, 2vw, 1.5rem)', fontSize: 'clamp(0.9rem, 3vw, 1.1rem)'}} data-aos="fade-up" data-aos-delay="100">
            Have questions about a custom order or product care?
          </p>
          <p style={{fontWeight: '600', marginBottom: 'clamp(1.5rem, 3vw, 2.5rem)', fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: '#fff'}} data-aos="fade-up" data-aos-delay="150">
            Yokebud Crafts Support Team
          </p>
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 'clamp(1rem, 3vw, 2.3rem)', flexWrap: 'wrap'}}>
            <p style={{...listItemStyle, fontSize: 'clamp(0.9rem, 3vw, 1rem)', margin: 0}} data-aos="fade-up" data-aos-delay="200">
              <span style={iconStyle}><FaEnvelope /></span> Email: Info@yokebud.com
            </p>
            <p style={{...listItemStyle, fontSize: 'clamp(0.9rem, 3vw, 1rem)', margin: 0}} data-aos="fade-up" data-aos-delay="250">
              <span style={iconStyle}><FaPhone /></span> Phone: +358 440 328 124
            </p>
          </div>
          <p style={{marginTop: 'clamp(1rem, 2vw, 1.5rem)', fontSize: 'clamp(0.8rem, 3vw, 0.9rem)', color: '#ccc'}} data-aos="fade-up" data-aos-delay="300">
            Pukinmäenaukio 4, 00720 Helsinki, Finland
          </p>
        </div>
      </div>

      <div style={{
        padding: 'clamp(1rem, 3vw, 2rem) clamp(5%, 10vw, 10%)',
        borderTop: '1px solid rgba(255, 215, 0, 0.1)',
        fontSize: 'clamp(0.75rem, 3vw, 0.85rem)',
        color: '#888',
        marginBottom: 'clamp(1rem, 2vw, 2rem)',
        textAlign: 'center'
      }} data-aos="fade-up">
        <p>© {new Date().getFullYear()} Yokebud Crafts. All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default PolicyPage;