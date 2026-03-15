import React, { useEffect } from 'react';
import { Helmet } from "react-helmet-async";
import{
  FaTruck,
  FaBoxes,
  FaClock,
  FaGlobeEurope,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaPhone,
  FaEnvelope,
  FaChevronRight,
  FaHandHoldingHeart,
  FaPlane
} from 'react-icons/fa';
import AOS from 'aos';
import 'aos/dist/aos.css';
import logo from '../assades/logo.jpg';

const Shipping = () => {
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
  const GRADIENT_ID = "gold-gradient-shipping";

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
    display: 'block',
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

  const policyIconWrapperStyle = {
    fontSize: 'clamp(2rem, 5vw, 2.5rem)',
    marginBottom: '0.8rem',
    display: 'inline-block'
  };

  const policyTitleStyle = {
    fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
    fontWeight: '600',
    marginBottom: '0.8rem',
    background: GOLD_GRADIENT,
    width: 'max-content',
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

  const listItemStyle = {
    marginBottom: 'clamp(0.8rem, 2vw, 1rem)',
    display: 'flex',
    fontSize: 'clamp(0.85rem, 3vw, 1rem)',
    alignItems: 'flex-start',
    gap: '0.5rem',
    lineHeight: '1.6'
  };

  // SVG Gradient Style for Icons
  const svgIconStyle = {
    fill: `url(#${GRADIENT_ID})`,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
  };

  const smallIconWrapperStyle = {
    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
    marginTop: '0.3rem',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center'
  };

  const contactCardStyle = {
    background: 'rgba(255, 215, 0, 0.05)',
    border: '1px solid #B38728',
    borderRadius: '12px',
    padding: 'clamp(1.2rem, 3vw, 2rem)',
    textAlign: 'center',
  };

  return (
    <div style={pageStyle} className="shipping-page-container">
      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
        <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BF953F" />
          <stop offset="20%" stopColor="#FCF6BA" />
          <stop offset="40%" stopColor="#B38728" />
          <stop offset="60%" stopColor="#FBF5B7" />
          <stop offset="80%" stopColor="#AA771C" />
        </linearGradient>
      </svg>

      {/* Hide Scrollbar Style */}
      <style>{`
        html, body, #root, .shipping-page-container { scrollbar-width: none !important; }
        html::-webkit-scrollbar, body::-webkit-scrollbar, #root::-webkit-scrollbar, .shipping-page-container::-webkit-scrollbar {
          display: none !important; width: 0 !important; height: 0 !important; background: transparent !important;
        }
        body { -ms-overflow-style: none; overflow-y: auto; }
      `}</style>

      {/* Background logo */}
      <div style={backgroundLogoStyle} />

      <Helmet>
        <title>Yokebud Crafts - Shipping Policy</title>
        <meta name="description" content="Yokebud Crafts shipping and delivery policy for handmade resin art and custom apparel." />
      </Helmet>

      {/* Hero Section */}
      <div style={heroStyle} data-aos="fade-down">
        <div style={heroContentStyle}>
          <h1 style={heroTitleStyle} data-aos="fade-up" data-aos-delay="100">Shipping & Delivery</h1>
          <p style={heroSubtitleStyle} data-aos="fade-up" data-aos-delay="200">Handcrafted with Care, Delivered to You</p>
        </div>
      </div>

      {/* Main Content Section */}
      <div style={sectionStyle}>
        <div style={policyContainerStyle}>
          
          {/* Processing Times */}
          <div style={policyCardStyle} data-aos="fade-up">
            <div style={policyIconWrapperStyle}>
              <FaClock style={svgIconStyle} />
            </div>
            <h2 style={policyTitleStyle}>Production Time</h2>
            <p style={policyTextStyle}>Since our items are handmade to order:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaHandHoldingHeart style={svgIconStyle} /></span>
                <strong>Ready-to-Ship:</strong> Dispatched within 1-3 business days.
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaHandHoldingHeart style={svgIconStyle} /></span>
                <strong>Custom Orders:</strong> Please allow 5-10 business days for creation.
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaHandHoldingHeart style={svgIconStyle} /></span>
                <strong>Peak Seasons:</strong> During holidays, production may take an extra 2-3 days.
              </li>
            </ul>
          </div>

          {/* Shipping Methods */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="100">
            <div style={policyIconWrapperStyle}>
              <FaTruck style={svgIconStyle} />
            </div>
            <h2 style={policyTitleStyle}>Shipping Methods</h2>
            <p style={policyTextStyle}>We use reliable carriers to ensure safe delivery:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                Standard Shipping (3-7 business days)
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                Express Shipping (1-3 business days)
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                All packages are tracked and insured.
              </li>
            </ul>
          </div>

          {/* International Shipping */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="150">
            <div style={policyIconWrapperStyle}>
              <FaPlane style={svgIconStyle} />
            </div>
            <h2 style={policyTitleStyle}>International Shipping</h2>
            <p style={policyTextStyle}>Sending handcrafted joy worldwide:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaGlobeEurope style={svgIconStyle} /></span>
                Standard International: 7-21 business days.
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaGlobeEurope style={svgIconStyle} /></span>
                Customs fees/duties are the responsibility of the buyer.
              </li>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaGlobeEurope style={svgIconStyle} /></span>
                Delays due to customs are out of our control.
              </li>
            </ul>
          </div>

          {/* Shipping Costs */}
          <div style={policyCardStyle} data-aos="fade-up" data-aos-delay="200">
            <div style={policyIconWrapperStyle}>
              <FaMoneyBillWave style={svgIconStyle} />
            </div>
            <h2 style={policyTitleStyle}>Shipping Costs</h2>
            <p style={policyTextStyle}>Transparent pricing for your peace of mind:</p>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                Calculated at checkout based on weight & location.
              </li>

              <li style={listItemStyle}>
                <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                Combined shipping available for multiple items.
              </li>
            </ul>
          </div>
        </div>

        {/* Additional Shipping Info */}
        <div style={{
          background: 'rgba(20, 20, 20, 0.8)',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginTop: '2rem',
          backdropFilter: 'blur(10px)'
        }} data-aos="fade-up">
          <h2 style={{...policyTitleStyle, textAlign: 'center', display: 'block'}}>Important Notes</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <div data-aos="fade-up" data-aos-delay="100">
              <h3 style={{...policyTitleStyle, fontSize: 'clamp(1rem, 3vw, 1.2rem)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <FaBoxes style={svgIconStyle} /> Order Tracking
              </h3>
              <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
                <li style={listItemStyle}>
                  <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                  You'll receive a tracking number via email as soon as your package ships.
                </li>
              </ul>
            </div>
            <div data-aos="fade-up" data-aos-delay="150">
              <h3 style={{...policyTitleStyle, fontSize: 'clamp(1rem, 3vw, 1.2rem)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <FaExclamationTriangle style={svgIconStyle} /> Lost/Damaged Packages
              </h3>
              <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
                <li style={listItemStyle}>
                  <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                  Please report damaged items within 48 hours of delivery with photos.
                </li>
                <li style={listItemStyle}>
                  <span style={smallIconWrapperStyle}><FaChevronRight style={svgIconStyle} /></span>
                  We are not responsible for packages lost due to incorrect addresses provided.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div style={{...sectionStyle, borderBottom: '1px solid rgba(238, 205, 160, 0.1)'}}>
        <h2 style={sectionTitleStyle} data-aos="fade-right">Need Assistance?</h2>
        <div style={contactCardStyle} data-aos="zoom-in">
          <p style={{marginBottom: '1rem', fontSize: 'clamp(0.8rem, 3vw, 1rem)'}} data-aos="fade-up" data-aos-delay="100">
            Questions about your shipment or delivery status?
          </p>
          <p style={{fontWeight: '600', marginBottom: '1.5rem', fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', color: '#fff'}} data-aos="fade-up" data-aos-delay="150">
            Yokebud Crafts Logistics
          </p>
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap'}}>
            <p style={{...listItemStyle, fontSize: 'clamp(0.7rem, 3vw, 0.9rem)', margin: 0}} data-aos="fade-up" data-aos-delay="200">
              <span style={{...smallIconWrapperStyle, marginRight: '5px'}}><FaEnvelope style={svgIconStyle} /></span>Email: yokebud@gmail.com
            </p>
            <p style={{...listItemStyle, fontSize: 'clamp(0.7rem, 3vw, 0.9rem)', margin: 0}} data-aos="fade-up" data-aos-delay="250">
              <span style={{...smallIconWrapperStyle, marginRight: '5px'}}><FaPhone style={svgIconStyle} /></span>Phone: +358 440 328 124
            </p>
          </div>
          <p style={{marginTop: '1rem', fontSize: 'clamp(0.7rem, 3vw, 0.9rem)', color: '#ccc'}} data-aos="fade-up" data-aos-delay="300">
            Pukinmäenaukio 4, 00720 Helsinki, Finland
          </p>
        </div>
      </div>

      <div style={{
        padding: '1.5rem 5%',
        borderTop: '1px solid rgba(238, 205, 160, 0.1)',
        fontSize: 'clamp(0.7rem, 3vw, 0.9rem)',
        marginBottom: '1.5rem',
        color: '#888',
        textAlign: 'center'
      }} data-aos="fade-up">
        <p>© {new Date().getFullYear()} Yokebud Crafts. All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default Shipping;