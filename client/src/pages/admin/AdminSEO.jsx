import React, { useState, useEffect } from 'react';
import { FiSave, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { apiFetch } from '../../utils/api';

const AdminSEO = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchSeoContent();
  }, []);

  const fetchSeoContent = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/seo/home');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFormData({
            title: result.data.title || '',
            content: result.data.content || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching SEO content:', error);
      toast.error('Error loading SEO content');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await apiFetch('/api/seo/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('SEO content updated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save SEO content');
      }
    } catch (error) {
      console.error('Error saving SEO content:', error);
      toast.error('Error saving SEO content');
    } finally {
      setSaving(false);
    }
  };

  const styles = {
    container: {
      padding: isMobile ? '1.5rem' : '3rem',
      background: '#050505',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      color: '#fff',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '3rem',
      flexWrap: 'wrap',
      gap: '1.5rem'
    },
    title: {
      fontSize: isMobile ? '1.8rem' : '2.5rem',
      fontWeight: '800',
      background: 'linear-gradient(to right, #F59E0B, #FBBF24)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      margin: 0,
      letterSpacing: '-0.02em'
    },
    form: {
      background: '#111',
      padding: isMobile ? '1.5rem' : '2.5rem',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      maxWidth: '800px',
      margin: '0 auto'
    },
    formGroup: {
      marginBottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    label: {
      fontSize: '0.9rem',
      fontWeight: '600',
      color: '#a1a1aa',
      marginLeft: '4px'
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '1rem',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '14px 16px',
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '1rem',
      outline: 'none',
      minHeight: '300px',
      resize: 'vertical',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      lineHeight: '1.6'
    },
    submitBtn: {
      width: '100%',
      padding: '16px',
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      border: 'none',
      borderRadius: '14px',
      color: '#000',
      fontWeight: '800',
      fontSize: '1.1rem',
      cursor: 'pointer',
      marginTop: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      boxShadow: '0 10px 25px rgba(245, 158, 11, 0.2)',
      opacity: saving ? 0.7 : 1,
      pointerEvents: saving ? 'none' : 'auto'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(245, 158, 11, 0.2)', borderTop: '3px solid #F59E0B', borderRadius: '50%', animation: 'spin 1s infinite linear' }}></div>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SEO Footer Text</h1>
          <p style={{ color: '#71717a', marginTop: '8px' }}>Manage the SEO content at the bottom of the home page</p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Section Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="e.g. Leading Handcrafted Art Shop in Finland"
              onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Content (HTML Supported)</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              style={styles.textarea}
              placeholder="Enter your SEO content here. You can use HTML tags like <p>, <strong>, <a>, etc."
              onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <motion.button 
            type="submit" 
            style={styles.submitBtn}
            whileHover={{ scale: 1.01, translateY: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            <FiSave size={20} />
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminSEO;
