import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiSave, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
// FIX: Changed 'assades' to 'assets'
import logo from '../../assades/LOGO.png'; 

// --- Modern Loading Spinner ---
const LoadingSpinner = () => (
  <div style={{ 
    height: '60vh', 
    width: '100%', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'column', 
    gap: '15px'
  }}>
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(245, 158, 11, 0.2)',
        borderTop: '3px solid #F59E0B',
        borderRadius: '50%'
      }}
    />
    <motion.span 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }}
      style={{ color: '#a1a1aa', fontSize: '0.9rem', letterSpacing: '0.05em' }}
    >
      Loading Blogs...
    </motion.span>
  </div>
);

const AdminBlog = () => {
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentBlog, setCurrentBlog] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    author: 'Admin',
    image_url: ''
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchBlogs();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/blogs');
      if (response.ok) {
        const data = await response.json();
        setBlogs(data);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    try {
      const form = new FormData();
      form.append('images', file);
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: form
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to upload image');
      }
      const out = await res.json();
      const url = Array.isArray(out.images) && out.images[0] && (out.images[0].url || out.images[0]);
      if (!url) throw new Error('Upload succeeded but no URL returned');
      setFormData(prev => ({ ...prev, image_url: url }));
      setImagePreview(url);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Blog image upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    }
  };

  const openCreateModal = () => {
    setEditMode(false);
    setCurrentBlog(null);
    setFormData({
      title: '',
      excerpt: '',
      content: '',
      category: '',
      author: 'Admin',
      image_url: ''
    });
    setImagePreview(null);
    setShowModal(true);
  };

  const openEditModal = (blog) => {
    setEditMode(true);
    setCurrentBlog(blog);
    setFormData({
      title: blog.title,
      excerpt: blog.excerpt,
      content: blog.content,
      category: blog.category || '',
      author: blog.author || 'Admin',
      image_url: blog.image_url || ''
    });
    setImagePreview(blog.image_url);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        excerpt: formData.excerpt,
        content: formData.content,
        category: formData.category,
        author: formData.author,
        image_url: formData.image_url || (editMode && currentBlog ? currentBlog.image_url : '')
      };

      const url = editMode ? `/api/blogs/${currentBlog.id}` : '/api/blogs';
      const method = editMode ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (response.ok) {
        toast.success(editMode ? 'Blog updated successfully!' : 'Blog created successfully!');
        setShowModal(false);
        fetchBlogs();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save blog');
      }
    } catch (error) {
      console.error('Error saving blog:', error);
      toast.error('Error saving blog');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) return;

    try {
      const response = await apiFetch(`/api/blogs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Blog deleted successfully!');
        fetchBlogs();
      } else {
        toast.error('Failed to delete blog');
      }
    } catch (error) {
      console.error('Error deleting blog:', error);
      toast.error('Error deleting blog');
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
    createBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '14px 28px',
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      border: 'none',
      borderRadius: '12px',
      color: '#000',
      fontWeight: '700',
      cursor: 'pointer',
      fontSize: '1rem',
      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
      transition: 'all 0.3s'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '2rem',
    },
    card: {
      background: '#111',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px',
      overflow: 'hidden',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    },
    cardImage: {
      width: '100%',
      height: '200px',
      objectFit: 'cover',
    },
    cardContent: {
      padding: '1.8rem'
    },
    cardTitle: {
      fontSize: '1.3rem',
      fontWeight: '700',
      marginBottom: '0.8rem',
      color: '#fff',
    },
    cardExcerpt: {
      fontSize: '0.95rem',
      color: '#a1a1aa',
      marginBottom: '1.5rem',
      lineHeight: '1.6',
    },
    cardMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.8rem',
      color: '#71717a',
      marginBottom: '1.5rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    cardActions: {
      display: 'flex',
      gap: '12px'
    },
    editBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      color: '#F59E0B',
      cursor: 'pointer',
      fontWeight: '600',
      transition: 'all 0.3s'
    },
    deleteBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px',
      background: 'rgba(239, 68, 68, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: '10px',
      color: '#EF4444',
      cursor: 'pointer',
      fontWeight: '600',
      transition: 'all 0.3s'
    },

    // --- Modern Modal Styles ---
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: isMobile ? '10px' : '20px'
    },
    modalContent: {
      background: '#0f0f0f',
      backgroundImage: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.05), transparent)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: isMobile ? '1.5rem' : '2.5rem',
      width: '80%',
      maxHeight: '90vh',
      overflowY: 'auto',
      position: 'relative',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      scrollbarWidth: 'thin',
      scrollbarColor: '#333 transparent'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      top: 0,
      background: '#0f0f0f',
      zIndex: 10,
      paddingBottom: '1rem',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    },
    modalTitle: {
      fontSize: '1.8rem',
      fontWeight: '800',
      color: '#fff',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.05)',
      border: 'none',
      color: '#fff',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '1.5rem'
    },
    formGroup: {
      marginBottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    fullWidth: {
      gridColumn: isMobile ? 'auto' : '1 / span 2'
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
      minHeight: '100px',
      resize: 'vertical',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      lineHeight: '1.6'
    },
    imageSection: {
      background: 'rgba(255,255,255,0.02)',
      border: '2px dashed rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '20px',
      textAlign: 'center',
      transition: 'all 0.3s ease'
    },
    imagePreview: {
      width: '100%',
      height: '200px',
      objectFit: 'cover',
      borderRadius: '12px',
      marginBottom: '15px',
      boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
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
      boxShadow: '0 10px 25px rgba(245, 158, 11, 0.2)'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #F59E0B;
        }
      `}</style>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Blog Studio</h1>
          <p style={{ color: '#71717a', marginTop: '8px' }}>Manage and publish your stories</p>
        </div>
        <motion.button 
          style={styles.createBtn}
          onClick={openCreateModal}
          whileHover={{ scale: 1.02, translateY: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiPlus size={22} />
          Create Post
        </motion.button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : blogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: '#52525b' }}>
          <FiEdit2 size={48} style={{ marginBottom: '20px', opacity: 0.2 }} />
          <h3>No blogs found</h3>
          <p>Start your journey by creating your first post.</p>
        </div>
      ) : (
        <motion.div 
          style={styles.grid}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {blogs.map((blog) => (
            <motion.div 
              key={blog.id} 
              style={styles.card}
              layout
              whileHover={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <img 
                  src={blog.image_url || logo} 
                  alt={blog.title} 
                  style={{
                    ...styles.cardImage,
                    opacity: blog.image_url ? 1 : 0.2,
                    padding: blog.image_url ? 0 : '40px'
                  }} 
                />
                <div style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  padding: '5px 12px',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {blog.category || 'General'}
                </div>
              </div>

              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>{blog.title}</h3>
                <p style={styles.cardExcerpt}>{blog.excerpt}</p>
                <div style={styles.cardMeta}>
                  <span>By {blog.author}</span>
                  <span>{new Date(blog.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div style={styles.cardActions}>
                  <button 
                    style={styles.editBtn}
                    onClick={() => openEditModal(blog)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  >
                    <FiEdit2 size={16} /> Edit
                  </button>
                  <button 
                    style={styles.deleteBtn}
                    onClick={() => handleDelete(blog.id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                  >
                    <FiTrash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* --- Modern Animated Modal --- */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            style={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div 
              style={styles.modalContent}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  {editMode ? <><FiEdit2 color="#F59E0B" /> Edit Post</> : <><FiPlus color="#F59E0B" /> New Post</>}
                </h2>
                <button 
                  style={styles.closeBtn}
                  onClick={() => setShowModal(false)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={styles.formGrid}>
                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}>Post Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder="Catchy headline for your blog..."
                      required
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#F59E0B';
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      style={{...styles.input, cursor: 'pointer'}}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                    >
                      <option value="" style={{ background: '#1a1a1a' }}>Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name} style={{ background: '#1a1a1a' }}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Author Name</label>
                    <input
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder="Admin"
                      onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}>Targeted Keyword</label>
                    <textarea
                      name="excerpt"
                      value={formData.excerpt}
                      onChange={handleInputChange}
                      style={styles.textarea}
                      placeholder="Enter targeted keywords for SEO (e.g. resin-art, handmade-crafts)..."
                      onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}>Content (Markdown/HTML Supported) *</label>
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleInputChange}
                      style={{...styles.textarea, minHeight: '250px'}}
                      placeholder="Share your story here..."
                      required
                      onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}>Featured Image</label>
                    <div style={styles.imageSection}>
                      {imagePreview && (
                        <motion.img 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          src={imagePreview} 
                          alt="Preview" 
                          style={styles.imagePreview} 
                        />
                      )}
                      <input
                        type="file"
                        id="imageInput"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                      <label 
                        htmlFor="imageInput" 
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 24px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          color: '#F59E0B',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
                      >
                        <FiImage size={20} />
                        {imagePreview ? 'Replace Image' : 'Select Featured Image'}
                      </label>
                      <p style={{ fontSize: '0.75rem', color: '#52525b', marginTop: '10px' }}>
                        Recommended: 1200x630px (Max 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                <motion.button 
                  type="submit" 
                  style={styles.submitBtn}
                  whileHover={{ scale: 1.01, translateY: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <FiSave size={20} />
                  {editMode ? 'Save Changes' : 'Publish Now'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBlog;