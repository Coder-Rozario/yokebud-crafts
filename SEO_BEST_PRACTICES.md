# SEO & Best Practices Guide (Achieve 100% Score)

## 1. Canonical Tags with react-helmet-async

### Step 1: Install react-helmet-async

```bash
npm install react-helmet-async
```

### Step 2: Setup HelmetProvider in Your App

```jsx
// src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
```

### Step 3: Create SEO Component

```jsx
// src/components/SEO.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = 'Yokebud Crafts - Handmade Artisan Products',
  description = 'Discover unique handmade crafts and artisan products. Free shipping on orders over $50.',
  keywords = 'handmade, crafts, artisan, gifts, custom products',
  image = 'https://yourdomain.com/og-image.jpg',
  url = window.location.href,
  type = 'website',
  author = 'Yokebud Crafts',
}) => {
  // Get canonical URL (without query params or hash)
  const canonicalUrl = url.split('?')[0].split('#')[0];

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      
      {/* Canonical URL - Critical for SEO */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph Tags (Facebook, LinkedIn) */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Yokebud Crafts" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Mobile Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      <meta name="theme-color" content="#0066cc" />
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
    </Helmet>
  );
};

export default SEO;
```

### Step 4: Use SEO Component in Every Page

```jsx
// src/pages/Home.jsx
import React from 'react';
import SEO from '../components/SEO';

const Home = () => {
  return (
    <>
      <SEO 
        title="Yokebud Crafts - Handmade Artisan Products"
        description="Discover unique handmade crafts and artisan products. Free shipping on orders over $50."
        url="https://yourdomain.com/"
        image="https://yourdomain.com/images/home-og.jpg"
      />
      
      <div className="home-page">
        <h1>Welcome to Yokebud Crafts</h1>
        {/* Page content */}
      </div>
    </>
  );
};

export default Home;
```

```jsx
// src/pages/Products.jsx
import React from 'react';
import SEO from '../components/SEO';

const Products = () => {
  return (
    <>
      <SEO 
        title="Shop All Products | Yokebud Crafts"
        description="Browse our complete collection of handmade crafts and artisan products."
        url="https://yourdomain.com/products"
        keywords="handmade products, artisan crafts, shop online"
      />
      
      <div className="products-page">
        <h1>Our Products</h1>
        {/* Product list */}
      </div>
    </>
  );
};

export default Products;
```

```jsx
// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../components/SEO';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    // Fetch product data
    fetchProduct(id).then(setProduct);
  }, [id]);

  if (!product) return <div>Loading...</div>;

  return (
    <>
      <SEO 
        title={`${product.name} | Yokebud Crafts`}
        description={product.description}
        url={`https://yourdomain.com/products/${product.id}`}
        image={product.image}
        type="product"
        keywords={`${product.name}, ${product.category}, handmade`}
      />
      
      <article className="product-detail">
        <h1>{product.name}</h1>
        {/* Product details */}
      </article>
    </>
  );
};

export default ProductDetail;
```

## 2. Security Headers with Helmet (Node.js Backend)

### Step 1: Install Helmet

```bash
# In your backend directory
npm install helmet
```

### Step 2: Configure Helmet in Express

```javascript
// backend/server.js or backend/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Apply Helmet middleware (MUST be early in middleware chain)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Only if absolutely necessary for React
        "https://yourdomain.com",
        "https://cdn.jsdelivr.net", // If you use CDN
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for styled-components/inline styles
        "https://fonts.googleapis.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://yourdomain.com",
        "https://*.cloudinary.com", // If using Cloudinary
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
      ],
      connectSrc: [
        "'self'",
        "https://yourdomain.com",
        "https://your-backend.onrender.com",
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [], // Force HTTPS
    },
  },
  crossOriginEmbedderPolicy: false, // If you need to embed external content
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your routes
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 3: Advanced Helmet Configuration (Production)

```javascript
// backend/config/helmet.config.js
module.exports = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
};

// Use in server.js:
// const helmetConfig = require('./config/helmet.config');
// app.use(helmet(helmetConfig));
```

### Step 4: Additional Security Middleware

```javascript
// backend/middleware/security.js
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Rate limiting to prevent brute force attacks
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiting for auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

module.exports = {
  limiter,
  authLimiter,
  mongoSanitize: mongoSanitize(), // Prevent NoSQL injection
  xss: xss(), // Prevent XSS attacks
};
```

```bash
# Install additional security packages
npm install express-rate-limit express-mongo-sanitize xss-clean
```

