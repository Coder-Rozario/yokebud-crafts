import React, { useEffect, useState } from 'react';
import { Helmet } from "react-helmet-async";
import { 
  FaExchangeAlt, 
  FaBoxOpen, 
  FaShippingFast, 
  FaMoneyBillWave,
  FaPhone,
  FaEnvelope,
  FaChevronRight,
  FaExclamationTriangle,
  FaHandSparkles
} from 'react-icons/fa';
import AOS from 'aos';
import 'aos/dist/aos.css';
import logo from '../assades/logo.jpg';

const Return = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSmallDevice, setIsSmallDevice] = useState(false);

  // --- CONSTANTS ---
  const GOLD_GRADIENT = 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)';

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallDevice(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Simulate API loading
  useEffect(() => {
    const simulateApiLoading = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };
    simulateApiLoading();
  }, []);

  // Initialize AOS
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: false,
      mirror: true
    });
  }, []);

  // --- STYLES ---
  const pageStyle = {
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: "'Montserrat', sans-serif",
    position: 'relative',
    overflowX: 'hidden',
    minHeight: '100vh',
    height: 'auto',
    padding: '0',
  };

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

  const sectionStyle = {
    padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1rem, 5vw, 5%)',
    position: 'relative',
    zIndex: 1,
  };

  const sectionTitleStyle = {
    fontSize: 'clamp(1.5rem, 5vw, 1.8rem)',
    marginBottom: '1.5rem',
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

  const heroSubtitleStyle = {
    fontSize: 'clamp(1rem, 3vw, 1.2rem)',
    fontWeight: '300',
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block'
  };

  const listItemStyle = {
    marginBottom: 'clamp(0.8rem, 2vw, 1rem)',
    display: 'flex',
    fontSize: 'clamp(0.85rem, 3vw, 1rem)',
    alignItems: 'flex-start',
    gap: '0.5rem',
    lineHeight: '1.6'
  };

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

  const policyContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    position: 'relative',
    zIndex: 1,
  };

  const policyCardStyle = {
    background: 'rgba(20, 20, 20, 0.8)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: '1.5rem',
    transition: 'all 0.3s ease',
    color: '#fff',
    marginBottom: '0',
    backdropFilter: 'blur(10px)'
  };

  const policyIconStyle = {
    fontSize: 'clamp(2rem, 5vw, 2.5rem)',
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.8rem',
    display: 'inline-block'
  };

  const policyTitleStyle = {
    fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
    fontWeight: '600',
    marginBottom: '0.8rem',
    background: GOLD_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'block'
  };

  const policyTextStyle = {
    lineHeight: '1.6',
    marginBottom: '1.2rem',
    color: '#ddd',
    fontSize: 'clamp(0.85rem, 3vw, 1rem)',
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

  // Responsive Loading Component
  const ResponsiveLoading = () => {
    if (!isLoading || !isSmallDevice) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '100vh',
        backgroundColor: '#050505',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '90vw'
        }}>
          <div style={{
            animation: 'pulse 2s infinite',
            marginBottom: '5vh',
            background: 'radial-gradient(circle, rgba(255,165,0,0.1) 0%, rgba(255,165,0,0) 70%)',
            borderRadius: '50%',
            padding: '20px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '150%',
              height: '150%',
              border: '2px solid rgba(255, 215, 0, 0.2)',
              borderRadius: '50%',
              animation: 'ripple 2s infinite'
            }} />
            <img
              src={logo}
              alt="Loading Logo"
              style={{
                width: 'min(25vw, 120px)',
                height: 'auto',
                borderRadius: '10px',
                filter: `drop-shadow(0 0 10px rgba(255, 168, 0, 0.6))`
              }}
            />
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 'clamp(12px, 3vw, 16px)',
            fontFamily: '"Helvetica Neue", sans-serif',
            fontWeight: 300,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '20px',
            animation: 'fadeInOut 1.5s infinite'
          }}>
            Loading Return Policy
          </div>
        </div>
        <style>{`
          @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.7; } }
          @keyframes ripple { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
          @keyframes fadeInOut { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        `}</style>
      </div>
    );
  };

  return (
    <div style={pageStyle} className="return-page-container">
      {/* Hide Scrollbar Style */}
      <style>{`
        /* For Firefox */
        html, body, #root, .return-page-container {
          scrollbar-width: none !important;
        }
        /* For Chrome, Safari, and Opera */
        html::-webkit-scrollbar, 
        body::-webkit-scrollbar, 
        #root::-webkit-scrollbar, 
        .return-page-container::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        /* Ensure content flows correctly */
        body {
          -ms-overflow-style: none; 
          overflow-y: auto; 
        }
      `}</style>

      <ResponsiveLoading />
      <div style={backgroundLogoStyle} />

      <Helmet>
        <title>Yokebud Crafts - Returns Policy</title>
        <meta name="description" content="Yokebud Crafts returns and refunds policy for handmade items." />
      </Helmet>

      {/* Hero Section */}
      <div style={heroStyle} data-aos="fade-down">
        <div style={heroContentStyle}>
          <h1 style={heroTitleStyle} data-aos="fade-up" data-aos-delay="100">Returns & Refunds</h1>
          <p style={heroSubtitleStyle} data-aos="fade-up" data-aos-delay="200">Transparency & Customer Care</p>
        </div>
      </div>

      {/* Main Content Section */}
      <div style={sectionStyle}>
        <div style={policyContainerStyle}>
          
          {/* Return Process */}
          <div style={policyCardStyle} data-aos="fade-up">
            <div style={policyIconStyle}><FaExchangeAlt /></div>
            <h2 style={policyTitleStyle}>Return Process</h2>
            <p style={policyTextStyle}>For ready-to-ship items:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Contact us within 14 days of delivery</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Provide order number & reason</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Wait for return authorization email</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Ship item back in original condition</li>
            </ul>
          </div>

          {/* Eligibility */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="100">
            <div style={policyIconStyle}><FaBoxOpen /></div>
            <h2 style={policyTitleStyle}>Eligibility</h2>
            <p style={policyTextStyle}>To be eligible for a return:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Item must be unused & in original box</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>No signs of wear or damage</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Must not be a custom order</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Return initiated within 14 days</li>
            </ul>
          </div>

          {/* Damaged Items */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="150">
            <div style={policyIconStyle}><FaExclamationTriangle /></div>
            <h2 style={policyTitleStyle}>Damaged Items</h2>
            <p style={policyTextStyle}>If your handmade item arrives broken:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Contact us within 48 hours</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Send clear photos of the damage</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Send photos of the packaging</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>We will arrange a replacement</li>
            </ul>
          </div>

          {/* Refund Process */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="200">
            <div style={policyIconStyle}><FaMoneyBillWave /></div>
            <h2 style={policyTitleStyle}>Refunds</h2>
            <p style={policyTextStyle}>Once we inspect your return:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Inspection takes 2-3 business days</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Refund to original payment method</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Funds take 5-10 days to appear</li>
              <li style={listItemStyle}><span style={iconStyle}><FaChevronRight /></span>Shipping costs are non-refundable</li>
            </ul>
          </div>
        </div>

        {/* Non-Returnable Items */}
        <div style={{...cardStyle, marginTop: '2rem'}} data-aos="fade-up">
          <h2 style={{...policyTitleStyle, textAlign: 'center', display: 'block', fontSize: '1.8rem'}}>Non-Returnable Items</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <div data-aos="fade-up" data-aos-delay="100" style={{background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '10px'}}>
              <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
                <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><div><strong>Custom Orders:</strong> Items made specifically for you (names, dates, custom colors) cannot be returned.</div></li>
                <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><div><strong>Sale Items:</strong> Clearance or final sale items are not eligible for return.</div></li>
              </ul>
            </div>
            <div data-aos="fade-up" data-aos-delay="150" style={{background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '10px'}}>
              <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
                <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><div><strong>Used Items:</strong> Any item that has been used, washed, or altered in any way.</div></li>
                <li style={listItemStyle}><span style={iconStyle}><FaHandSparkles /></span><div><strong>Gift Cards:</strong> Gift cards are non-refundable.</div></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(255, 215, 0, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Need Help?</h2>
        <div style={contactCardStyle} data-aos="zoom-in">
          <p style={{marginBottom: '1.2rem', fontSize: 'clamp(0.9rem, 3vw, 1.1rem)'}} data-aos="fade-up" data-aos-delay="100">
            Questions about a return or issue with your order?
          </p>
          <p style={{fontWeight: '600', marginBottom: '1.5rem', fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: '#fff'}} data-aos="fade-up" data-aos-delay="150">
            Yokebud Crafts Support
          </p>
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap'}}>
            <p style={{...listItemStyle, fontSize: 'clamp(0.9rem, 3vw, 1rem)', margin: 0}} data-aos="fade-up" data-aos-delay="200">
              <span style={iconStyle}><FaEnvelope /></span>Email: returns@yokebud.com
            </p>
            <p style={{...listItemStyle, fontSize: 'clamp(0.9rem, 3vw, 1rem)', margin: 0}} data-aos="fade-up" data-aos-delay="250">
              <span style={iconStyle}><FaPhone /></span>Phone: +358 440 328 124
            </p>
          </div>
          <p style={{marginTop: '1rem', fontSize: 'clamp(0.8rem, 3vw, 0.9rem)', color: '#ccc'}} data-aos="fade-up" data-aos-delay="300">
            Pukinmäenaukio 4, 00720 Helsinki, Finland
          </p>
        </div>
      </div>

      <div style={{
        padding: 'clamp(1rem, 3vw, 2rem) clamp(5%, 10vw, 10%)',
        borderTop: '1px solid rgba(255, 215, 0, 0.1)',
        fontSize: 'clamp(0.75rem, 3vw, 0.85rem)',
        color: '#888',
        textAlign: 'center',
        marginBottom: '20px'
      }} data-aos="fade-up">
        <p>© {new Date().getFullYear()} Yokebud Crafts. All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default Return;