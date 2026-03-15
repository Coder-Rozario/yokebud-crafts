import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiUpload, FiX, FiCheck, FiBox, FiDollarSign, FiTag, FiLayers, FiImage, FiHash, FiRefreshCw, FiSave, FiEdit2, FiLoader } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { apiFetch } from '../../utils/api';

const AdminEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('products');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Feature Modal State
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [newFeatureInput, setNewFeatureInput] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [product, setProduct] = useState({
    name: '',
    description: '',
    product_price: '',
    discount_price: '',
    categories: [],
    stock: '', // Total stock
    material: '',
    care: '',
    sku: '',
    shipping: '',
    warranty: '',
    bulk_discount: '',
    sizes: [],
    colors: [],
    tags: [],
    features: [],
    is_customizable: false
  });
  
  // New State for handling variant specific stock
  const [variantStock, setVariantStock] = useState({});
  const [removedVariantKeys, setRemovedVariantKeys] = useState([]);

  const [previews, setPreviews] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]); 
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  const [categories, setCategories] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const handleDeleteCategory = (catId, catName) => {
    toast.warn(
      <div style={{ padding: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Permanently delete category "{catName}"?</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { confirmDeleteCategory(catId); toast.dismiss(); }} style={{ background: '#ff4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Yes, Delete</button>
          <button onClick={() => toast.dismiss()} style={{ background: '#444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>,
      { autoClose: false, closeButton: false, icon: false, style: { background: '#1e1e1e', border: '1px solid #333' } }
    );
  };

  const confirmDeleteCategory = async (id) => {
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Category deleted successfully');
        fetchCategories();
        setIsDeleteMode(false);
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error deleting category');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newCategoryName, parent_id: parentCategoryId || null })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Category added!');
        setNewCategoryName('');
        setParentCategoryId('');
        setIsCategoryModalOpen(false);
        fetchCategories();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to add category');
    }
  };
  const letterSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const numberSizes = ['28', '30', '32', '34', '36', '38', '40', '42', '44'];

  const CLOTHING_COLORS = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Gray', hex: '#808080' },
    { name: 'Light Gray', hex: '#D3D3D3' },
    { name: 'Dark Gray', hex: '#A9A9A9' },
    { name: 'Charcoal', hex: '#36454F' },
    { name: 'Navy', hex: '#000080' },
    { name: 'Royal Blue', hex: '#4169E1' },
    { name: 'Blue', hex: '#3498db' },
    { name: 'Sky Blue', hex: '#87CEEB' },
    { name: 'Teal', hex: '#008080' },
    { name: 'Cyan', hex: '#00FFFF' },
    { name: 'Green', hex: '#008000' },
    { name: 'Forest Green', hex: '#27ae60' },
    { name: 'Lime', hex: '#32CD32' },
    { name: 'Olive', hex: '#808000' },
    { name: 'Yellow', hex: '#FFD400' },
    { name: 'Mustard', hex: '#FFDB58' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Coral', hex: '#FF7F50' },
    { name: 'Red', hex: '#e74c3c' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Burgundy', hex: '#800020' },
    { name: 'Pink', hex: '#FFC0CB' },
    { name: 'Hot Pink', hex: '#FF69B4' },
    { name: 'Magenta', hex: '#FF00FF' },
    { name: 'Purple', hex: '#8e44ad' },
    { name: 'Lavender', hex: '#E6E6FA' },
    { name: 'Brown', hex: '#8B4513' },
    { name: 'Tan', hex: '#D2B48C' },
    { name: 'Beige', hex: '#F5F5DC' },
    { name: 'Cream', hex: '#FFFDD0' },
    { name: 'Midnight', hex: '#2c3e50' }
  ];

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_SIZE_BYTES = 120 * 1024 * 1024;

  const normalizeColorName = (value) => {
    if (!value) return value;
    const byName = CLOTHING_COLORS.find(c => String(c.name).toLowerCase() === String(value).toLowerCase());
    if (byName) return byName.name;
    const byHex = CLOTHING_COLORS.find(c => String(c.hex).toLowerCase() === String(value).toLowerCase());
    return byHex ? byHex.name : value;
  };

  // --- Helper to determine if we have variants ---
  const hasVariants = useMemo(() => {
    return (product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0);
  }, [product.colors, product.sizes]);

  // --- Generate Variant Combinations ---
  const variantCombinations = useMemo(() => {
    const combos = [];
    if (product.colors.length > 0 && product.sizes.length > 0) {
      // Both Color and Size
      product.colors.forEach(color => {
        product.sizes.forEach(size => {
          combos.push({ color, size, key: `${color}-${size}` });
        });
      });
    } else if (product.colors.length > 0) {
      // Only Colors
      product.colors.forEach(color => {
        combos.push({ color, size: null, key: `${color}-NA` });
      });
    } else if (product.sizes.length > 0) {
      // Only Sizes
      product.sizes.forEach(size => {
        combos.push({ color: null, size, key: `NA-${size}` });
      });
    }
    return combos;
  }, [product.colors, product.sizes]);

  const activeVariantCombinations = useMemo(() => {
    return variantCombinations.filter(c => !removedVariantKeys.includes(c.key));
  }, [variantCombinations, removedVariantKeys]);

  // --- Calculate total stock automatically from active variants ---
  useEffect(() => {
    if (hasVariants) {
      const total = activeVariantCombinations.reduce((acc, combo) => {
        const qty = parseInt(variantStock[combo.key]) || 0;
        return acc + qty;
      }, 0);
      if (parseInt(product.stock) !== total) {
        setProduct(prev => ({ ...prev, stock: total }));
      }
    }
  }, [variantStock, activeVariantCombinations, hasVariants]);

  // --- Fetch Existing Product Data ---
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await apiFetch(`/api/products/${id}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        const p = await response.json();
        const imgs = Array.isArray(p.images) ? p.images : Array.isArray(p.product_photos) ? p.product_photos : [];
        
        // 1. Set Basic Info
        const incomingColors = Array.isArray(p.colors) ? p.colors : (p.attributes && Array.isArray(p.attributes.colors) ? p.attributes.colors : []);
        const normalizedColors = (incomingColors || []).map(normalizeColorName);
        const incomingSizes = Array.isArray(p.sizes) ? p.sizes : (p.attributes && Array.isArray(p.attributes.sizes) ? p.attributes.sizes : []);
        setProduct({
          name: p.product_name || '',
          description: p.product_description || '',
          product_price: p.price || '',
          discount_price: p.discounted_price || '',
          categories: Array.isArray(p.categories) ? p.categories : (p.category ? [p.category] : []),
          stock: p.stock || '',
          material: p.material || (p.attributes && p.attributes.material) || '',
          care: p.care_instructions || (p.attributes && p.attributes.care) || '',
          sku: p.sku || '',
          shipping: (p.metadata && p.metadata.shipping) || p.shipping_info || '',
          warranty: (p.metadata && p.metadata.warranty) || p.warranty || '',
          bulk_discount: (p.metadata && p.metadata.bulk_discount) || p.bulk_discount || '',
          sizes: incomingSizes || [],
          colors: normalizedColors || [],
          tags: (p.metadata && Array.isArray(p.metadata.tags)) ? p.metadata.tags : (Array.isArray(p.tags) ? p.tags : []),
          features: (p.metadata && Array.isArray(p.metadata.features)) ? p.metadata.features : (Array.isArray(p.features) ? p.features : []),
          is_customizable: p.is_customizable === 1 || p.is_customizable === '1' || p.is_customizable === true
        });

        // 2. Set Existing Variants Stock
        if (p.variants && Array.isArray(p.variants)) {
            const stockMap = {};
            p.variants.forEach(v => {
                const c = normalizeColorName(v.color || 'NA');
                const s = v.size || 'NA';
                const key = `${c}-${s}`;
                stockMap[key] = v.quantity;
            });
            setVariantStock(stockMap);
        }

        const isVideo = (u) => String(u || '').toLowerCase().match(/\.(mp4|webm|mov|ogg)(\?.*)?$/) || String(u || '').toLowerCase().includes('/video/upload/');
        const imageUrls = imgs.filter(u => !isVideo(u));
        const videoUrls = imgs.filter(u => isVideo(u));
        if (imageUrls.length > 0) {
          const imgObjects = imageUrls.map(url => ({ url }));
          setUploadedImages(imgObjects);
          setPreviews(imageUrls);
        }
        if (videoUrls.length > 0) {
          const videoObjects = videoUrls.map(url => ({ url }));
          setUploadedVideos(videoObjects);
          setVideoPreviews(videoUrls);
        }
      } catch (err) {
        console.error(err);
        showToast('error', 'Error loading product data');
      } finally {
        setIsLoadingData(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (type, message) => {
    toast[type](message, { theme: "dark", position: "top-center" });
  };

  const generateSlug = (text) => {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const generateSKU = () => {
    if (product.categories.length === 0 || !product.name) return '';
    const categoryCode = product.categories[0].substring(0, 3).toUpperCase();
    const nameCode = product.name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const timestamp = Date.now().toString().slice(-4);
    return `${categoryCode}-${nameCode}-${randomNum}-${timestamp}`;
  };

  useEffect(() => {
    if (product.categories.length > 0 && product.name) {
      const newSKU = generateSKU();
      setProduct(prev => ({ ...prev, sku: newSKU }));
    }
  }, [product.categories, product.name]);

  const compressImage = (file, { maxWidth = 1280, quality = 0.8 } = {}) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
          resolve(compressedFile);
        }, 'image/webp', quality);
      };
      img.onerror = reject;
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProduct(prev => ({ ...prev, [name]: value }));
  };

  const handleVariantStockChange = (key, value) => {
    const numValue = parseInt(value) || 0;
    setVariantStock(prev => ({ ...prev, [key]: numValue }));
  };

  const removeVariantSlot = (key) => {
    const ok = window.confirm('Remove this color-size slot from variants?');
    if (!ok) return;
    const nextRemoved = (removedVariantKeys.includes(key) ? removedVariantKeys : [...removedVariantKeys, key]);
    let nextVariant;
    setVariantStock(prev => {
      const next = { ...prev };
      delete next[key];
      nextVariant = next;
      return next;
    });
    setRemovedVariantKeys(nextRemoved);
    const combos = [];
    if ((product.colors || []).length > 0 && (product.sizes || []).length > 0) {
      (product.colors || []).forEach(color => {
        (product.sizes || []).forEach(size => {
          combos.push({ color, size, key: `${color}-${size}` });
        });
      });
    } else if ((product.colors || []).length > 0) {
      (product.colors || []).forEach(color => {
        combos.push({ color, size: null, key: `${color}-NA` });
      });
    } else if ((product.sizes || []).length > 0) {
      (product.sizes || []).forEach(size => {
        combos.push({ color: null, size, key: `NA-${size}` });
      });
    }
    const active = combos.filter(c => !nextRemoved.includes(c.key));
    const total = active.reduce((acc, c) => acc + (parseInt((nextVariant || {})[c.key]) || 0), 0);
    const finalVariants = active
      .map(c => ({ color: c.color, size: c.size, quantity: parseInt((nextVariant || {})[c.key]) || 0 }))
      .filter(v => v.quantity > 0);
    const sync = async () => {
      try {
        const res = await apiFetch(`/api/products/${id}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ variants: finalVariants, stock: total })
        });
        if (!res.ok) throw new Error('variants route not available');
        await res.json();
        showToast('success', 'Variant deleted');
      } catch (err) {
        try { console.warn(err); } catch {}
        try {
          const payload = {
            ...product,
            price: product.product_price ? parseFloat(product.product_price) : (product.discount_price ? parseFloat(product.discount_price) : parseFloat(product.price || 0)),
            discounted_price: product.discount_price ? parseFloat(product.discount_price) : (product.discounted_price ?? null),
            stock: parseInt(total),
            slug: (product.slug || ''),
            thumbnail: uploadedImages[0]?.url || '',
            attributes: { material: product.material, care: product.care, sizes: product.sizes, colors: product.colors },
            variants: finalVariants,
            images: uploadedImages.map(img => img.url),
            imageUrls: uploadedImages.map(img => img.url),
            metadata: { tags: product.tags, features: product.features, warranty: product.warranty, bulk_discount: product.bulk_discount, shipping: product.shipping },
          };
          const res2 = await apiFetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          if (!res2.ok) throw new Error('Failed to update product');
          await res2.json();
          showToast('success', 'Variant deleted');
        } catch (e) {
          showToast('error', e.message || 'Failed to sync variant');
        }
      }
    };
    sync();
  };

  const handleCategoryChange = (category) => {
    setProduct(prev => {
      const isSelected = prev.categories[0] === category;
      return { ...prev, categories: isSelected ? [] : [category] };
    });
  };

  const handleArrayChange = (field, value) => {
    setProduct(prev => {
      const currentArray = prev[field] ? [...prev[field]] : [];
      const index = currentArray.indexOf(value);
      if (index === -1) currentArray.push(value);
      else currentArray.splice(index, 1);
      return { ...prev, [field]: currentArray };
    });
  };

  const removeColor = (name) => {
    setProduct(prev => ({ ...prev, colors: prev.colors.filter(c => c !== name) }));
    setVariantStock(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${name}-`)) delete next[k]; });
      return next;
    });
    setRemovedVariantKeys(prev => prev.filter(k => !k.startsWith(`${name}-`)));
  };

  const removeSize = (size) => {
    setProduct(prev => ({ ...prev, sizes: prev.sizes.filter(s => s !== size) }));
    setVariantStock(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.endsWith(`-${size}`) || k.endsWith(`NA-${size}`)) delete next[k]; });
      return next;
    });
    setRemovedVariantKeys(prev => prev.filter(k => !(k.endsWith(`-${size}`) || k.endsWith(`NA-${size}`))));
  };

  const confirmAddFeature = (e) => {
    e.preventDefault();
    if (newFeatureInput && newFeatureInput.trim() !== '') {
      setProduct(prev => ({ ...prev, features: [...prev.features, newFeatureInput.trim()] }));
      setNewFeatureInput('');
      setIsFeatureModalOpen(false);
      showToast('success', 'Feature added!');
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidType = files.find(file => !ALLOWED_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      showToast('error', 'Only JPG, PNG and WEBP images are allowed');
      return;
    }

    const tooLarge = files.find(file => file.size > MAX_IMAGE_SIZE_BYTES);
    if (tooLarge) {
      showToast('error', 'Each image must be smaller than 8MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const newPreviews = await Promise.all(
        files.map(file => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        }))
      );
      setPreviews(prev => [...prev, ...newPreviews]); 

      const uploadResults = [];
      for (const file of files) {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append('images', compressed);

        const response = await apiFetch(`/api/upload/${id}`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        let result;
        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok || !result || !result.success) {
          const message = (result && (result.error || result.message)) || 'Failed to upload images';
          throw new Error(message);
        }

        if (Array.isArray(result.images)) {
          const validImages = result.images.filter(img => img && (img.url || typeof img === 'string')).map(img => typeof img === 'string' ? { url: img } : img);
          uploadResults.push(...validImages);
          setUploadProgress(prev => prev + (100 / files.length));
        }
      }

      setUploadedImages(prev => [...prev, ...uploadResults]); 
      showToast('success', 'New images uploaded!');
    } catch (err) {
      console.error('Image upload error:', err);
      showToast('error', err.message || 'Failed to upload images.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = async (index) => {
    try {
      const target = uploadedImages[index];
      const url = target && target.url ? target.url : previews[index];
      if (!url) return;
      const response = await apiFetch(`/api/products/${id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url, public_id: target && target.public_id ? target.public_id : undefined })
      });
      if (!response.ok) throw new Error('Failed to delete image');
      const out = await response.json();
      if (!out.success) throw new Error(out.message || 'Failed to delete image');
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
      setPreviews(prev => prev.filter((_, i) => i !== index));
      showToast('success', 'Image deleted');
    } catch (e) {
      showToast('error', e.message || 'Failed to delete image');
    }
  };

  const handleDeleteAllPhotos = async () => {
    if (uploadedImages.length === 0) return;
    
    if (!window.confirm("Are you sure you want to delete all photos?")) return;

    setIsUploading(true);
    try {
      // Use Promise.all to delete images in parallel for efficiency
      const deletePromises = uploadedImages.map(async (img) => {
        const url = img.url;
        const public_id = img.public_id;
        
        try {
          const response = await apiFetch(`/api/products/${id}/images`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ url, public_id })
          });
          
          if (!response.ok) {
            console.error(`Failed to delete image: ${url}`);
          }
        } catch (err) {
          console.error(`Error deleting image ${url}:`, err);
        }
      });
      
      await Promise.all(deletePromises);
      
      setUploadedImages([]);
      setPreviews([]);
      showToast('success', 'All Photos Deleted Successfully');
    } catch (error) {
      console.error('Error deleting all photos:', error);
      showToast('error', 'Failed to delete all photos');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidType = files.find(file => !ALLOWED_VIDEO_TYPES.includes(file.type));
    if (invalidType) {
      showToast('error', 'Only MP4, WEBM, OGG and MOV videos are allowed');
      return;
    }

    const tooLarge = files.find(file => file.size > MAX_VIDEO_SIZE_BYTES);
    if (tooLarge) {
      showToast('error', 'Each video must be smaller than 120MB');
      return;
    }
    setIsUploading(true);
    setVideoUploadProgress(0);
    try {
      const newPreviews = await Promise.all(
        files.map(file => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        }))
      );
      setVideoPreviews(prev => [...prev, ...newPreviews]);
      const uploadResults = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('images', file);
        const response = await apiFetch(`/api/upload/${id}`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        let result;
        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok || !result || !result.success) {
          const message = (result && (result.error || result.message)) || 'Failed to upload videos';
          throw new Error(message);
        }

        if (Array.isArray(result.images)) {
          uploadResults.push(...result.images);
          setVideoUploadProgress(prev => prev + (100 / files.length));
        }
      }
      const objects = uploadResults.map(x => (x && x.url) ? { url: x.url } : { url: x });
      setUploadedVideos(prev => [...prev, ...objects]);
      showToast('success', 'Videos uploaded');
    } catch (err) {
      showToast('error', err.message || 'Failed to upload videos');
      setVideoPreviews(prev => prev.slice(files.length));
    } finally {
      setIsUploading(false);
    }
  };

  const removeVideo = async (index) => {
    try {
      const target = uploadedVideos[index];
      const url = target && target.url ? target.url : videoPreviews[index];
      if (!url) return;
      const response = await apiFetch(`/api/products/${id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url, public_id: target && target.public_id ? target.public_id : undefined })
      });
      if (!response.ok) throw new Error('Failed to delete video');
      const out = await response.json();
      if (!out.success) throw new Error(out.message || 'Failed to delete video');
      setUploadedVideos(prev => prev.filter((_, i) => i !== index));
      setVideoPreviews(prev => prev.filter((_, i) => i !== index));
      showToast('success', 'Video deleted');
    } catch (e) {
      showToast('error', e.message || 'Failed to delete video');
    }
  };

  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDragOver = (e) => e.preventDefault();
  
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newPreviews = [...previews];
    const [draggedItem] = newPreviews.splice(draggedIndex, 1);
    newPreviews.splice(targetIndex, 0, draggedItem);
    setPreviews(newPreviews);

    const newUploadedImages = [...uploadedImages];
    const [draggedImage] = newUploadedImages.splice(draggedIndex, 1);
    newUploadedImages.splice(targetIndex, 0, draggedImage);
    setUploadedImages(newUploadedImages);
    setDraggedIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!product.name || !product.discount_price || parseFloat(product.discount_price) <= 0 || uploadedImages.length === 0 || product.categories.length === 0) {
      showToast('error', 'Please fill required fields & ensure images are present');
      return;
    }

    setIsUploading(true);

    try {
      // Prepare Variants Data
      const finalVariants = hasVariants ? activeVariantCombinations
        .map(combo => ({
          color: combo.color,
          size: combo.size,
          quantity: parseInt(variantStock[combo.key]) || 0
        }))
        .filter(v => v.quantity > 0) : [];

      const productData = {
        ...product,
        price: product.product_price ? parseFloat(product.product_price) : parseFloat(product.discount_price),
        discounted_price: product.discount_price ? parseFloat(product.discount_price) : null,
        stock: parseInt(product.stock),
        slug: generateSlug(product.name),
        thumbnail: uploadedImages[0]?.url || '',
        attributes: { material: product.material, care: product.care, sizes: product.sizes, colors: product.colors },
        variants: finalVariants, // Include updated variants
        is_customizable: !!product.is_customizable,
        images: [...uploadedImages.filter(img => img?.url).map(img => img.url), ...uploadedVideos.filter(v => v?.url || typeof v === 'string').map(v => v?.url || v)],
        imageUrls: [...uploadedImages.filter(img => img?.url).map(img => img.url), ...uploadedVideos.filter(v => v?.url || typeof v === 'string').map(v => v?.url || v)],
        metadata: { tags: product.tags, features: product.features, warranty: product.warranty, bulk_discount: product.bulk_discount, shipping: product.shipping },
      };

      const response = await apiFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(productData)
      });

      if (!response.ok) throw new Error('Failed to update product');
      const result = await response.json();

      if (result.success) {
        showToast('success', 'Product updated successfully!');
        navigate('/admin/products');
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Styles (Updated for Correct Scroll System & Modern Loader) ---
  const cssStyles = `
    .admin-container {
      display: flex;
      height: 100vh; /* Fixed height to viewport */
      background-color: #09090b;
      color: #e0e0e0;
      font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
      overflow: hidden; /* Prevent body scroll, handle inside main-content */
    }
    .main-content {
      flex: 1;
      padding: 2.5rem;
      position: relative;
      overflow-y: auto; /* Internal scrolling enabled here */
      height: 100%;
      scroll-behavior: smooth;
    }
    
    /* Modern Scrollbar for Main Content */
    .main-content::-webkit-scrollbar { width: 8px; }
    .main-content::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
    .main-content::-webkit-scrollbar-thumb { background: rgba(255, 165, 0, 0.2); border-radius: 4px; }
    .main-content::-webkit-scrollbar-thumb:hover { background: rgba(255, 165, 0, 0.4); }

    @media (max-width: 768px) {
      .main-content { margin-left: 0; padding: 1.5rem; }
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }

    .sku-badge {
      background: rgba(255, 165, 0, 0.08);
      border: 1px solid rgba(255, 165, 0, 0.2);
      color: #FFA500;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 0.7rem;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 0 15px rgba(255, 165, 0, 0.05);
    }
    .sku-badge:hover {
      background: rgba(255, 165, 0, 0.15);
      transform: translateY(-1px);
      box-shadow: 0 0 20px rgba(255, 165, 0, 0.2);
    }

    .form-grid {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      gap: 2rem;
      padding-bottom: 3rem; /* Extra space at bottom */
    }
    @media (max-width: 1100px) {
      .form-grid { grid-template-columns: 1fr; }
    }

    .glass-card {
      background: rgba(30, 30, 35, 0.4);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: ${isMobile ? '1.5rem' : '2rem'};
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s ease;
    }
    .glass-card:hover {
        border-color: rgba(255, 255, 255, 0.08);
    }

    .card-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 1.8rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .card-heading svg { color: #FFA500; }
    .card-heading h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #f4f4f5;
    }

    .form-group { margin-bottom: 1.5rem; }
    .form-label {
      display: block;
      margin-bottom: 0.6rem;
      color: #a1a1aa;
      font-size: 0.85rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .form-label.required::after {
      content: " *";
      color: #FFA500;
    }
    
    .form-input, .form-textarea {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      color: #fff;
      padding: 1rem 1.2rem;
      border-radius: 12px;
      outline: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.95rem;
    }
    .form-input:focus, .form-textarea:focus {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 165, 0, 0.5);
      box-shadow: 0 0 0 4px rgba(255, 165, 0, 0.1);
    }
    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    input[type=number] {
      -moz-appearance: textfield;
    }
    
    .form-textarea { 
        min-height: 300px;
        resize: vertical; 
        line-height: 1.6; 
    }
    .form-textarea::-webkit-scrollbar { width: 10px; }
    .form-textarea::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 8px; }
    .form-textarea::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 2px solid rgba(0,0,0,0); background-clip: content-box; transition: background 0.2s; }
    .form-textarea::-webkit-scrollbar-thumb:hover { background-color: #FFA500; }

    .chip-container { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .chip {
      padding: 0.6rem 1.2rem;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d4d4d8;
    }
    .chip:hover { background: rgba(255, 255, 255, 0.08); }
    .chip.active {
      background: #FFA500;
      border-color: #FFA500;
      color: #000;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(255, 165, 0, 0.3);
    }
    
    .color-option {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid #333;
      cursor: pointer;
      color: #d4d4d8;
      transition: all 0.2s;
      background: #111;
    }
    .color-option:hover { border-color: #555; }
    .color-option.active {
      border: 2px solid transparent;
      background: linear-gradient(#111,#111) padding-box, linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C) border-box;
      color: #FFD700;
    }
    .color-swatch { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #555; }
    
    .feature-tag {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 165, 0, 0.08);
      border: 1px solid rgba(255, 165, 0, 0.15);
      color: #FFA500;
      padding: 6px 12px;
      border-radius: 8px;
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 0.85rem;
    }
    .feature-remove { margin-left: 8px; cursor: pointer; opacity: 0.6; transition: 0.2s; }
    .feature-remove:hover { opacity: 1; }
    
    .add-feature-btn {
        background: transparent;
        border: 1px dashed rgba(255, 165, 0, 0.4);
        color: #FFA500;
        padding: 0.6rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.9rem;
        transition: 0.2s;
    }
    .add-feature-btn:hover { background: rgba(255, 165, 0, 0.05); }

    .upload-area {
      border: 2px dashed rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 3rem 1.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: rgba(0, 0, 0, 0.2);
    }
    .upload-area:hover, .upload-area.active {
      border-color: #FFA500;
      background: rgba(255, 165, 0, 0.03);
      transform: translateY(-2px);
    }
    .preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 12px;
      margin-top: 1.5rem;
    }
    .preview-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    
    .submit-btn {
      width: 100%;
      padding: 1.2rem;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%);
      color: #000;
      font-weight: 700;
      font-size: 1.05rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 2rem;
      transition: all 0.3s;
      box-shadow: 0 10px 30px rgba(255, 165, 0, 0.2);
    }
    .submit-btn:hover { 
        transform: translateY(-2px);
        box-shadow: 0 15px 40px rgba(255, 165, 0, 0.3);
    }

    /* Variant Table Styles */
    .variant-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    .variant-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.8rem;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        margin-bottom: 0.5rem;
        border-radius: 10px;
    }
    .variant-info { display: flex; align-items: center; gap: 10px; flex: 1; font-size: 0.9rem; color: #ddd; }
    .variant-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #666; }
    .variant-input { width: 120px !important; padding: 0.5rem 0.8rem !important; margin-bottom: 0 !important; text-align: right; }

    /* PREMIUM SCROLLBAR FOR VARIANTS */
    .variant-scroll-container {
        max-height: 300px;
        overflow-y: auto;
        padding-right: 12px;
        margin-right: -8px; /* Offset padding to keep visual alignment */
    }
    
    .variant-scroll-container::-webkit-scrollbar {
        width: 6px;
    }
    .variant-scroll-container::-webkit-scrollbar-track {
        background: transparent;
    }
    .variant-scroll-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,0.1);
    }
    .variant-scroll-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 165, 0, 0.6); /* Orange accent on hover */
    }

    .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background: #18181b;
        border: 1px solid rgba(255,255,255,0.1);
        padding: 2rem;
        border-radius: 16px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 1.5rem; }
    .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; }
    .btn-primary { background: #FFA500; color: #000; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    
    /* Loading Animation Styles */
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        color: #FFA500;
        gap: 20px;
    }
  `;

  if (isLoadingData) {
      return (
          <div className="admin-container">
             <style>{cssStyles}</style>
             <div className="loading-container">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                    <FiLoader size={48} color="#FFA500" />
                </motion.div>
                <motion.div
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                    style={{ fontSize: '1.1rem', fontWeight: 500, letterSpacing: '1px' }}
                >
                    LOADING PRODUCT DATA...
                </motion.div>
             </div>
          </div>
      );
  }

  return (
    <div className="admin-container">
      <style>{cssStyles}</style>
      <ToastContainer />
      
      {/* Feature Input Popup Modal */}
      <AnimatePresence>
        {isFeatureModalOpen && (
            <motion.div 
                className="modal-overlay"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsFeatureModalOpen(false)}
            >
                <motion.div 
                    className="modal-content"
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 style={{ marginTop: 0, color: '#FFA500' }}>Add New Feature</h3>
                    <input 
                        type="text" 
                        className="form-input" 
                        autoFocus
                        placeholder="e.g., Water Resistant"
                        value={newFeatureInput}
                        onChange={(e) => setNewFeatureInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmAddFeature(e)}
                    />
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setIsFeatureModalOpen(false)}>Cancel</button>
                        <button className="btn-primary" onClick={confirmAddFeature}>Add Feature</button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- Category Input Popup Modal --- */}
      <AnimatePresence>
        {isCategoryModalOpen && (
            <motion.div 
                className="modal-overlay"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsCategoryModalOpen(false)}
            >
                <motion.div 
                    className="modal-content"
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 style={{ marginTop: 0, color: '#FFA500' }}>Add New Category</h3>
                    
                    <div className="form-group">
                        <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Select Parent Section <span style={{ color: 'red' }}>*</span></label>
                        <div style={{ display: 'flex', gap: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            {['Apparel', 'Crafts Item'].map((rootName) => {
                                const rootCat = categories.find(c => c.name === rootName);
                                return (
                                    <label key={rootName} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
                                        <input 
                                            type="radio" 
                                            name="parentCategory" 
                                            value={rootCat ? rootCat.id : ''} 
                                            checked={rootCat && String(parentCategoryId) === String(rootCat.id)}
                                            onChange={(e) => setParentCategoryId(e.target.value)}
                                            style={{ accentColor: '#FFA500', width: '18px', height: '18px' }}
                                            disabled={!rootCat}
                                        />
                                        {rootName} {(!rootCat) && <small style={{color:'red'}}>(Not found)</small>}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Category Name <span style={{ color: 'red' }}>*</span></label>
                        <input 
                            type="text" 
                            className="form-input" 
                            autoFocus
                            placeholder="e.g., Watches, Resin Art"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                    </div>

                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
                        <button 
                            className="btn-primary" 
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim() || !parentCategoryId}
                            style={{ opacity: (!newCategoryName.trim() || !parentCategoryId) ? 0.5 : 1 }}
                        >
                            Add Category
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <main className="main-content">
        
        {/* Header with Top-Right SKU Badge */}
        <header className="page-header">
          <h1 className="page-title">Edit Product</h1>
          
          <div className="sku-badge" onClick={() => setProduct(prev => ({ ...prev, sku: generateSKU() }))} title="Click to Regenerate">
             <FiHash /> 
             {product.sku || 'PENDING-SKU'}
             <FiRefreshCw size={14} style={{ marginLeft: 5, opacity: 0.7 }}/>
          </div>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Left Column: Main Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Basic Details Card */}
              <div className="glass-card">
                <div className="card-heading">
                   <FiBox size={20} /> <h3>Basic Information</h3>
                </div>
                
                <div className="form-group">
                  <label className="form-label required">Product Name</label>
                  <input type="text" name="name" value={product.name} onChange={handleChange} className="form-input" required />
                </div>

                <div className="form-group">
                  <label className="form-label required">Description</label>
                  <textarea name="description" value={product.description} onChange={handleChange} className="form-textarea" required />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      name="is_customizable" 
                      checked={product.is_customizable === true || product.is_customizable === 1 || product.is_customizable === '1'} 
                      onChange={(e) => setProduct(prev => ({ ...prev, is_customizable: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: '#FFA500' }}
                    />
                    <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '600' }}>Customizable</span>
                  </label>
                  <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '5px', marginLeft: '28px' }}>
                    Enable this if the product can be customized by the user (design upload and instructions).
                  </p>
                </div>
              </div>

              {/* Pricing & Inventory Card */}
              <div className="glass-card">
                <div className="card-heading">
                   <FiDollarSign size={20} /> <h3>Pricing & Inventory</h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label required">Current Price (€)</label>
                        <input type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]*$" name="discount_price" value={product.discount_price} onChange={handleChange} className="form-input" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Previous Price (€)</label>
                        <input type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]*$" name="product_price" value={product.product_price} onChange={handleChange} className="form-input" />
                    </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">Bulk Discount Info</label>
                        <input type="text" name="bulk_discount" value={product.bulk_discount} onChange={handleChange} className="form-input" />
                    </div>
                    
                    {/* Render Total Stock (Read Only if variants exist) */}
                    <div className="form-group">
                        <label className="form-label required">Total Stock Quantity</label>
                        <input 
                            type="text" 
                            inputMode="numeric" 
                            pattern="^[0-9]*$" 
                            name="stock" 
                            value={product.stock} 
                            onChange={handleChange} 
                            className="form-input" 
                            required 
                            readOnly={hasVariants} 
                            style={hasVariants ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                        />
                        {hasVariants && <small style={{ color: '#FFA500', marginTop: '5px', display: 'block' }}>* Auto-calculated from variant stock below</small>}
                    </div>
                </div>

                {/* --- Dynamic Variant Stock Input Section --- */}
                {hasVariants && (
                    <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                             <label className="form-label" style={{ marginBottom: 0 }}>Variant Stock Management</label>
                             <span style={{ fontSize: '0.8rem', color: '#888' }}>Set quantity for each option</span>
                        </div>
                        
                        {/* APPLIED NEW SCROLLBAR CLASS HERE */}
                        <div className="variant-scroll-container">
                            {activeVariantCombinations.map((combo) => {
                                const colorObj = CLOTHING_COLORS.find(c => c.name === combo.color);
                                return (
                                    <div key={combo.key} className="variant-row">
                                        <div className="variant-info">
                                            {combo.color && (
                                                <>
                                                    <div className="variant-dot" style={{ backgroundColor: colorObj ? colorObj.hex : '#fff' }}></div>
                                                    <span>{combo.color}</span>
                                                </>
                                            )}
                                            {combo.color && combo.size && <span style={{ color: '#555' }}>/</span>}
                                            {combo.size && (
                                                <span style={{ background: '#333', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{combo.size}</span>
                                            )}
                                        </div>
                                        <input 
                                            type="text" 
                                            inputMode="numeric" 
                                            pattern="^[0-9]*$" 
                                            placeholder="Qty"
                                            className="form-input variant-input"
                                            value={variantStock[combo.key] || ''}
                                            onChange={(e) => handleVariantStockChange(combo.key, e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeVariantSlot(combo.key)} style={{ background: 'transparent', border: 'none', color: '#FFA500', cursor: 'pointer' }} title="Remove this slot">
                                           <FiX />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

              </div>

              {/* Attributes Card */}
              <div className="glass-card">
                  <div className="card-heading">
                     <FiLayers size={20} /> <h3>Product Attributes</h3>
                </div>
                
                <div className="form-group">
                    <label className="form-label">Key Features</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <AnimatePresence>
                        {product.features.map((feature, idx) => (
                            <motion.span 
                                key={idx} 
                                initial={{ opacity: 0, scale: 0.8 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="feature-tag"
                            >
                                {feature} <FiX className="feature-remove" onClick={() => setProduct(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }))} />
                            </motion.span>
                        ))}
                        </AnimatePresence>
                    </div>
                    <button type="button" onClick={() => setIsFeatureModalOpen(true)} className="add-feature-btn">
                        <FiPlus /> Add New Feature
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label required">Material</label>
                        <input type="text" name="material" value={product.material} onChange={handleChange} className="form-input" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label required">Care Instructions</label>
                        <input type="text" name="care" value={product.care} onChange={handleChange} className="form-input" required />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">Warranty</label>
                        <input type="text" name="warranty" value={product.warranty} onChange={handleChange} className="form-input" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Shipping Text</label>
                        <input type="text" name="shipping" value={product.shipping} onChange={handleChange} className="form-input" />
                    </div>
                 </div>
              </div>
            </div>

            {/* Right Column: Media & Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Categories */}
              <div className="glass-card">
                <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <FiTag size={20} /> <h3>Categories</h3>
                     <button type="button" onClick={() => setIsDeleteMode(!isDeleteMode)} style={{ background: 'transparent', border: 'none', color: isDeleteMode ? '#ff4444' : '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '5px' }}>
                        <FiEdit2 size={14} />
                     </button>
                   </div>
                   <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="add-feature-btn" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                     <FiPlus size={14} /> Add
                   </button>
                </div>
                <div className="chip-container">
                    {categories.map(cat => (
                        <div key={cat.id} onClick={() => !isDeleteMode && handleCategoryChange(cat.name)} className={`chip ${product.categories.includes(cat.name) ? 'active' : ''}`} style={isDeleteMode ? { cursor: 'default', paddingRight: '28px', position: 'relative' } : {}}>
                            {product.categories.includes(cat.name) && !isDeleteMode && <FiCheck size={14} />} {cat.name}
                            {isDeleteMode && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }} style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', display: 'flex' }}>
                                    <FiX size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
              </div>

              {/* Tags */}
              <div className="glass-card">
                  <label className="form-label">Tags</label>
                  <div className="chip-container">
                    {['NEW', 'SALE', 'BESTSELLER', 'LIMITED', 'SUMMER', 'WINTER'].map(tag => (
                        <div key={tag} onClick={() => handleArrayChange('tags', tag)} className={`chip ${product.tags.includes(tag) ? 'active' : ''}`}>
                             {tag}
                        </div>
                    ))}
                  </div>
              </div>

              {/* Variants (Colors & Sizes) */}
              <div className="glass-card">
                  <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.1rem', color: '#e0e0e0', fontWeight: 600 }}>Variants</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Colors</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {CLOTHING_COLORS.map(({name, hex}) => (
                          <div
                            key={hex}
                            onClick={() => handleArrayChange('colors', name)}
                            className={`color-option ${product.colors?.includes(name) ? 'active' : ''}`}
                            title={name}
                          >
                            <span className="color-swatch" style={{ backgroundColor: hex }} />
                            <span>{name}</span>
                            {product.colors?.includes(name) && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeColor(name); }} style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#FFA500', cursor: 'pointer' }}>
                                <FiX size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                 </div>

                 <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Sizes</label>
                    <div className="chip-container">
                        {[...letterSizes, ...numberSizes].map(s => (
                            <div key={s} onClick={() => handleArrayChange('sizes', s)} className={`chip ${product.sizes.includes(s) ? 'active' : ''}`} style={{ padding: '0.6rem 1rem', minWidth: '40px', justifyContent: 'center' }}>
                                {s}
                                {product.sizes.includes(s) && (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); removeSize(s); }} style={{ marginLeft: 6, background: 'transparent', border: 'none', color: '#000', cursor: 'pointer' }}>
                                    <FiX size={12} />
                                  </button>
                                )}
                            </div>
                        ))}
                    </div>
                 </div>
              </div>

                            {/* Media Upload */}
              <div className="glass-card">
                <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <FiImage size={20} /> <h3>Media Gallery</h3>
                   </div>
                   {uploadedImages.length > 0 && (
                     <button 
                       type="button" 
                       onClick={handleDeleteAllPhotos} 
                       className="add-feature-btn" 
                       style={{ color: '#ff4444', borderColor: 'rgba(255, 68, 68, 0.4)', fontSize: '0.8rem', padding: '4px 8px' }}
                     >
                       <FiX size={14} /> Delete All
                     </button>
                   )}
                </div>
                
                <input type="file" id="img-upload" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                <label htmlFor="img-upload" className={`upload-area ${isUploading ? 'active' : ''}`}>
                    {isUploading ? (
                        <div style={{ color: '#FFA500' }}>Uploading... {Math.round(uploadProgress)}%</div>
                    ) : (
                        <>
                            <div style={{ background: 'rgba(255, 165, 0, 0.1)', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                                <FiUpload size={24} color="#FFA500" />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#e0e0e0', fontWeight: 600 }}>Click to Upload New</p>
                        </>
                    )}
                </label>

                <div className="preview-grid">
                    <AnimatePresence>
                        {previews.map((src, index) => (
                            <motion.div 
                                key={index} 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="preview-item"
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                            >
                                <img src={src} alt="Product edit preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button type="button" onClick={() => removeImage(index)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FiX size={12}/></button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
              </div>

              <div className="glass-card">
                <div className="card-heading">
                   <FiImage size={20} /> <h3>Video Gallery</h3>
                </div>
                <input type="file" id="video-upload" multiple accept="video/*" onChange={handleVideoChange} style={{ display: 'none' }} />
                <label htmlFor="video-upload" className={`upload-area ${isUploading ? 'active' : ''}`}>
                    {isUploading ? (
                        <div style={{ color: '#FFA500' }}>Uploading... {Math.round(videoUploadProgress)}%</div>
                    ) : (
                        <>
                            <div style={{ background: 'rgba(255, 165, 0, 0.1)', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                                <FiUpload size={24} color="#FFA500" />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#e0e0e0', fontWeight: 600 }}>Click to Upload Videos</p>
                        </>
                    )}
                </label>
                <div className="preview-grid">
                    <AnimatePresence>
                        {videoPreviews.map((src, index) => (
                            <motion.div 
                                key={index} 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="preview-item"
                            >
                                <video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                                <button type="button" onClick={() => removeVideo(index)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><FiX size={12}/></button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                className="submit-btn" 
                disabled={isUploading}
              >
                 {isUploading ? 'Updating...' : <><FiSave size={20} /> Update Product</>}
              </motion.button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AdminEdit;
