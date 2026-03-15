import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState({
    storeName: 'Golden Threads',
    currency: 'USD',
    maintenanceMode: false,
    notifications: true,
    analytics: true,
  });
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIfMobile();

    // Add event listener
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Styles
  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      overflowX: 'hidden',
      margin: 0,
      padding: 0,
    },
    
    mainContent: {
      flex: 1,
      padding: isMobile ? '1rem' : '2rem',
      width: '100%',
      minWidth: 0,
      background: 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)',
      boxSizing: 'border-box',
      transition: 'margin-left 0.3s ease, padding 0.3s ease',
    },
    
    header: {
      marginBottom: isMobile ? '1rem' : '2rem',
      width: '100%',
    },
    
    title: {
      fontSize: isMobile ? '1.5rem' : '1.8rem',
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: isMobile ? '2rem' : '3rem',
      background: 'linear-gradient(90deg, #FFA500, #FFD700)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      margin: 0,
    },
    
    settingsContainer: {
      background: 'rgba(40, 40, 40, 0.7)',
      borderRadius: '12px',
      padding: isMobile ? '1.2rem' : '2rem',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 215, 0, 0.1)',
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
    },
    
    formGroup: {
      marginBottom: isMobile ? '1.2rem' : '1.5rem',
      width: '100%',
    },
    
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontWeight: '500',
      color: '#aaa',
      fontSize: isMobile ? '0.9rem' : '1rem',
    },
    
    input: {
      width: '100%',
      padding: isMobile ? '0.7rem' : '0.75rem',
      borderRadius: '6px',
      border: '1px solid rgba(255, 215, 0, 0.3)',
      background: 'rgba(30, 30, 30, 0.8)',
      color: '#e0e0e0',
      fontSize: isMobile ? '0.9rem' : '0.95rem',
      outline: 'none',
      transition: 'all 0.3s ease',
      ':focus': {
        borderColor: '#FFA500',
        boxShadow: '0 0 0 2px rgba(255, 165, 0, 0.2)',
      },
    },
    
    select: {
      width: '100%',
      padding: isMobile ? '0.7rem' : '0.75rem',
      borderRadius: '6px',
      border: '1px solid rgba(255, 215, 0, 0.3)',
      background: 'rgba(30, 30, 30, 0.8)',
      color: '#e0e0e0',
      fontSize: isMobile ? '0.9rem' : '0.95rem',
      outline: 'none',
      transition: 'all 0.3s ease',
      ':focus': {
        borderColor: '#FFA500',
        boxShadow: '0 0 0 2px rgba(255, 165, 0, 0.2)',
      },
    },
    
    toggleContainer: {
      display: 'flex',
      marginBottom: isMobile ? '1rem' : '1.2rem',
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? '0.5rem' : 0,
    },
    
    toggleLabel: {
      marginRight: isMobile ? 0 : '1rem',
      width: isMobile ? '100%' : '150px',
      flexShrink: 0,
      fontSize: isMobile ? '0.9rem' : '1rem',
    },
    
    toggleWrapper: {
      display: 'flex',
      alignItems: 'center',
      width: isMobile ? '100%' : 'auto',
      justifyContent: isMobile ? 'space-between' : 'flex-start',
    },
    
    toggle: {
      position: 'relative',
      display: 'inline-block',
      width: '50px',
      height: '24px',
    },
    
    slider: (checked) => ({
      position: 'absolute',
      cursor: 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: checked ? 'rgba(255, 165, 0, 0.5)' : 'rgba(70, 70, 70, 0.7)',
      transition: '.4s',
      borderRadius: '24px',
      ':before': {
        position: 'absolute',
        content: '""',
        height: '16px',
        width: '16px',
        left: '4px',
        bottom: '4px',
        backgroundColor: checked ? '#FFD700' : '#aaa',
        transition: '.4s',
        borderRadius: '50%',
        transform: checked ? 'translateX(26px)' : 'translateX(0)',
      },
    }),
    
    checkboxInput: {
      opacity: 0,
      width: 0,
      height: 0,
    },
    
    submitButton: {
      padding: isMobile ? '0.7rem' : '0.75rem 1.5rem',
      borderRadius: '6px',
      border: 'none',
      background: 'linear-gradient(90deg, #FFA500, #FFD700)',
      color: '#1a1a1a',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: isMobile ? '0.9rem' : '1rem',
      transition: 'all 0.3s ease',
      width: '100%',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(255, 165, 0, 0.3)',
      },
    },
    
    sectionTitle: {
      color: '#FFA500',
      marginBottom: '1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      paddingBottom: '0.5rem',
      width: '100%',
      fontSize: isMobile ? '1.1rem' : '1.2rem',
    },
    
    toggleStatus: (checked) => ({
      marginLeft: isMobile ? 0 : '0.5rem',
      color: checked ? '#FFD700' : '#aaa',
      fontSize: isMobile ? '0.8rem' : '0.9rem',
      fontWeight: checked ? '600' : '400',
    }),
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Settings saved:', settings);
    alert('Settings saved successfully!');
  };

  return (
    <div style={styles.container}>
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <motion.h1 
            style={styles.title}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Store Settings
          </motion.h1>
        </header>

        <motion.div 
          style={styles.settingsContainer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Store Name</label>
              <input
                type="text"
                name="storeName"
                value={settings.storeName}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Currency</label>
              <select
                name="currency"
                value={settings.currency}
                onChange={handleChange}
                style={styles.select}
                required
              >
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="JPY">Japanese Yen (JPY)</option>
                <option value="CAD">Canadian Dollar (CAD)</option>
              </select>
            </div>

            <h3 style={styles.sectionTitle}>
              System Settings
            </h3>

            <div style={styles.toggleContainer}>
              <span style={styles.toggleLabel}>Maintenance Mode</span>
              <div style={styles.toggleWrapper}>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    name="maintenanceMode"
                    checked={settings.maintenanceMode}
                    onChange={handleChange}
                    style={styles.checkboxInput}
                  />
                  <span style={styles.slider(settings.maintenanceMode)}></span>
                </label>
                <span style={styles.toggleStatus(settings.maintenanceMode)}>
                  {settings.maintenanceMode ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div style={styles.toggleContainer}>
              <span style={styles.toggleLabel}>Email Notifications</span>
              <div style={styles.toggleWrapper}>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    name="notifications"
                    checked={settings.notifications}
                    onChange={handleChange}
                    style={styles.checkboxInput}
                  />
                  <span style={styles.slider(settings.notifications)}></span>
                </label>
                <span style={styles.toggleStatus(settings.notifications)}>
                  {settings.notifications ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div style={styles.toggleContainer}>
              <span style={styles.toggleLabel}>Analytics Tracking</span>
              <div style={styles.toggleWrapper}>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    name="analytics"
                    checked={settings.analytics}
                    onChange={handleChange}
                    style={styles.checkboxInput}
                  />
                  <span style={styles.slider(settings.analytics)}></span>
                </label>
                <span style={styles.toggleStatus(settings.analytics)}>
                  {settings.analytics ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <motion.button
              type="submit"
              style={styles.submitButton}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Save Settings
            </motion.button>
          </form>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminSettings;