import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCalendar, FaUser, FaTag, FaSearch, FaClock, FaChevronRight, FaTimes } from 'react-icons/fa';
import { apiFetch } from '../utils/api'; 
import { toast } from 'react-toastify';
import logo from '../assades/LOGO.png'; // Yokebud logo

const Blog = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [blogs, setBlogs] = useState([]);
  const [filteredBlogs, setFilteredBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  
  // State for the Popup/Modal
  const [selectedBlog, setSelectedBlog] = useState(null);

  const createSlug = (title, keyword = '') => {
    if (!title) return '';
    const base = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove all non-word characters except spaces and hyphens
      .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
    
    if (keyword) {
      const cleanKeyword = keyword
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `${base}-${cleanKeyword}`;
    }
    return base;
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  // Handle URL slug to open specific blog
  useEffect(() => {
    if (blogs.length > 0 && slug) {
      const blog = blogs.find(b => createSlug(b.title, b.excerpt) === slug);
      if (blog) {
        setSelectedBlog(blog);
      } else {
        // If slug not found, clear modal and redirect back to blog
        setSelectedBlog(null);
        navigate('/blog');
      }
    } else if (!slug) {
      setSelectedBlog(null);
    }
  }, [slug, blogs]);

  useEffect(() => {
    filterBlogs();
  }, [searchTerm, selectedCategory, blogs]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedBlog) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [selectedBlog]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/blogs');
      if (response.ok) {
        const data = await response.json();
        setBlogs(data);
        const uniqueCategories = [...new Set(data.map(blog => blog.category).filter(Boolean))];
        setCategories(uniqueCategories);
      } else {
        toast.error('Failed to load blogs');
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
      toast.error('Error loading blogs');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBlog = (blog) => {
    const blogSlug = createSlug(blog.title, blog.excerpt);
    navigate(`/blogs/${blogSlug}`);
  };

  const handleCloseBlog = () => {
    setSelectedBlog(null);
    navigate('/blog');
  };

  const filterBlogs = () => {
    let filtered = [...blogs];
    if (searchTerm) {
      filtered = filtered.filter(blog => 
        blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blog.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(blog => blog.category === selectedCategory);
    }
    setFilteredBlogs(filtered);
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const calculateReadTime = (content) => {
    if (!content) return 1;
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  const getBlogUrl = (blog) => {
    if (!blog) return '';
    const slug = createSlug(blog.title, blog.excerpt);
    const base =
      (typeof window !== 'undefined' && window.location && window.location.origin) ||
      'https://www.yokebud.fi';
    return `${base}/blogs/${slug}`;
  };

  // --- Embedded CSS for Premium Styling ---
  const styles = `
    :root {
      --gold-primary: #D4AF37;
      --gold-shine: #F7EF8A;
      --gold-dark: #AA8C2C;
      --silver-light: #F5F5F5;
      --silver-dark: #8E8E8E;
      --bg-dark: #050505;
      --card-bg: #0B0B0B;
      --border-color: rgba(255, 255, 255, 0.06);
      --glass-bg: rgba(15, 15, 15, 0.7);
    }

    .blog-page {
      min-height: 100vh;
      background-color: var(--bg-dark);
      color: #ffffff;
      padding-top: 100px;
      font-family: 'Inter', sans-serif;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.05), transparent 70%),
        linear-gradient(to bottom, #000 0%, #050505 100%);
    }

    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* --- Hero Typography --- */
    .hero-section {
      text-align: center;
      padding: 60px 0 90px;
    }

    .hero-title {
      font-size: 4rem;
      font-weight: 800;
      margin-bottom: 15px;
      line-height: 1.1;
      letter-spacing: -1px;
    }

    .text-silver {
      background: linear-gradient(135deg, #FFFFFF 0%, #C0C0C0 50%, #6E6E6E 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: inline-block;
      margin-right: 15px;
      text-shadow: 0px 0px 30px rgba(255, 255, 255, 0.1);
    }

    .text-gold {
      background: linear-gradient(135deg, #BF953F 0%, #FCF6BA 50%, #B38728 100%, #FBF5B7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: inline-block;
      text-shadow: 0px 0px 30px rgba(212, 175, 55, 0.2);
    }

    .hero-subtitle {
      color: #888;
      font-size: 1.1rem;
      font-weight: 300;
      max-width: 500px;
      margin: 0 auto;
      letter-spacing: 0.5px;
    }

    /* --- Filters --- */
    .filter-wrapper {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 100px; /* Pill shape for cleaner look */
      padding: 10px 10px 10px 30px;
      margin-bottom: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }

    .category-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-right: 20px;
      scrollbar-width: none;
    }
    .category-scroll::-webkit-scrollbar { display: none; }

    .cat-btn {
      padding: 8px 20px;
      border-radius: 30px;
      background: transparent;
      border: 1px solid transparent;
      color: #888;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .cat-btn:hover {
      color: #fff;
    }

    .cat-btn.active {
      background: rgba(212, 175, 55, 0.1);
      border-color: var(--gold-primary);
      color: var(--gold-primary);
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.1);
    }

    .search-container {
      position: relative;
      min-width: 250px;
    }

    .search-input {
      width: 100%;
      background: rgba(0,0,0,0.3);
      border: none;
      padding: 14px 20px 14px 45px;
      border-radius: 50px;
      color: #fff;
      font-size: 0.9rem;
      transition: all 0.3s;
    }

    .search-input:focus {
      outline: none;
      background: rgba(0,0,0,0.5);
      box-shadow: inset 0 0 0 1px var(--gold-dark);
    }

    .search-icon {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--gold-primary);
    }

    /* --- Blog Grid --- */
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 40px;
      padding-bottom: 80px;
    }

    /* --- Premium Card Styling --- */
    .blog-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0px; /* Sharp corners for more "luxury" feel, or minimal radius */
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
    }

    .blog-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 30px 60px rgba(0,0,0,0.5);
      border-color: rgba(212, 175, 55, 0.4);
    }

    .card-img-wrapper {
      height: 260px;
      overflow: hidden;
      position: relative;
    }

    .card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.7s ease;
      filter: grayscale(20%);
    }

    .blog-card:hover .card-img {
      transform: scale(1.08);
      filter: grayscale(0%);
    }

    .card-category {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(5px);
      color: var(--gold-primary);
      padding: 5px 12px;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-left: 2px solid var(--gold-primary);
    }

    .card-content {
      padding: 30px;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    /* Subtle gold line on top of content */
    .card-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: 30px;
      width: 40px;
      height: 2px;
      background: var(--gold-dark);
      transition: width 0.4s ease;
    }
    
    .blog-card:hover .card-content::before {
      width: 80px;
    }

    .card-meta {
      display: flex;
      gap: 15px;
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 15px;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .meta-item { display: flex; align-items: center; gap: 6px; }
    .meta-item svg { color: var(--gold-dark); }

    .card-title {
      font-size: 1.5rem;
      color: #fff;
      margin-bottom: 15px;
      line-height: 1.3;
      font-family: 'Playfair Display', serif; /* If available, else falls back */
      font-weight: 400;
    }

    .card-excerpt {
      color: #999;
      font-size: 0.95rem;
      line-height: 1.7;
      margin-bottom: 25px;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-weight: 300;
    }

    .read-more-btn {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--gold-primary);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: gap 0.3s;
    }

    .blog-card:hover .read-more-btn { gap: 15px; }


    /* --- MODAL (POPUP) STYLES --- */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .modal-container {
      background: #111;
      width: 100%;
      max-width: 70%;
      max-height: 90vh;
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 4px;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 50px rgba(0,0,0,0.8);
    }

    .modal-close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255,255,255,0.05);
      border: none;
      color: #fff;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.3s;
    }

    .modal-close-btn:hover {
      background: var(--gold-primary);
      color: #000;
      transform: rotate(90deg);
    }

    .modal-scroll-area {
      overflow-y: auto;
      padding: 0;
    }

    /* Custom Scrollbar for Modal */
    .modal-scroll-area::-webkit-scrollbar { width: 6px; }
    .modal-scroll-area::-webkit-scrollbar-track { background: #050505; }
    .modal-scroll-area::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    .modal-scroll-area::-webkit-scrollbar-thumb:hover { background: var(--gold-dark); }

    .modal-hero-img {
      width: 100%;
      height: 350px;
      object-fit: cover;
      display: block;
      mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
    }

    .modal-content-body {
      padding: 0 50px 50px 50px;
      margin-top: -60px; /* Pull text up into faded image */
      position: relative;
      z-index: 2;
    }

    .modal-category {
      color: var(--gold-primary);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 10px;
      display: block;
    }

    .modal-title {
      font-size: 2.5rem;
      line-height: 1.2;
      margin-bottom: 20px;
      color: #fff;
      font-family: 'Playfair Display', serif;
    }

    .modal-meta-row {
      display: flex;
      gap: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 20px;
      margin-bottom: 30px;
      color: #888;
      font-size: 0.9rem;
    }

    .modal-html-content {
      color: #ccc;
      line-height: 1.8;
      font-size: 1.05rem;
    }
    
    .modal-html-content h2, .modal-html-content h3 {
      color: #fff;
      margin-top: 30px;
      margin-bottom: 15px;
    }

    .modal-html-content p {
      margin-bottom: 20px;
    }

    .modal-html-content img {
      max-width: 100%;
      border-radius: 4px;
      margin: 20px 0;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .modal-html-content a {
      color: var(--gold-primary);
      text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero-title { font-size: 2.5rem; }
      .filter-wrapper { flex-direction: column; border-radius: 20px; gap: 20px; align-items: stretch; }
      .cat-btn { font-size: 0.75rem; padding: 6px 12px; }
      .search-container { width: 100%; }
      .blog-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
      .card-img-wrapper { height: 200px; }
      .card-content { padding: 20px; }
      .card-title { font-size: 1.25rem; }
      .card-excerpt { font-size: 0.85rem; }
      .read-more-btn { font-size: 0.75rem; }
      
      .modal-overlay { z-index: 100000; padding: 0; }
      .modal-container { max-width: 90%; width: 100%; height: 100vh; max-height: 100vh; border-radius: 0; border: none; z-index: 100001; }
      .modal-content-body { padding: 0 15px 30px 15px; margin-top: -40px; }
      .modal-title { font-size: 1.35rem; margin-bottom: 12px; line-height: 1.3; }
      .modal-meta-row { font-size: 0.75rem; gap: 10px; margin-bottom: 20px; padding-bottom: 15px; flex-wrap: wrap; }
      .modal-hero-img { height: 200px; }
      .modal-close-btn { 
        position: fixed;
        top: 15px; 
        right: 15px; 
        background: rgba(0,0,0,0.8); 
        border: 1px solid var(--gold-primary); 
        z-index: 100002;
        width: 35px;
        height: 35px;
      }
      .modal-html-content { font-size: 0.9rem; line-height: 1.6; }
      .modal-html-content h1 { font-size: 1.3rem; margin-top: 20px; }
      .modal-html-content h2 { font-size: 1.2rem; margin-top: 18px; }
      .modal-html-content h3 { font-size: 1.1rem; margin-top: 15px; }
      .modal-html-content p { margin-bottom: 12px; }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      
      <div className="blog-page">
        <div className="container">
          
          {/* Hero Section */}
          <section className="hero-section">
            <motion.h1 
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <span className="text-silver">The</span>
              <span className="text-gold">Journal</span>
            </motion.h1>
            <motion.p 
              className="hero-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Curated stories on resin artistry, craftsmanship, and Nordic design.
            </motion.p>
          </section>

          {/* Filter & Search Bar */}
          <motion.div 
            className="filter-wrapper"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="category-scroll">
              <button
                className={`cat-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All Stories
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={`cat-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="search-container">
              <FaSearch className="search-icon" size={12} />
              <input
                type="text"
                className="search-input"
                placeholder="Search the journal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </motion.div>

          {/* Content Area */}
          {loading ? (
            <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               {/* Simple CSS Spinner */}
               <div style={{ width: '40px', height: '40px', border: '2px solid rgba(212,175,55,0.3)', borderTop: '2px solid #D4AF37', borderRadius: '50%', animation: 'spin 1s infinite linear' }}></div>
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>No stories found.</div>
          ) : (
            <div className="blog-grid">
              <AnimatePresence>
                {filteredBlogs.map((blog, index) => (
                  <motion.article
                    key={blog.id}
                    className="blog-card"
                    onClick={() => handleOpenBlog(blog)} // Open Modal via URL
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    layout
                  >
                    <div className="card-img-wrapper">
                      {blog.image_url ? (
                        <img src={blog.image_url} alt={blog.title} className="card-img" />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2rem'
                        }}>
                          <img 
                            src={logo} 
                            alt="Yokebud Logo" 
                            style={{ 
                              maxWidth: '60%', 
                              maxHeight: '60%', 
                              objectFit: 'contain',
                              opacity: 0.6
                            }} 
                          />
                        </div>
                      )}
                      
                      {blog.category && (
                        <span className="card-category">
                          {blog.category}
                        </span>
                      )}
                    </div>

                    <div className="card-content">
                      <div className="card-meta">
                        <span className="meta-item">
                          <FaCalendar size={10} /> {formatDate(blog.created_at)}
                        </span>
                        <span className="meta-item">
                          <FaClock size={10} /> {calculateReadTime(blog.content)} min
                        </span>
                      </div>

                      <h3 className="card-title">{blog.title}</h3>
                      <p className="card-excerpt">
                        {blog.excerpt || blog.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...'}
                      </p>

                      <p style={{ fontSize: '0.75rem', color: '#777', wordBreak: 'break-all', marginBottom: '10px' }}>
                        URL: {getBlogUrl(blog)}
                      </p>

                      <div className="read-more-btn">
                        Read Story <FaChevronRight size={10} />
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL / POPUP --- */}
      <AnimatePresence>
        {selectedBlog && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseBlog} // Close via navigation
          >
            <motion.div 
              className="modal-container"
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()} // Prevent close on content click
            >
              <button className="modal-close-btn" onClick={handleCloseBlog}>
                <FaTimes />
              </button>

              <div className="modal-scroll-area">
                {/* Modal Header Image */}
                {selectedBlog.image_url && (
                  <img src={selectedBlog.image_url} alt={selectedBlog.title} className="modal-hero-img" />
                )}

                {/* Modal Content */}
                <div className="modal-content-body" style={{ marginTop: selectedBlog.image_url ? '-80px' : '40px' }}>
                  <span className="modal-category">{selectedBlog.category}</span>
                  <h2 className="modal-title">{selectedBlog.title}</h2>
                  
                  <div className="modal-meta-row">
                     <span>{formatDate(selectedBlog.created_at)}</span>
                     <span>•</span>
                     <span>{selectedBlog.author || 'Yokebud Team'}</span>
                     <span>•</span>
                     <span>{calculateReadTime(selectedBlog.content)} min read</span>
                     <span>•</span>
                     <span style={{ fontSize: '0.75rem', color: '#777', wordBreak: 'break-all' }}>
                       {getBlogUrl(selectedBlog)}
                     </span>
                  </div>

                  {/* Full HTML Content */}
                  <div 
                    className="modal-html-content"
                    dangerouslySetInnerHTML={{ __html: selectedBlog.content }}
                  />
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Blog;