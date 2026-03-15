import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true' || 
                         document.cookie.split('; ').some(row => row.startsWith('adminAuth=authenticated'));
  
  if (!isAuthenticated) {
    localStorage.removeItem('isAdminAuthenticated');
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default ProtectedRoute;