```javascript
// Apply in server.js
const { limiter, authLimiter, mongoSanitize, xss } = require('./middleware/security');

app.use('/api', limiter); // Apply to all API routes
app.use('/api/auth', authLimiter); // Stricter for auth routes
app.use(mongoSanitize); // Data sanitization
app.use(xss); // XSS protection
```

## 3. Force HTTPS - All Resources

### Frontend: Redirect HTTP to HTTPS

```javascript
// src/utils/forceHttps.js
/**
 * Force HTTPS redirect (for browsers)
 */
export const forceHttps = () => {
  if (
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    window.location.href = window.location.href.replace('http:', 'https:');
  }
};

// Call in your main entry file
// src/index.jsx
import { forceHttps } from './utils/forceHttps';
forceHttps();
```

### Backend: Force HTTPS Middleware

```javascript
// backend/middleware/forceHttps.js
/**
 * Force HTTPS in production
 */
const forceHttps = (req, res, next) => {
  // Only enforce in production
  if (process.env.NODE_ENV === 'production') {
    // Check if the request is already HTTPS
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
  }
  next();
};

module.exports = forceHttps;
```

```javascript
// Apply in server.js
const forceHttps = require('./middleware/forceHttps');
app.use(forceHttps);
```

### Ensure All API Calls Use HTTPS

```javascript
// src/config/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-backend.onrender.com/api'
  : 'https://api.yokebud.fi/api';

// Ensure URL always uses HTTPS in production
export const getApiUrl = (endpoint) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
};

// Usage in API calls
import axios from 'axios';
import { getApiUrl } from '../config/api';

export const fetchProducts = async () => {
  const response = await axios.get(getApiUrl('/products'));
  return response.data;
};
```

## 4. Structured Data (Schema.org) for SEO

### Product Schema

```jsx
// src/components/ProductSchema.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

const ProductSchema = ({ product }) => {
  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": product.image,
    "description": product.description,
    "brand": {
      "@type": "Brand",
      "name": "Yokebud Crafts"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://yourdomain.com/products/${product.id}`,
      "priceCurrency": "USD",
      "price": product.price,
      "availability": product.inStock 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Yokebud Crafts"
      }
    },
    "aggregateRating": product.rating ? {
      "@type": "AggregateRating",
      "ratingValue": product.rating.average,
      "reviewCount": product.rating.count
    } : undefined
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default ProductSchema;
```

### Organization Schema

```jsx
// src/components/OrganizationSchema.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

const OrganizationSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Yokebud Crafts",
    "url": "https://yourdomain.com",
    "logo": "https://yourdomain.com/logo.png",
    "sameAs": [
      "https://www.facebook.com/yokebudcrafts",
      "https://www.instagram.com/yokebudcrafts",
      "https://www.twitter.com/yokebudcrafts"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-555-1234",
      "contactType": "Customer Service",
      "email": "support@yourdomain.com",
      "availableLanguage": "English"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default OrganizationSchema;
```

## 5. robots.txt and sitemap.xml

### Create robots.txt

```txt
# public/robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /profile/

Sitemap: https://yourdomain.com/sitemap.xml
```

### Generate Dynamic Sitemap (Backend)

```javascript
// backend/routes/sitemap.js
const express = require('express');
const router = express.Router();
const { getAllProducts } = require('../controllers/productController');

router.get('/sitemap.xml', async (req, res) => {
  try {
    const products = await getAllProducts();
    const baseUrl = 'https://yourdomain.com';
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    
    // Homepage
    xml += `
      <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
    `;
    
    // Static pages
    const staticPages = ['products', 'about', 'contact'];
    staticPages.forEach(page => {
      xml += `
        <url>
          <loc>${baseUrl}/${page}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
      `;
    });
    
    // Product pages
    products.forEach(product => {
      xml += `
        <url>
          <loc>${baseUrl}/products/${product.id}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
          <lastmod>${product.updatedAt || new Date().toISOString()}</lastmod>
        </url>
      `;
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
```

```javascript
// Add to server.js
app.use('/', require('./routes/sitemap'));
```

## Package Installation Summary

```bash
# Frontend
npm install react-helmet-async

# Backend
npm install helmet express-rate-limit express-mongo-sanitize xss-clean cors

# Development/Testing
npm install --save-dev lighthouse @axe-core/react
```

## Expected Results

After implementing these changes:
- **SEO Score:** 100/100
- **Best Practices Score:** 100/100
- **Canonical tags** on all pages
- **Security headers** properly configured
- **HTTPS** enforced everywhere
- **Structured data** for better search results
- **Rate limiting** to prevent abuse
