import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../pages/admin/AdminSidebar';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const styles = {
    adminLayout: {
      display: 'flex',
      height: '100vh',
      background: '#0a0a0a',
      overflow: 'hidden'
    },
    adminContent: {
      flex: 1,
      marginLeft: isMobile ? '0' : '260px',
      width: isMobile ? '100%' : 'calc(100% - 260px)',
      height: '100vh',
      background: '#0a0a0a',
      overflowX: 'hidden',
      overflowY: 'auto',
      transition: 'all 0.3s ease'
    }
  };

  return (
    <>
      <style>{`
        body {
          overflow: hidden;
        }
        #root {
          overflow: hidden;
        }
      `}</style>
      
      <div style={styles.adminLayout}>
        <AdminSidebar 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        
        <div style={styles.adminContent}>
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default AdminLayout;