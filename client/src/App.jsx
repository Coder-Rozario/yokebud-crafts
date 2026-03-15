import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
import './pages/styles/main.scss';
import ProtectedRoute from './components/ProtectedRoute';
const Signup = lazy(() => import('./components/Signup'));
const CartPage = lazy(() => import('./pages/CartPage'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const PolicyPage = lazy(() => import('./components/PolicyPage'));
const Return = lazy(() => import('./components/Return'));
const Shipping = lazy(() => import('./components/Shipping'));
import Loading from './components/Loading';
import { ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Customization from './components/Custozization';

function ScrollToTop() {
  const { pathname, state } = useLocation();
  useEffect(() => {
    // Don't scroll to top if we're opening a modal over the current page
    if (state && state.background) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [pathname]);
  return null;
}
const AdminEdit = lazy(() => import('./pages/admin/AdminEdit'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings '));
const AdminUpload = lazy(() => import('./pages/admin/AdminUpload '));
const ProductModal = lazy(() => import('./components/ProductModal'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const Checkout = lazy(() => import('./components/Checkout'));
const Inquiry = lazy(() => import('./components/Inquiry'));
const AdminInquiry = lazy(() => import('./pages/admin/AdminInquiry'));
const MessagesPage = lazy(() => import('./components/MessagesPage'));
const UnsubscribePage = lazy(() => import('./components/UnsubscribePage'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const Blog = lazy(() => import('./pages/Blog'));
const AdminBlog = lazy(() => import('./pages/admin/AdminBlog'));
const AdminSEO = lazy(() => import('./pages/admin/AdminSEO'));
const AdminSitemap = lazy(() => import('./pages/admin/AdminSitemap'));

function AppContent() {
  const location = useLocation();
  const background = location.state && location.state.background;

  return (
    <>
      <Routes location={background || location}>
        <Route path="/loading" element={<Loading />} />
        
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/" element={<Home />} />
          <Route path="MessagesPage" element={<MessagesPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/UnsubscribePage" element={<UnsubscribePage />} />
          <Route path="/Inquiry" element={<Inquiry />} />
          <Route path="/Checkout" element={<Checkout />} />
          <Route path="/UserProfile" element={<UserProfile />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/blogs/:slug" element={<Blog />} />
          <Route path="/Customization" element={<Customization />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/return" element={<Return />} />
          <Route path="/shipping" element={<Shipping />} />
          <Route path="/products/:id" element={<Home />} />
          <Route path="/products/:id/:slug" element={<Home />} />
          <Route path="/p/:id/:slug" element={<Home />} />
          <Route path="/p/:id" element={<Home />} />
        </Route>

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Admin Routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminPanel />} />
          <Route path="dashboard" element={<AdminPanel />} />
          <Route path="AdminInquiry" element={<AdminInquiry />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="upload" element={<AdminUpload />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="seo" element={<AdminSEO />} />
          <Route path="sitemap" element={<AdminSitemap />} />
          <Route path="products/edit/:id" element={<AdminEdit />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="messages/:id" element={<AdminMessages />} />
        </Route>

        {/* 404 Page */}
        <Route path="*" element={<div>Page Not Found</div>} />
      </Routes>

      {/* Show the modal when we match a product route, either as a modal or a separate page content */}
      <Routes>
        <Route path="/products/:id" element={<ProductModal />} />
        <Route path="/products/:id/:slug" element={<ProductModal />} />
        <Route path="/p/:id/:slug" element={<ProductModal />} />
        <Route path="/p/:id" element={<ProductModal />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <AppContent />
      </Suspense>
      <ToastContainer position="top-right" autoClose={3000} theme="dark" newestOnTop pauseOnFocusLoss={false} pauseOnHover transition={Slide} closeOnClick className="premium-toast-container" />
    </Router>
  );
}

export default App;
