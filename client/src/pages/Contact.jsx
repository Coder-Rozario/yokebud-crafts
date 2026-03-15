import { useState, useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaWhatsapp, FaFacebook, FaInstagram, FaTiktok, FaEnvelope, FaYoutube } from 'react-icons/fa';
import { motion } from 'framer-motion';
import bglogoimg from '../assades/logo.jpg';
import { apiFetch } from '../utils/api';

const Contact = () => {
  // ... (state remains same)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [activeMap, setActiveMap] = useState('finland');

  useEffect(() => {
    // Scroll to top when contact page loads
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.whatsapp.trim()) newErrors.whatsapp = 'WhatsApp number is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/contact', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success('Message sent successfully! You will receive a confirmation email shortly.', {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          zIndex: 5000000000000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        setFormData({ name: '', email: '', whatsapp: '', message: '' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'An error occurred. Please try again.', {
        position: "top-center",
        autoClose: 5000,
        zIndex: 5000000000000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const gold = '#D4AF37';
  const darkGold = '#D4AF37';
  const lightBg = '#1a1a1a';

  const sectionStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    color: '#fff',
    width: '100%',
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1
  };

  const headingStyle = {
    textAlign: 'center',
    marginBottom: '2rem',
    fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
    fontWeight: 'bold',
    background: 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };

  const cardContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2rem',
    marginBottom: '3rem',
    justifyContent: 'center'
  };

  const cardStyle = {
    flex: '1 1 300px',
    minWidth: '280px',
    backgroundColor: lightBg,
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: '0 6px 30px rgba(255, 215, 0, 0.1)',
    color: '#eee',
    transition: 'transform 0.3s ease'
  };

  const formContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5rem',
    marginBottom: '10vh',
    justifyContent: 'center'
  };

  const formColumnStyle = {
    flex: '1 1 500px',
    minWidth: '100%',
    maxWidth: '100%'
  };

  const formStyle = {
    backgroundColor: '#111',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 6px 30px rgba(255, 215, 0, 0.1)',
    width: '100%',
    backdropFilter: 'blur(4px)',
    border: '1px solid #333',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    fontWeight: '600',
    color: darkGold,
    marginBottom: '0.5rem',
    display: 'block',
    fontSize: 'clamp(0.9rem, 2vw, 1rem)'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '0.5rem',
    border: '1px solid #333',
    borderRadius: '8px',
    fontSize: 'clamp(0.9rem, 2vw, 1rem)',
    backgroundColor: '#1f1f1f',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.3s ease'
  };

  const errorStyle = {
    color: '#ff4d4f',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    display: 'block'
  };

  const buttonStyle = {
    background: 'linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
    color: '#111',
    padding: '0.9rem 2.2rem',
    border: `2px solid ${gold}`,
    borderRadius: '8px',
    fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: isHovering ? '0 8px 20px rgba(212, 175, 55, 0.45)' : '0 4px 12px rgba(212, 175, 55, 0.25)',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '300px',
    margin: '0 auto'
  };

  const loadingStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
    border: `3px solid rgba(0, 0, 0, 0.2)`,
    borderTopColor: '#111',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  };

  const mapContainerStyle = {
    width: '100%',
    height: '400px',
    minHeight: '300px',
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 6px 30px rgba(255, 215, 0, 0.1)'
  };

  const mapStyle = {
    width: '100%',
    height: '100%',
    border: 'none'
  };

  const mapTabsStyle = {
    display: 'flex',
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 100,
    gap: '5px'
  };

  const mapTabStyle = {
    padding: '8px 16px',
    backgroundColor: 'rgba(17, 17, 17, 0.8)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  };

  const activeMapTabStyle = {
    ...mapTabStyle,
    backgroundColor: darkGold,
    color: '#111'
  };

  const iconContainerStyle = {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '2.5rem',
    flexWrap: 'wrap',
  };

  const iconStyle = {
    color: 'white',
    fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
    cursor: 'pointer',
    transition: 'transform 0.3s ease, color 0.3s ease'
  };

  const dividerStyle = {
    borderColor: '#333',
    marginBottom: '3rem',
    width: '100%'
  };

  const revealVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: "easeOut" } 
    }
  };

  return (
    <motion.div
      className="contact-page"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5 } }
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#111', // Fixed solid color for background
        minHeight: '100vh'
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          opacity: 0.15,
          width: '100%',
          maxWidth: '800px',
          height: '100%',
          backgroundImage: `url(${bglogoimg})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          pointerEvents: 'none',
          filter: 'brightness(0.8)'
        }}
      />

      <ToastContainer />
      <style>{`
        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
      
      <main style={{ 
        position: 'relative', 
        zIndex: 1,
        paddingTop: '5vh'
      }}>
        <section style={sectionStyle}>
          <motion.h1 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
            style={headingStyle}
          >
            Contact Us
          </motion.h1>

          <div style={cardContainerStyle}>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: -50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.8 } }
              }}
              style={cardStyle}
              whileHover={{ y: -5 }}
            >
              <h5 style={{ color: gold, marginBottom: '1rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>Address</h5>
              <p style={{ marginBottom: '1.5rem', fontSize: 'clamp(0.9rem, 2vw, 1rem)' }}>
                <strong style={{ color: gold }}>Finland:</strong> Pukinmäenaukio 4, 00720 Helsinki, Finland
              </p>
              <p style={{ marginBottom: '1.5rem', fontSize: 'clamp(0.9rem, 2vw, 1rem)' }}>
                <strong style={{ color: gold }}>Phone:</strong> +358 440 328 124
              </p>
              <p style={{ fontSize: 'clamp(0.9rem, 2vw, 1rem)' }}>
                <strong style={{ color: gold }}>Email:</strong> yokebud@gmail.com, info@yokebud.com
              </p>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: 50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.8 } }
              }}
              style={cardStyle}
              whileHover={{ y: -5 }}
            >
              <h5 style={{ color: gold, marginBottom: '1rem', fontSize: 'clamp(1rem, 2vw, 1.2rem)' }}>For All Queries</h5>
              <p style={{ fontSize: 'clamp(0.9rem, 2vw, 1rem)', marginBottom: '1.5rem' }}>
                Feel free to contact us anytime via Email or WhatsApp.<br />We'll get back to you shortly!
              </p>
              <div style={iconContainerStyle}>
                <a href="https://wa.me/+358440328124" target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
                <a href="https://www.facebook.com/share/1D9o7CoZB7/" target="_blank" rel="noopener noreferrer">
                  <FaFacebook 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
                <a href="https://www.instagram.com/yokebud" target="_blank" rel="noopener noreferrer">
                  <FaInstagram 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
                <a href="https://www.tiktok.com/@yokebud" target="_blank" rel="noopener noreferrer">
                  <FaTiktok 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
                <a href="mailto:yokebud@gmail.com">
                  <FaEnvelope 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
                <a href="https://www.youtube.com/@yokebud" target="_blank" rel="noopener noreferrer">
                  <FaYoutube 
                    style={iconStyle} 
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </a>
              </div>
            </motion.div>
          </div>

          <hr style={dividerStyle} />

          <motion.h1 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
            style={headingStyle}
          >
            Get in Touch
          </motion.h1>

          <div style={formContainerStyle}>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={revealVariants}
              style={formColumnStyle}
              whileHover={{ scale: 1.01 }}
            >
              <form style={formStyle} onSubmit={handleSubmit}>
                <label style={labelStyle}>Your Name</label>
                <input 
                  style={{ 
                    ...inputStyle, 
                    borderColor: errors.name ? '#ff4d4f' : '#333' 
                  }} 
                  name="name" 
                  type="text" 
                  value={formData.name} 
                  onChange={handleChange} 
                />
                {errors.name && <span style={errorStyle}>{errors.name}</span>}

                <label style={labelStyle}>Email Address</label>
                <input 
                  style={{ 
                    ...inputStyle, 
                    borderColor: errors.email ? '#ff4d4f' : '#333' 
                  }} 
                  name="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                />
                {errors.email && <span style={errorStyle}>{errors.email}</span>}

                <label style={labelStyle}>Whatsapp Number</label>
                <input
                  style={{
                    ...inputStyle,
                    appearance: 'textfield',
                    MozAppearance: 'textfield',
                    WebkitAppearance: 'none',
                    margin: 0,
                    borderColor: errors.whatsapp ? '#ff4d4f' : '#333'
                  }}
                  type="number"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                />
                {errors.whatsapp && <span style={errorStyle}>{errors.whatsapp}</span>}

                <label style={labelStyle}>Message</label>
                <textarea
                  style={{ 
                    ...inputStyle, 
                    minHeight: '150px', 
                    resize: 'vertical',
                    borderColor: errors.message ? '#ff4d4f' : '#333' 
                  }}
                  name="message"
                  rows="6"
                  value={formData.message}
                  onChange={handleChange}
                />
                {errors.message && <span style={errorStyle}>{errors.message}</span>}

                <motion.button
                  type="submit"
                  style={buttonStyle}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSubmitting ? (
                    <>
                      <span style={{ opacity: 0 }}>Send Message</span>
                      <div style={loadingStyle} />
                    </>
                  ) : (
                    'Send Message'
                  )}
                </motion.button>
              </form>
            </motion.div>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={revealVariants}
              style={formColumnStyle}
              whileHover={{ scale: 1.01 }}
            >
              <div style={mapContainerStyle}>
                <div style={mapTabsStyle}>

                </div>
                
                {activeMap === 'finland' ? (
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1985.980588920213!2d25.008692316119986!3d60.23941118197048!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4692082b9fc87d31%3A0xdf17b19b0e2c5c2!2sPukinm%C3%A4enaukio%204%2C%2000720%20Helsinki%2C%20Finland!5e0!3m2!1sen!2sfi!4v1684244212794!5m2!1sen!2sfi"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title="Finland Location"
                    style={mapStyle}
                  />
                ) : (
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3648.383394996359!2d90.4151113154316!3d23.87382978901336!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c42a3a6a9a9d%3A0x8a7e5e3b3a1a1a1a!2sNayonpur%2C%20Shahebpara%2C%20Rajendropur%20Cantonment%20Gazipur%201742%2C%20Bangladesh!5e0!3m2!1sen!2sbd!4v1684244212794!5m2!1sen!2sbd"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title="Bangladesh Location"
                    style={mapStyle}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </motion.div>
  );
};

export default Contact;
