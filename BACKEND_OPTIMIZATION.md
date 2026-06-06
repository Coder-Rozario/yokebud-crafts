# Backend Optimization - Node.js/MySQL (Render Deployment)

## 1. Handle Cold Starts & Improve TTFB (Time to First Byte)

### Problem
Render.com free tier instances spin down after inactivity, causing 15-30 second cold starts.

### Solution 1: Keep-Alive Ping Service

```javascript
// backend/services/keepAlive.js
const axios = require('axios');

/**
 * Ping server every 10 minutes to prevent cold start
 * Only use this on paid Render plans or as temporary solution
 */
class KeepAliveService {
  constructor(url) {
    this.url = url;
    this.interval = null;
  }

  start() {
    // Don't run in development
    if (process.env.NODE_ENV !== 'production') return;

    console.log('Starting keep-alive service...');
    
    // Ping every 10 minutes (600000ms)
    this.interval = setInterval(async () => {
      try {
        await axios.get(`${this.url}/health`);
        console.log('Keep-alive ping successful');
      } catch (error) {
        console.error('Keep-alive ping failed:', error.message);
      }
    }, 10 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Keep-alive service stopped');
    }
  }
}

module.exports = KeepAliveService;
```

```javascript
// backend/server.js
const KeepAliveService = require('./services/keepAlive');

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

// Start keep-alive service
if (process.env.ENABLE_KEEP_ALIVE === 'true') {
  const keepAlive = new KeepAliveService(process.env.APP_URL);
  keepAlive.start();
}
```

### Solution 2: External Cron Job (Better Approach)

Use a free service like **UptimeRobot** or **Cron-Job.org** to ping your backend every 5-10 minutes.

1. Sign up at https://uptimerobot.com (free)
2. Add a new HTTP(s) monitor
3. URL: `https://your-backend.onrender.com/health`
4. Monitoring interval: 5 minutes

## 2. Implement In-Memory Caching with node-cache

### Step 1: Install node-cache

```bash
npm install node-cache
```

### Step 2: Create Cache Service

```javascript
// backend/services/cache.js
const NodeCache = require('node-cache');

/**
 * Cache Configuration
 * stdTTL: Standard time to live (in seconds)
 * checkperiod: Automatic delete check interval
 */
const cache = new NodeCache({
  stdTTL: 600, // 10 minutes default
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Better performance, but be careful with object mutations
});

/**
 * Get cached data or execute callback to fetch fresh data
 */
async function getOrSet(key, fetchFunction, ttl = 600) {
  try {
    // Try to get from cache
    const cachedData = cache.get(key);
    
    if (cachedData !== undefined) {
      console.log(`Cache HIT: ${key}`);
      return cachedData;
    }

    console.log(`Cache MISS: ${key}`);
    
    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Store in cache
    cache.set(key, freshData, ttl);
    
    return freshData;
  } catch (error) {
    console.error(`Cache error for key ${key}:`, error);
    // If cache fails, still return fresh data
    return await fetchFunction();
  }
}

/**
 * Invalidate specific cache key
 */
function invalidate(key) {
  cache.del(key);
  console.log(`Cache invalidated: ${key}`);
}

/**
 * Invalidate multiple keys by pattern
 */
function invalidatePattern(pattern) {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  
  matchingKeys.forEach(key => cache.del(key));
  console.log(`Invalidated ${matchingKeys.length} keys matching: ${pattern}`);
}

/**
 * Clear all cache
 */
function clearAll() {
  cache.flushAll();
  console.log('All cache cleared');
}

/**
 * Get cache statistics
 */
function getStats() {
  return cache.getStats();
}

module.exports = {
  cache,
  getOrSet,
  invalidate,
  invalidatePattern,
  clearAll,
  getStats,
};
```

### Step 3: Implement Caching in Product Controller

