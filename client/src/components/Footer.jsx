import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaWhatsapp, FaYoutube, FaInstagram, FaChevronDown, FaTiktok, FaGlobe } from 'react-icons/fa';
import { SiVisa, SiMastercard, SiPaypal } from 'react-icons/si';
import { toast } from 'react-toastify';
import { auth } from '../firebase'; 
import { apiFetch } from '../utils/api';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Scroll Detection
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user && user.email) {
        setEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscription Status Check
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      const user = auth.currentUser;
      const userEmail = user ? user.email : localStorage.getItem('userEmail');
      
      if (userEmail) {
        try {
          const response = await apiFetch(`/api/subscription-status?email=${encodeURIComponent(userEmail)}`);
          if (response.ok) {
            const data = await response.json();
            setIsSubscribed(data.isSubscribed);
          }
        } catch (error) {
          console.error('Error checking subscription status:', error);
        }
      }
    };
    checkSubscriptionStatus();
  }, []);

  // Subscribe Handler
  const handleSubscribe = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    toast.info('Processing subscription...', { autoClose: 2000 });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await apiFetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Successfully subscribed to newsletter!');
        setEmail('');
        setIsSubscribed(true);
        localStorage.setItem('userEmail', email);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        toast.error(data.message || 'Subscription failed. Please try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      if (error.name === 'AbortError') {
        toast.error('Request timed out. Please try again later.');
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMenu = (index) => {
    setActiveMenu(activeMenu === index ? null : index);
  };

  // --- INTERNAL CSS (Fixed Overflow & Updated Premium Colors) ---
  const internalStyles = `
    :root {
      --bg-dark: #050505;
      --bg-card: #111111;
      --text-main: #ffffff;
      --text-muted: #b0b0b0; /* Slightly lighter for better readability */
      
      /* Updated Premium Gold Colors */
      --gold-primary: #D4AF37; /* Metallic Gold */
      --gold-secondary: #AA8C2C; /* Darker Gold */
      --gold-gradient: linear-gradient(135deg, #D4AF37 0%, #AA8C2C 100%); /* Premium Gradient */
      
      --border-light: rgba(255, 255, 255, 0.08);
    }

    /* Fixed Container Overflow */
    .footer-container {
      background-color: var(--bg-dark);
      color: var(--text-main);
      position: relative;
      font-family: 'Inter', sans-serif;
      width: 100%;          
      overflow: hidden;    
      box-sizing: border-box;
    }

    /* Wave Animation */
    .footer-wave {
      position: absolute;
      top: -50px;
      left: 0;
      width: 100%;
      line-height: 0;
      transform: rotate(180deg);
      z-index: 1;
      pointer-events: none; 
    }
    .footer-wave svg {
      display: block;
      width: calc(100% + 1.3px);
      height: 50px;
    }
    .footer-wave path {
      fill: var(--bg-dark);
    }

    .footer-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 4rem 2rem 2rem;
      position: relative;
      z-index: 2;
      box-sizing: border-box;
    }

    /* Grid Layout */
    .footer-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1fr 1.5fr; /* 5 Columns */
      gap: 2rem;
      width: 100%;
    }

    /* Headers */
    .footer-col h3 {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 1.5px; /* Increased letter spacing for premium look */
      background: var(--gold-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: default;
    }

    .dropdown-icon { display: none; color: var(--gold-primary); }

    /* Links & Lists */
    .footer-col ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .footer-col li {
      margin-bottom: 0.8rem;
    }

    .footer-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.95rem;
      transition: all 0.3s ease;
      position: relative;
      display: inline-block;
      font-weight: 300; /* Sleeker font weight */
    }
    
    .footer-link::after {
      content: '';
      position: absolute;
      width: 0;
      height: 1px;
      bottom: -2px;
      left: 0;
      background: var(--gold-primary);
      transition: width 0.3s;
    }

    .footer-link:hover {
      color: var(--gold-primary);
      padding-left: 5px;
    }
    .footer-link:hover::after {
      width: 100%;
    }

    /* Contact Items */
    .footer-container .contact-item { margin-bottom: 1.2rem; }
    .contact-label {
      display: block;
      color: var(--gold-primary);
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .contact-value {
      color: var(--text-muted);
      font-size: 0.88rem;
      text-decoration: none;
      line-height: 1.4;
      display: block;
      transition: 0.3s;
      font-weight: 300;
    }
    .contact-value:hover { color: #fff; }

    /* Newsletter */
    .newsletter-text {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 1rem;
      line-height: 1.6;
      font-weight: 300;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      margin-bottom: 1rem;
      background: rgba(255,255,255,0.03);
      border-radius: 2px; /* Sharper corners for modern look */
      border: 1px solid var(--border-light);
      transition: 0.3s;
      width: 100%; 
      box-sizing: border-box;
    }
    .input-wrapper:focus-within {
      border-color: var(--gold-primary);
      box-shadow: 0 0 10px rgba(212, 175, 55, 0.1);
    }

    .email-input {
      flex: 1;
      background: transparent;
      border: none;
      padding: 12px 15px;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      min-width: 0; 
    }
    
    .subscribe-btn {
      background: var(--gold-gradient);
      color: #000;
      border: none;
      padding: 0 25px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 1px;
      transition: 0.3s;
      border-top-right-radius: 2px;
      border-bottom-right-radius: 2px;
      white-space: nowrap;
    }
    .subscribe-btn:hover {
      filter: brightness(1.1);
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
    }

    .subscribed-msg {
      background: rgba(46, 204, 113, 0.1);
      border: 1px solid #2ecc71;
      color: #2ecc71;
      padding: 10px;
      border-radius: 4px;
      font-size: 0.9rem;
      text-align: center;
    }

    /* Social Icons */
    .social-container {
      display: flex;
      gap: 15px;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }
    .social-icon {
      width: 35px;
      height: 35px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.05);
      color: #fff;
      border-radius: 50%;
      transition: all 0.3s;
      font-size: 1.1rem;
      border: 1px solid transparent;
    }
    .social-icon:hover {
      background: transparent;
      color: var(--gold-primary);
      border-color: var(--gold-primary);
      transform: translateY(-3px);
    }

    /* Payment Methods */
    .payment-section { margin-top: 1.5rem; }
    .payment-title { 
      font-size: 0.75rem; 
      color: var(--text-muted); 
      margin-bottom: 8px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .payment-icons {
      display: flex;
      gap: 15px;
      font-size: 2rem;
      color: #fff;
      opacity: 0.6;
    }

    /* Bottom Bar */
    .footer-bottom {
      border-top: 1px solid var(--border-light);
      padding: 1.5rem;
      text-align: center;
      background: #000;
      width: 100%;
    }
    .footer-bottom p {
      font-size: 0.8rem;
      color: #666;
      margin: 0;
    }

    /* --- RESPONSIVE MEDIA QUERIES --- */
    
    @media (max-width: 1024px) {
      .footer-grid {
        grid-template-columns: repeat(3, 1fr); 
      }
      .footer-col:nth-child(5) { 
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column; 
        background: var(--bg-card);
        padding: 20px;
        border-radius: 8px;
        margin-top: 1rem;
      }
      .footer-col:nth-child(5) h3 { margin-bottom: 15px; }
    }

    @media (max-width: 768px) {
      .footer-container { margin-top: 0; }
      
      .footer-content { padding: 3rem 1.5rem 1rem; width: 100%; }

      .footer-grid {
        display: block; 
        width: 100%;
      }

      .footer-col {
        border-bottom: 1px solid var(--border-light);
        margin-bottom: 0;
        width: 100%;
      }
      .footer-col:last-child { border-bottom: none; }

      /* Mobile Accordion Style - Smaller Text */
      .footer-col h3 {
        padding: 1rem 0;
        margin-bottom: 0;
        cursor: pointer;
        font-size: 0.95rem; /* Reduced size for mobile */
      }
      
      .dropdown-icon { 
        display: block; 
        transition: transform 0.3s;
        font-size: 0.8rem;
      }
      
      .active h3 .dropdown-icon { transform: rotate(180deg); }

      .footer-col ul {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s ease-out, opacity 0.4s ease;
        opacity: 0;
      }
      
      .active ul {
        max-height: 600px;
        opacity: 1;
        padding-bottom: 1.5rem;
      }

      /* Smaller Text for Mobile Links */
      .footer-link, .contact-value, .contact-label {
        font-size: 0.85rem; /* Smaller text */
      }
      
      /* Reset Newsletter for Mobile */
      .footer-col:nth-child(5) {
        display: block;
        background: transparent;
        padding: 0;
        margin-top: 0;
      }
      
      /* Newsletter always visible on mobile */
      .footer-col:last-child ul {
        max-height: none;
        opacity: 1;
        padding: 1rem 0 2rem;
      }
      
      .newsletter-text {
         font-size: 0.85rem; /* Smaller description */
      }

      .footer-col:last-child h3 { pointer-events: none; }
      .footer-col:last-child .dropdown-icon { display: none; }
    }
  `;

  return (
    <footer className="footer-container">
      {/* Inject Styles */}
      <style>{internalStyles}</style>

      {/* Top Wave */}
      <div className="footer-wave">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25"></path>
          <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5"></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"></path>
        </svg>
      </div>

      <section className="footer-content">
        <div className="footer-grid">
          
          {/* COLUMN 1: Contact */}
          <div className={`footer-col ${activeMenu === 0 ? 'active' : ''}`}>
            <h3 onClick={() => toggleMenu(0)}>
              Contact Us
              <FaChevronDown className="dropdown-icon" />
            </h3>
            <ul>
              <li>
                <div className="contact-item">
                  <span className="contact-label">Whatsapp (24/7)</span>
                  <a href="https://wa.me/358440328124" className="contact-value">+358 440 328 124</a>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Email</span>
                  <a href="https://mail.google.com/mail/?view=cm&fs=1&to=info@yokebud.com" target="_blank" rel="noopener noreferrer" className="contact-value">info@yokebud.com</a>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Address</span>
                  <span className="contact-value">Pukinmäenaukio 4, 00720 Helsinki</span>
                </div>
              </li>
            </ul>
          </div>

          {/* COLUMN 2: Quick Links */}
          <div className={`footer-col ${activeMenu === 1 ? 'active' : ''}`}>
            <h3 onClick={() => toggleMenu(1)}>
              Quick Links
              <FaChevronDown className="dropdown-icon" />
            </h3>
            <ul>
              <li><Link to="/" className="footer-link">Home</Link></li>
              <li><Link to="/about" className="footer-link">About Us</Link></li>
              <li><Link to="/contact" className="footer-link">Contact</Link></li>
              <li><Link to="/blog" className="footer-link">Blog</Link></li>
            </ul>
          </div>

          {/* COLUMN 3: Policy */}
          <div className={`footer-col ${activeMenu === 2 ? 'active' : ''}`}>
            <h3 onClick={() => toggleMenu(2)}>
              Policy
              <FaChevronDown className="dropdown-icon" />
            </h3>
            <ul>
              <li><Link to="/policy" className="footer-link">Privacy Policy</Link></li>
              <li><Link to="/return" className="footer-link">Return Policy</Link></li>
              <li><Link to="/shipping" className="footer-link">Shipping Info</Link></li>
            </ul>
          </div>

          {/* COLUMN 4: OUR BRANDS */}
          <div className={`footer-col ${activeMenu === 3 ? 'active' : ''}`}>
            <h3 onClick={() => toggleMenu(3)}>
              Our Brands
              <FaChevronDown className="dropdown-icon" />
            </h3>
            <ul>
              <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <FaGlobe style={{ color: '#D4AF37', fontSize: '0.8rem'}} />
                <a href="https://www.yokebud.com" target="_blank" rel="noopener noreferrer" className="footer-link">
                   Yokebud Official
                </a>
              </li>
              <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <FaGlobe style={{ color: '#D4AF37', fontSize: '0.8rem'}} />
                <a href="https://www.etsy.com/shop/yokebuddigitalcraft/?etsrc=sdt" target="_blank" rel="noopener noreferrer" className="footer-link">
                   Yokebud Digital Craft
                </a>
              </li>
              <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <FaGlobe style={{ color: '#D4AF37', fontSize: '0.8rem'}} />
                <a href="#" target="_blank" rel="noopener noreferrer" className="footer-link">
                   Yokebud Clean
                </a>
              </li>
            </ul>
          </div>

          {/* COLUMN 5: Newsletter */}
          <div className="footer-col">
            <h3>Newsletter</h3>
            <ul>
              <li>
                <div className="newsletter-form">
                  <p className="newsletter-text">Join the club! Subscribe for weekly updates, new products, and exclusive offers.</p>
                  
                  {isSubscribed ? (
                    <div className="subscribed-msg">
                      ✓ You're subscribed!
                    </div>
                  ) : (
                    <form onSubmit={handleSubscribe} className="input-wrapper">
                      <input 
                        type="email" 
                        placeholder="Your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="email-input"
                        required
                        disabled={isLoading}
                      />
                      <button type="submit" className="subscribe-btn" disabled={isLoading}>
                        {isLoading ? '...' : 'JOIN'}
                      </button>
                    </form>
                  )}
                  
                  <div className="social-container">
                    <a href="https://www.facebook.com/share/1D9o7CoZB7/" target="_blank" rel="noopener noreferrer" className="social-icon"><FaFacebook /></a>
                    <a href="https://wa.me/+358440328124" target="_blank" rel="noopener noreferrer" className="social-icon"><FaWhatsapp /></a>
                    <a href="https://www.youtube.com/@yokebud" target="_blank" rel="noopener noreferrer" className="social-icon"><FaYoutube /></a>
                    <a href="https://www.instagram.com/yokebud/" target="_blank" rel="noopener noreferrer" className="social-icon"><FaInstagram /></a>
                    <a href="https://www.tiktok.com/@yokebud" target="_blank" rel="noopener noreferrer" className="social-icon"><FaTiktok /></a>
                  </div>

                  <div className="payment-section">
                    <div className="payment-title">Guaranteed Safe Checkout</div>
                    <div className="payment-icons">
                      <SiVisa />
                      <SiMastercard />
                      <SiPaypal />
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </section>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Yokebud Crafts. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;