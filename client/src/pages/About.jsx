import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import { 
  FaGem, 
  FaTshirt, 
  FaGlobeAmericas, 
  FaLeaf, 
  FaFingerprint, 
  FaShippingFast, 
  FaArrowRight, 
  FaCrown, 
  FaStar, 
  FaHeart, 
  FaGift, 
  FaCheck,
  FaPalette, // Added for the design section
  FaMagic, // Added for the engraving section
  FaTools
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

// --- Images ---
import aboutImage from '../assades/About-1.jpeg'; // Resin Image
import aboutImage2 from '../assades/About-2.png'; // Clothing Image
import engravingImage from '../assades/engraving.jpg'; // Engraving Image
import bglogoimg from '../assades/logo.jpg'; // Logo

// --- THEME CONFIGURATION ---
const THEME = {
  dark: '#050505',
  glass: 'rgba(20, 20, 20, 0.4)',
  glassBorder: 'rgba(191, 149, 63, 0.3)',
  goldGradient: 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
  goldSolid: '#D4AF37', 
  textSecondary: '#b0b0b0'
};

// --- HELPER COMPONENTS ---

const GoldIcon = ({ Icon, size = '2rem' }) => (
  <div style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }}>
    <svg width={0} height={0}>
      <linearGradient id="gold-gradient-fill" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop stopColor="#BF953F" offset="0%" />
        <stop stopColor="#FCF6BA" offset="25%" />
        <stop stopColor="#B38728" offset="50%" />
        <stop stopColor="#FBF5B7" offset="75%" />
        <stop stopColor="#AA771C" offset="100%" />
      </linearGradient>
    </svg>
    <Icon style={{ fontSize: size, fill: "url(#gold-gradient-fill)", filter: 'drop-shadow(0 0 8px rgba(191, 149, 63, 0.4))', display: 'inline-block', verticalAlign: 'middle' }} />
  </div>
);