```javascript
// backend/controllers/productController.js
const db = require('../config/database');
const { getOrSet, invalidate, invalidatePattern } = require('../services/cache');

/**
 * Get all products (with caching)
 */
const getAllProducts = async (req, res) => {
  try {
    const { category, sort } = req.query;
    
    // Create unique cache key based on query params
    const cacheKey = `products:all:${category || 'all'}:${sort || 'default'}`;
    
    const products = await getOrSet(
      cacheKey,
      async () => {
        console.log('Fetching products from database...');
        
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        
        if (category) {
          query += ' AND category = ?';
          params.push(category);
        }
        
        if (sort === 'price-asc') {
          query += ' ORDER BY price ASC';
        } else if (sort === 'price-desc') {
          query += ' ORDER BY price DESC';
        } else {
          query += ' ORDER BY created_at DESC';
        }
        
        const [rows] = await db.query(query, params);
        return rows;
      },
      600 // Cache for 10 minutes
    );
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

/**
 * Get single product by ID (with caching)
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}`;
    
    const product = await getOrSet(
      cacheKey,
      async () => {
        console.log(`Fetching product ${id} from database...`);
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
        return rows[0];
      },
      1800 // Cache for 30 minutes (less frequently changed)
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

/**
 * Create new product (invalidate cache)
 */
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    
    const [result] = await db.query(
      'INSERT INTO products (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)',
      [name, description, price, category, image]
    );
    
    // Invalidate all product list caches
    invalidatePattern('products:all');
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Product created successfully' 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

/**
 * Update product (invalidate specific cache)
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, image } = req.body;
    
    await db.query(
      'UPDATE products SET name = ?, description = ?, price = ?, category = ?, image = ? WHERE id = ?',
      [name, description, price, category, image, id]
    );
    
    // Invalidate specific product cache and all list caches
    invalidate(`product:${id}`);
    invalidatePattern('products:all');
    
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

/**
 * Delete product (invalidate cache)
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    
    // Invalidate specific product cache and all list caches
    invalidate(`product:${id}`);
    invalidatePattern('products:all');
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
```

### Step 4: Cache Statistics Endpoint (for monitoring)

```javascript
// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { getStats, clearAll } = require('../services/cache');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * Get cache statistics (admin only)
 */
router.get('/cache/stats', authenticateAdmin, (req, res) => {
  const stats = getStats();
  res.json({
    hits: stats.hits,
    misses: stats.misses,
    keys: stats.keys,
    hitRate: stats.hits / (stats.hits + stats.misses) * 100,
  });
});

/**
 * Clear all cache (admin only)
 */
router.post('/cache/clear', authenticateAdmin, (req, res) => {
  clearAll();
  res.json({ message: 'Cache cleared successfully' });
});

module.exports = router;
```

## 3. Database Query Optimization

### Connection Pool Configuration

```javascript
// backend/config/database.js
const mysql = require('mysql2/promise');

/**
 * MySQL Connection Pool
 * Reuse connections instead of creating new ones
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Max connections
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release();
  })
  .catch(error => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

module.exports = pool;
```

### Add Database Indexes

```sql
-- backend/database/indexes.sql
-- Run these to improve query performance

-- Index on product category (for filtered queries)
CREATE INDEX idx_products_category ON products(category);

-- Index on product price (for sorted queries)
CREATE INDEX idx_products_price ON products(price);

-- Index on created_at (for date-based queries)
CREATE INDEX idx_products_created_at ON products(created_at);

-- Composite index for category + price (common filter combo)
CREATE INDEX idx_products_category_price ON products(category, price);

-- Index on order user_id (for user order history)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Index on order status (for admin order filtering)
CREATE INDEX idx_orders_status ON orders(status);

-- Full-text search index on product name and description
ALTER TABLE products ADD FULLTEXT INDEX idx_products_search (name, description);
```

### Optimize Queries with Prepared Statements

```javascript
// backend/controllers/productController.js
/**
 * Search products (optimized with full-text search)
 */
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const cacheKey = `products:search:${q}`;
    
    const products = await getOrSet(
      cacheKey,
      async () => {
        // Use full-text search for better performance
        const [rows] = await db.query(
          `SELECT *, MATCH(name, description) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
           FROM products
           WHERE MATCH(name, description) AGAINST(? IN NATURAL LANGUAGE MODE)
           ORDER BY relevance DESC
           LIMIT 50`,
          [q, q]
        );
        return rows;
      },
      300 // Cache search results for 5 minutes
    );
    
    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};
```

## 4. Response Compression

```javascript
// backend/server.js
const compression = require('compression');

// Install: npm install compression
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
```

```bash
npm install compression
```

## 5. Advanced: Redis Caching (Production-Ready)

For production at scale, consider Redis instead of in-memory cache.

```bash
npm install redis
```

```javascript
// backend/services/redisCache.js
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('Redis connected'));

(async () => {
  await client.connect();
})();

async function getOrSet(key, fetchFunction, ttl = 600) {
  try {
    const cached = await client.get(key);
    
    if (cached) {
      console.log(`Redis HIT: ${key}`);
      return JSON.parse(cached);
    }
    
    console.log(`Redis MISS: ${key}`);
    const fresh = await fetchFunction();
    
    await client.setEx(key, ttl, JSON.stringify(fresh));
    return fresh;
  } catch (error) {
    console.error('Redis error:', error);
    return await fetchFunction();
  }
}

module.exports = { client, getOrSet };
```

## 6. Environment Variables (.env)

```bash
# backend/.env
NODE_ENV=production
PORT=5000

# Database
DB_HOST=your-mysql-host.com
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=yokebud_crafts

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com

# App URL (for keep-alive)
APP_URL=https://your-backend.onrender.com

# Keep-alive (set to 'true' only if needed)
ENABLE_KEEP_ALIVE=false

# Redis (optional, for production)
REDIS_URL=redis://your-redis-host:6379

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 7. Performance Monitoring Middleware

```javascript
// backend/middleware/performanceMonitor.js
/**
 * Log slow database queries and API response times
 */
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Log in production for monitoring
    if (process.env.NODE_ENV === 'production') {
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

module.exports = performanceMonitor;
```

```javascript
// Apply in server.js
const performanceMonitor = require('./middleware/performanceMonitor');
app.use(performanceMonitor);
```

## Package Installation Summary

```bash
# Core caching
npm install node-cache

# Database
npm install mysql2

# Performance & Security
npm install compression

# Keep-alive (if needed)
npm install axios

# Optional: Redis (production)
npm install redis
```

## Expected Results

After implementing these optimizations:
- **TTFB (Time to First Byte):** < 200ms (with cache)
- **Cold Start Impact:** Minimized with keep-alive or external monitoring
- **Database Query Time:** Reduced by 70-90% with caching
- **Response Size:** Reduced by 60-70% with compression
- **API Response Time:** < 300ms for cached requests
- **Concurrent Users:** Can handle 100+ simultaneous users on Render's basic plan
