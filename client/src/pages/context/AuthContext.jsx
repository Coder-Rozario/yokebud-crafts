// // src/context/AuthContext.jsx
// import { createContext, useContext, useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// const API_BASE_URL = 'https://api.yokebud.fiapi';

// const AuthContext = createContext();

// export const AuthProvider = ({ children }) => {
//   const [admin, setAdmin] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const navigate = useNavigate();

//   const checkAuth = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/admin/check-auth`, {
//         credentials: 'include',
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });

//       if (!response.ok) {
//         // Don't throw error for 401 - just means not logged in
//         if (response.status !== 401) {
//           throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         return;
//       }

//       const data = await response.json();
//       if (data.authenticated) {
//         setAdmin({ username: data.username });
//       }
//     } catch (error) {
//       console.error('Auth check failed:', error);
//       setError(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     checkAuth();
//   }, []);

//   const login = async (credentials) => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       const response = await fetch(`${API_BASE_URL}/admin/login`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(credentials),
//         credentials: 'include'
//       });

//       const data = await response.json();
      
//       if (!response.ok) {
//         throw new Error(data.message || data.error || 'Login failed');
//       }

//       setAdmin({ username: data.username });
//       await checkAuth(); // Verify auth status after login
//       return data;
//     } catch (error) {
//       console.error('Login error:', error);
//       setError(error.message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   };

//   const logout = async () => {
//     try {
//       await fetch(`${API_BASE_URL}/admin/logout`, {
//         method: 'POST',
//         credentials: 'include'
//       });
//       setAdmin(null);
//       navigate('/admin/login');
//     } catch (error) {
//       console.error('Logout failed:', error);
//       setError(error.message);
//     }
//   };

//   return (
//     <AuthContext.Provider value={{ 
//       admin, 
//       login, 
//       logout, 
//       loading, 
//       error,
//       checkAuth
//     }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

import React from 'react';

const AuthContext = () => {
  return (
    <div>
      
    </div>
  );
};

export default AuthContext;