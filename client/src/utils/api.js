// Development এবং Production এর জন্য API URL সেটআপ
// আপনার লোকাল সার্ভার যদি 5000 পোর্টে চলে, তবে লোকালহোস্টে https://api.yokebud.fi ব্যবহার করা উচিত।
export const API_BASE = (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname))
  ? '' // Use Vite proxy in development
  : (import.meta.env.VITE_API_URL || 'https://api.yokebud.fi'); // Use env or default in production

export const SOCKET_BASE = API_BASE;

/**
 * Enhanced fetch wrapper for handling Headers, Auth, and FormData automatically.
 * Includes automatic retry mechanism for network errors.
 */
export async function apiFetch(endpoint, options = {}, retries = 3) {
  // ১. URL তৈরি করা
  const isApiPath = typeof endpoint === 'string' && endpoint.startsWith('/api');
  const url = isApiPath ? `${API_BASE}${endpoint}` : endpoint;

  // ২. ডিফল্ট হেডার সেট করা
  const headers = { ...(options.headers || {}) };

  // ৩. টোকেন যুক্ত করা (যদি লোকাল স্টোরেজে থাকে)
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null; 
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // ৪. Content-Type হ্যান্ডলিং
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  } else if (options.body && typeof options.body === 'object' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const config = {
    ...options,
    headers,
    // Admin endpoints depend on HTTP-only cookie (adminAuth) set on API domain.
    // Production: frontend (yokebud.fi) talks to backend (api.yokebud.fi) as cross-site,
    // so we must explicitly include credentials for cookies to be sent.
    credentials: isApiPath ? 'include' : (options.credentials || 'same-origin')
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, config);

      // অ্যাডমিন অথেন্টিকেশন ফেইল চেক
      const path = typeof endpoint === 'string' ? endpoint : '';
      const isAdminEndpoint = path.startsWith('/api/admin') || path.startsWith('/api/blogs');

      // Sitemap tab e jodi kono কারনে 401/403 ashe, shekhane auto-logout korbo na,
      // shudhu response return korbo jate UI nijer moto handle korte pare.
      const isSitemapAdminEndpoint =
        typeof path === 'string' &&
        (path.startsWith('/api/admin/sitemap') || path.startsWith('/api/admin/sitemap/'));

      if ((response.status === 401 || response.status === 403) && isAdminEndpoint && !isSitemapAdminEndpoint) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('isAdminAuthenticated'); 
          localStorage.removeItem('token');
          document.cookie = "adminAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login'; 
        }
      }

      return response;
    } catch (error) {
      if (i === retries - 1) {
        console.error("API Request Failed after multiple retries:", error);
        throw error;
      }
      // Wait for 1 second before retrying
      await new Promise(res => setTimeout(res, 1000));
    }
  }
}

// হেল্পার ফাংশন: ইমেজের পূর্ণাঙ্গ URL পাওয়ার জন্য
export function absoluteUrl(path) {
  if (!path) return '';
  if (typeof path !== 'string') return '';
  if (path.startsWith('http')) return path;
  
  // ক্লাউডিনারি লিংক হলে সরাসরি রিটার্ন করুন
  if (path.includes('cloudinary.com')) return path;

  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SOCKET_BASE}${clean}`;
}