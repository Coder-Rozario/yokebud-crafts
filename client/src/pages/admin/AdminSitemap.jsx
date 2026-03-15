import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiSave, FiPlus, FiTrash2, FiRefreshCw, FiClock, FiCheck, 
  FiX, FiSearch, FiChevronDown, FiChevronUp, FiLink 
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';

const PRIORITY_OPTIONS = ['1.0', '0.9', '0.8', '0.7', '0.6', '0.5', '0.4', '0.3', '0.2', '0.1'];
const FREQUENCY_OPTIONS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

const AdminSitemap = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newEntry, setNewEntry] = useState({ path: '', priority: '0.6', changefreq: 'weekly', type: 'static' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [entriesRes, revisionsRes, productsRes] = await Promise.all([
        apiFetch('/api/admin/sitemap'),
        apiFetch('/api/admin/sitemap/revisions'),
        apiFetch('/api/products')
      ]);

      if (entriesRes.ok) {
        const result = await entriesRes.json();
        if (result.success) setEntries(result.data);
      }
      if (revisionsRes.ok) {
        const result = await revisionsRes.json();
        if (result.success) setRevisions(result.data);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        const productList = Array.isArray(data) ? data : (data?.products || []);
        setProducts(productList);
      }
    } catch (error) {
      toast.error('Error loading sitemap data');
    } finally {
      setTimeout(() => setLoading(false), 800); // Smooth transition
    }
  };

  // Search Logic
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => 
      entry.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, searchQuery]);

  // Handlers (Keep original logic)
  const handleAddEntry = async () => {
    if (!newEntry.path) return toast.error('Path is required');
    setActiveAction('add');
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
      if (res.ok) {
        toast.success('Entry added successfully');
        setNewEntry({ path: '', priority: '0.6', changefreq: 'weekly', type: 'static' });
        setShowAddForm(false);
        fetchData();
      }
    } catch (error) {
      toast.error('Error adding entry');
    } finally {
      setSaving(false);
      setActiveAction(null);
    }
  };

  const handleSyncProducts = async () => {
    const toSlug = (text) => text?.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
    const productEntries = products.map(p => ({
      path: `/products/${p.id}/${toSlug(p.product_name || p.name)}`,
      priority: '0.8',
      changefreq: 'weekly',
      type: 'product'
    }));
    if (productEntries.length === 0) return toast.info('No products to sync');
    setActiveAction('syncProducts');
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/sitemap/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: productEntries })
      });
      if (res.ok) {
        toast.success('All products synced');
        fetchData();
      }
    } catch (error) { toast.error('Sync failed'); }
    finally { setSaving(false); setActiveAction(null); }
  };

  const handleUpdateEntry = async (id, data, isSync = false) => {
    setActiveAction('update');
    setSaving(true);
    try {
      const res = await apiFetch(isSync ? '/api/admin/sitemap/sync' : `/api/admin/sitemap/${id}`, {
        method: isSync ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSync ? { entries: [data] } : data)
      });
      if (res.ok) {
        toast.success('Updated successfully');
        setEditingId(null);
        fetchData();
      }
    } catch (error) { toast.error('Update failed'); }
    finally { setSaving(false); setActiveAction(null); }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    setActiveAction('delete');
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/sitemap/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Deleted'); fetchData(); }
    } catch (error) { toast.error('Delete failed'); }
    finally { setSaving(false); setActiveAction(null); }
  };

  const handleRegenerateSitemap = async () => {
    setActiveAction('regenerate');
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/sitemap/regenerate', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Generated! URLs: ${result.count}`);
        fetchData();
      }
    } catch (error) { toast.error('Regeneration failed'); }
    finally { setSaving(false); setActiveAction(null); }
  };

  const handleRevert = async (revId) => {
    if (!window.confirm('Revert to this version?')) return;
    setActiveAction('revert');
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/sitemap/revert/${revId}`, { method: 'POST' });
      if (res.ok) { toast.success('Reverted'); fetchData(); }
    } catch (error) { toast.error('Revert failed'); }
    finally { setSaving(false); setActiveAction(null); }
  };

  const styles = {
    container: {
      padding: isMobile ? '1rem' : '2.5rem',
      background: '#050505',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: "'Inter', sans-serif"
    },
    headerCard: {
      background: 'linear-gradient(145deg, #111, #080808)',
      padding: '2rem',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      marginBottom: '2rem',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    },
    searchWrapper: {
      position: 'relative',
      flex: '1',
      maxWidth: isMobile ? '100%' : '400px'
    },
    searchInput: {
      width: '100%',
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '12px 12px 12px 40px',
      color: '#fff',
      fontSize: '0.9rem',
      outline: 'none',
      transition: 'all 0.3s'
    },
    input: {
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      color: '#fff',
      padding: '10px 14px',
      fontSize: '0.9rem',
      outline: 'none',
      width: '100%',
      focus: { borderColor: '#F59E0B' }
    },
    btn: {
      padding: '10px 20px',
      borderRadius: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s',
      border: 'none',
      fontSize: '0.85rem'
    },
    badge: (type) => {
      const colors = {
        static: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
        category: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' },
        blog: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f97316' },
        product: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' }
      };
      const style = colors[type] || { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' };
      return {
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.7rem',
        fontWeight: '700',
        background: style.bg,
        color: style.text,
        textTransform: 'uppercase'
      };
    }
  };

  if (loading) return (
    <div style={{...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        style={{ width: 50, height: 50, border: '3px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#F59E0B', borderRadius: '50%' }}
      />
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Header & Controls */}
      <div style={styles.headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', background: 'linear-gradient(to right, #F59E0B, #FBBF24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Sitemap Engine</h1>
            <p style={{ color: '#71717a', marginTop: '5px' }}>Configure SEO pathways and XML generation</p>
          </div>
          
          <div style={styles.searchWrapper}>
            <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
            <input 
              style={styles.searchInput} 
              placeholder="Search by path or type..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '2rem', flexWrap: 'wrap' }}>
          <motion.button
            whileTap={{ scale: saving ? 1 : 0.95 }}
            style={{
              ...styles.btn,
              background: activeAction === 'regenerate' ? 'rgba(245, 158, 11, 0.7)' : '#F59E0B',
              color: '#000',
              boxShadow: activeAction === 'regenerate' ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'none'
            }}
            onClick={handleRegenerateSitemap}
            disabled={saving}
          >
            {activeAction === 'regenerate' ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                  <FiRefreshCw />
                </motion.span>
                Regenerating...
              </>
            ) : (
              <> <FiRefreshCw /> Regenerate XML </>
            )}
          </motion.button>

          <button style={{...styles.btn, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)'}} onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <FiX /> : <FiPlus />} {showAddForm ? 'Close Editor' : 'Add New URL'}
          </button>

          <motion.button
            whileTap={{ scale: saving ? 1 : 0.95 }}
            style={{
              ...styles.btn,
              background: activeAction === 'syncProducts' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              boxShadow: activeAction === 'syncProducts' ? '0 0 20px rgba(16, 185, 129, 0.35)' : 'none'
            }}
            onClick={handleSyncProducts}
            disabled={saving}
          >
            {activeAction === 'syncProducts' ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                  <FiRefreshCw />
                </motion.span>
                Syncing...
              </>
            ) : (
              <> <FiRefreshCw /> Sync Products </>
            )}
          </motion.button>

          <button style={{...styles.btn, background: 'rgba(255,255,255,0.05)', color: '#a1a1aa'}} onClick={() => setShowRevisions(!showRevisions)}>
            <FiClock /> {showRevisions ? 'View List' : 'History'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', marginBottom: '2rem' }}
          >
            <div style={{...styles.headerCard, background: '#111', border: '1px solid rgba(245, 158, 11, 0.2)'}}>
              <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}><FiPlus color="#F59E0B"/> Define New Entry</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '8px', display: 'block' }}>Path</label>
                  <input style={styles.input} placeholder="/new-service-page" value={newEntry.path} onChange={e => setNewEntry({...newEntry, path: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '8px', display: 'block' }}>Priority</label>
                  <select style={styles.input} value={newEntry.priority} onChange={e => setNewEntry({...newEntry, priority: e.target.value})}>
                    {PRIORITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '8px', display: 'block' }}>Frequency</label>
                  <select style={styles.input} value={newEntry.changefreq} onChange={e => setNewEntry({...newEntry, changefreq: e.target.value})}>
                    {FREQUENCY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '8px', display: 'block' }}>Type</label>
                  <select style={styles.input} value={newEntry.type} onChange={e => setNewEntry({...newEntry, type: e.target.value})}>
                    <option value="static">Static</option>
                    <option value="category">Category</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
                <motion.button
                  whileTap={{ scale: saving ? 1 : 0.95 }}
                  style={{
                    ...styles.btn,
                    background: activeAction === 'add' ? 'rgba(245, 158, 11, 0.7)' : '#F59E0B',
                    color: '#000',
                    height: '42px',
                    boxShadow: activeAction === 'add' ? '0 0 16px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                  onClick={handleAddEntry}
                  disabled={saving}
                >
                  {activeAction === 'add' ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                        <FiRefreshCw />
                      </motion.span>
                      Saving...
                    </>
                  ) : (
                    'Save Entry'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {!showRevisions ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Type', 'Pathway', 'Priority', 'Frequency', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '1.2rem', fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    key={entry.id} 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: editingId === entry.id ? 'rgba(245, 158, 11, 0.03)' : 'transparent' }}
                  >
                    <td style={{ padding: '1.2rem' }}><span style={styles.badge(entry.type)}>{entry.type}</span></td>
                    <td style={{ padding: '1.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiLink size={14} color="#555" />
                        {editingId === entry.id ? (
                          <input style={styles.input} value={entry.path} onChange={e => setEntries(entries.map(ev => ev.id === entry.id ? {...ev, path: e.target.value} : ev))} />
                        ) : (
                          <span style={{ fontSize: '0.9rem', color: '#eee' }}>{entry.path}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1.2rem', color: '#a1a1aa' }}>
                      {editingId === entry.id ? (
                        <select
                          style={{ ...styles.input, padding: '8px 12px', minWidth: '80px' }}
                          value={entry.priority}
                          onChange={e => setEntries(entries.map(ev => ev.id === entry.id ? { ...ev, priority: e.target.value } : ev))}
                        >
                          {PRIORITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        entry.priority
                      )}
                    </td>
                    <td style={{ padding: '1.2rem', color: '#a1a1aa' }}>
                      {editingId === entry.id ? (
                        <select
                          style={{ ...styles.input, padding: '8px 12px', minWidth: '100px' }}
                          value={entry.changefreq}
                          onChange={e => setEntries(entries.map(ev => ev.id === entry.id ? { ...ev, changefreq: e.target.value } : ev))}
                        >
                          {FREQUENCY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        entry.changefreq
                      )}
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <button 
                        onClick={() => handleUpdateEntry(entry.id, {...entry, is_active: !entry.is_active})}
                        style={{ background: 'none', border: 'none', color: entry.is_active ? '#10b981' : '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        {entry.is_active ? <FiCheck /> : <FiX />} {entry.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {editingId === entry.id ? (
                          <button
                            style={{
                              color: activeAction === 'update' ? '#71717a' : '#10b981',
                              background: 'none',
                              border: 'none',
                              cursor: activeAction === 'update' ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onClick={() => handleUpdateEntry(entry.id, entry)}
                            disabled={saving}
                          >
                            {activeAction === 'update' ? (
                              <>
                                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                                  <FiRefreshCw size={16} />
                                </motion.span>
                                Updating...
                              </>
                            ) : (
                              <><FiSave size={18}/> Save</>
                            )}
                          </button>
                        ) : (
                          <button style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setEditingId(entry.id)}><FiPlus size={18}/></button>
                        )}
                        <button
                          style={{
                            color: activeAction === 'delete' ? '#71717a' : '#ef4444',
                            background: 'none',
                            border: 'none',
                            cursor: activeAction === 'delete' ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={saving}
                        >
                          {activeAction === 'delete' ? (
                            <>
                              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                                <FiRefreshCw size={16} />
                              </motion.span>
                              Deleting...
                            </>
                          ) : (
                            <FiTrash2 size={18}/>
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '1.5rem' }}>
             {revisions.map(rev => (
                <div key={rev.id} style={{ background: '#111', padding: '1.2rem', borderRadius: '16px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.8rem', color: rev.action === 'ADD' ? '#10b981' : '#3b82f6' }}>{rev.action}</span>
                      <span style={{ color: '#555', fontSize: '0.8rem' }}>{new Date(rev.created_at).toLocaleString()}</span>
                    </div>
                    <code style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>{rev.action === 'ADD' ? JSON.parse(rev.new_data).path : `ID: ${rev.entry_id}`}</code>
                  </div>
                  <motion.button
                    whileTap={{ scale: saving ? 1 : 0.95 }}
                    style={{
                      ...styles.btn,
                      background: activeAction === 'revert' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.1)',
                      color: '#F59E0B',
                      boxShadow: activeAction === 'revert' ? '0 0 14px rgba(245, 158, 11, 0.3)' : 'none'
                    }}
                    onClick={() => handleRevert(rev.id)}
                    disabled={saving}
                  >
                    {activeAction === 'revert' ? (
                      <>
                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                          <FiRefreshCw />
                        </motion.span>
                        Reverting...
                      </>
                    ) : (
                      'Revert'
                    )}
                  </motion.button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSitemap;