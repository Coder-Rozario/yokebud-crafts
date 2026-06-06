# Performance Optimization Guide - Mobile Score Fix (45 → 100)

## 1. Code Splitting Implementation

### Step 1: Update Your Main Router (App.jsx or Routes.jsx)

```jsx
// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';

// Eager load: Only critical components (Header, Footer)
import Header from './components/Header';
import Footer from './components/Footer';

// Lazy load: All route components
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Profile = lazy(() => import('./pages/Profile'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    minHeight: '60vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
  }}>
    <LoadingSpinner />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/orders" element={<OrderHistory />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
```

### Step 2: Create Loading Spinner Component

```jsx
// src/components/LoadingSpinner.jsx
import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = () => {
  return (
    <div className="spinner-container" role="status" aria-live="polite">
      <div className="spinner"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
```

```css
/* src/components/LoadingSpinner.css */
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## 2. Reduce Main Thread Work - useMemo & useCallback

### Example 1: Product List Component (Prevent Unnecessary Re-renders)

```jsx
// src/components/ProductList.jsx
import React, { useMemo, useCallback, useState } from 'react';
import ProductCard from './ProductCard';

const ProductList = ({ products, onAddToCart }) => {
  const [sortBy, setSortBy] = useState('name');
  const [filterCategory, setFilterCategory] = useState('all');

  // Memoize filtered and sorted products
  const filteredAndSortedProducts = useMemo(() => {
    console.log('Recomputing filtered products'); // Only logs when dependencies change
    
    let filtered = products;
    
    // Filter
    if (filterCategory !== 'all') {
      filtered = products.filter(p => p.category === filterCategory);
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      return 0;
    });
    
    return sorted;
  }, [products, sortBy, filterCategory]); // Only recompute when these change

  // Memoize unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  // Memoize callback functions to prevent child re-renders
  const handleSortChange = useCallback((e) => {
    setSortBy(e.target.value);
  }, []);

  const handleFilterChange = useCallback((e) => {
    setFilterCategory(e.target.value);
  }, []);

  const handleAddToCart = useCallback((productId) => {
    onAddToCart(productId);
  }, [onAddToCart]);

  return (
    <div className="product-list">
      <div className="filters">
        <select value={sortBy} onChange={handleSortChange} aria-label="Sort products">
          <option value="name">Sort by Name</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </select>

        <select value={filterCategory} onChange={handleFilterChange} aria-label="Filter by category">
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      <div className="grid-container">
        {filteredAndSortedProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={handleAddToCart}
          />
        ))}
      </div>
    </div>
  );
};

// Wrap component with React.memo to prevent re-renders when props haven't changed
export default React.memo(ProductList);
```

### Example 2: Optimized Product Card Component

```jsx
// src/components/ProductCard.jsx
import React, { memo, useCallback } from 'react';
import LazyImage from './LazyImage';

const ProductCard = ({ product, onAddToCart }) => {
  const handleClick = useCallback(() => {
    onAddToCart(product.id);
  }, [product.id, onAddToCart]);

  return (
    <article className="product-card">
      <LazyImage
        src={product.image}
        alt={product.name}
        width={300}
        height={300}
      />
      <h3>{product.name}</h3>
      <p className="price">${product.price.toFixed(2)}</p>
      <button 
        onClick={handleClick}
        aria-label={`Add ${product.name} to cart`}
        className="add-to-cart-btn"
      >
        Add to Cart
      </button>
    </article>
  );
};

// Only re-render if product or onAddToCart changes
export default memo(ProductCard);
```

## 3. Image Optimization - Lazy Loading & WebP

### Step 1: Create LazyImage Component

```jsx
// src/components/LazyImage.jsx
import React, { useState, useEffect, useRef } from 'react';
import './LazyImage.css';

const LazyImage = ({ 
  src, 
  alt, 
  width, 
  height, 
  className = '',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e0e0e0"/%3E%3C/svg%3E'
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Convert to WebP if supported
  const getWebPSrc = (originalSrc) => {
    if (typeof originalSrc !== 'string') return originalSrc;
    
    // If your backend serves WebP, use this pattern
    // Example: image.jpg -> image.webp
    return originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  };

  return (
    <picture>
      {/* WebP format for modern browsers */}
      <source 
        srcSet={imageSrc !== placeholder ? getWebPSrc(imageSrc) : placeholder} 
        type="image/webp" 
      />
      {/* Fallback to original format */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`lazy-image ${className} ${isLoaded ? 'loaded' : 'loading'}`}
        onLoad={handleLoad}
        loading="lazy" // Native lazy loading as fallback
        decoding="async"
      />
    </picture>
  );
};

export default LazyImage;
```

```css
/* src/components/LazyImage.css */
.lazy-image {
  transition: opacity 0.3s ease-in-out;
  background-color: #f0f0f0;
}

.lazy-image.loading {
  opacity: 0.5;
}

.lazy-image.loaded {
  opacity: 1;
}
```

### Step 2: Backend - Serve WebP Images (Node.js/Express)

```javascript
// backend/utils/imageConverter.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Convert uploaded images to WebP format
 * Call this in your image upload endpoint
 */
async function convertToWebP(inputPath, outputPath = null) {
  try {
    if (!outputPath) {
      const parsed = path.parse(inputPath);
      outputPath = path.join(parsed.dir, `${parsed.name}.webp`);
    }

    await sharp(inputPath)
      .webp({ quality: 80 }) // Adjust quality (80 is good balance)
      .toFile(outputPath);

    console.log(`Converted ${inputPath} to WebP: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('WebP conversion error:', error);
    throw error;
  }
}

/**
 * Resize and optimize image
 */
async function optimizeImage(inputPath, outputPath, maxWidth = 1200) {
  try {
    await sharp(inputPath)
      .resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('Image optimization error:', error);
    throw error;
  }
}

module.exports = { convertToWebP, optimizeImage };
```

## 4. Tree-Shaking Configuration

### For Vite (vite.config.js)

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Analyze bundle size
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    // Enable tree-shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        dead_code: true,
        unused: true,
      },
    },
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Split other heavy libraries
          'utils': ['axios', 'date-fns'],
        },
      },
    },
    // Increase chunk size warning limit if needed
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});
```

### For Webpack (webpack.config.js)

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',
  optimization: {
    usedExports: true, // Enable tree-shaking
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            dead_code: true,
            unused: true,
          },
        },
      }),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
          name: 'react-vendor',
          priority: 20,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
  plugins: [
    // Analyze bundle (run: npm run build -- --analyze)
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE ? 'server' : 'disabled',
    }),
  ],
};
```

## 5. Additional Performance Tips

### Implement Service Worker for Caching

```javascript
// public/service-worker.js
const CACHE_NAME = 'yokebud-crafts-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

### Register Service Worker (in index.html or main entry)

```javascript
// src/index.jsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed'));
  });
}
```

## Package Installation Commands

```bash
# For image optimization (backend)
npm install sharp

# For Vite bundle analysis
npm install --save-dev rollup-plugin-visualizer

# For Webpack bundle analysis
npm install --save-dev webpack-bundle-analyzer terser-webpack-plugin
```

## Expected Results

After implementing these changes:
- **Initial Bundle Size:** Reduced by 60-70%
- **TBT (Total Blocking Time):** From 7000ms → < 300ms
- **Mobile Performance Score:** From 45 → 90+
- **First Contentful Paint (FCP):** < 1.8s
- **Largest Contentful Paint (LCP):** < 2.5s