const Reveal = ({ children, delay = 0, style }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(5px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

const AutoFloat = ({ children, duration = 4 }) => {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: duration, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};

const Section = ({ children, isMobile, style }) => (
  <section style={{ 
    maxWidth: '1400px', 
    margin: '0 auto', 
    padding: isMobile ? '40px 15px' : '80px 20px', 
    position: 'relative', 
    zIndex: 2,
    ...style
  }}>
    {children}
  </section>
);

const PremiumCard = ({ icon, title, desc, delay, isMobile }) => (
  <Reveal delay={delay}>
    <Tilt tiltMaxAngleX={isMobile ? 0 : 5} tiltMaxAngleY={isMobile ? 0 : 5} perspective={1000} scale={1.02} transitionSpeed={2000} glareEnable={!isMobile} glareMaxOpacity={0.1} glareColor="#BF953F">
      <AutoFloat duration={5 + delay}> 
        <div style={{
          background: 'linear-gradient(145deg, rgba(20,20,20,0.6) 0%, rgba(0,0,0,0.8) 100%)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: `1px solid ${THEME.glassBorder}`,
          borderRadius: '24px',
          padding: isMobile ? '25px' : '40px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}>
          <div style={{ marginBottom: isMobile ? '15px' : '20px', padding: '15px', borderRadius: '50%', background: 'rgba(191, 149, 63, 0.05)', border: `1px solid rgba(191, 149, 63, 0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GoldIcon Icon={icon} size={isMobile ? "1.8rem" : "2.2rem"} />
          </div>
          <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', color: '#fff', marginBottom: '15px', fontFamily: "'Playfair Display', serif", letterSpacing: '0.5px', textAlign: 'center' }}>{title}</h3>
          <p style={{ color: THEME.textSecondary, lineHeight: '1.75', fontSize: isMobile ? '0.85rem' : '0.95rem', textAlign: 'center', margin: 0 }}>{desc}</p>
        </div>
      </AutoFloat>
    </Tilt>
  </Reveal>
);

// --- MAIN PAGE COMPONENT ---
const About = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const s = {
    page: {
      backgroundColor: 'transparent',
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
    },
    fixedBackground: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100vh',
      zIndex: -1, 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.dark,
    },
    logoImage: {
      width: isMobile ? '80vw' : '55vw',
      opacity: 0.25,
    },
    overlay: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(circle, transparent 20%, #050505 90%)',
      zIndex: 0
    },
    goldText: {
      background: THEME.goldGradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: '800'
    },
    heroTitle: {
      fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 7vw, 6rem)',
      fontWeight: '900',
      lineHeight: 1.1,
      marginBottom: '20px',
      letterSpacing: '-2px',
      color: '#fff',
      textShadow: '0 10px 30px rgba(0,0,0,1)' // Note: This shadow causes issues with gradient text if not handled
    },
    btn: {
      background: THEME.goldGradient,
      color: '#000',
      border: 'none',
      padding: isMobile ? '14px 30px' : '18px 45px',
      borderRadius: '50px',
      fontSize: isMobile ? '0.9rem' : '1rem',
      fontWeight: '800',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      marginTop: '40px',
      boxShadow: '0 0 20px rgba(191, 149, 63, 0.4)',
      textTransform: 'uppercase',
      letterSpacing: '1px'
    }
  };

  return (
    <div style={s.page} className="about-react">
      
      {/* --- 1. FIXED STATIC BACKGROUND --- */}
      <div style={s.fixedBackground}>
        <div style={{...s.overlay, background: '#050505'}} /> 
      </div>

      {/* --- 2. HERO SECTION --- */}
      <section className="about-hero" style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 20px', position: 'relative', zIndex: 10 }}>
        
        <Reveal>
          <AutoFloat duration={6}>
            <div style={{ 
              border: `1px solid ${THEME.goldSolid}`, color: THEME.goldSolid, padding: isMobile ? '8px 18px' : '10px 25px', 
              borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '10px',
              marginBottom: '30px', fontSize: isMobile ? '0.7rem' : '0.8rem', letterSpacing: '3px', textTransform: 'uppercase',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)'
            }}>
              <FaHeart style={{color: THEME.goldSolid}} /> Handmade With Love
            </div>
          </AutoFloat>
        </Reveal>

        <Reveal delay={0.1}>
          <h1 style={s.heroTitle}>
            CRAFTED IN <br />
            {/* FIX APPLIED HERE: Added textShadow: 'none' and a drop-shadow filter instead */}
            <span style={{ 
                ...s.goldText, 
                textShadow: 'none', 
                filter: 'drop-shadow(0 0 15px rgba(191, 149, 63, 0.4))' 
            }}>
                FINLAND.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p style={{ maxWidth: '700px', margin: '0 auto', color: '#ccc', fontSize: isMobile ? '1rem' : '1.2rem', lineHeight: 1.6, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            Welcome to Yokebud Craft. We design and handcraft beautiful resin jewellery made with love, creativity, and attention to detail. Every piece is unique — just like you.
          </p>
        </Reveal>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1, y: [0, 10, 0] }} 
          transition={{ delay: 1, duration: 1.5, repeat: Infinity }}
          style={{ position: 'absolute', bottom: '40px' }}
        >
          <div style={{ width: '1px', height: '60px', background: `linear-gradient(to bottom, ${THEME.goldSolid}, transparent)` }} />
        </motion.div>
      </section>


      {/* --- 3. STORY SECTION (Using Logo Image) --- */}
      <Section isMobile={isMobile}>
        <div className="about-story-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))', gap: isMobile ? '30px' : '60px', alignItems: 'center' }}>
          
          {/* Image Side - LOGO */}
          <Reveal>
            <Tilt tiltMaxAngleX={isMobile ? 0 : 5} tiltMaxAngleY={isMobile ? 0 : 5} perspective={1000}>
               <div style={{ 
                 position: 'relative', 
                 borderRadius: '30px', 
                 overflow: 'hidden', 
                 border: `1px solid ${THEME.glassBorder}`, 
                 boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                 background: 'rgba(255,255,255,0.03)',
                 padding: '40px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center'
               }}>
                 <img src={bglogoimg} alt="Yokebud Logo" style={{ width: '80%', height: 'auto', display: 'block', objectFit: 'contain' }} />
               </div>
            </Tilt>
          </Reveal>

          {/* Text Side */}
          <div>
            <Reveal delay={0.1}>
              <h2 style={{ fontSize: isMobile ? '2rem' : '2.8rem', fontWeight: '800', marginBottom: '25px', lineHeight: 1.2, color: '#fff' }}>
                Our <span style={s.goldText}>Story</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <div style={{ color: THEME.textSecondary, marginBottom: '20px', fontSize: isMobile ? '0.95rem' : '1.1rem', lineHeight: '1.8' }}>
                <p style={{marginBottom: '20px'}}>
                  Welcome to <strong>Yokebud Craft</strong>, a Finnish handmade jewellery brand dedicated to creating beautiful, meaningful resin accessories.
                </p>
                <p>
                  What started as a small home-based creative hobby has grown into a passion for producing unique, elegant, and affordable jewellery. We bring joy and beauty through handcrafted accessories that make every moment a little more special.
                </p>
              </div>
            </Reveal>
            
            <Reveal delay={0.3}>
                <div style={{ borderLeft: `3px solid ${THEME.goldSolid}`, paddingLeft: '20px', fontStyle: 'italic', color: '#fff', marginTop: '30px' }}>
                    "To bring joy and beauty through handcrafted accessories that make every moment a little more special."
                </div>
            </Reveal>
          </div>
        </div>
      </Section>


      {/* --- 4A. HANDCRAFTED RESIN JEWELLERY (Image: About-1) --- */}
      <Section isMobile={isMobile} style={{background: 'rgba(255,255,255,0.02)'}}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '50px', alignItems: 'center' }}>
            {/* Text First on Desktop (Alternating layout) */}
            <div style={{ order: isMobile ? 2 : 1 }}>
                <Reveal>
                    <div style={{display:'flex', alignItems:'center', gap: '10px', marginBottom: '15px'}}>
                         <GoldIcon Icon={FaGem} size="1.5rem" />
                         <span style={{color: THEME.goldSolid, letterSpacing: '2px', textTransform:'uppercase', fontWeight:'bold'}}>The Collection</span>
                    </div>
                    <h2 style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                        Handcrafted <span style={s.goldText}>Resin Jewellery</span>
                    </h2>
                    <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                        We specialise in creating delicate, one-of-a-kind pieces that capture nature's beauty. Using high-quality resin and real dried flowers, our collection is perfect for adding a touch of elegance to your daily life.
                    </p>
                    
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        {[
                            'Hand-poured Resin Earrings', 'Resin Keyrings & Bag Charms', 
                            'Necklace & Pendant Sets', 'Initial & Name Keychains',
                            'Real Dried Flower Jewellery', 'Custom Colors & Collections'
                        ].map((item, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                                <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> {item}
                            </li>
                        ))}
                    </ul>
                </Reveal>
            </div>

            {/* Image (About-1) */}
            <div style={{ order: isMobile ? 1 : 2 }}>
                <Reveal delay={0.2}>
                    <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000}>
                        <div style={{ 
                            position: 'relative', borderRadius: '24px', overflow: 'hidden', 
                            border: `1px solid ${THEME.glassBorder}`, boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                            height: isMobile ? '300px' : '500px',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <img src={aboutImage} alt="Resin Jewellery" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
                                <span style={{ color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaStar color={THEME.goldSolid}/> Unique & Elegant
                                </span>
                            </div>
                        </div>
                    </Tilt>
                </Reveal>
            </div>
        </div>
      </Section>


      {/* --- 4B. CUSTOM CLOTHING & DESIGN (Image: About-2) --- */}
      <Section isMobile={isMobile}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '50px', alignItems: 'center' }}>
            
            {/* Image (About-2) - Left on Desktop */}
            <div>
                <Reveal delay={0.2}>
                    <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000}>
                        <div style={{ 
                            position: 'relative', borderRadius: '24px', overflow: 'hidden', 
                            border: `1px solid ${THEME.glassBorder}`, boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                            height: isMobile ? '300px' : '500px',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <img src={aboutImage2} alt="Custom Clothing Design" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                             <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
                                <span style={{ color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaPalette color={THEME.goldSolid}/> Design Services
                                </span>
                            </div>
                        </div>
                    </Tilt>
                </Reveal>
            </div>

            {/* Text - Right on Desktop */}
            <div>
                <Reveal>
                    <div style={{display:'flex', alignItems:'center', gap: '10px', marginBottom: '15px'}}>
                         <GoldIcon Icon={FaTshirt} size="1.5rem" />
                         <span style={{color: THEME.goldSolid, letterSpacing: '2px', textTransform:'uppercase', fontWeight:'bold'}}>Apparel Design</span>
                    </div>
                    <h2 style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                        Custom <span style={s.goldText}>T-Shirt Design</span>
                    </h2>
                    <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                       From personal wear to unique gifts, we bring your ideas to life! We offer custom design services for t-shirts and hoodies. Express yourself with a unique print that is made just for you.
                    </p>
                    
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                            <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> Personal Wear & Styling
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                            <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> Custom Gift Printing
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                            <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> Unique Graphic Designs
                        </li>
                         <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                            <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> High-Quality Prints
                        </li>
                    </ul>

                    <div style={{ marginTop: '30px', padding: '15px', background: 'rgba(191, 149, 63, 0.1)', borderRadius: '10px', borderLeft: `3px solid ${THEME.goldSolid}` }}>
                         <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff', fontStyle: 'italic' }}>
                            "Your idea, our design. Perfect for special surprises and everyday style."
                         </p>
                    </div>
                </Reveal>
            </div>
        </div>
      </Section>


      {/* --- 4C. LASER ENGRAVING & CUSTOMIZED PRODUCTS --- */}
      <Section isMobile={isMobile} style={{background: 'rgba(255,255,255,0.02)'}}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '50px', alignItems: 'center' }}>
            
            {/* Text - Left on Desktop */}
            <div style={{ order: isMobile ? 2 : 1 }}>
                <Reveal>
                    <div style={{display:'flex', alignItems:'center', gap: '10px', marginBottom: '15px'}}>
                         <GoldIcon Icon={FaMagic} size="1.5rem" />
                         <span style={{color: THEME.goldSolid, letterSpacing: '2px', textTransform:'uppercase', fontWeight:'bold'}}>Laser & Engraving</span>
                    </div>
                    <h2 style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
                        Customized <span style={s.goldText}>Laser Engraving</span>
                    </h2>
                    <p style={{ color: '#ccc', lineHeight: '1.7', marginBottom: '30px' }}>
                        Experience the art of precision! Our newest collection features custom engraving on natural wood and premium leather. From personalized jewelry and unique keyrings to elegant home decor and custom pet tags, we bring a timeless touch to your everyday items.
                    </p>
                    
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        {[
                            'Wooden Engraved Jewellery', 'Leather Laser Printing', 
                            'Custom Keyrings & Charms', 'Personalized Pet Tags',
                            'Elegant Home Decoration', 'Custom Wood Ornaments'
                        ].map((item, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b0b0b0' }}>
                                <FaCheck style={{ color: THEME.goldSolid, fontSize: '0.8rem' }} /> {item}
                            </li>
                        ))}
                    </ul>
                </Reveal>
            </div>

            {/* Image (Engraving) - Right on Desktop */}
            <div style={{ order: isMobile ? 1 : 2 }}>
                <Reveal delay={0.2}>
                    <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000}>
                        <div style={{ 
                            position: 'relative', borderRadius: '24px', overflow: 'hidden', 
                            border: `1px solid ${THEME.glassBorder}`, boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                            height: isMobile ? '300px' : '500px',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <img src={engravingImage} alt="Laser Engraving Services" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                             <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
                                <span style={{ color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaTools color={THEME.goldSolid}/> Hand-Finished in Finland
                                </span>
                            </div>
                        </div>
                    </Tilt>
                </Reveal>
            </div>
        </div>
      </Section>


      {/* --- 5. OCCASIONS & DETAILS --- */}
      <Section isMobile={isMobile}>
         <Reveal>
            <div style={{
                background: 'linear-gradient(145deg, rgba(20,20,20,0.8), rgba(10,10,10,0.9))',
                borderRadius: '24px', border: `1px solid ${THEME.glassBorder}`,
                padding: isMobile ? '30px' : '50px',
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '40px'
            }}>
                {/* Occasions */}
                <div>
                     <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <GoldIcon Icon={FaGift} size="1.5rem" /> Perfect For All Occasions
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {['Birthdays', 'Anniversaries', 'Everyday Wear', 'Corporate Gifts', 'Pet Accessories', 'Home Decor', 'Wedding Favours', 'Special Surprises'].map((tag, i) => (
                             <span key={i} style={{ 
                                padding: '8px 16px', borderRadius: '50px', 
                                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(191, 149, 63, 0.2)',
                                color: '#ccc', fontSize: '0.9rem'
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Additional Promise */}
                <div style={{ borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)', paddingLeft: isMobile ? 0 : '40px', paddingTop: isMobile ? '20px' : 0, borderTop: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                     <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <GoldIcon Icon={FaStar} size="1.5rem" /> Why Choose Us?
                    </h3>
                    <p style={{color: '#aaa', marginBottom: '10px'}}><strong style={{color:'#fff'}}>Handmade with Love:</strong> Every item is made in small batches in Finland, ensuring quality, safety, and uniqueness.</p>
                    <p style={{color: '#aaa'}}><strong style={{color:'#fff'}}>Unique & Personal:</strong> No two pieces are identical.</p>
                </div>
            </div>
         </Reveal>
      </Section>

      {/* --- 6. CORE VALUES (UPDATED TEXT) --- */}
      <Section isMobile={isMobile}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '40px' : '60px' }}>
            <h2 style={{ fontSize: isMobile ? '2.2rem' : '3rem', fontWeight: '800', color: '#fff' }}>Our <span style={s.goldText}>Promise</span></h2>
            <AutoFloat duration={3}>
              <div style={{ width: '60px', height: '4px', background: THEME.goldGradient, margin: '20px auto', borderRadius: '2px' }} />
            </AutoFloat>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? '20px' : '30px', marginBottom: '0px' }}>
          
          <PremiumCard 
            icon={FaCrown} 
            title="High-Quality Materials" 
            desc="We use only the best materials for our resin and apparel to ensure durability and beauty." 
            delay={0} 
            isMobile={isMobile}
          />
          
          <PremiumCard 
            icon={FaLeaf} 
            title="Safe & Conscious" 
            desc="Nickel-free, hypoallergenic findings and eco-conscious packaging. Quality you can trust." 
            delay={0.1} 
            isMobile={isMobile}
          />
          
          <PremiumCard 
            icon={FaFingerprint} 
            title="Unique Designs" 
            desc="No two pieces are identical. Custom colours and special collections made just for you." 
            delay={0.2} 
            isMobile={isMobile}
          />
        </div>
      </Section>


    {/* --- 7. SHIPPING BANNER --- */}
    <Section isMobile={isMobile}>
        <Reveal>
            <div style={{ 
                background: 'linear-gradient(to right, rgba(20,20,20,0.9), rgba(5,5,5,0.95))', 
                border: `1px solid ${THEME.glassBorder}`, borderRadius: '20px', 
                padding: '40px', textAlign: 'center', position: 'relative', overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <AutoFloat><GoldIcon Icon={FaShippingFast} size="3rem" /></AutoFloat>
                    <h2 style={{ color: '#fff', fontSize: isMobile ? '1.5rem' : '2rem', margin: '20px 0 10px 0' }}>Delivery Across Finland</h2>
                    <p style={{ color: '#aaa', maxWidth: '600px', margin: '0 auto 20px auto' }}>
                        Order easily from our online shop. We ship your handcrafted items via <strong>Posti, Matkahuolto</strong>, and other couriers across Finland.
                    </p>
                    <div style={{ fontSize: '0.9rem', color: THEME.goldSolid, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Thank you for supporting small Finnish handmade business
                    </div>
                </div>
                {/* Background Glow */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '300px', background: THEME.goldSolid, opacity: 0.05, filter: 'blur(80px)', borderRadius: '50%' }} />
            </div>
        </Reveal>
    </Section>


      {/* --- 8. CTA SECTION --- */}
      <section className="about-cta" style={{ padding: isMobile ? '80px 20px' : '150px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <AutoFloat duration={8}>
          <div className="cta-glow" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(191, 149, 63, 0.15) 0%, transparent 70%)', zIndex: 0 }} />
        </AutoFloat>
        
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Reveal>
            <h2 style={{ fontSize: isMobile ? '2rem' : 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: '900', marginBottom: '20px', lineHeight: 1.1, color: '#fff' }}>
              Find Your <span style={s.goldText}>Sparkle</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p style={{ color: '#aaa', fontSize: isMobile ? '1rem' : '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
              Shop our latest collection of handmade resin jewelry and custom apparel.
            </p>
          </Reveal>
          
          <Reveal delay={0.2}>
            <motion.button 
              style={s.btn}
              whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(191, 149, 63, 0.6)' }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: ['0 0 20px rgba(191, 149, 63, 0.3)', '0 0 40px rgba(191, 149, 63, 0.6)', '0 0 20px rgba(191, 149, 63, 0.3)'] }}
              transition={{ repeat: Infinity, duration: 2 }}
              onClick={() => navigate('/')}
            >
              Shop Now <FaArrowRight />
            </motion.button>
          </Reveal>
        </div>
      </section>

    </div>
  );
};

export default About;