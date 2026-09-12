require('dotenv').config();
const express = require('express');
const compression = require('compression');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
// Serve static files (e.g. sitemap.xsl) from Backend/public
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Application build/version metadata (used by frontend to detect updates)
const APP_VERSION =
  process.env.RENDER_GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  process.env.GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Math.floor(Date.now() / 1000));
const APP_BUILD_TIME = new Date().toISOString();

// Stripe initialization (requires STRIPE_SECRET_KEY in env)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized.');
  } catch (e) {
    console.warn('Stripe could not be initialized:', e.message || e);
  }
} else {
  console.warn('STRIPE_SECRET_KEY not set; Stripe payments disabled.');
}

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dumadhsnc';

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.warn('CLOUDINARY_CLOUD_NAME not set; using default cloud name "dumadhsnc". Set CLOUDINARY_CLOUD_NAME in your environment to override.');
}

// Security headers for Lighthouse Best Practices
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middleware
app.use(compression());
app.use(cors({ origin: true, credentials: true }));

// Cache static assets
app.use('/uploads', express.static('uploads', {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true
}));

// Set proper MIME types for ES modules
app.use((req, res, next) => {
  if (req.path.endsWith('.mjs')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

// Version endpoint for cache-busting/version detection on the client
app.get('/version.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(JSON.stringify({
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    service: 'backend'
  }));
});

app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  abortOnLimit: true,
  useTempFiles: true
}));
const toSlug = (str) => {
  try {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  } catch {
    return '';
  }
};

function parseMetadataObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isFreeShippingEnabled(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function parseFreeShippingMinAmount(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;
  return Math.round(numericValue * 100) / 100;
}

function getNormalizedFreeShippingConfig(source = {}) {
  const productMeta = parseMetadataObject(source.product?.metadata) || {};
  const itemMeta = parseMetadataObject(source.metadata) || {};

  const enabledValue =
    source.free_shipping ??
    source.product?.free_shipping ??
    productMeta.free_shipping ??
    productMeta.freeShipping ??
    itemMeta.free_shipping ??
    itemMeta.freeShipping;

  const minimumAmountValue =
    source.free_shipping_min_amount ??
    source.product?.free_shipping_min_amount ??
    productMeta.free_shipping_min_amount ??
    productMeta.freeShippingMinAmount ??
    itemMeta.free_shipping_min_amount ??
    itemMeta.freeShippingMinAmount;

  return {
    enabled: isFreeShippingEnabled(enabledValue),
    minimumAmount: parseFreeShippingMinAmount(minimumAmountValue)
  };
}

function calculateItemsMerchandiseTotal(items = []) {
  const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const unitPrice = Number(item?.discounted_price ?? item?.price ?? 0) || 0;
    const quantity = Number(item?.quantity ?? 1) || 1;
    return sum + (unitPrice * quantity);
  }, 0);

  return Math.round(subtotal * 100) / 100;
}

function getFreeShippingStatus(items = [], merchandiseTotal = null) {
  const orderItems = Array.isArray(items) ? items : [];
  const normalizedTotal = Number.isFinite(Number(merchandiseTotal))
    ? Number(merchandiseTotal)
    : calculateItemsMerchandiseTotal(orderItems);

  let hasOffer = false;
  let minimumThreshold = null;

  for (const item of orderItems) {
    const config = getNormalizedFreeShippingConfig(item);
    if (!config.enabled) continue;

    hasOffer = true;

    if (config.minimumAmount === null) {
      return {
        hasOffer: true,
        qualifies: true,
        threshold: null
      };
    }

    minimumThreshold = minimumThreshold === null
      ? config.minimumAmount
      : Math.min(minimumThreshold, config.minimumAmount);
  }

  if (!hasOffer) {
    return {
      hasOffer: false,
      qualifies: false,
      threshold: null
    };
  }

  return {
    hasOffer: true,
    qualifies: minimumThreshold !== null && normalizedTotal >= minimumThreshold,
    threshold: minimumThreshold
  };
}



// URL Redirection Middleware
// ==================== SSR MIDDLEWARE FOR SOCIAL SHARING ====================
// এই middleware social crawlers detect করে সোশ্যাল মেটা ট্যাগ সহ HTML সরবরাহ করবে
// URL structure অপরিবর্তিত থাকবে

app.use(async (req, res, next) => {
  // Only handle GET requests for HTML pages
  if (req.method !== 'GET') return next();
  
  // Skip API, static files, and sitemap XMLs
  if (req.path.startsWith('/api') ||
      req.path.startsWith('/share') ||
      req.path.includes('.') ||
      req.path.endsWith('sitemap.xml') ||
      req.path.endsWith('.xsl') ||
      req.path === '/robots.txt' ||
      req.path === '/health' ||
      req.path === '/version.json') {
    return next();
  }

  // Check if this is a product page
  const productId = productSocialSeo.extractProductIdFromRequestPath(req.path);
  
  // Debug log
  console.log(`[SSR Middleware] Path: ${req.path}, Extracted Product ID: ${productId}`);
  console.log(`[SSR Middleware] User-Agent: ${req.headers['user-agent']}`);
  
  if (!productId) return next();

  try {
    // For social media crawlers, serve the social HTML directly without redirecting
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isSocialCrawler = 
      // Facebook
      userAgent.includes('facebookexternalhit') || 
      userAgent.includes('facebot') ||
      userAgent.includes('facebookbot') ||
      // Twitter/X
      userAgent.includes('twitterbot') ||
      userAgent.includes('tweetmemebot') ||
      userAgent.includes('twurly') ||
      // LinkedIn
      userAgent.includes('linkedinbot') ||
      userAgent.includes('linkedin') ||
      // Slack
      userAgent.includes('slackbot') ||
      userAgent.includes('slack') ||
      // Pinterest
      userAgent.includes('pinterest') ||
      userAgent.includes('pinterestbot') ||
      // WhatsApp
      userAgent.includes('whatsapp') ||
      // Telegram
      userAgent.includes('telegrambot') ||
      userAgent.includes('telegram') ||
      // Discord
      userAgent.includes('discordbot') ||
      userAgent.includes('discord') ||
      // Reddit
      userAgent.includes('redditbot') ||
      userAgent.includes('reddit') ||
      // Apple Messages
      userAgent.includes('applebot') ||
      // Other crawlers
      userAgent.includes('googlebot') ||
      userAgent.includes('bingbot') ||
      userAgent.includes('yahoo') ||
      userAgent.includes('baiduspider') ||
      // Generic crawlers
      userAgent.includes('bot') ||
      userAgent.includes('crawler') ||
      userAgent.includes('spider');

    console.log(`[SSR Middleware] Is social crawler? ${isSocialCrawler}`);

    if (isSocialCrawler) {
      const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
      const indexPath = path.join(CLIENT_BUILD_PATH, 'index.html');
      
      let html;
      if (fs.existsSync(indexPath)) {
        console.log(`[SSR Middleware] Using dist index.html at ${indexPath}`);
        html = fs.readFileSync(indexPath, 'utf8');
      } else {
        console.log(`[SSR Middleware] Using source index.html`);
        html = fs.readFileSync(path.join(__dirname, '../client/index.html'), 'utf8');
      }
      
      const socialHtml = await productSocialSeo.buildProductSocialHtml(pool, req.path, html);
      if (socialHtml) {
        console.log(`[SSR Middleware] Sending social HTML for product ${productId}`);
        return res.send(socialHtml);
      }
      console.log(`[SSR Middleware] No social HTML generated, falling through`);
    }

    next();
  } catch (error) {
    console.error('SSR middleware error:', error);
    next();
  }
});

const ADMIN_ID = parseInt(process.env.ADMIN_ID || '1', 10);
const adminFailedAttempts = new Map();

const hasAdminSession = (req) => {
  // Check cookie-based auth first
  if (req.cookies && req.cookies.adminAuth === 'authenticated') {
    return true;
  }
  
  // Check JWT token in Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Verify it's an admin token
      if (decoded.type === 'admin') {
        return true;
      }
    } catch (err) {
      // Token verification failed, continue to check other auth methods
    }
  }
  
  return false;
};

const requireAdminAuth = (req, res, next) => {
  const isAdmin = hasAdminSession(req);
  if (!isAdmin) {
    return res.status(401).json({ success: false, message: 'Unauthorized: admin access required' });
  }
  next();
};

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// Create a connection pool
// Create a connection pool
const pool = mysql.createPool(dbConfig);

async function ensureProductVariantsSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE IF NOT EXISTS product_variants (
        id INT NOT NULL AUTO_INCREMENT,
        product_id INT NOT NULL,
        color VARCHAR(64) NULL,
        size VARCHAR(64) NULL,
        quantity INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_product_variant (product_id, color, size),
        KEY idx_product (product_id)
      )`
    );
  } catch (e) {
  } finally {
    if (connection) connection.release();
  }
}

ensureProductVariantsSchema();

// ===== এই ফাংশনটি যোগ করুন =====
async function ensureQuantityDiscountRangesSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE IF NOT EXISTS quantity_discount_ranges (
        id INT NOT NULL AUTO_INCREMENT,
        product_id INT NOT NULL,
        min_quantity INT NOT NULL,
        max_quantity INT NULL,
        discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        discounted_price DECIMAL(10,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_id (product_id)
      )`
    );
    console.log('✅ Quantity discount ranges table checked/created');
  } catch (e) {
    console.warn('Quantity discount ranges schema setup error:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureQuantityDiscountRangesSchema();

async function ensureCustomLaserOrdersSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_laser_orders (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT NULL,
        width DECIMAL(10,2) NULL,
        height DECIMAL(10,2) NULL,
        depth DECIMAL(10,2) NULL,
        material VARCHAR(100) NULL,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user (user_id)
      )
    `);

    // Check if columns exist and add if missing
    const [cols] = await connection.query("SHOW COLUMNS FROM custom_laser_orders");
    const colNames = new Set(cols.map(c => c.Field));

    if (!colNames.has('inquiry_id')) {
      await connection.query("ALTER TABLE custom_laser_orders ADD COLUMN inquiry_id VARCHAR(100) NULL");
      console.log('Added inquiry_id column to custom_laser_orders table.');
    }

    if (!colNames.has('price')) {
      await connection.query("ALTER TABLE custom_laser_orders ADD COLUMN price DECIMAL(10,2) NULL DEFAULT 0.00");
      console.log('Added price column to custom_laser_orders table.');
    }

    if (!colNames.has('category')) {
      await connection.query("ALTER TABLE custom_laser_orders ADD COLUMN category VARCHAR(100) NULL");
      console.log('Added category column to custom_laser_orders table.');
    }
  } catch (err) {
    console.error('Custom laser orders schema setup error:', err.message);
  } finally {
    if (connection) connection.release();
  }
}

ensureCustomLaserOrdersSchema();

async function ensureAdminOtpSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(
      `CREATE TABLE IF NOT EXISTS admin_otp_attempts (
        id INT NOT NULL AUTO_INCREMENT,
        admin_id INT NULL,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(16) NOT NULL,
        status VARCHAR(32) NOT NULL,
        ip VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_email_created (email, created_at)
      )`
    );

    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_otp_attempts'`,
      [process.env.DB_NAME]
    );

    const columnNames = new Set((cols || []).map(c => c.COLUMN_NAME));

    if (!columnNames.has('admin_id')) {
      await connection.query(
        'ALTER TABLE admin_otp_attempts ADD COLUMN admin_id INT NULL AFTER id'
      );
    }

    if (!columnNames.has('updated_at')) {
      await connection.query(
        'ALTER TABLE admin_otp_attempts ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
      );
    }
  } catch (e) {
    console.warn('Admin OTP schema check failed (non-critical):', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureAdminOtpSchema();

async function ensureCategoriesExtendedSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check and add missing columns to categories table
    const [categoryCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories'`,
      [process.env.DB_NAME]
    );
    const categoryColNames = new Set((categoryCols || []).map(c => c.COLUMN_NAME));

    if (!categoryColNames.has('type')) {
      await connection.query('ALTER TABLE categories ADD COLUMN type VARCHAR(50) DEFAULT "craft"');
    }
    if (!categoryColNames.has('image_url')) {
      await connection.query('ALTER TABLE categories ADD COLUMN image_url TEXT NULL');
    }
    if (!categoryColNames.has('slug')) {
      await connection.query('ALTER TABLE categories ADD COLUMN slug VARCHAR(255) NULL');
    }
    if (!categoryColNames.has('updated_at')) {
      await connection.query('ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    // Ensure all categories have a slug if missing
    const [rows] = await connection.query('SELECT id, name FROM categories WHERE slug IS NULL OR slug = ""');
    for (const row of rows) {
      const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await connection.query('UPDATE categories SET slug = ? WHERE id = ?', [slug, row.id]);
    }

    console.log('✅ Categories schema updated successfully.');
  } catch (e) {
    console.warn('Categories schema update failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureCategoriesExtendedSchema();

async function ensureSeoSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check and add SEO columns to products table
    const [productCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );
    const productColNames = new Set((productCols || []).map(c => c.COLUMN_NAME));

    if (!productColNames.has('seo_title')) {
      await connection.query('ALTER TABLE products ADD COLUMN seo_title VARCHAR(255) NULL');
    }
    if (!productColNames.has('seo_description')) {
      await connection.query('ALTER TABLE products ADD COLUMN seo_description TEXT NULL');
    }
    if (!productColNames.has('seo_keywords')) {
      await connection.query('ALTER TABLE products ADD COLUMN seo_keywords TEXT NULL');
    }
    if (!productColNames.has('schema_json')) {
      await connection.query('ALTER TABLE products ADD COLUMN schema_json JSON NULL');
    }
    if (!productColNames.has('image_alt_text')) {
      await connection.query('ALTER TABLE products ADD COLUMN image_alt_text VARCHAR(255) NULL');
    }
    if (!productColNames.has('og_image')) {
      await connection.query('ALTER TABLE products ADD COLUMN og_image TEXT NULL');
    }
    if (!productColNames.has('twitter_image')) {
      await connection.query('ALTER TABLE products ADD COLUMN twitter_image TEXT NULL');
    }
    if (!productColNames.has('canonical_url')) {
      await connection.query('ALTER TABLE products ADD COLUMN canonical_url TEXT NULL');
    }
    if (!productColNames.has('hreflang_fi')) {
      await connection.query('ALTER TABLE products ADD COLUMN hreflang_fi TEXT NULL');
    }
    if (!productColNames.has('hreflang_de')) {
      await connection.query('ALTER TABLE products ADD COLUMN hreflang_de TEXT NULL');
    }
    if (!productColNames.has('gtin')) {
      await connection.query('ALTER TABLE products ADD COLUMN gtin VARCHAR(50) NULL');
    }

    // Check and add SEO columns to categories table
    const [categoryCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories'`,
      [process.env.DB_NAME]
    );
    const categoryColNames = new Set((categoryCols || []).map(c => c.COLUMN_NAME));

    if (!categoryColNames.has('seo_title')) {
      await connection.query('ALTER TABLE categories ADD COLUMN seo_title VARCHAR(255) NULL');
    }
    if (!categoryColNames.has('seo_description')) {
      await connection.query('ALTER TABLE categories ADD COLUMN seo_description TEXT NULL');
    }
    if (!categoryColNames.has('seo_keywords')) {
      await connection.query('ALTER TABLE categories ADD COLUMN seo_keywords TEXT NULL');
    }
    if (!categoryColNames.has('seo_content')) {
      await connection.query('ALTER TABLE categories ADD COLUMN seo_content TEXT NULL');
    }
    if (!categoryColNames.has('image_alt')) {
      await connection.query('ALTER TABLE categories ADD COLUMN image_alt VARCHAR(255) NULL');
    }
    if (!categoryColNames.has('og_image')) {
      await connection.query('ALTER TABLE categories ADD COLUMN og_image TEXT NULL');
    }
    if (!categoryColNames.has('canonical_url')) {
      await connection.query('ALTER TABLE categories ADD COLUMN canonical_url TEXT NULL');
    }
    if (!categoryColNames.has('hreflang_tags')) {
      try { await connection.query('ALTER TABLE categories ADD COLUMN hreflang_tags JSON NULL'); } catch {}
    }
    if (!categoryColNames.has('parent_category_id')) {
      try { await connection.query('ALTER TABLE categories ADD COLUMN parent_category_id INT NULL DEFAULT NULL'); } catch {}
    }
    if (!categoryColNames.has('slug')) {
      try { await connection.query('ALTER TABLE categories ADD COLUMN slug VARCHAR(255) NULL'); } catch {}
    }
    if (!categoryColNames.has('description')) {
      try { await connection.query('ALTER TABLE categories ADD COLUMN description TEXT NULL'); } catch {}
    }

    // Add default home page SEO content if it doesn't exist
    const [homeSeo] = await connection.query('SELECT 1 FROM seo_content WHERE page_name = "home" LIMIT 1');
    if (homeSeo.length === 0) {
      const defaultHomeTitle = 'Laser Engraving, Custom Apparel & Resin Art | Personalized Gifts Finland';
      const defaultHomeContent = `
        <p>Welcome to <strong>Yokebud craft</strong>, your premier destination for high-quality <strong>laser engraving Finland</strong>, <strong>custom apparel</strong>, and <strong>resin art</strong>. We specialize in precision <strong>laser cutting services</strong>, professional engraving, and unique handcrafted creations that transform everyday objects into meaningful treasures.</p>
        
        <h3>Expert Laser Engraving & Custom Apparel in Finland</h3>
        <p>Our state-of-the-art technology allows us to provide the finest <strong>laser engraving Helsinki</strong> has to offer, alongside premium <strong>customized hoodies</strong> and <strong>t-shirts</strong>. Whether you're looking for corporate branding, personalized wedding gifts, or custom streetwear, our team ensures every detail is captured with perfection.</p>
        
        <h3>Resin Art & Handcrafted Jewelry</h3>
        <p>Explore our stunning collection of <strong>resin art</strong> and <strong>handcrafted jewelry</strong>. Each piece is uniquely designed and made with care in our Finnish studio, combining traditional craftmanship with modern artistic techniques. From <strong>engraved wood gifts</strong> to <strong>personalized leather accessories</strong>, we have something for everyone.</p>
        
        <h3>Why Choose Yokebud craft?</h3>
        <ul>
          <li><strong>Precision and Quality:</strong> Advanced laser systems and high-quality apparel materials.</li>
          <li><strong>Local Expertise:</strong> Proudly based in Helsinki, serving all of Finland.</li>
          <li><strong>Customization:</strong> We can personalize almost anything to fit your vision.</li>
          <li><strong>Unique Designs:</strong> One-of-a-kind products you won't find anywhere else.</li>
        </ul>
      `;
      await connection.query(
        'INSERT INTO seo_content (page_name, title, content) VALUES ("home", ?, ?)',
        [defaultHomeTitle, defaultHomeContent]
      );
    }

    // Add default laser-engraving category SEO content if it doesn't exist
    const [laserSeo] = await connection.query('SELECT 1 FROM seo_content WHERE page_name = "laser-engraving" LIMIT 1');
    if (laserSeo.length === 0) {
      const laserTitle = 'Premium Laser Engraving Services in Finland';
      const laserContent = `
        <p>Yokebud craft is the leading provider of <strong>laser engraving Finland</strong>, offering unparalleled precision and artistic flair for all your customization needs. Our <strong>laser cutting products</strong> and engraving services are designed to meet the highest standards of quality, whether you're looking for a single personalized gift or large-scale corporate branding solutions.</p>
        
        <h3>Why Laser Engraving?</h3>
        <p>Laser engraving is a permanent, high-precision method of marking materials. Unlike traditional printing, <strong>engraved gifts</strong> do not fade or wear off over time. At Yokebud craft, we use state-of-the-art CO2 and Fiber lasers to work with wood, leather, acrylic, metal, and more. Our <strong>laser cutting services</strong> allow us to create intricate shapes and designs that were once thought impossible.</p>
        
        <h3>Our Laser Engraving Capabilities in Helsinki</h3>
        <p>Based in the heart of <strong>Helsinki</strong>, we serve clients across Finland with fast turnaround times and exceptional attention to detail. Our services include:</p>
        <ul>
          <li><strong>Wood Engraving:</strong> Perfect for kitchenware, signs, and photo frames.</li>
          <li><strong>Leather Engraving:</strong> Ideal for wallets, belts, and personalized accessories.</li>
          <li><strong>Metal Marking:</strong> High-contrast marking on stainless steel, aluminum, and more.</li>
          <li><strong>Custom Laser Cutting:</strong> Precision cutting for prototypes, models, and decor.</li>
        </ul>
        
        <h3>Personalized Engraving for Every Story</h3>
        <p>Every piece we create is a collaboration between our technology and your vision. From <strong>personalized engraving</strong> on jewelry to <strong>custom engraved gifts</strong> for weddings and anniversaries, we help you make every moment memorable. Our <strong>laser engraving Finland</strong> service is trusted by thousands of customers for its reliability and beauty.</p>
        
        <h3>Frequently Asked Questions (FAQ)</h3>
        <div class="seo-faq">
          <p><strong>Q: What materials can be laser engraved?</strong><br/>A: We can engrave on wood, leather, glass, acrylic, stone, and various metals. Each material requires specific settings for the best results.</p>
          <p><strong>Q: How long does laser engraving take?</strong><br/>A: Most individual orders are completed within 2-4 business days. Bulk orders may take longer depending on the quantity.</p>
          <p><strong>Q: Can I provide my own item for engraving?</strong><br/>A: Yes, we offer engraving services for customer-provided items, provided the material is compatible with our laser systems.</p>
          <p><strong>Q: Do you offer laser cutting services in Finland?</strong><br/>A: Yes, we provide precision laser cutting for wood, acrylic, and paper products up to certain thicknesses.</p>
        </div>
        
        <p>Ready to start your next project? Browse our <a href="/products">latest products</a> or <a href="/contact">contact us</a> for a custom quote on <strong>laser engraving Helsinki</strong> services.</p>
      `;
      await connection.query(
        'INSERT INTO seo_content (page_name, title, content) VALUES ("laser-engraving", ?, ?)',
        [laserTitle, laserContent]
      );
    }

    console.log('✅ SEO schema updated successfully.');
  } catch (e) {
    console.warn('SEO schema update failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

async function ensureCustomizationSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check and add customization columns to products table
    const [productCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );
    const productColNames = new Set((productCols || []).map(c => c.COLUMN_NAME));

    if (!productColNames.has('customization_type')) {
      await connection.query('ALTER TABLE products ADD COLUMN customization_type VARCHAR(50) DEFAULT "Apparels"');
    }
    if (!productColNames.has('customization_images')) {
      await connection.query('ALTER TABLE products ADD COLUMN customization_images JSON NULL');
    }
    if (!productColNames.has('customization_dimensions')) {
      await connection.query('ALTER TABLE products ADD COLUMN customization_dimensions JSON NULL');
    }

    console.log('✅ Customization schema updated successfully.');
  } catch (e) {
    console.warn('Customization schema update failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

async function ensureOrdersEstimatedDeliveryDate() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Check and add estimated_delivery_date column to orders
    try {
      await connection.query('ALTER TABLE orders ADD COLUMN estimated_delivery_date DATE NULL AFTER delivered_at');
      console.log('✅ Added estimated_delivery_date column to orders table');
    } catch (err) {
      if (!err.message.includes('Duplicate column name')) {
        console.warn('⚠️ Could not add estimated_delivery_date column:', err.message);
      }
    }
  } catch (e) {
    console.warn('⚠️ Orders estimated delivery date check failed:', e.message);
  } finally {
    if (connection) connection.release();
  }
}

ensureSeoSchema().then(() => {
  ensureCustomizationSchema();
  ensureOrdersEstimatedDeliveryDate();
});

// Using existing 'user_wishlist' table provisioned in the database

async function ensureProductCustomizableSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );

    const columnNames = new Set((cols || []).map(c => c.COLUMN_NAME));

    if (!columnNames.has('is_customizable')) {
      await connection.query(
        'ALTER TABLE products ADD COLUMN is_customizable BOOLEAN DEFAULT FALSE'
      );
      console.log('Added is_customizable column to products table');
    }
  } catch (e) {
    console.warn('Product customizable schema check failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureProductCustomizableSchema();

async function ensureProductPreorderSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );

    const columnNames = new Set((cols || []).map(c => c.COLUMN_NAME));

    if (!columnNames.has('is_preorder')) {
      await connection.query(
        'ALTER TABLE products ADD COLUMN is_preorder BOOLEAN DEFAULT FALSE'
      );
      console.log('Added is_preorder column to products table');
    }
  } catch (e) {
    console.warn('Product preorder schema check failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureProductPreorderSchema();

async function ensureProductStockStatusSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );

    const columnNames = new Set((cols || []).map(c => c.COLUMN_NAME));

    if (!columnNames.has('stock_status')) {
      await connection.query(
        "ALTER TABLE products ADD COLUMN stock_status VARCHAR(50) DEFAULT 'In Stock'"
      );
      console.log('Added stock_status column to products table');
    }
  } catch (e) {
    console.warn('Product stock_status schema check failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureProductStockStatusSchema();

async function ensureEngravingTypeSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [process.env.DB_NAME]
    );

    const columnNames = new Set((cols || []).map(c => c.COLUMN_NAME));

    if (!columnNames.has('engraving_type')) {
      await connection.query(
        "ALTER TABLE products ADD COLUMN engraving_type VARCHAR(20) DEFAULT 'both'"
      );
      console.log('Added engraving_type column to products table');
    }

    if (!columnNames.has('allow_customer_size_adjustment')) {
      await connection.query(
        'ALTER TABLE products ADD COLUMN allow_customer_size_adjustment BOOLEAN DEFAULT FALSE'
      );
      console.log('Added allow_customer_size_adjustment column to products table');
    }
  } catch (e) {
    console.warn('Engraving type schema check failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureEngravingTypeSchema();

async function ensureVideosSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE IF NOT EXISTS videos (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(255),
        embed_url TEXT NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );
    console.log('✅ Videos table checked/created');
  } catch (e) {
    console.warn('Videos schema setup error:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureVideosSchema();

async function ensureSeoContentSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE IF NOT EXISTS seo_content (
        id INT NOT NULL AUTO_INCREMENT,
        page_name VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(255) NULL,
        content TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );

    // Check if home page content exists, if not, insert a placeholder
    const [rows] = await connection.query('SELECT * FROM seo_content WHERE page_name = "home"');
    if (rows.length === 0) {
      await connection.query(
        'INSERT INTO seo_content (page_name, title, content) VALUES ("home", "Welcome to Yokebud craft", "<p>Your SEO content here...</p>")'
      );
    }
  } catch (e) {
    console.warn('SEO Content schema check failed:', e.message || e);
  } finally {
    if (connection) connection.release();
  }
}

ensureSeoContentSchema();

async function ensureSitemapSchema() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Sitemap entries table
    await connection.query(
      `CREATE TABLE IF NOT EXISTS sitemap_entries (
        id INT NOT NULL AUTO_INCREMENT,
        path VARCHAR(255) NOT NULL UNIQUE,
        priority VARCHAR(10) DEFAULT '0.6',
        changefreq VARCHAR(20) DEFAULT 'weekly',
        type VARCHAR(50) DEFAULT 'static', -- 'static', 'category', 'product', 'blog'
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );

    // URL Redirects table
    await connection.query(
      `CREATE TABLE IF NOT EXISTS url_redirects (
        id INT NOT NULL AUTO_INCREMENT,
        old_path VARCHAR(255) NOT NULL UNIQUE,
        new_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_old_path (old_path)
      )`
    );

    // Sitemap revisions table
    await connection.query(
      `CREATE TABLE IF NOT EXISTS sitemap_revisions (
        id INT NOT NULL AUTO_INCREMENT,
        action VARCHAR(50) NOT NULL, -- 'ADD', 'UPDATE', 'DELETE', 'REVERT'
        entry_id INT NULL,
        old_data JSON NULL,
        new_data JSON NULL,
        admin_id INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );

    // Ensure core static page URLs always exist in sitemap_entries (upsert style)
    const corePages = [
      ['/', '1.0', 'weekly', 'static'],
      ['/about', '0.8', 'monthly', 'static'],
      ['/contact', '0.8', 'monthly', 'static'],
      ['/cart', '0.6', 'weekly', 'static'],
      ['/policy', '0.5', 'yearly', 'static'],
      ['/return', '0.5', 'yearly', 'static'],
      ['/shipping', '0.5', 'yearly', 'static'],
      ['/blog', '0.6', 'weekly', 'static'] // main blog listing page so it appears in DB-driven sitemaps
    ];

    for (const [p, priority, freq, type] of corePages) {
      await connection.query(
        `INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           priority = VALUES(priority),
           changefreq = VALUES(changefreq),
           type = VALUES(type),
           is_active = TRUE`
        ,
        [p, priority, freq, type]
      );
    }
    console.log('✅ Sitemap schema checked/created successfully');
  } catch (e) {
    console.warn('⚠️ Sitemap schema check failed:', e.message);
  } finally {
    if (connection) connection.release();
  }
}

ensureSitemapSchema();



const { exec } = require('child_process');

// Public site URL for SEO
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://www.yokebud.fi';
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || 'http://localhost:5000';

const productSocialSeo = (() => {
  const DEFAULT_OG_IMAGE = `${PUBLIC_SITE_URL}/LOGO.png`;

  function escapeAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripHtml(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function toSlug(str) {
    try {
      return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
    } catch {
      return 'product';
    }
  }

  function extractProductIdFromRequestPath(reqPath) {
    try {
      const pathValue = String(reqPath || '').split('?')[0].replace(/\/+$/, '');
      const match = pathValue.match(/^\/(?:products|p)\/(.+)$/i);
      if (!match) return null;

      const segment = match[1];
      const parts = segment.split('/');

      if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
        return parts[0];
      }

      const first = parts[0];
      if (/^\d+$/.test(first)) return first;

      const lastHyphenPart = first.split('-').pop();
      if (/^\d+$/.test(lastHyphenPart)) return lastHyphenPart;

      return null;
    } catch {
      return null;
    }
  }

  function getProductIdFromSitemapPath(pathStr) {
    try {
      const pathValue = String(pathStr || '');
      const legacy = pathValue.match(/^\/products\/(\d+)\//);
      if (legacy) return legacy[1];
      const slugId = pathValue.match(/\/products\/[^/]*-(\d+)$/);
      if (slugId) return slugId[1];
      const bare = pathValue.match(/^\/products\/(\d+)$/);
      if (bare) return bare[1];
      return null;
    } catch {
      return null;
    }
  }

  // ========== NEW: Social sharing optimized image URL ==========
function getImageUrlForSharing(imgPath, width = 1200, height = 630) {
  console.log(`[getImageUrlForSharing] imgPath: ${imgPath}`);
  if (!imgPath) {
    console.log(`[getImageUrlForSharing] No image path, returning default: ${DEFAULT_OG_IMAGE}`);
    return DEFAULT_OG_IMAGE;
  }
  const s = String(imgPath);
  console.log(`[getImageUrlForSharing] s: ${s}`);
  if (s.startsWith('http://') || s.startsWith('https://')) {
    // Cloudinary optimization for social sharing
    if (s.includes('cloudinary.com')) {
      const parts = s.split('/upload/');
      if (parts.length === 2) {
        const optimizedUrl = `${parts[0]}/upload/f_auto,q_auto:good,w_${width},h_${height},c_fill/${parts[1]}`;
        console.log(`[getImageUrlForSharing] Optimized Cloudinary URL: ${optimizedUrl}`);
        return optimizedUrl;
      }
    }
    console.log(`[getImageUrlForSharing] Returning as-is: ${s}`);
    return s;
  }
  const clean = s.startsWith('/') ? s : `/${s}`;
  const result = `${PUBLIC_API_BASE}${clean}`;
  console.log(`[getImageUrlForSharing] Returning local image: ${result}`);
  return result;
}

  // ========== UPDATED: absoluteImageUrl uses the new function ==========
function absoluteImageUrl(imgPath, backendBase = PUBLIC_API_BASE) {
  if (!imgPath) return DEFAULT_OG_IMAGE;
  return getImageUrlForSharing(imgPath, 1200, 630);
}

  function parseProductPhotos(product) {
    try {
      console.log(`[parseProductPhotos] product.images: ${product.images}`);
      console.log(`[parseProductPhotos] product.product_photos: ${product.product_photos}`);
      const raw = product.images || product.product_photos || '[]';
      console.log(`[parseProductPhotos] raw: ${raw}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const result = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      console.log(`[parseProductPhotos] result: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      console.error(`[parseProductPhotos] Error: ${err}`);
      return [];
    }
  }

  async function resolveProductSitemapPath(connection, productId) {
    const [rows] = await connection.query(
      `SELECT path FROM sitemap_entries
       WHERE type = 'product' AND (is_active = TRUE OR is_active = 1)
       AND (path LIKE ? OR path LIKE ? OR path = ?)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [`/products/${productId}/%`, `/products/%-${productId}`, `/products/${productId}`]
    );
    return rows.length > 0 ? rows[0].path : null;
  }

  function buildCanonicalProductPath(product, sitemapPath, productId) {
    if (sitemapPath) return sitemapPath;
    const slug = product.slug || toSlug(product.product_name || 'product');
    return `/products/${slug}-${productId}`;
  }

  function buildProductSocialMetaTags(product, { canonicalUrl, imageUrl, siteName = 'Yokebud craft' } = {}) {
    console.log(`[buildProductSocialMetaTags] product.product_name: ${product.product_name}`);
    const name = product.product_name || 'Product';
    const desc = stripHtml(
      product.seo_description || product.product_details || product.product_description || ''
    ).slice(0, 200);
    console.log(`[buildProductSocialMetaTags] desc: ${desc}`);
    const title = escapeAttr(`${name} | ${siteName}`);
    const safeName = escapeAttr(name);
    const safeDesc = escapeAttr(desc);
    const safeUrl = escapeAttr(canonicalUrl);
    const safeImage = escapeAttr(imageUrl);
    const imageAlt = escapeAttr(name);
    console.log(`[buildProductSocialMetaTags] imageUrl: ${imageUrl}`);

    const tags = `
    <!-- Dynamic product social meta -->
    <title>${title}</title>
    <meta name="description" content="${safeDesc}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${safeUrl}" />
    <meta property="og:site_name" content="${escapeAttr(siteName)}" />
    <meta property="og:title" content="${safeName}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:alt" content="${imageAlt}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@yokebud" />
    <meta name="twitter:creator" content="@yokebud" />
    <meta name="twitter:title" content="${safeName}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:image:alt" content="${imageAlt}" />
  `;

    const noscriptBody = `
    <noscript id="product-seo-fallback">
      <article style="max-width:720px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#111;">
        <h1 style="font-size:1.5rem;margin:0 0 12px;">${safeName}</h1>
        <p style="line-height:1.5;margin:0 0 16px;">${safeDesc}</p>
        <img src="${safeImage}" alt="${imageAlt}" style="max-width:100%;height:auto;border-radius:8px;" />
        <p style="margin-top:16px;"><a href="${safeUrl}">View product on Yokebud craft</a></p>
      </article>
    </noscript>
  `;

    console.log(`[buildProductSocialMetaTags] Generated tags`);
    return { tags, noscriptBody };
  }

  function injectSocialMetaIntoHtml(html, { tags, noscriptBody }) {
    console.log(`[injectSocialMetaIntoHtml] Starting injection`);
    let result = String(html || '');
    result = result.replace(/<title>[\s\S]*?<\/title>/i, '');
    result = result.replace(/<meta\s+name="description"[^>]*\/?>/gi, '');
    result = result.replace(/<meta\s+name="robots"[^>]*\/?>/gi, '');
    result = result.replace(/<link\s+rel="canonical"[^>]*\/?>/gi, '');
    result = result.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
    result = result.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');

    console.log(`[injectSocialMetaIntoHtml] Replacing <head> tag`);
    result = result.replace(/<head>/i, `<head>${tags}`);

    if (noscriptBody && !result.includes('id="product-seo-fallback"')) {
      console.log(`[injectSocialMetaIntoHtml] Adding noscript body`);
      result = result.replace(/<body([^>]*)>/i, `<body$1>${noscriptBody}`);
    }

    console.log(`[injectSocialMetaIntoHtml] Done!`);
    return result;
  }

// ========== UPDATED: buildProductSocialHtml with proper image ==========
async function buildProductSocialHtml(pool, reqPath, html) {
  const productId = extractProductIdFromRequestPath(reqPath);
  console.log(`[buildProductSocialHtml] Product ID: ${productId}`);
  if (!productId) return null;

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
    console.log(`[buildProductSocialHtml] Product rows found: ${rows.length}`);
    if (!rows.length) {
      connection.release();
      return null;
    }

    const product = rows[0];
    const sitemapPath = await resolveProductSitemapPath(connection, productId);
    connection.release();
    connection = null;

    const canonicalPath = buildCanonicalProductPath(product, sitemapPath, productId);
    const canonicalUrl = `${PUBLIC_SITE_URL}${canonicalPath}`;
    const photos = parseProductPhotos(product);
    const imageUrl = photos[0] ? getImageUrlForSharing(photos[0], 1200, 630) : DEFAULT_OG_IMAGE;
    console.log(`[buildProductSocialHtml] Image URL: ${imageUrl}`);
    const meta = buildProductSocialMetaTags(product, { canonicalUrl, imageUrl });

    const result = injectSocialMetaIntoHtml(html, meta);
    console.log(`[buildProductSocialHtml] Generated social HTML successfully`);
    return result;
  } catch (err) {
    if (connection) connection.release();
    console.error(`[buildProductSocialHtml] Error: ${err}`);
    throw err;
  }
}

  // ========== EXPORT all functions ==========
  return {
    PUBLIC_SITE_URL,
    PUBLIC_API_BASE,
    DEFAULT_OG_IMAGE,
    escapeAttr,
    stripHtml,
    toSlug,
    extractProductIdFromRequestPath,
    getProductIdFromSitemapPath,
    absoluteImageUrl,
   getImageUrlForSharing,   // <-- NEW: export this
    parseProductPhotos,
    resolveProductSitemapPath,
    buildCanonicalProductPath,
    buildProductSocialMetaTags,
    injectSocialMetaIntoHtml,
    buildProductSocialHtml,
  };
})();

// Helper: extract productId from a sitemap path like `/products/slug-id`
function getProductIdFromPath(pathStr) {
  return productSocialSeo.getProductIdFromSitemapPath(pathStr);
}

async function regenerateSitemap() {
  const toSlug = (str) => {
    try {
      return String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } catch { return ''; }
  };

  let connection;
  try {
    console.log('🔄 Sitemap regeneration started...');
    connection = await pool.getConnection();

    // Fetch ALL sitemap entries directly from DB table
    // This query mirrors:
    // SELECT `id`, `path`, `priority`, `changefreq`, `type`, `is_active`, `created_at`, `updated_at` FROM `sitemap_entries` WHERE 1
    let [entries] = await connection.query(
      'SELECT id, path, priority, changefreq, type, is_active, created_at, updated_at FROM sitemap_entries WHERE 1'
    );
    console.log(`Fetched ${entries.length} sitemap entries from database.`);

    // Auto-sync products into sitemap_entries if missing
    const [allProducts] = await connection.query('SELECT id, slug, product_name FROM products WHERE status = "active" OR status IS NULL');
    for (const p of allProducts) {
      const slug = p.slug || toSlug(p.product_name);
      const pPath = `/products/${slug}-${p.id}`;
      const exists = entries.some(e => e.path === pPath);
      if (!exists) {
        await connection.query(
          'INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active) VALUES (?, "0.7", "weekly", "product", TRUE)',
          [pPath]
        );
      }
    }

    // Auto-sync blogs into sitemap_entries if missing
    const [allBlogs] = await connection.query('SELECT slug FROM blogs WHERE is_published = TRUE');
    for (const b of allBlogs) {
      if (!b.slug) continue;
      const bPath = `/blogs/${b.slug}`;
      const exists = entries.some(e => e.path === bPath);
      if (!exists) {
        await connection.query(
          'INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active) VALUES (?, "0.6", "weekly", "blog", TRUE)',
          [bPath]
        );
      }
    }

    // Auto-sync categories into sitemap_entries if missing
    const [allCats] = await connection.query('SELECT slug FROM categories');
    for (const c of allCats) {
      if (!c.slug) continue;
      const cPath = `/shop/${c.slug}`;
      const exists = entries.some(e => e.path === cPath);
      if (!exists) {
        await connection.query(
          'INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active) VALUES (?, "0.8", "weekly", "category", TRUE)',
          [cPath]
        );
      }
    }

    // =============================================================
    // CLEANUP: De-duplicate product URLs (same productId → keep 1 best)
    // =============================================================
    try {
      const [productEntries] = await connection.query(
        `SELECT id, path, priority, is_active, updated_at
         FROM sitemap_entries
         WHERE (type = 'product' OR path LIKE '/products/%')
         ORDER BY
           CASE WHEN path REGEXP '/products/[a-z0-9-]+-[0-9]+/?$' THEN 0 ELSE 1 END,
           CAST(priority AS DECIMAL(3,2)) DESC,
           updated_at DESC,
           id DESC`
      );

      const seenProductIds = new Set();
      const idsToKeep = new Set();
      const idsToDeactivate = [];

      for (const e of productEntries) {
        const pid = getProductIdFromPath(e.path);
        if (!pid) {
          // path looks like product but no id detectable → only keep if path is exactly canonical
          const looksCanonical = /^\/products\/[a-z0-9-]+-[0-9]+\/?$/.test(String(e.path || '').toLowerCase());
          if (!looksCanonical) {
            idsToDeactivate.push(e.id);
          }
          continue;
        }
        if (seenProductIds.has(pid)) {
          idsToDeactivate.push(e.id);
        } else {
          seenProductIds.add(pid);
          idsToKeep.add(e.id);
        }
      }

      if (idsToDeactivate.length > 0) {
        const placeholders = idsToDeactivate.map(() => '?').join(',');
        await connection.query(
          `UPDATE sitemap_entries SET is_active = FALSE, updated_at = NOW() WHERE id IN (${placeholders})`,
          idsToDeactivate
        );
        console.log(`🧹 Deactivated ${idsToDeactivate.length} duplicate/non-canonical product sitemap entries.`);
      }
    } catch (dedupErr) {
      console.warn('Duplicate product URL cleanup skipped:', dedupErr.message);
    }

    // Refetch entries after sync + dedup
    [entries] = await connection.query(
      'SELECT id, path, priority, changefreq, type, is_active, created_at, updated_at FROM sitemap_entries WHERE 1'
    );

    // If there are no category-type entries yet but an existing category-sitemap.xml
    // file is present (legacy static sitemap), import those URLs as initial
    // category entries so that AdminSitemap and DB-driven category sitemaps use them.
    const hasCategoryEntries = entries.some(
      (e) => String(e.type || '').trim().toLowerCase() === 'category'
    );
    if (!hasCategoryEntries) {
      try {
        const categoryXmlPath = path.join(
          __dirname,
          '..',
          'client',
          'public',
          'category-sitemap.xml'
        );
        if (fs.existsSync(categoryXmlPath)) {
          const raw = fs.readFileSync(categoryXmlPath, 'utf8');
          const locRegex = /<loc>([^<]+)<\/loc>/g;
          const toPath = (fullUrl) => {
            try {
              const url = new URL(fullUrl);
              return url.pathname + (url.search || '');
            } catch {
              return fullUrl.replace(PUBLIC_SITE_URL, '');
            }
          };

          const imported = [];
          let match;
          while ((match = locRegex.exec(raw)) !== null) {
            const loc = match[1];
            if (!loc) continue;
            const pathValue = toPath(loc.trim());
            if (!pathValue) continue;
            imported.push({
              path: pathValue,
              priority: '0.6',
              changefreq: 'weekly',
              type: 'category'
            });
          }

          if (imported.length > 0) {
            console.log(
              `Importing ${imported.length} legacy category URLs from static category-sitemap.xml`
            );
            for (const entry of imported) {
              await connection.query(
                `INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active)
                 VALUES (?, ?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE
                   priority = COALESCE(sitemap_entries.priority, VALUES(priority)),
                   changefreq = COALESCE(sitemap_entries.changefreq, VALUES(changefreq)),
                   type = VALUES(type),
                   is_active = COALESCE(sitemap_entries.is_active, TRUE)`,
                [entry.path, entry.priority, entry.changefreq, entry.type]
              );
            }

            // Re-load entries so subsequent logic sees the imported category URLs
            ;[entries] = await connection.query(
              'SELECT id, path, priority, changefreq, type, is_active, created_at, updated_at FROM sitemap_entries WHERE 1'
            );
          }
        }
      } catch (importErr) {
        console.warn('Category sitemap import skipped due to error:', importErr.message);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const header = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    // Helpers to build XML from a list
    const escapeXml = (unsafe) => {
      return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const buildXml = (items) => {
      const nodes = items.map(d => {
        const parts = [];
        parts.push('  <url>');
        parts.push(`    <loc>${escapeXml(d.loc)}</loc>`);
        parts.push(`    <lastmod>${escapeXml(d.lastmod)}</lastmod>`);
        parts.push(`    <changefreq>${escapeXml(d.changefreq)}</changefreq>`);
        parts.push(`    <priority>${escapeXml(d.priority)}</priority>`);
        for (const img of d.images || []) {
          if (!img) continue;
          parts.push('    <image:image>');
          parts.push(`      <image:loc>${escapeXml(img)}</image:loc>`);
          parts.push('    </image:image>');
        }
        parts.push('  </url>');
        return parts.join('\n');
      });
      return `${header}\n${nodes.join('\n')}\n</urlset>\n`;
    };

    const allUrls = [];
    const productUrls = [];
    const categoryUrls = [];
    const pageUrls = [];
    const blogUrls = [];

    // Build from sitemap_entries table
    for (const e of entries) {
      // Treat anything that looks like 0 / '0' / false as inactive
      const active =
        e.is_active === undefined || e.is_active === null
          ? true
          : !(e.is_active === 0 || e.is_active === '0' || e.is_active === false);
      if (!active) continue;

      const type = String(e.type || '').trim().toLowerCase();

      const base = {
        loc: `${PUBLIC_SITE_URL}${e.path}`,
        priority: e.priority || '0.6',
        changefreq: e.changefreq || 'weekly',
        lastmod: today,
        category:
          type === 'static'
            ? 'Pages'
            : type === 'category'
              ? 'Categories'
              : type === 'product'
                ? 'Products'
                : type === 'blog'
                  ? 'Blog'
                  : 'Other',
        images: []
      };

      allUrls.push(base);
      if (type === 'static') {
        pageUrls.push(base);
      } else if (type === 'product') {
        productUrls.push(base);
      } else if (type === 'category') {
        categoryUrls.push(base);
      } else if (type === 'blog') {
        blogUrls.push(base);
      }
    }

    // Sort helpers
    const sortUrls = (arr) => {
      arr.sort((a, b) => {
        const catComp = (String(a.category || '')).localeCompare(String(b.category || ''));
        if (catComp !== 0) return catComp;
        return parseFloat(b.priority) - parseFloat(a.priority);
      });
    };

    sortUrls(allUrls);
    sortUrls(productUrls);
    sortUrls(categoryUrls);
    sortUrls(pageUrls);
    sortUrls(blogUrls);

    const mainXml = buildSitemapIndexXml([
      { loc: `${PUBLIC_SITE_URL}/product-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/category-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/blog-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/page-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/component-sitemap.xml` }
    ]);
    const publicDir = path.join(__dirname, '..', 'client', 'public');
    const outPath = path.join(publicDir, 'sitemap.xml');
    const productPath = path.join(publicDir, 'product-sitemap.xml');
    const categoryPath = path.join(publicDir, 'category-sitemap.xml');
    const pagePath = path.join(publicDir, 'page-sitemap.xml');
    const blogPath = path.join(publicDir, 'blog-sitemap.xml');
    const componentPath = path.join(publicDir, 'component-sitemap.xml');
    const componentXml = await generateComponentSitemapXml();

    try {
      const legacyFiles = fs.readdirSync(publicDir).filter((fileName) =>
        fileName === 'product-sitemap.xml' ||
        fileName === 'category-sitemap.xml' ||
        fileName === 'page-sitemap.xml' ||
        fileName === 'blog-sitemap.xml' ||
        fileName === 'component-sitemap.xml' ||
        /^category-sitemap-[a-z0-9-]+\.xml$/i.test(fileName)
      );
      for (const legacyFile of legacyFiles) {
        try {
          fs.unlinkSync(path.join(publicDir, legacyFile));
        } catch (cleanupErr) {
          console.warn(`Could not remove legacy sitemap file ${legacyFile}:`, cleanupErr.message);
        }
      }
    } catch (cleanupErr) {
      console.warn('Legacy sitemap cleanup skipped:', cleanupErr.message);
    }

    const productXml = buildXml(productUrls);
    const categoryXml = buildXml(categoryUrls);
    const pageXml = buildXml(pageUrls);
    const blogXml = buildXml(blogUrls);
    fs.writeFileSync(outPath, mainXml, 'utf8');
    fs.writeFileSync(productPath, productXml, 'utf8');
    fs.writeFileSync(categoryPath, categoryXml, 'utf8');
    fs.writeFileSync(pagePath, pageXml, 'utf8');
    fs.writeFileSync(blogPath, blogXml, 'utf8');
    fs.writeFileSync(componentPath, componentXml, 'utf8');

    // Notify Google & Bing about the updated sitemap
    try {
      // Fire-and-forget (non-blocking) so regeneration latency stays low
      setImmediate(() => {
        pingSitemapToSearchEngines(`${PUBLIC_SITE_URL}/sitemap.xml`).catch(() => {});
      });
    } catch (_pingErr) {
      // ignore ping errors; regeneration itself succeeded
    }

    console.log(
      `✅ Sitemap regenerated: all=${allUrls.length}, products=${productUrls.length}, categories=${categoryUrls.length}, pages=${pageUrls.length}, blogs=${blogUrls.length}`
    );
    return {
      success: true,
      count: allUrls.length,
      path: outPath,
      productCount: productUrls.length,
      productPath,
      categoryCount: categoryUrls.length,
      categoryPath,
      pageCount: pageUrls.length,
      pagePath,
      blogCount: blogUrls.length,
      blogPath,
      componentPath
    };
  } catch (error) {
    console.error(`❌ Sitemap regeneration error: ${error.message}`);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Email sending via Brevo API
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY || '';
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
const nodemailer = require('nodemailer');

const isSmtpConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

let smtpTransport = null;
const getSmtpTransport = () => {
  if (smtpTransport) return smtpTransport;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return smtpTransport;
};

const getBrevoErrorDetails = (error) => {
  const details = {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    status: error?.status
  };
  const body = error?.response?.body ?? error?.body ?? null;
  if (body) details.body = body;
  return details;
};

const parseAddress = (input) => {
  if (!input) return { email: '', name: '' };
  if (typeof input === 'string') {
    const m = input.match(/^(.*)<(.+)>$/);
    if (m) return { name: m[1].trim(), email: m[2].trim() };
    return { name: input.split('@')[0], email: input.trim() };
  }
  if (typeof input === 'object' && input.email) {
    return { name: input.name || input.email.split('@')[0], email: input.email };
  }
  return { email: String(input), name: String(input) };
};

const sendMail = async (mailOptions) => {
  const sender = parseAddress(mailOptions.from || process.env.EMAIL_FROM);
  const toListRaw = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const toList = toListRaw.filter(Boolean).map(parseAddress).map(({ email, name }) => ({ email, name }));
  if (!sender.email) {
    throw new Error('Email sender is missing. Set EMAIL_FROM.');
  }
  if (!toList || toList.length === 0 || !toList[0]?.email) {
    throw new Error('Email recipient is missing.');
  }
  const payload = {
    sender,
    to: toList,
    subject: mailOptions.subject || '',
    htmlContent: mailOptions.html || '',
    textContent: mailOptions.text || undefined,
    replyTo: mailOptions.replyTo ? parseAddress(mailOptions.replyTo) : undefined
  };

  const canUseBrevo = !!(process.env.BREVO_API_KEY && String(process.env.BREVO_API_KEY).trim());
  let lastError = null;

  if (canUseBrevo) {
    try {
      const res = await brevoEmailApi.sendTransacEmail(payload);
      return { ok: true, provider: 'brevo', res };
    } catch (error) {
      lastError = error;
      console.error('❌ Brevo send error:', getBrevoErrorDetails(error));
    }
  } else {
    lastError = new Error('BREVO_API_KEY is missing');
  }

  if (isSmtpConfigured()) {
    const transport = getSmtpTransport();
    const smtpTo = toList.map(t => t.email).join(', ');
    const smtpMail = {
      from: `${sender.name} <${sender.email}>`,
      to: smtpTo,
      subject: payload.subject,
      html: payload.htmlContent,
      text: payload.textContent
    };
    const res = await transport.sendMail(smtpMail);
    return { ok: true, provider: 'smtp', res };
  }

  throw lastError || new Error('Email send failed');
};

const EMAIL_THEME = {
  primary: '#FFA500', // Gold/Orange
  secondary: '#2D3748', // Dark gray
  accent: '#48BB78', // Green
  danger: '#E53E3E', // Red
  light: '#F7FAFC', // Light gray
  dark: '#1A202C', // Dark
  text: '#2D3748',
  textLight: '#718096',
  white: '#FFFFFF',
  border: '#E2E8F0'
};

// ==================== PREMIUM EMAIL TEMPLATE COMPONENTS ====================

const renderThemedEmail = ({
  title,
  subtitle,
  contentHtml,
  primaryCtaText,
  primaryCtaUrl,
  secondaryCtaText,
  secondaryCtaUrl,
  footerNote,
  includeSocial = true
}) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${title || 'Yokebud craft'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        /* Reset and Base Styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: ${EMAIL_THEME.text};
          background-color: ${EMAIL_THEME.light};
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .email-container {
          max-width: 650px;
          margin: 0 auto;
          background: ${EMAIL_THEME.white};
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }
        
        /* Header Styles */
        .email-header {
          background: ${EMAIL_THEME.white};
          padding: 40px 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .email-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0,0 L100,0 L100,100 Z" fill="rgba(255,255,255,0.1)"/></svg>');
          background-size: cover;
        }
        
        .header-content {
          position: relative;
          z-index: 2;
        }
        
        .brand-logo {
          font-size: 32px;
          font-weight: 800;
          color: #000000;
          margin-bottom: 15px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          letter-spacing: 1px;
        }
        
        .email-title {
          color: #000000;
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 10px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          line-height: 1.2;
        }
        
        .email-subtitle {
          color: #000000;
          font-size: 18px;
          font-weight: 400;
          max-width: 500px;
          margin: 0 auto;
        }
        
        /* Content Styles */
        .email-content {
          padding: 40px 30px;
        }
        
        .content-section {
          margin-bottom: 35px;
        }
        
        .content-section:last-child {
          margin-bottom: 0;
        }
        
        .content-title {
          color: ${EMAIL_THEME.dark};
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .content-text {
          color: ${EMAIL_THEME.textLight};
          font-size: 16px;
          line-height: 1.7;
          margin-bottom: 20px;
        }
        
        /* Card Component */
        .email-card {
          background: ${EMAIL_THEME.light};
          border: 1px solid ${EMAIL_THEME.border};
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
        }
        
        .card-title {
          color: ${EMAIL_THEME.dark};
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        /* CTA Buttons */
        .cta-section {
          text-align: center;
          margin: 35px 0;
        }
        
        .cta-grid {
          text-align: center;
        }
        
        .primary-cta {
          display: inline-block;
          background: linear-gradient(135deg, ${EMAIL_THEME.primary}, #FFD700);
          color: ${EMAIL_THEME.dark};
          text-decoration: none;
          padding: 16px 35px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 700;
          box-shadow: 0 6px 20px rgba(255, 165, 0, 0.3);
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
          min-width: 200px;
        }
        
        .primary-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(255, 165, 0, 0.4);
        }
        
        .secondary-cta {
          display: inline-block;
          background: ${EMAIL_THEME.white};
          color: ${EMAIL_THEME.dark};
          text-decoration: none;
          padding: 16px 35px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          border: 2px solid ${EMAIL_THEME.primary};
          transition: all 0.3s ease;
          min-width: 200px;
        }
        
        .secondary-cta:hover {
          background: ${EMAIL_THEME.primary};
          color: ${EMAIL_THEME.white};
        }
        
        /* Footer Styles */
        .email-footer {
          background: ${EMAIL_THEME.white};
          color: ${EMAIL_THEME.dark};
          padding: 30px;
          text-align: center;
          border-top: 1px solid ${EMAIL_THEME.border};
        }
        
        .footer-content {
          max-width: 500px;
          margin: 0 auto;
        }
        
        .footer-text {
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .social-links {
          text-align: center;
          margin: 18px 0 10px 0;
        }
        
        .social-link {
          display: inline-block;
          line-height: 0;
          text-decoration: none;
          transition: transform 0.2s ease;
          background: transparent !important;
          border-radius: 0 !important;
          margin: 0 6px 10px 6px;
        }
        
        .social-link:hover {
          transform: translateY(-1px) scale(1.05);
        }
        
        .social-icon {
          width: 24px;
          height: 24px;
          background: transparent !important;
          border-radius: 0 !important;
        }
        
        .contact-info {
          margin-top: 20px;
          font-size: 12px;
          line-height: 1.5;
        }
        
        .contact-info p {
          margin-bottom: 5px;
        }
        
        .copyright {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid ${EMAIL_THEME.border};
          font-size: 12px;
          color: ${EMAIL_THEME.textLight};
        }
        
        /* Responsive Styles */
        @media (max-width: 600px) {
          .email-header {
            padding: 30px 20px;
          }
          
          .email-title {
            font-size: 28px;
          }
          
          .email-subtitle {
            font-size: 16px;
          }
          
          .email-content {
            padding: 30px 20px;
          }
          
          .content-title {
            font-size: 22px;
          }
          
          .primary-cta,
          .secondary-cta {
            width: 100%;
            max-width: 300px;
          }
          .social-link { margin: 0 6px 10px 6px; }
        }
        
        /* Print Styles */
        @media print {
          .email-container {
            box-shadow: none;
            border: 1px solid #ddd;
          }
          
          .primary-cta,
          .secondary-cta {
            background: #f0f0f0 !important;
            color: #000 !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="email-header">
          <div class="header-content">
            <div class="brand-logo">YOKEBUD craft</div>
            <h1 class="email-title">${title || 'Yokebud craft'}</h1>
            ${subtitle ? `<p class="email-subtitle">${subtitle}</p>` : ''}
          </div>
        </div>
        
        <!-- Content -->
        <div class="email-content">
          ${contentHtml || ''}
          
          <!-- CTA Section -->
          ${(primaryCtaText && primaryCtaUrl) || (secondaryCtaText && secondaryCtaUrl) ? `
          <div class="cta-section">
            <div class="cta-grid">
              ${primaryCtaText && primaryCtaUrl ? `
                <a href="${primaryCtaUrl}" class="primary-cta" style="display:inline-block;margin:0 6px 12px 6px;">
                  ${primaryCtaText}
                </a>
              ` : ''}
              
              ${secondaryCtaText && secondaryCtaUrl ? `
                <a href="${secondaryCtaUrl}" class="secondary-cta" style="display:inline-block;margin:0 6px 12px 6px;">
                  ${secondaryCtaText}
                </a>
              ` : ''}
            </div>
          </div>
          ` : ''}
          
          <!-- Footer Note -->
          ${footerNote ? `
          <div class="email-card">
            <p class="content-text" style="text-align: center; margin: 0;">
              ${footerNote}
            </p>
          </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          <div class="footer-content">
            ${includeSocial ? `
            <div class="social-links">
              <a href="https://www.facebook.com/share/1D9o7CoZB7/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://wa.me/+358440328124" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WhatsApp" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.youtube.com/@yokebud" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.instagram.com/yokebud/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.tiktok.com/@yokebud" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" alt="TikTok" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://fi.pinterest.com/yokebud/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/174/174863.png" alt="Pinterest" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.linkedin.com/company/yokebudcraft/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/3955/3955056.png" alt="LinkedIn" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://yokebudcraft.etsy.com" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px 10px 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/825/825513.png" alt="Etsy" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
            </div>
            ` : ''}
            
            <div class="contact-info">
              <p>Yokebud craft</p>
              <p>Kotopellonkatu 1A, 04200 Kerava, Finland</p>
              <p>Email: info@yokebud.com | Phone: +358 440 328 124</p>
            </div>
            
            <div class="copyright">
              &copy; ${new Date().getFullYear()} Yokebud craft. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ==================== SPECIFIC EMAIL TEMPLATES ====================

// ==================== ADMIN AUTHENTICATION API ====================

// ==================== ADMIN OTP EMAIL TEMPLATE ====================

// 1. Template Renderer (Matches your Image Design)
const renderAdminOtpEmail = (otp) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Login Verification</h2>
        <p class="content-text">
          Secure Verification Required
        </p>
      </div>
      
      <div class="email-card" style="text-align: center; padding: 40px 20px;">
        <p class="content-text" style="margin-bottom: 20px;">
          Use this OTP to login to your Yokebud craft account.
        </p>

        <div style="background: #1A202C; border-radius: 12px; padding: 20px; display: inline-block; margin: 0 auto 20px auto; min-width: 200px;">
          <span style="color: #FFFFFF; font-size: 32px; font-weight: 700; letter-spacing: 12px; font-family: monospace;">
            ${otp}
          </span>
        </div>

        <p style="color: #E53E3E; font-weight: 600; font-size: 14px; margin-top: 15px;">
          ⏳ This OTP expires in 15 minutes. Do not share it.
        </p>
      </div>
      
      <p class="content-text" style="text-align: center; font-size: 13px; color: #718096;">
        If you didn't request this code, please ignore this email.
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Yokebud craft Admin',
    subtitle: 'Admin Access Verification',
    contentHtml,
    footerNote: 'This code was generated for Admin access.'
  });
};

// 2. Sender Function
const sendAdminOtpEmail = async (otpRecord) => {
  if (!otpRecord || !otpRecord.otp_code) {
    console.error('❌ Admin OTP email error: invalid OTP record');
    return false;
  }

  const adminEmail = otpRecord.email || 'yokebud@gmail.com';
  const html = renderAdminOtpEmail(otpRecord.otp_code);

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud Security <security@yokebud.com>',
    to: adminEmail,
    subject: '🔐 Admin Login Verification Code',
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Admin OTP email sent to ${adminEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Admin OTP email error:', error);
    return false;
  }
};



// 1. WELCOME EMAIL (NEWSLETTER SUBSCRIPTION)
const renderWelcomeEmail = (email, token) => {
  const unsubscribeLink = `${PUBLIC_SITE_URL}/UnsubscribePage?token=${token}`;

  const contentHtml = `
    <div class="content-section">
      <h2 class="content-title">Welcome to Yokebud craft! </h2>
      <p class="content-text">
        Thank you for joining our exclusive community of fashion enthusiasts and wholesale buyers. 
        We're thrilled to have you on board!
      </p>
      
      <div class="email-card">
        <h3 class="card-title">Your Subscription Benefits</h3>
        <ul style="color: ${EMAIL_THEME.textLight}; line-height: 1.8; padding-left: 20px;">
          <li><strong>Weekly Product Updates:</strong> Be the first to see new arrivals</li>
          <li><strong>Exclusive Wholesale Prices:</strong> Special rates for subscribers</li>
          <li><strong>Priority Support:</strong> Dedicated assistance for your needs</li>
          <li><strong>Trend Insights:</strong> Latest fashion trends and analysis</li>
          <li><strong>Seasonal Promotions:</strong> Limited-time offers and discounts</li>
        </ul>
      </div>
      
      <p class="content-text">
        Our first newsletter will arrive in your inbox soon. In the meantime, feel free to explore 
        our premium collection of wholesale fashion products.
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Welcome to Yokebud craft',
    subtitle: 'Your journey to premium wholesale fashion begins here',
    contentHtml,
    primaryCtaText: 'Explore Our Collection',
    primaryCtaUrl: PUBLIC_SITE_URL,
    secondaryCtaText: 'Unsubscribe',
    secondaryCtaUrl: unsubscribeLink,
    footerNote: 'If you have any questions, simply reply to this email. We\'re here to help!'
  });
};

// ACCOUNT WELCOME EMAIL (NEW USER REGISTRATION)
const renderAccountWelcomeEmail = (name) => {
  const profileUrl = `${PUBLIC_SITE_URL}/UserProfile`;
  const shopUrl = `${PUBLIC_SITE_URL}/`;
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Welcome${name ? `, ${name}` : ''}! 🎉</h2>
        <p class="content-text">Your Yokebud craft account has been created successfully.</p>
      </div>

      <div class="email-card">
        <h3 class="card-title">Getting Started</h3>
        <ul style="color: ${EMAIL_THEME.textLight}; line-height: 1.8; padding-left: 20px;">
          <li><strong>Update Profile:</strong> Add your contact and shipping details</li>
          <li><strong>Browse Products:</strong> Explore our latest collections</li>
          <li><strong>Start a Conversation:</strong> Message us for wholesale inquiries</li>
        </ul>
      </div>

    </div>
  `;

  return renderThemedEmail({
    title: 'Welcome to Yokebud craft',
    subtitle: 'We are excited to have you here',
    contentHtml,
    primaryCtaText: 'Go to Your Profile',
    primaryCtaUrl: profileUrl,
    secondaryCtaText: 'Explore Products',
    secondaryCtaUrl: shopUrl,
    footerNote: 'Complete your profile for a smoother checkout and support experience.'
  });
};

// 2. ORDER CONFIRMATION EMAIL
const renderOrderConfirmationEmail = (orderId, customerInfo, items, totals) => {
  const viewOrdersUrl = `${PUBLIC_SITE_URL}/UserProfile`;
  const downloadUrl = `${PUBLIC_SITE_URL}/Checkout?orderId=${encodeURIComponent(orderId)}&download=invoice`;

  const itemsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${items.map(item => `
        <tr>
          <td style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <strong>${item.product_name || item.name}</strong>
            <div style="color: ${EMAIL_THEME.textLight}; font-size: 14px; line-height: 1.6;">
              Quantity: ${item.quantity} × $${Number(item.discounted_price || item.price || 0).toFixed(2)}
              ${item.size ? ` • Size: ${item.size}` : ''}
              ${item.color ? ` • Color: ${item.color}` : ''}
            </div>
          </td>
          <td align="right" style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border}; font-weight: 600; white-space: nowrap;">
            $${(Number(item.quantity) * Number(item.discounted_price || item.price || 0)).toFixed(2)}
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Order Confirmed! 🎉</h2>
        <p class="content-text" style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
          Order #${orderId}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Order Summary</h3>
        ${itemsHtml}
        <div style="padding: 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border};">Subtotal:</td>
              <td align="right" style="padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border}; white-space: nowrap;">
                $${Number(totals.subtotal || 0).toFixed(2)}
              </td>
            </tr>
            ${totals.shipping ? `
              <tr>
                <td style="padding: 10px 0;">Shipping:</td>
                <td align="right" style="padding: 10px 0; white-space: nowrap;">
                  $${Number(totals.shipping).toFixed(2)}
                </td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border};">Total:</td>
              <td align="right" style="padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border}; white-space: nowrap;">
                <span style="color: ${EMAIL_THEME.primary};">$${Number(totals.total || 0).toFixed(2)}</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Customer Information</h3>
        <p style="margin-bottom: 10px;">
          <strong>Name:</strong> ${customerInfo.firstName} ${customerInfo.lastName}
        </p>
        <p style="margin-bottom: 10px;">
          <strong>Email:</strong> ${customerInfo.email}
        </p>
        ${customerInfo.phone ? `<p style="margin-bottom: 10px;"><strong>Phone:</strong> ${customerInfo.phone}</p>` : ''}
        <p style="margin-bottom: 10px;">
          <strong>Address:</strong> ${customerInfo.address}, ${customerInfo.city}, ${customerInfo.country}
        </p>
      </div>
      
      <p class="content-text">
        We've received your order and are preparing it for shipment. You'll receive another email 
        with tracking information once your order ships. Thank you for choosing Yokebud craft!
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Order Confirmation',
    subtitle: `Order #${orderId}`,
    contentHtml,
    primaryCtaText: 'Download Invoice',
    primaryCtaUrl: downloadUrl,
    secondaryCtaText: 'View Orders',
    secondaryCtaUrl: viewOrdersUrl,
    footerNote: 'Estimated delivery: 7-14 business days. For any questions, reply to this email.'
  });
};

// 2a. ADMIN NEW ORDER EMAIL
const renderAdminNewOrderEmail = (orderId, customerInfo, items, totals) => {
  const itemsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${items.map(item => `
        <tr>
          <td style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <strong>${item.product_name || item.name}</strong>
            <div style="color: ${EMAIL_THEME.textLight}; font-size: 14px; line-height: 1.6;">
              Quantity: ${item.quantity} × €${Number(item.discounted_price || item.price || 0).toFixed(2)}
              ${item.size ? ` • Size: ${item.size}` : ''}
              ${item.color ? ` • Color: ${item.color}` : ''}
            </div>
          </td>
          <td align="right" style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border}; font-weight: 600; white-space: nowrap;">
            €${(Number(item.quantity) * Number(item.discounted_price || item.price || 0)).toFixed(2)}
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">New Order Received! </h2>
        <p class="content-text" style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
          Order #${orderId}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Order Summary</h3>
        ${itemsHtml}
        <div style="padding: 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border};">Subtotal:</td>
              <td align="right" style="padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border}; white-space: nowrap;">
                €${Number(totals.subtotal || 0).toFixed(2)}
              </td>
            </tr>
            ${totals.shipping ? `
              <tr>
                <td style="padding: 10px 0;">Shipping:</td>
                <td align="right" style="padding: 10px 0; white-space: nowrap;">
                  €${Number(totals.shipping).toFixed(2)}
                </td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border};">Total:</td>
              <td align="right" style="padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border}; white-space: nowrap;">
                <span style="color: ${EMAIL_THEME.primary};">€${Number(totals.total || 0).toFixed(2)}</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Customer Information</h3>
        <p style="margin-bottom: 10px;">
          <strong>Name:</strong> ${customerInfo.firstName} ${customerInfo.lastName}
        </p>
        <p style="margin-bottom: 10px;">
          <strong>Email:</strong> ${customerInfo.email}
        </p>
        ${customerInfo.phone ? `<p style="margin-bottom: 10px;"><strong>Phone:</strong> ${customerInfo.phone}</p>` : ''}
        <p style="margin-bottom: 10px;">
          <strong>Address:</strong> ${customerInfo.address}, ${customerInfo.city}, ${customerInfo.country}
        </p>
      </div>
    </div>
  `;

  return renderThemedEmail({
    title: 'New Order Alert',
    subtitle: `Order #${orderId}`,
    contentHtml,
    primaryCtaText: 'View in Admin Panel',
    primaryCtaUrl: `${process.env.ADMIN_URL || 'http://localhost:5173/admin'}/orders`,
    footerNote: 'This is an automated notification for Admins.'
  });
};

// 2b. MANUAL SUCCESS EMAIL
const renderManualNotificationEmail = (orderId, customerInfo) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Hello ${customerInfo.firstName}! </h2>
        <p class="content-text">
          We just wanted to send a quick note about your order.
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Order Update</h3>
        <p class="content-text">
          Your order <strong>#${orderId}</strong> is being processed with care. We appreciate your patience and support!
        </p>
        <p class="content-text">
          If you have any questions, feel free to reply to this email.
        </p>
      </div>
    </div>
  `;

  return renderThemedEmail({
    title: 'Order Update',
    subtitle: `Order #${orderId}`,
    contentHtml,
    primaryCtaText: 'View Order',
    primaryCtaUrl: `${process.env.PUBLIC_SITE_URL || 'http://localhost:5173'}/UserProfile`,
    footerNote: 'Thank you for choosing Yokebud craft!'
  });
};

// 3. NEWSLETTER SUBSCRIPTION NOTIFICATION (ADMIN)
const renderNewSubscriberNotificationEmail = (subscriberEmail) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">New Newsletter Subscriber! </h2>
        <p class="content-text">
          Someone just subscribed to your newsletter
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Subscriber Details</h3>
        <div style="padding: 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                <strong style="display: block; color: ${EMAIL_THEME.text};">Email Address</strong>
                <span style="color: ${EMAIL_THEME.textLight};">${subscriberEmail}</span>
              </td>
              <td align="right" style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border}; white-space: nowrap; color: ${EMAIL_THEME.accent}; font-weight: 600;">
                ✅ Active
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                <strong style="display: block; color: ${EMAIL_THEME.text};">Subscription Date</strong>
                <span style="color: ${EMAIL_THEME.textLight};">
                  ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}
                </span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 15px 0 0 0;">
                <span style="color: ${EMAIL_THEME.textLight}; font-size: 24px; font-weight: 700;">+1</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;

  return renderThemedEmail({
    title: 'New Subscriber Alert',
    subtitle: 'Yokebud craft Newsletter System',
    contentHtml,
    primaryCtaText: 'View Subscriber Dashboard',
    primaryCtaUrl: `${process.env.ADMIN_URL || 'https://www.yokebud.fi/admin'}`,
    footerNote: 'This is an automated notification from Yokebud craft Newsletter System'
  });
};

const escapeEmailHtml = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatNewsletterPrice = (value) => {
  const amount = Number(value || 0);
  return `€${amount.toFixed(2)}`;
};

const getNewsletterProductLink = (product) => {
  const slug = String(product.product_name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${PUBLIC_SITE_URL}/products/${slug}-${product.id}`;
};

const getNewsletterImageUrl = (product) => {
  const raw = product.firstImage || '';
  if (!raw) return `${PUBLIC_SITE_URL}/LOGO.png`;
  const source = String(raw);
  if (source.startsWith('http://') || source.startsWith('https://')) return source;
  const clean = source.startsWith('/') ? source : `/${source}`;
  return `${PUBLIC_API_BASE}${clean}`;
};

const getNewsletterDiscountMeta = (product) => {
  const price = Number(product.price || 0);
  const discountedPrice = Number(product.discounted_price || 0);
  const hasDiscount = discountedPrice > 0 && discountedPrice < price;
  if (!hasDiscount) {
    return { hasDiscount: false, amountSaved: 0, percentSaved: 0 };
  }

  const amountSaved = price - discountedPrice;
  const percentSaved = price > 0 ? Math.round((amountSaved / price) * 100) : 0;
  return { hasDiscount, amountSaved, percentSaved };
};

const renderNewsletterProductGrid = (products, { accentColor, badgeBg, badgeText, ctaText }) => {
  const safeProducts = Array.isArray(products) ? products : [];
  if (safeProducts.length === 0) return '';

  const rows = [];
  for (let index = 0; index < safeProducts.length; index += 2) {
    rows.push(safeProducts.slice(index, index + 2));
  }

  return rows.map(row => {
    const cells = row.map(product => {
      const productName = escapeEmailHtml(product.product_name || 'Product');
      const productLink = getNewsletterProductLink(product);
      const imageUrl = getNewsletterImageUrl(product);
      const { hasDiscount, amountSaved, percentSaved } = getNewsletterDiscountMeta(product);
      const priceHtml = hasDiscount
        ? `
            <div style="font-size: 13px; color: #8A94A6; text-decoration: line-through; margin-bottom: 4px;">
              ${formatNewsletterPrice(product.price)}
            </div>
            <div style="font-size: 22px; line-height: 28px; font-weight: 800; color: ${EMAIL_THEME.danger};">
              ${formatNewsletterPrice(product.discounted_price)}
            </div>
            <div style="font-size: 12px; line-height: 18px; color: ${EMAIL_THEME.accent}; font-weight: 700; margin-top: 4px;">
              Save ${formatNewsletterPrice(amountSaved)}${percentSaved > 0 ? ` (${percentSaved}% off)` : ''}
            </div>
          `
        : `
            <div style="font-size: 22px; line-height: 28px; font-weight: 800; color: ${EMAIL_THEME.dark};">
              ${formatNewsletterPrice(product.price)}
            </div>
          `;

      return `
        <td width="50%" valign="top" style="padding: 0 8px 16px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid ${EMAIL_THEME.border}; border-radius: 14px; overflow: hidden; background: #ffffff;">
            <tr>
              <td style="padding: 0;">
                <a href="${productLink}" style="text-decoration: none; display: block;">
                  <img src="${imageUrl}" alt="${productName}" width="100%" style="display: block; width: 100%; height: 220px; object-fit: cover; background: #f7fafc;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 18px 16px 18px;">
                <div style="margin-bottom: 12px;">
                  <span style="display: inline-block; background: ${badgeBg}; color: ${badgeText}; font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; padding: 5px 9px; border-radius: 999px;">
                    ${hasDiscount ? 'Special Offer' : 'Latest Upload'}
                  </span>
                </div>
                <div style="font-size: 18px; line-height: 25px; color: ${EMAIL_THEME.dark}; font-weight: 700; min-height: 50px; margin-bottom: 10px;">
                  ${productName}
                </div>
                <div style="margin-bottom: 16px;">
                  ${priceHtml}
                </div>
                <a href="${productLink}" style="display: inline-block; background: ${accentColor}; color: #ffffff; text-decoration: none; padding: 11px 18px; border-radius: 8px; font-size: 13px; line-height: 18px; font-weight: 700;">
                  ${ctaText}
                </a>
              </td>
            </tr>
          </table>
        </td>
      `;
    }).join('');

    const spacer = row.length === 1
      ? '<td width="50%" valign="top" style="padding: 0 8px 16px 8px;"></td>'
      : '';

    return `<tr>${cells}${spacer}</tr>`;
  }).join('');
};

const renderNewsletterSection = ({
  title,
  intro,
  products,
  accentColor,
  badgeBg,
  badgeText,
  ctaText
}) => {
  if (!Array.isArray(products) || products.length === 0) return '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 28px;">
      <tr>
        <td style="padding: 0 0 14px 0;">
          <div style="font-size: 24px; line-height: 30px; color: ${EMAIL_THEME.dark}; font-weight: 800; margin-bottom: 8px;">
            ${title}
          </div>
          <div style="font-size: 15px; line-height: 24px; color: ${EMAIL_THEME.textLight};">
            ${intro}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${renderNewsletterProductGrid(products, { accentColor, badgeBg, badgeText, ctaText })}
          </table>
        </td>
      </tr>
    </table>
  `;
};

// 4. WEEKLY NEWSLETTER EMAIL
const renderWeeklyNewsletterEmail = (subscriber, collections, token) => {
  const unsubscribeLink = `${PUBLIC_SITE_URL}/UnsubscribePage?token=${token}`;
  const newArrivals = Array.isArray(collections?.newArrivals) ? collections.newArrivals : [];
  const discountedProducts = Array.isArray(collections?.discounted) ? collections.discounted : [];
  const totalHighlights = newArrivals.length + discountedProducts.length;

  const highlightsSummary = [
    newArrivals.length > 0 ? `${newArrivals.length} latest upload${newArrivals.length > 1 ? 's' : ''}` : null,
    discountedProducts.length > 0 ? `${discountedProducts.length} special deal${discountedProducts.length > 1 ? 's' : ''}` : null
  ].filter(Boolean).join(' and ');

  const newArrivalsHtml = renderNewsletterSection({
    title: 'Latest Uploads',
    intro: 'Freshly uploaded products from the workshop, selected from the newest active items on the site.',
    products: newArrivals,
    accentColor: '#111111',
    badgeBg: '#FFF4D8',
    badgeText: '#8A5A00',
    ctaText: 'View Product'
  });

  const discountedHtml = renderNewsletterSection({
    title: 'Special Discounts',
    intro: 'Current discounted products featured separately, so subscribers can spot active offers right away.',
    products: discountedProducts,
    accentColor: EMAIL_THEME.danger,
    badgeBg: '#FDECEC',
    badgeText: '#B42318',
    ctaText: 'Claim Offer'
  });

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; padding: 7px 14px; border-radius: 999px; background: #FFF4D8; color: #8A5A00; font-size: 12px; line-height: 18px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 16px;">
          Weekly Product Newsletter
        </div>
        <h2 class="content-title" style="margin-bottom: 10px;">This Week at Yokebud craft</h2>
        <p class="content-text" style="text-align: center; margin-bottom: 10px;">
          ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <p class="content-text" style="text-align: center; max-width: 520px; margin: 0 auto;">
          ${totalHighlights > 0
            ? `We prepared ${escapeEmailHtml(highlightsSummary)} for this week's edition, with newly uploaded products and clearly separated offer items for faster browsing.`
            : 'We prepared a curated weekly look at what is new on Yokebud craft.'}
        </p>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid ${EMAIL_THEME.border}; border-radius: 14px; background: #F9FBFC;">
        <tr>
          <td style="padding: 18px 20px;">
            <div style="font-size: 14px; line-height: 23px; color: ${EMAIL_THEME.text};">
              You are receiving the latest uploads directly from our store. Whenever a product has a live discount, it appears in its own dedicated section below instead of being mixed into the general product feed.
            </div>
          </td>
        </tr>
      </table>

      ${newArrivalsHtml}
      ${discountedHtml}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 28px; border: 1px dashed ${EMAIL_THEME.primary}; border-radius: 14px; background: #FFF9ED;">
        <tr>
          <td style="padding: 20px;">
            <div style="font-size: 16px; line-height: 24px; color: ${EMAIL_THEME.dark}; font-weight: 700; margin-bottom: 6px; text-align: center;">
              Custom engraving available
            </div>
            <div style="font-size: 14px; line-height: 22px; color: ${EMAIL_THEME.textLight}; text-align: center;">
              Many of our products can be personalized for gifts, events, and branded orders. Contact us for custom requests and bulk pricing.
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return renderThemedEmail({
    title: 'Weekly Product Highlights',
    subtitle: 'Latest uploads and separate discount picks',
    contentHtml,
    primaryCtaText: 'Browse All Products',
    primaryCtaUrl: `${PUBLIC_SITE_URL}/shop`,
    secondaryCtaText: 'Unsubscribe',
    secondaryCtaUrl: unsubscribeLink,
    footerNote: `Need inspiration first? Explore the latest stories on our blog: <a href="${PUBLIC_SITE_URL}/blog" style="color:${EMAIL_THEME.primary}; text-decoration:none;">${PUBLIC_SITE_URL}/blog</a>`
  });
};

// 5. UNSUBSCRIBE CONFIRMATION EMAIL
const renderUnsubscribeConfirmationEmail = (email) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Successfully Unsubscribed</h2>
        <p class="content-text">
          You have been removed from our mailing list
        </p>
      </div>
      
      <div class="email-card">
        <p class="content-text" style="text-align: center; margin: 0;">
          You will no longer receive weekly product updates, exclusive offers, 
          or fashion insights from Yokebud craft.
        </p>
      </div>
      
      <p class="content-text" style="text-align: center;">
        We hope you enjoyed being part of our community and found value in our updates. 
        You can always resubscribe through our website if you change your mind.
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Unsubscribed',
    subtitle: 'You have left our newsletter',
    contentHtml,
    primaryCtaText: 'Visit Our Website',
    primaryCtaUrl: PUBLIC_SITE_URL,
    footerNote: 'Thank you for being part of our community. We wish you all the best!'
  });
};

// 6. OTP VERIFICATION EMAIL - Standalone version without external resources
const renderOTPEmail = (email, otp, type = 'registration') => {
  const subjectText = type === 'registration' ? 'Verify Your Email Address' : 'Login Verification';
  const descriptionText = type === 'registration'
    ? 'Thank you for signing up with Yokebud craft!'
    : 'Use this OTP to login to your Yokebud craft account.';

  // Standalone HTML without external fonts or images
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subjectText} - Yokebud craft</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #2D3748;
          background-color: #F7FAFC;
          padding: 20px;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }
        .email-header {
          background: #FFFFFF;
          padding: 40px 30px;
          text-align: center;
          border-bottom: 2px solid #FFA500;
        }
        .brand-logo {
          font-size: 28px;
          font-weight: 800;
          color: #000000;
          margin-bottom: 10px;
          letter-spacing: 2px;
        }
        .email-title {
          color: #000000;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .email-subtitle {
          color: #666666;
          font-size: 16px;
        }
        .email-content {
          padding: 40px 30px;
        }
        .content-title {
          color: #1A202C;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 15px;
          text-align: center;
        }
        .content-text {
          color: #718096;
          font-size: 16px;
          line-height: 1.7;
          margin-bottom: 20px;
          text-align: center;
        }
        .otp-card {
          background: #F7FAFC;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
        }
        .otp-label {
          color: #718096;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .otp-code {
          background: #1A202C;
          border-radius: 12px;
          padding: 25px;
          display: inline-block;
          margin: 0 auto;
        }
        .otp-number {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: 12px;
          color: #FFFFFF;
          text-align: center;
          font-family: 'Courier New', monospace;
        }
        .otp-warning {
          color: #E53E3E;
          font-weight: 700;
          margin-top: 20px;
          font-size: 14px;
        }
        .email-footer {
          background: #FFFFFF;
          color: #1A202C;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #E2E8F0;
        }
        .contact-info {
          font-size: 12px;
          line-height: 1.6;
          margin-top: 15px;
        }
        .contact-info p {
          margin-bottom: 5px;
        }
        .copyright {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #E2E8F0;
          font-size: 12px;
          color: #718096;
        }
        @media (max-width: 600px) {
          .email-header { padding: 30px 20px; }
          .email-content { padding: 30px 20px; }
          .otp-number { font-size: 36px; letter-spacing: 8px; }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div class="brand-logo">YOKEBUD craft</div>
          <h1 class="email-title">${subjectText}</h1>
          <p class="email-subtitle">Secure Verification Required</p>
        </div>
        
        <div class="email-content">
          <h2 class="content-title">${subjectText}</h2>
          <p class="content-text">${descriptionText}</p>
          
          <div class="otp-card">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">
              <div class="otp-number">${otp}</div>
            </div>
            <div class="otp-warning">⏳ This OTP expires in 1 minute. Do not share it.</div>
          </div>
          
          <p class="content-text" style="font-size: 14px;">
            If you didn't request this code, please ignore this email or contact our support team.
          </p>
        </div>
        
        <div class="email-footer">
          <div style="text-align: center; margin-bottom: 12px;">
            <a href="https://www.facebook.com/share/1D9o7CoZB7/" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://wa.me/+358440328124" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WhatsApp" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://www.youtube.com/@yokebud" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://www.instagram.com/yokebud/" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://www.tiktok.com/@yokebud" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" alt="TikTok" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://fi.pinterest.com/yokebud/" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/174/174863.png" alt="Pinterest" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://www.linkedin.com/company/yokebudcraft/" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/3955/3955056.png" alt="LinkedIn" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
            <a href="https://yokebudcraft.etsy.com" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;margin:0 6px 10px 6px;">
              <img src="https://cdn-icons-png.flaticon.com/512/825/825513.png" alt="Etsy" style="width:22px;height:22px;display:block;border:0;outline:none;">
            </a>
          </div>
          <div class="contact-info">
            <p><strong>Yokebud craft</strong></p>
            <p>Kotopellonkatu 1A, 04200 Kerava, Finland</p>
            <p>Email: info@yokebud.com | Phone: +358 440 328 124</p>
          </div>
          <div class="copyright">
            &copy; ${new Date().getFullYear()} Yokebud craft. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 7. ORDER STATUS UPDATE EMAIL
const renderOrderStatusUpdateEmail = (orderId, status, customerInfo, trackingNumber = null, estimatedDeliveryDate = null) => {
  const viewOrdersUrl = `${PUBLIC_SITE_URL}/UserProfile`;

  const statusConfig = {
    'processing': { color: EMAIL_THEME.primary, icon: '🔄', title: 'Order Processing' },
    'shipped': { color: EMAIL_THEME.accent, icon: '🚚', title: 'Order Shipped' },
    'delivered': { color: EMAIL_THEME.accent, icon: '✅', title: 'Order Delivered' },
    'cancelled': { color: EMAIL_THEME.danger, icon: '❌', title: 'Order Cancelled' }
  };

  const config = statusConfig[status.toLowerCase()] || { color: EMAIL_THEME.primary, icon: '📦', title: 'Order Update' };

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">${config.title}</h2>
        <p class="content-text" style="color: ${config.color}; font-weight: 600;">
          Order #${orderId} • ${status.charAt(0).toUpperCase() + status.slice(1)}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Status Details</h3>
        <div style="padding: 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                <strong style="display: block; color: ${EMAIL_THEME.text};">Order Status</strong>
                <span style="color: ${config.color}; font-weight: 600;">
                  ${status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </td>
              <td align="right" style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border}; white-space: nowrap; font-size: 24px;">
                ${config.icon}
              </td>
            </tr>
            ${trackingNumber ? `
              <tr>
                <td colspan="2" style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                  <strong style="display: block; color: ${EMAIL_THEME.text};">Tracking Number</strong>
                  <span style="color: ${EMAIL_THEME.textLight}; font-family: monospace;">
                    ${trackingNumber}
                  </span>
                </td>
              </tr>
            ` : ''}
            ${estimatedDeliveryDate ? `
              <tr>
                <td colspan="2" style="padding: 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                  <strong style="display: block; color: ${EMAIL_THEME.text};">Estimated Delivery Date</strong>
                  <span style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
                    ${new Date(estimatedDeliveryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}
                  </span>
                </td>
              </tr>
            ` : ''}
            <tr>
              <td colspan="2" style="padding: 15px 0 0 0;">
                <strong style="display: block; color: ${EMAIL_THEME.text};">Update Date</strong>
                <span style="color: ${EMAIL_THEME.textLight};">
                  ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <p class="content-text">
        ${status.toLowerCase() === 'shipped' ? 'Your order has been shipped! You can track your package using the tracking number above.' : ''}
        ${status.toLowerCase() === 'delivered' ? 'Your order has been delivered! We hope you enjoy your purchase.' : ''}
        ${status.toLowerCase() === 'processing' ? 'Your order is being processed and will be shipped soon.' : ''}
        ${status.toLowerCase() === 'cancelled' ? 'Your order has been cancelled as requested.' : ''}
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Order Status Update',
    subtitle: `Order #${orderId}`,
    contentHtml,
    primaryCtaText: 'View Order Details',
    primaryCtaUrl: viewOrdersUrl,
    footerNote: 'If you have any questions about this update, please reply to this email.'
  });
};

// Render estimated delivery date update email
const renderEstimatedDeliveryUpdateEmail = (orderId, customerInfo, estimatedDeliveryDate) => {
  const viewOrdersUrl = `${PUBLIC_SITE_URL}/UserProfile`;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Estimated Delivery Update 📅</h2>
        <p class="content-text" style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
          Order #${orderId}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Delivery Details</h3>
        <div style="padding: 15px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${estimatedDeliveryDate ? `
              <tr>
                <td style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                  <strong style="display: block; color: ${EMAIL_THEME.text};">Estimated Delivery Date</strong>
                  <span style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
                    ${new Date(estimatedDeliveryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}
                  </span>
                </td>
                <td align="right" style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border}; white-space: nowrap; font-size: 24px;">
                  📅
                </td>
              </tr>
            ` : `
              <tr>
                <td style="padding: 0 0 15px 0; border-bottom: 1px solid ${EMAIL_THEME.border};">
                  <strong style="display: block; color: ${EMAIL_THEME.text};">Estimated Delivery Date</strong>
                  <span style="color: ${EMAIL_THEME.textLight};">
                    No estimated delivery date set
                  </span>
                </td>
              </tr>
            `}
            <tr>
              <td colspan="2" style="padding: 15px 0 0 0;">
                <strong style="display: block; color: ${EMAIL_THEME.text};">Update Date</strong>
                <span style="color: ${EMAIL_THEME.textLight};">
                  ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <p class="content-text">
        ${estimatedDeliveryDate
      ? `We have updated the estimated delivery date for your order. We aim to deliver your order by ${new Date(estimatedDeliveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}.`
      : 'We have removed the estimated delivery date for your order. We will update you when we have more information.'
    }
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'Estimated Delivery Update',
    subtitle: `Order #${orderId}`,
    contentHtml,
    primaryCtaText: 'View Order Details',
    primaryCtaUrl: viewOrdersUrl,
    footerNote: 'If you have any questions about this update, please reply to this email.'
  });
};

// 8. CONTACT FORM NOTIFICATION EMAIL (ADMIN)
const renderContactFormNotificationEmail = (name, email, whatsapp, message) => {
  const adminUrl = `${process.env.ADMIN_URL || 'https://www.yokebud.fi/admin'}/messages`;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">New Contact Message 📩</h2>
        <p class="content-text">
          You have received a new contact form submission
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Message Details</h3>
        <div style="padding: 15px;">
          <div style="margin-bottom: 15px;">
            <strong style="display: block; color: ${EMAIL_THEME.text}; margin-bottom: 5px;">From:</strong>
            <span style="color: ${EMAIL_THEME.textLight};">${name} &lt;${email}&gt;</span>
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong style="display: block; color: ${EMAIL_THEME.text}; margin-bottom: 5px;">WhatsApp:</strong>
            <span style="color: ${EMAIL_THEME.textLight};">${whatsapp}</span>
          </div>
          
          <div>
            <strong style="display: block; color: ${EMAIL_THEME.text}; margin-bottom: 5px;">Message:</strong>
            <div style="background: ${EMAIL_THEME.white}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 15px; margin-top: 10px;">
              <p style="margin: 0; color: ${EMAIL_THEME.text}; line-height: 1.7;">
                ${message.replace(/\n/g, '<br>')}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <p class="content-text">
        This message requires your attention. Please respond to the customer within 24 hours.
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: 'New Contact Message',
    subtitle: 'From website contact form',
    contentHtml,
    primaryCtaText: 'Open Admin Inbox',
    primaryCtaUrl: adminUrl,
    footerNote: 'This is an automated notification from Yokebud craft website.'
  });
};

// 9. CONTACT FORM CONFIRMATION EMAIL (CUSTOMER)
const renderContactFormConfirmationEmail = (name, email, message) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Message Received! ✨</h2>
        <p class="content-text">
          Thank you for contacting Yokebud craft
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Your Message</h3>
        <div style="background: ${EMAIL_THEME.white}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 20px; margin-top: 10px;">
          <p style="margin: 0; color: ${EMAIL_THEME.text}; line-height: 1.7;">
            ${message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>
      
      <p class="content-text">
        We have received your message and our team will get back to you within 24 hours. 
        For urgent inquiries, you can also reach us on WhatsApp at +358 440 328 124.
      </p>
      
      <div class="email-card" style="background: linear-gradient(135deg, ${EMAIL_THEME.light}, #EDF2F7);">
        <h3 class="card-title" style="color: ${EMAIL_THEME.text};">What's Next?</h3>
        <ul style="color: ${EMAIL_THEME.textLight}; line-height: 1.8; padding-left: 20px;">
          <li>Our team will review your message</li>
          <li>We'll respond to your email within 24 hours</li>
          <li>You may receive a follow-up call if needed</li>
          <li>Check your spam folder if you don't see our reply</li>
        </ul>
      </div>
    </div>
  `;

  return renderThemedEmail({
    title: 'Message Confirmation',
    subtitle: 'We will respond soon',
    contentHtml,
    primaryCtaText: 'Visit Our Website',
    primaryCtaUrl: PUBLIC_SITE_URL,
    footerNote: 'This is an automated confirmation. Please do not reply to this email.'
  });
};

// 9.5. INQUIRY NOTIFICATION EMAIL
const renderInquiryNotificationEmail = (recipientName, senderName, inquiryNumber, productName, messagePreview, isToAdmin) => {
  const adminUrl = `${PUBLIC_SITE_URL}/admin/inquiries`;
  const inquiryUrl = `${PUBLIC_SITE_URL}/account/inquiries`;

  const title = isToAdmin ? 'New Customer Message' : 'New Message Received';
  const subtitle = isToAdmin ? `From ${senderName} regarding Inquiry #${inquiryNumber}` : `Regarding your inquiry #${inquiryNumber}`;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">${title}</h2>
        <p class="content-text">
          ${isToAdmin ? `Customer <strong>${senderName}</strong> has sent a new message.` : `You have received a new message from Yokebud craft support.`}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Product: ${productName}</h3>
        <div style="background: ${EMAIL_THEME.white}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 20px; margin-top: 10px;">
          <p style="margin: 0; color: ${EMAIL_THEME.text}; line-height: 1.7;">
            "${messagePreview.replace(/\n/g, '<br>').slice(0, 300)}${messagePreview.length > 300 ? '...' : ''}"
          </p>
        </div>
      </div>
      
      <p class="content-text">
        ${isToAdmin ? 'Please review and respond as soon as possible.' : 'Please log in to your account to view the full conversation and reply.'}
      </p>
    </div>
  `;

  return renderThemedEmail({
    title: title,
    subtitle: subtitle,
    contentHtml,
    primaryCtaText: isToAdmin ? 'View in Admin Panel' : 'View Message',
    primaryCtaUrl: isToAdmin ? adminUrl : inquiryUrl,
    footerNote: isToAdmin ? 'Automated admin notification.' : 'Please do not reply directly to this email.'
  });
};

// 10. PASSWORD RESET EMAIL
const renderPasswordResetEmail = (email, resetToken) => {
  const resetUrl = `${PUBLIC_SITE_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Password Reset Request</h2>
        <p class="content-text">
          We received a request to reset your password
        </p>
      </div>
      
      <div class="email-card" style="text-align: center;">
        <p class="content-text" style="margin-bottom: 20px;">
          Click the button below to reset your password. This link will expire in 1 hour.
        </p>
        
        <a href="${resetUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, ${EMAIL_THEME.danger}, #FC8181); color: white; padding: 16px 35px; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: 700; box-shadow: 0 6px 20px rgba(229, 62, 62, 0.3); transition: all 0.3s ease; margin: 10px 0;">
          Reset Password
        </a>
        
        <p style="color: ${EMAIL_THEME.danger}; font-weight: 700; margin-top: 20px;">
          ⏳ This link expires in 1 hour
        </p>
      </div>
      
      <p class="content-text">
        If you didn't request a password reset, you can safely ignore this email. 
        Your password will not be changed until you access the link above and create a new one.
      </p>
      
      <div class="email-card" style="background: ${EMAIL_THEME.light};">
        <h3 class="card-title" style="color: ${EMAIL_THEME.text}; font-size: 14px;">Security Tips</h3>
        <ul style="color: ${EMAIL_THEME.textLight}; line-height: 1.6; font-size: 13px; padding-left: 20px;">
          <li>Never share your password with anyone</li>
          <li>Use a strong, unique password</li>
          <li>Enable two-factor authentication if available</li>
          <li>Regularly update your password</li>
        </ul>
      </div>
    </div>
  `;

  return renderThemedEmail({
    title: 'Password Reset',
    subtitle: 'Secure your account',
    contentHtml,
    primaryCtaText: 'Reset Password',
    primaryCtaUrl: resetUrl,
    footerNote: 'For security reasons, this link will expire in 1 hour.'
  });
};

// ==================== EMAIL SENDING FUNCTIONS ====================

// Send welcome email (newsletter subscription)
const sendWelcomeEmail = async (email, token) => {
  const html = renderWelcomeEmail(email, token);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: email,
    subject: '✅ Subscription Confirmed — Yokebud craft Newsletter',
    html,
    priority: 'high'
  };

  try {
    const result = await sendMail(mailOptions);
    console.log(`📧 Welcome email sent to ${email} via ${result?.provider || 'provider'}`);
    return true;
  } catch (error) {
    console.error('❌ Welcome email error:', error?.message || error);
    return false;
  }
};

// Send account welcome email (new user registration)
const sendAccountWelcomeEmail = async (email, name) => {
  const html = renderAccountWelcomeEmail(name);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <welcome@yokebud.com>',
    to: email,
    subject: '🎉 Welcome to Yokebud craft',
    html,
    priority: 'normal'
  };
  try {
    await sendMail(mailOptions);
    console.log(`📧 Account welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Account welcome email error:', error);
    return false;
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (orderId, customerInfo, items, totals) => {
  const html = renderOrderConfirmationEmail(orderId, customerInfo, items, totals);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: customerInfo.email,
    subject: `✅ Order Confirmed #${orderId} - Yokebud craft`,
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Order confirmation email sent for order #${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Order confirmation email error:', error);
    return false;
  }
};

// Send new subscriber notification (admin)
const sendNewSubscriberNotification = async (subscriberEmail) => {
  const html = renderNewSubscriberNotificationEmail(subscriberEmail);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft System <yokebud@gmail.com>',
    to: 'yokebud@gmail.com',
    subject: `🎯 New Newsletter Subscriber: ${subscriberEmail}`,
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log('📧 New subscriber notification sent to admin');
    return true;
  } catch (error) {
    console.error('❌ New subscriber notification error:', error);
    return false;
  }
};

// Send weekly newsletter
const sendWeeklyNewsletter = async (subscriber, products) => {
  const html = renderWeeklyNewsletterEmail(subscriber, products, subscriber.subscription_token);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: subscriber.email,
    subject: `🚀 Yokebud craft Weekly Update - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    html,
    priority: 'normal'
  };

  try {
    const result = await sendMail(mailOptions);
    console.log(`📧 Weekly newsletter sent to ${subscriber.email} via ${result?.provider || 'provider'}`);
    return true;
  } catch (error) {
    console.error('❌ Weekly newsletter error:', error?.message || error);
    return false;
  }
};

// Send unsubscribe confirmation
const sendUnsubscribeConfirmation = async (email) => {
  const html = renderUnsubscribeConfirmationEmail(email);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <newsletter@yokebud.com>',
    to: email,
    subject: '👋 You have been unsubscribed from Yokebud craft Newsletter',
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Unsubscribe confirmation sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Unsubscribe confirmation error:', error);
    return false;
  }
};

// Send OTP email with retry mechanism for Render.com network issues
const sendOTPEmail = async (email, otp, type = 'registration', customFrom = null, retries = 3) => {
  const html = renderOTPEmail(email, otp, type);
  const subject = type === 'registration'
    ? 'Verify Your Email - Yokebud craft'
    : type === 'admin_login'
      ? '🔐 Admin Login OTP - Yokebud craft'
      : 'Login OTP - Yokebud craft';

  const mailOptions = {
    from: customFrom || process.env.EMAIL_FROM || `Yokebud craft Security <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html, // Add HTML content
    text: `Your OTP code is: ${otp}. It expires in 1 minute.`,
    priority: 'high'
  };

  // Retry mechanism for connection timeout issues on Render.com
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Attempt ${attempt}/${retries}: Sending ${type} OTP email to ${email}...`);

      // Create a promise with timeout
      const sendPromise = sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout after 55 seconds')), 55000)
      );

      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`✅ ${type} OTP email sent successfully to ${email} (attempt ${attempt})`);
      return true;
    } catch (error) {
      const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
      const isLastAttempt = attempt === retries;

      console.error(`❌ Attempt ${attempt}/${retries} failed:`, error.message || error.code);

      if (isLastAttempt) {
        console.error(`❌ ${type} OTP email failed after ${retries} attempts for ${email}`);
        return false;
      }

      // If timeout, wait before retry (exponential backoff)
      if (isTimeout) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`⏳ Connection timeout. Retrying in ${waitTime / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // For other errors, return immediately
        console.error(`❌ ${type} OTP email error:`, error);
        return false;
      }
    }
  }

  return false;
};

// Send order status update email
const sendOrderStatusUpdateEmail = async (orderId, status, customerInfo, trackingNumber = null, estimatedDeliveryDate = null) => {
  const html = renderOrderStatusUpdateEmail(orderId, status, customerInfo, trackingNumber, estimatedDeliveryDate);
  const mailOptions = {
    from: process.env.EMAIL_FROM || `Yokebud craft <${process.env.EMAIL_USER}>`,
    to: customerInfo.email,
    subject: `📦 Order Status Update #${orderId} - ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Order status update email sent for order #${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Order status update email error:', error);
    return false;
  }
};

// Send estimated delivery date update email
const sendEstimatedDeliveryUpdateEmail = async (orderId, customerInfo, estimatedDeliveryDate) => {
  const html = renderEstimatedDeliveryUpdateEmail(orderId, customerInfo, estimatedDeliveryDate);
  const mailOptions = {
    from: process.env.EMAIL_FROM || `Yokebud craft <${process.env.EMAIL_USER}>`,
    to: customerInfo.email,
    subject: `📅 Estimated Delivery Update for Order #${orderId}`,
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Estimated delivery update email sent for order #${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Estimated delivery update email error:', error);
    return false;
  }
};

// Send admin new order email
const sendAdminNewOrderEmail = async (orderId, customerInfo, items, totals) => {
  const html = renderAdminNewOrderEmail(orderId, customerInfo, items, totals);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft System <yokebud@gmail.com>',
    to: 'yokebud@gmail.com',
    subject: `🚀 New Order Received: #${orderId}`,
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Admin notification sent for order #${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Admin notification email error:', error);
    return false;
  }
};

// Send manual notification email (Single Send)
const sendManualNotificationEmail = async (orderId, customerInfo) => {
  const html = renderManualNotificationEmail(orderId, customerInfo);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: customerInfo.email,
    subject: `✨ Update regarding Order #${orderId} - Yokebud craft`,
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Manual notification sent for order #${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Manual notification email error:', error);
    return false;
  }
};

// Send contact form notification (admin)
const sendContactFormNotification = async (name, email, whatsapp, message) => {
  const html = renderContactFormNotificationEmail(name, email, whatsapp, message);
  const mailOptions = {
    from: process.env.EMAIL_FROM || `Yokebud craft <${process.env.EMAIL_USER}>`,
    replyTo: email,
    to: 'yokebud@gmail.com',
    subject: `📩 New Contact Message from ${name} - Yokebud craft`,
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Contact form notification sent to admin from ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Contact form notification error:', error);
    return false;
  }
};

// Send contact form confirmation (customer)
const sendContactFormConfirmation = async (name, email, message) => {
  const html = renderContactFormConfirmationEmail(name, email, message);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: email,
    subject: '✨ Thank you for contacting Yokebud craft',
    html,
    priority: 'normal'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Contact form confirmation sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Contact form confirmation error:', error);
    return false;
  }
};

// Send inquiry notification (instant)
const sendInquiryNotification = async (inquiry, message, senderType) => {
  const isToAdmin = senderType === 'user';
  const recipientEmail = isToAdmin ? 'yokebud@gmail.com' : inquiry.customer_email;
  const recipientName = isToAdmin ? 'Admin' : inquiry.customer_name;
  const senderName = isToAdmin ? inquiry.customer_name : 'Yokebud craft Support';

  // Parse product name safely
  let productName = 'Product Inquiry';
  try {
    const productData = typeof inquiry.product_data === 'string'
      ? JSON.parse(inquiry.product_data)
      : inquiry.product_data;
    productName = productData.product_name || 'Product Inquiry';
  } catch (e) { }

  const html = renderInquiryNotificationEmail(recipientName, senderName, inquiry.inquiry_number, productName, message, isToAdmin);

  const subject = isToAdmin
    ? `📩 New Message: Inquiry #${inquiry.inquiry_number} - ${productName}`
    : `💬 New Message regarding Inquiry #${inquiry.inquiry_number} - Yokebud craft`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft <yokebud@gmail.com>',
    to: recipientEmail,
    subject: subject,
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Inquiry notification sent to ${isToAdmin ? 'Admin' : 'User (' + recipientEmail + ')'}`);
    return true;
  } catch (error) {
    console.error('❌ Inquiry notification error:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  const html = renderPasswordResetEmail(email, resetToken);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud craft Security <security@yokebud.com>',
    to: email,
    subject: '🔐 Password Reset Request - Yokebud craft',
    html,
    priority: 'high'
  };

  try {
    await sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Password reset email error:', error);
    return false;
  }
};

// Cached sitemap
let cachedSitemap = { xml: '', ts: 0 };

// Utils
const slugify = (str) => String(str || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const generateProductSEO = (name, description, price, imageUrls) => {
  const seo_title = `Personalized Laser Engraved ${name} – Finland Handmade Gift`;

  // Create a description focusing on laser engraving
  const baseDescription = description || '';
  const seo_description = `Discover this exquisite ${name}, a premium handmade custom gift from Finland. Our professional laser engraving service ensures each piece is a unique masterpiece of personalization. Perfect for those seeking high-quality engraved treasures in Finland. This handcrafted item showcases the precision of modern laser engraving technology while maintaining the charm of a traditional handmade gift. Experience the best of Finnish craftmanship with our custom engraving options, tailored specifically for your special occasions. Each ${name} is carefully processed to meet our high standards of excellence. ${baseDescription.slice(0, 300)}...`;

  const seo_keywords = `laser engraving Finland, engraved ${name}, custom engraving, personalized gift Finland, handmade ${name}, laser cutting services, custom personalized gifts`;

  const schema_json = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": name,
    "description": seo_description,
    "image": imageUrls || [],
    "brand": {
      "@type": "Brand",
      "name": "Yokebud craft"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "EUR",
      "price": price,
      "availability": "https://schema.org/InStock",
      "url": `${process.env.PUBLIC_SITE_URL || 'https://www.yokebud.fi'}/products/${slugify(name)}`
    }
  };

  return { seo_title, seo_description, seo_keywords, schema_json };
};

const ensureUniqueSlug = async (connection, baseSlug, table = 'products') => {
  let slug = baseSlug;
    let suffix = 1;
      while (true) {
          const [rows] = await connection.query(`SELECT id FROM ${table} WHERE slug = ? LIMIT 1`, [slug]);
              if (!rows || rows.length === 0) return slug;
                  slug = `${baseSlug}-${suffix++}`;
                    }
                    };
                    
const ensureUniqueSKU = async (connection, baseSKU) => {
  let sku = String(baseSKU || 'SKU').trim();
    if (!sku) sku = 'SKU';
      let suffix = 1;
        while (true) {
            const [rows] = await connection.query('SELECT id FROM products WHERE sku = ? LIMIT 1', [sku]);
                if (!rows || rows.length === 0) return sku;
                    sku = `${baseSKU}-${suffix++}`;
                      }
                      };
                      
const validateProductPayload = (payload) => {
  const {
    name,
    description,
    price,
    categories,
    stock,
    sku,
    imageUrls,
    images,
    is_preorder,
    stock_status
  } = payload || {};
  if (!name || typeof name !== 'string') return { valid: false, message: 'Invalid name' };
  if (!description || typeof description !== 'string') return { valid: false, message: 'Invalid description' };
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) return { valid: false, message: 'Invalid price' };
  if (!Array.isArray(categories) || categories.length === 0) return { valid: false, message: 'Invalid categories' };

  // Only validate stock if not a preorder
  if (!is_preorder && stock_status !== 'Pre-order') {
    if (stock == null || isNaN(parseInt(stock))) return { valid: false, message: 'Invalid stock' };
  }

  if (!sku || typeof sku !== 'string') return { valid: false, message: 'Invalid SKU' };
  const hasImages = (Array.isArray(imageUrls) && imageUrls.length > 0) || (Array.isArray(images) && images.length > 0);
  if (!hasImages) return { valid: false, message: 'At least one image is required' };
  return { valid: true };
};

// DB-driven sitemaps (no hardcoded/static URLs)
async function generateSitemapXmlFromDb({ type = 'all' } = {}) {
  let connection;
  try {
    connection = await pool.getConnection();

    const escapeXml = (unsafe) => {
      return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    const absImg = (raw) => {
      if (!raw) return null;
      const s = String(raw);
      if (s.startsWith('http')) return s;
      const clean = s.startsWith('/') ? s : `/${s}`;
      if (clean.startsWith('//')) return null;
      return `${PUBLIC_API_BASE}${clean}`;
    };
    const parseImgs = (p) => {
      try {
        const raw = p?.images || p?.product_photos || p?.photos || '[]';
        const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(list)) return [];
        return list.map(x => absImg(x)).filter(Boolean).slice(0, 4);
      } catch { return []; }
    };
    const extractProductIdFromPath = (pathVal) => {
      try {
        const v = String(pathVal || '');
        const m1 = v.match(/^\/products\/(\d+)\//);
        if (m1) return m1[1];
        const m2 = v.match(/\/products\/[^/]*-(\d+)\/?$/);
        if (m2) return m2[1];
        const m3 = v.match(/^\/products\/(\d+)\/?$/);
        if (m3) return m3[1];
        return null;
      } catch { return null; }
    };

    let where = 'WHERE is_active = TRUE AND type != "product_exclude"';
    const params = [];
    if (type && type !== 'all') {
      where += ' AND type = ?';
      params.push(type);
    }

    const [rows] = await connection.query(
      `SELECT path, priority, changefreq, type, updated_at
       FROM sitemap_entries
       ${where}
       ORDER BY type, path`,
      params
    );

    let productImages = new Map();
    if (type === 'all' || type === 'product') {
      try {
        const [pRows] = await connection.query(
          'SELECT id, product_name, images, product_photos, thumbnail FROM products'
        );
        for (const p of pRows) {
          const imgList = parseImgs(p);
          if (imgList.length) productImages.set(String(p.id), { imgs: imgList, name: p.product_name || '' });
          if (p.thumbnail) {
            const t = absImg(p.thumbnail);
            if (t && !imgList.length) productImages.set(String(p.id), { imgs: [t], name: p.product_name || '' });
          }
        }
      } catch (imgErr) {
        console.warn('Product images lookup failed', imgErr.message);
      }
    }

    let categoryImages = new Map();
    if (type === 'all' || type === 'category') {
      try {
        const [cRows] = await connection.query(
          'SELECT id, name, slug, image, image_alt FROM categories WHERE 1'
        );
        const toSlugLocal = (str) => {
          try {
            return String(str || '').toLowerCase().trim()
              .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
          } catch { return ''; }
        };
        for (const c of cRows || []) {
          const entry = {
            name: c.name || '',
            imageUrl: absImg(c.image),
            imageAlt: c.image_alt || `${c.name || 'Category'} Collection | Yokebud craft Finland`
          };
          if (c.slug) categoryImages.set(String(c.slug).toLowerCase().trim(), entry);
          if (c.name) categoryImages.set(toSlugLocal(c.name), entry);
        }
      } catch (catErr) {
        console.warn('Category images lookup failed', catErr.message);
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const header = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    const nodes = rows.map(r => {
      const loc = `${PUBLIC_SITE_URL}${r.path}`;
      const updatedMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      const lastmod = (updatedMs && updatedMs > 0) ? new Date(updatedMs).toISOString().slice(0, 10) : today;
      const changefreq = r.changefreq || 'weekly';
      const priority = r.priority || (r.type === 'product' ? '0.8' : (r.type === 'category' ? '0.8' : '0.6'));

      const parts = [];
      parts.push('  <url>');
      parts.push(`    <loc>${escapeXml(loc)}</loc>`);
      parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
      parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
      parts.push(`    <priority>${escapeXml(priority)}</priority>`);

      if (r.type === 'product') {
        const pid = extractProductIdFromPath(r.path);
        if (pid && productImages.has(pid)) {
          const info = productImages.get(pid);
          for (const img of info.imgs) {
            parts.push('    <image:image>');
            parts.push(`      <image:loc>${escapeXml(img)}</image:loc>`);
            if (info?.name) {
              parts.push(`      <image:title>${escapeXml(info.name)} | Yokebud craft</image:title>`);
              parts.push(`      <image:caption>${escapeXml(`${info.name} - Handcrafted personalized gift by Yokebud craft Finland Europe`)}</image:caption>`);
            }
            parts.push('    </image:image>');
          }
        }
      } else if (r.type === 'category') {
        try {
          const slugMatch = String(r.path || '').match(/^\/shop\/(.+)$/);
          if (slugMatch && slugMatch[1]) {
            const slug = slugMatch[1].toLowerCase().trim();
            const catInfo = categoryImages.get(slug);
            const nameCapitalized = (catInfo?.name || slug.replace(/-/g, ' ')).replace(/\b\w/g, c => c.toUpperCase());
            const catImg = catInfo?.imageUrl || absImg(catInfo?.imageUrl) || `${PUBLIC_SITE_URL}/LOGO.png`;
            const captionBase = (catInfo?.imageAlt && String(catInfo.imageAlt).length > 3)
              ? catInfo.imageAlt
              : `Shop ${slug.replace(/-/g, ' ')} products - custom ${slug.replace(/-/g, ' ')}, premium ${slug.replace(/-/g, ' ')} collection, laser engraving, personalized gifts Finland, shipping Europe. Unique ${slug.replace(/-/g, ' ')} gift ideas by Yokebud craft Helsinki.`;

            parts.push('    <image:image>');
            parts.push(`      <image:loc>${escapeXml(catImg)}</image:loc>`);
            parts.push(`      <image:title>${escapeXml(`${nameCapitalized} Collection | Yokebud craft Finland Europe`)}</image:title>`);
            parts.push(`      <image:caption>${escapeXml(captionBase)}</image:caption>`);
            parts.push('      <image:geo_location>Helsinki, Finland</image:geo_location>');
            parts.push('    </image:image>');
          }
        } catch {}
      }
      parts.push('  </url>');
      return parts.join('\n');
    }).join('\n');

    return `${header}\n${nodes}\n</urlset>\n`;
  } finally {
    if (connection) connection.release();
  }
}

function buildSitemapIndexXml(items = []) {
  const today = new Date().toISOString().slice(0, 10);
  const nodes = items
    .filter((item) => item && item.loc)
    .map((item) =>
      `  <sitemap>\n` +
      `    <loc>${String(item.loc)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')}</loc>\n` +
      `    <lastmod>${String(item.lastmod || today)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')}</lastmod>\n` +
      `  </sitemap>`
    )
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${nodes}\n` +
    `</sitemapindex>\n`
  );
}

function buildSimpleUrlsetXml(items = []) {
  const escapeXml = (unsafe) => {
    return String(unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const nodes = items
    .filter((item) => item && item.loc)
    .map((item) => {
      const parts = [];
      parts.push('  <url>');
      parts.push(`    <loc>${escapeXml(item.loc)}</loc>`);
      parts.push(`    <lastmod>${escapeXml(item.lastmod || new Date().toISOString().slice(0, 10))}</lastmod>`);
      parts.push(`    <changefreq>${escapeXml(item.changefreq || 'monthly')}</changefreq>`);
      parts.push(`    <priority>${escapeXml(item.priority || '0.4')}</priority>`);
      parts.push('  </url>');
      return parts.join('\n');
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${nodes}\n` +
    `</urlset>\n`
  );
}

async function generateComponentSitemapXml() {
  let connection;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const componentItems = [];
    const seen = new Set();
    const publicRoots = [
      path.join(__dirname, '..', 'client', 'public'),
      path.join(__dirname, 'public')
    ];
    const allowedExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico', '.avif',
      '.glb', '.gltf', '.json', '.webmanifest', '.txt', '.pdf', '.js', '.css'
    ]);
    const excludedNames = new Set([
      'robots.txt',
      'sitemap.xml',
      'product-sitemap.xml',
      'category-sitemap.xml',
      'page-sitemap.xml',
      'blog-sitemap.xml',
      'component-sitemap.xml'
    ]);

    const addItem = (loc, lastmod = today, changefreq = 'monthly', priority = '0.3') => {
      const normalized = String(loc || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      componentItems.push({ loc: normalized, lastmod, changefreq, priority });
    };

    const walk = (rootPath, dirPath) => {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walk(rootPath, fullPath);
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!allowedExtensions.has(ext)) continue;
        if (excludedNames.has(entry.name.toLowerCase())) continue;

        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
        const stats = fs.statSync(fullPath);
        addItem(
          `${PUBLIC_SITE_URL}/${relativePath}`,
          new Date(stats.mtimeMs || Date.now()).toISOString().slice(0, 10),
          ext === '.json' || ext === '.txt' ? 'weekly' : 'monthly',
          ['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext) ? '0.5' : '0.3'
        );
      }
    };

    for (const rootPath of publicRoots) {
      if (!fs.existsSync(rootPath)) continue;
      walk(rootPath, rootPath);
    }

    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT path, priority, changefreq, updated_at, type, is_active
       FROM sitemap_entries
       WHERE is_active = TRUE
         AND type NOT IN ('static', 'product', 'category', 'blog', 'product_exclude')`
    );

    for (const row of rows || []) {
      addItem(
        `${PUBLIC_SITE_URL}${row.path}`,
        row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : today,
        row.changefreq || 'monthly',
        row.priority || '0.4'
      );
    }

    componentItems.sort((a, b) => a.loc.localeCompare(b.loc));
    return buildSimpleUrlsetXml(componentItems);
  } finally {
    if (connection) connection.release();
  }
}

function sendXml(res, xml) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.type('application/xml');
  res.send(xml);
}

app.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = buildSitemapIndexXml([
      { loc: `${PUBLIC_SITE_URL}/product-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/category-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/blog-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/page-sitemap.xml` },
      { loc: `${PUBLIC_SITE_URL}/component-sitemap.xml` }
    ]);
    return sendXml(res, xml);
  } catch (error) {
    console.error('Sitemap index generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/product-sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemapXmlFromDb({ type: 'product' });
    return sendXml(res, xml);
  } catch (error) {
    console.error('Product sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/category-sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemapXmlFromDb({ type: 'category' });
    return sendXml(res, xml);
  } catch (error) {
    console.error('Category sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/blog-sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemapXmlFromDb({ type: 'blog' });
    return sendXml(res, xml);
  } catch (error) {
    console.error('Blog sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/page-sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemapXmlFromDb({ type: 'static' });
    return sendXml(res, xml);
  } catch (error) {
    console.error('Page sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/component-sitemap.xml', async (req, res) => {
  try {
    const xml = await generateComponentSitemapXml();
    return sendXml(res, xml);
  } catch (error) {
    console.error('Component sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/category-sitemap-:slug.xml', (req, res) => {
  res.redirect(301, '/category-sitemap.xml');
});

// Helper: Notify Google & Bing when sitemap is regenerated
async function pingSitemapToSearchEngines(sitemapUrl) {
  const target = sitemapUrl || `${PUBLIC_SITE_URL}/sitemap.xml`;
  const encoded = encodeURIComponent(target);
  const endpoints = [
    `https://www.google.com/ping?sitemap=${encoded}`,
    `https://www.bing.com/ping?sitemap=${encoded}`
  ];
  const results = [];
  for (const ep of endpoints) {
    try {
      // Use node:https/http directly so no new dependency needed
      const isHttps = ep.startsWith('https:');
      const lib = require(isHttps ? 'https' : 'http');
      const p = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { reject(new Error('timeout')); }, 4000);
        const req = lib.get(ep, (res) => {
          clearTimeout(timeout);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
          res.resume();
        }).on('error', (e) => { clearTimeout(timeout); reject(e); });
        req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const r = await p;
      results.push({ endpoint: ep, ...r });
    } catch (err) {
      results.push({ endpoint: ep, ok: false, error: err.message });
    }
  }
  console.log('📡 Search engine ping results:', JSON.stringify(results));
  return results;
}

// robots.txt
app.get('/robots.txt', (req, res) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Allow images & static assets to be indexed for Image Search',
    'Allow: /uploads/',
    'Allow: /upload/',
    'Allow: /images/',
    'Allow: /img/',
    'Allow: /static/',
    'Allow: /LOGO.png',
    '',
    '# Protect admin & internal paths',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /admin/*',
    'Disallow: /admin/login',
    'Disallow: /api/admin/',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /account',
    'Disallow: /inquiry',
    '',
    '# Finland / Europe / Global friendly crawl delay',
    'Crawl-delay: 1',
    '',
    `Host: ${PUBLIC_SITE_URL.replace(/^https?:\/\//, '')}`,
    '',
    '# Canonical sitemap',
    `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`
  ];
  res.header('Content-Type', 'text/plain');
  res.header('Cache-Control', 'public, max-age=3600');
  res.send(lines.join('\n'));
});

// Constants for size validation
const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const NUMBER_SIZES = ['28', '30', '32', '34', '36', '38', '40', '42', '44'];

// Helper function to validate and combine sizes
const processSizes = (sizes) => {
  const validSizes = Array.isArray(sizes) ? sizes : [];
  return [
    ...validSizes.filter(size => LETTER_SIZES.includes(size)),
    ...validSizes.filter(size => NUMBER_SIZES.includes(size)),
    ...validSizes.filter(size => !LETTER_SIZES.includes(size) && !NUMBER_SIZES.includes(size))
  ];
};
// duplicate helpers removed; central helpers declared above

// ==================== JWT TOKEN GENERATION FUNCTION ====================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const generateToken = (userId) => {
  return jwt.sign(
    { userId, type: 'user' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const generateAdminToken = () => {
  return jwt.sign(
    { type: 'admin', issuedAt: Date.now() },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
};

// Generate unique inquiry ID
const generateInquiryId = (userId, productId) => {
  return `inq_${userId}_${productId}_${Date.now()}`;
};

// Generate inquiry number
const generateInquiryNumber = () => {
  return `INQ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

};

// ==================== AUTOMATED EMAIL NOTIFICATION SYSTEM ====================

// Track notification timers
const notificationTimers = new Map();

const checkUnreadMessageReminders = async () => {
  try {
      const connection = await pool.getConnection();
          const [rows] = await connection.query('SELECT id FROM user_messages WHERE is_read = 0 LIMIT 1');
              connection.release();
                  return rows;
                    } catch (error) {
                        console.error('Unread message reminder check failed:', error.message);
                          }
                          };
                          
// Create product endpoint
app.post('/api/products', requireAdminAuth, async (req, res) => {
  try {
      console.log('POST /api/products request body:', JSON.stringify(req.body, null, 2));
          const {
                name,
                      description,
                            price,
                                  discounted_price,
                                        categories,
                                              stock,
                                                    moq,
                                                          material,
                                                                care,
                                                                      sku,
                                                                            shipping,
                                                                                  warranty,
                                                                                        bulk_discount,
                                                                                              sizes,
                                                                                                    colors,
                                                                                                          tags,
                                                                                                                features,
                                                                                                                      imageUrls,
                                                                                                                            slug,
                                                                                                                                  status,
                                                                                                                                        featured,
                                                                                                                                              thumbnail,
                                                                                                                                                    attributes,
                                                                                                                                                          images,
                                                                                                                                                                metadata,
                                                                                                                                                                      rating,
                                                                                                                                                                            is_customizable,
                                                                                                                                                                                  is_preorder,
                                                                                                                                                                                        stock_status,
                                                                                                                                                                                              customization_type,
                                                                                                                                                                                                    customization_images,
                                                                                                                                                                                                          customization_dimensions,
                                                                                                                                                                                                                engraving_type,
                                                                                                                                                                                                                      allow_customer_size_adjustment,
                                                                                                                                                                                                                            discount_ranges
                                                                                                                                                                                                                                } = req.body;
                                                                                                                                                                                                                    
    const validation = validateProductPayload(req.body);
        if (!validation.valid) {
              return res.status(400).json({ success: false, message: validation.message });
                  }
                  
    const finalPrice = parseFloat(price);
        const finalDiscountedPrice = discounted_price ? parseFloat(discounted_price) : null;
            const processedSizes = processSizes(sizes);
            
    const connection = await pool.getConnection();
        const baseSlug = slugify(slug || name);
            const uniqueSlug = await ensureUniqueSlug(connection, baseSlug);
                const finalSku = await ensureUniqueSKU(connection, sku);
                
    const imageArray = Array.isArray(images) ? images : (Array.isArray(imageUrls) ? imageUrls : []);
        const thumb = thumbnail || (imageArray[0] || null);
        
    const seo = generateProductSEO(name, description, finalPrice, imageArray);
        const finalSeoTitle = req.body.seo_title ; seo.seo_title;
            const finalSeoDescription = req.body.seo_description ; seo.seo_description;
                const finalSeoKeywords = req.body.seo_keywords ; seo.seo_keywords;
                    const finalSchemaJson = req.body.schema_json ? JSON.stringify(req.body.schema_json) : JSON.stringify(seo.schema_json);
                    
    const metadataPayload = metadata && typeof metadata === 'object' ? metadata : {};
        const freeShipping = isFreeShippingEnabled(metadataPayload.free_shipping ?? req.body.free_shipping);
            const freeShippingMinAmount = freeShipping
                  ? parseFreeShippingMinAmount(metadataPayload.free_shipping_min_amount ?? req.body.free_shipping_min_amount)
                        : null;
                        
    if (freeShipping && freeShippingMinAmount === null) {
          connection.release();
                return res.status(400).json({ success: false, message: 'Please provide a valid free shipping minimum amount.' });
                    }
                    
    const attributesJson = JSON.stringify({ material, sizes: processedSizes, colors });
        const imagesJson = JSON.stringify(imageArray);
            const metadataJson = JSON.stringify({
                  tags: Array.isArray(tags) ? tags : (Array.isArray(metadataPayload.tags) ? metadataPayload.tags : []),
                        features: Array.isArray(features) ? features : (Array.isArray(metadataPayload.features) ? metadataPayload.features : []),
                              moq: moq ?? metadataPayload.moq ?? 1,
                                    shipping: shipping ?? metadataPayload.shipping ?? '',
                                          warranty: warranty ?? metadataPayload.warranty ?? '',
                                                bulk_discount: bulk_discount ?? metadataPayload.bulk_discount ?? '',
                                                      free_shipping: freeShipping,
                                                            free_shipping_min_amount: freeShippingMinAmount
                                                                });
                                                                
    console.log('CREATE product - customization_mode:', req.body.customization_mode);
    
    const [result] = await connection.query(
          `INSERT INTO products (
                  product_name,
                          product_description,
                                  price,
                                          discounted_price,
                                                  category,
                                                          stock,
                                                                  moq,
                                                                          material,
                                                                                  care_instructions,
                                                                                          sku,
                                                                                                  shipping_info,
                                                                                                          warranty,
                                                                                                                  bulk_discount,
                                                                                                                          sizes,
                                                                                                                                  colors,
                                                                                                                                          tags,
                                                                                                                                                  features,
                                                                                                                                                          slug,
                                                                                                                                                                  status,
                                                                                                                                                                          featured,
                                                                                                                                                                                  thumbnail,
                                                                                                                                                                                          attributes,
                                                                                                                                                                                                  images,
                                                                                                                                                                                                          metadata,
                                                                                                                                                                                                                  rating,
                                                                                                                                                                                                                          is_customizable,
                                                                                                                                                                                                                                  is_preorder,
                                                                                                                                                                                                                                          stock_status,
                                                                                                                                                                                                                                                  seo_title,
                                                                                                                                                                                                                                                          seo_description,
                                                                                                                                                                                                                                                                  seo_keywords,
                                                                                                                                                                                                                                                                          schema_json,
                                                                                                                                                                                                                                                                                  customization_type,
                                                                                                                                                                                                                                                                                          customization_mode,
                                                                                                                                                                                                                                                                                                  customization_images,
                                                                                                                                                                                                                                                                                                          customization_dimensions,
                                                                                                                                                                                                                                                                                                                  engraving_type,
                                                                                                                                                                                                                                                                                                                          allow_customer_size_adjustment
                                                                                                                                                                                                                                                                                                                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
                                                                                                                                                                                                                                                                                                                      [
                                                                                                                                                                                                                                                                                                                              name,
                                                                                                                                                                                                                                                                                                                                      description,
                                                                                                                                                                                                                                                                                                                                              finalPrice,
                                                                                                                                                                                                                                                                                                                                                      finalDiscountedPrice,
                                                                                                                                                                                                                                                                                                                                                              JSON.stringify(categories),
                                                                                                                                                                                                                                                                                                                                                                      (is_preorder === true || is_preorder === 1 || is_preorder === 'true' || stock_status === 'Pre-order') ? 0 : parseInt(stock),
                                                                                                                                                                                                                                                                                                                                                                              parseInt(moq) || 1,
                                                                                                                                                                                                                                                                                                                                                                                      material,
                                                                                                                                                                                                                                                                                                                                                                                              care,
                                                                                                                                                                                                                                                                                                                                                                                                      finalSku,
                                                                                                                                                                                                                                                                                                                                                                                                              shipping,
                                                                                                                                                                                                                                                                                                                                                                                                                      warranty,
                                                                                                                                                                                                                                                                                                                                                                                                                              bulk_discount,
                                                                                                                                                                                                                                                                                                                                                                                                                                      JSON.stringify(processedSizes),
                                                                                                                                                                                                                                                                                                                                                                                                                                              JSON.stringify(colors),
                                                                                                                                                                                                                                                                                                                                                                                                                                                      JSON.stringify(tags),
                                                                                                                                                                                                                                                                                                                                                                                                                                                              JSON.stringify(features),
                                                                                                                                                                                                                                                                                                                                                                                                                                                                      uniqueSlug,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              status || 'active',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      featured ? 1 : 0,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              thumb,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      attributesJson,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              imagesJson,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      metadataJson,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              rating || 0,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      is_customizable ? 1 : 0,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              (is_preorder === true || is_preorder === 1 || is_preorder === 'true' || stock_status === 'Pre-order') ? 1 : 0,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      stock_status || (is_preorder === true || is_preorder === 1 || is_preorder === 'true' ? 'Pre-order' : 'In Stock'),
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              finalSeoTitle,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      finalSeoDescription,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              finalSeoKeywords,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      finalSchemaJson,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              customization_type || 'Apparels',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      req.body.customization_mode || null,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              customization_images ? JSON.stringify(customization_images) : null,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      customization_dimensions ? JSON.stringify(customization_dimensions) : null,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              engraving_type || 'both',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      allow_customer_size_adjustment ? 1 : 0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            ]
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                );
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
        for (const v of variants) {
              const qty = v.quantity != null ? parseInt(v.quantity) : 0;
                    await connection.query(
                            'INSERT INTO product_variants (product_id, color, size, quantity) VALUES (?, ?, ?, ?)',
                                    [result.insertId, v.color ? String(v.color) : null, v.size ? String(v.size) : null, isNaN(qty) ? 0 : qty]
                                          );
                                              }
                                              
    const discountRanges = Array.isArray(discount_ranges) ? discount_ranges : [];
        for (const range of discountRanges) {
              const minQty = Number(range.min_quantity ?? range.min_qty ?? 2);
                    const maxQty = range.max_quantity !== undefined ? Number(range.max_quantity) : (range.max_qty !== undefined ? Number(range.max_qty) : null);
                          const discountPercent = Number(range.discount_percentage ?? range.discount_percent ?? 0);
                                const discPrice = range.discounted_price !== undefined ? Number(range.discounted_price) : null;
                                      await connection.query(
                                              `INSERT INTO quantity_discount_ranges
                                                       (product_id, min_quantity, max_quantity, discount_percentage, discounted_price)
                                                                VALUES (?, ?, ?, ?, ?)`,
                                                                        [result.insertId, minQty, maxQty !== null ? maxQty : null, discountPercent, discPrice]
                                                                              );
                                                                                  }
                                                                                  
    connection.release();
    
    res.json({
          success: true,
                message: 'Product created successfully',
                      productId: result.insertId
                          });
                          
    regenerateSitemap().catch(err => console.error('Sitemap regeneration failed after product creation:', err));
      } catch (error) {
          console.error('Product creation error:', error);
              res.status(500).json({
                    success: false,
                          message: 'Failed to create product',
                                error: error.message
                                    });
                                      }
                                      });
                                      
// Update product endpoint
app.put('/api/products/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const productId = req.params.id;
    console.log('PUT /api/products/' + productId + ' request body:', JSON.stringify(req.body, null, 2));
    const {
      name,
      description,
      price, // This will be max_price
      min_price, // This can be custom min price
      discounted_price, // For setting min_price
      categories,
      stock,
      moq,
      material,
      care,
      sku,
      shipping,
      warranty,
      bulk_discount,
      sizes,
      colors,
      tags,
      features,
      imageUrls,
      imagesToDelete = [],
      status,
      featured,
      is_customizable,
      is_preorder,
      stock_status,
      customization_type,
      customization_images,
      customization_dimensions,
      engraving_type,
      allow_customer_size_adjustment,
      discount_ranges
    } = req.body;

    const metadataPayload = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const freeShipping = isFreeShippingEnabled(metadataPayload.free_shipping ?? req.body.free_shipping);
    const freeShippingMinAmount = freeShipping
      ? parseFreeShippingMinAmount(metadataPayload.free_shipping_min_amount ?? req.body.free_shipping_min_amount)
      : null;

    if (freeShipping && freeShippingMinAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid free shipping minimum amount.'
      });
    }

    const validation = validateProductPayload({
      name,
      description,
      price,
      categories,
      stock,
      sku,
      imageUrls,
      is_preorder,
      stock_status
    });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const finalPrice = parseFloat(price);
    const finalDiscountedPrice = discounted_price ? parseFloat(discounted_price) : null;

    // Process sizes
    const processedSizes = processSizes(sizes);

    connection = await pool.getConnection();

    await connection.beginTransaction();


    // Get current product data
    const [products] = await connection.query(
      'SELECT sku, status, featured FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const currentSku = products[0].sku;
    const currentStatus = products[0].status;
    const currentFeatured = products[0].featured;

    // Check if SKU is being changed to one that already exists
    if (sku !== currentSku) {
      const [skuCheck] = await connection.query(
        'SELECT id FROM products WHERE sku = ? AND id != ?',
        [sku, productId]
      );

      if (skuCheck.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: 'SKU already exists' });
      }
    }

    // Delete images from Cloudinary
    if (imagesToDelete.length > 0) {
      try {
        const deletePromises = imagesToDelete.map(publicId => {
          return cloudinary.uploader.destroy(publicId);
        });
        await Promise.all(deletePromises);
      } catch (err) {
        console.error('Error deleting images from Cloudinary:', err);
      }
    }

    // Update product in database
    const baseSlug = slugify(name);
    const uniqueSlug = await ensureUniqueSlug(connection, baseSlug);
    const attributesJson = JSON.stringify({ material, sizes: processedSizes, colors });
    const imagesJson = JSON.stringify(imageUrls);
    const metadataJson = JSON.stringify({
      tags,
      features,
      moq: moq ?? metadataPayload.moq ?? 1,
      shipping,
      warranty,
      bulk_discount,
      free_shipping: freeShipping,
      free_shipping_min_amount: freeShippingMinAmount
    });

    // Auto-generate SEO fields if not provided
    const seo = generateProductSEO(name, description, finalPrice, imageUrls);
    const finalSeoTitle = req.body.seo_title || seo.seo_title;
    const finalSeoDescription = req.body.seo_description || seo.seo_description;
    const finalSeoKeywords = req.body.seo_keywords || seo.seo_keywords;
    const finalSchemaJson = req.body.schema_json ? JSON.stringify(req.body.schema_json) : JSON.stringify(seo.schema_json);

    const [result] = await connection.query(
      `UPDATE products SET 
        product_name = ?,
        product_description = ?,
        price = ?,
        discounted_price = ?,
        category = ?,
        stock = ?,
        moq = ?,
        material = ?,
        care_instructions = ?,
        sku = ?,
        shipping_info = ?,
        warranty = ?,
        bulk_discount = ?,
        sizes = ?,
        colors = ?,
        tags = ?,
        features = ?,
        slug = ?,
        status = ?,
        featured = ?,
        thumbnail = ?,
        attributes = ?,
        images = ?,
        metadata = ?,
        rating = ?,
        is_customizable = ?,
        is_preorder = ?,
        stock_status = ?,
        seo_title = ?,
        seo_description = ?,
        seo_keywords = ?,
        schema_json = ?,
        customization_type = ?,
        customization_mode = ?,
        customization_images = ?,
        customization_dimensions = ?,
        engraving_type = ?,
        allow_customer_size_adjustment = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        name,
        description,
        finalPrice,
        finalDiscountedPrice,
        JSON.stringify(categories),
        (is_preorder === true || is_preorder === 1 || is_preorder === 'true' || stock_status === 'Pre-order') ? 0 : parseInt(stock),
        parseInt(moq) || 1,
        material,
        care,
        sku,
        shipping,
        warranty,
        bulk_discount,
        JSON.stringify(processedSizes),
        JSON.stringify(colors),
        JSON.stringify(tags),
        JSON.stringify(features),
        uniqueSlug,
        status ?? currentStatus ?? 'active',
        typeof featured !== 'undefined' ? (featured ? 1 : 0) : (currentFeatured ? 1 : 0),
        (imageUrls[0] || null),
        attributesJson,
        imagesJson,
        metadataJson,
        0,
        is_customizable ? 1 : 0,
        (is_preorder === true || is_preorder === 1 || is_preorder === 'true' || stock_status === 'Pre-order') ? 1 : 0,
        stock_status || (is_preorder === true || is_preorder === 1 || is_preorder === 'true' ? 'Pre-order' : 'In Stock'),
        finalSeoTitle,
        finalSeoDescription,
        finalSeoKeywords,
        finalSchemaJson,
        customization_type || 'Apparels',
        req.body.customization_mode || null,
        customization_images ? JSON.stringify(customization_images) : null,
        customization_dimensions ? JSON.stringify(customization_dimensions) : null,
        engraving_type || 'both',
        allow_customer_size_adjustment ? 1 : 0,
        productId
      ]
    );
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    await connection.query('DELETE FROM product_variants WHERE product_id = ?', [productId]);
    for (const v of variants) {
      const qty = v && v.quantity != null ? parseInt(v.quantity) : 0;
      await connection.query(
        'INSERT INTO product_variants (product_id, color, size, quantity) VALUES (?, ?, ?, ?)',
        [productId, v && v.color ? String(v.color) : null, v && v.size ? String(v.size) : null, isNaN(qty) ? 0 : qty]
      );
    }
    // Handle discount ranges
    console.log('PUT product discount_ranges:', discount_ranges);
    const discountRanges = Array.isArray(discount_ranges) ? discount_ranges : [];
    await connection.query('DELETE FROM quantity_discount_ranges WHERE product_id = ?', [productId]);
    console.log('Inserting discount ranges:', discountRanges);
    for (const range of discountRanges) {
      const minQty = Number(range.min_quantity || range.min_qty || 2);
      const maxQty = range.max_quantity !== undefined ? Number(range.max_quantity) : (range.max_qty !== undefined ? Number(range.max_qty) : null);
      const discountPercent = Number(range.discount_percentage || range.discount_percent || 0);
      const discPrice = range.discounted_price !== undefined ? Number(range.discounted_price) : null;
      console.log('Inserting range:', [productId, minQty, maxQty, discountPercent, discPrice]);
      await connection.query(
        `INSERT INTO quantity_discount_ranges 
         (product_id, min_quantity, max_quantity, discount_percentage, discounted_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [productId, minQty, maxQty !== null ? maxQty : null, discountPercent, discPrice]
      );
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Product updated successfully',
      productId: productId
    });

    // Auto-regenerate sitemap when a product is updated
    regenerateSitemap().catch(err => console.error('Sitemap regeneration failed after product update:', err));
  } catch (error) {
    try { if (connection) await connection.rollback(); } catch { }
    console.error('Product update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
});

app.put('/api/products/:id/status', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const productId = req.params.id;
    const normalizedStatus = String(req.body?.status || '').trim().toLowerCase();

    if (!['active', 'inactive'].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product status. Use active or inactive.'
      });
    }

    connection = await pool.getConnection();
    const [products] = await connection.query(
      'SELECT id, product_name FROM products WHERE id = ? LIMIT 1',
      [productId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await connection.query(
      'UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?',
      [normalizedStatus, productId]
    );
    connection.release();
    connection = null;

    res.json({
      success: true,
      message: `Product ${normalizedStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      product: {
        id: Number(productId),
        product_name: products[0].product_name,
        status: normalizedStatus
      }
    });

    regenerateSitemap().catch(err => console.error('Sitemap regeneration failed after product status update:', err));
  } catch (error) {
    try { if (connection) connection.release(); } catch {}
    console.error('Product status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: error.message
    });
  }
});

// Get single product endpoint
app.get('/api/products/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  try {
    const productId = req.params.id;
    const canViewInactive = hasAdminSession(req);

    const connection = await pool.getConnection();
    const [products] = await connection.query(
      `SELECT * FROM products
       WHERE id = ?
       ${canViewInactive ? '' : 'AND (status = "active" OR status IS NULL)'}`,
      [productId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    const sitemapPath = await productSocialSeo.resolveProductSitemapPath(connection, productId);

    const product = products[0];
    const [sumRows] = await connection.query(
      'SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM user_reviews WHERE product_id = ? AND is_approved = 1',
      [productId]
    );
    const avgRating = sumRows[0] && sumRows[0].avg_rating != null ? Number(sumRows[0].avg_rating) : null;
    const reviewCount = sumRows[0] && sumRows[0].review_count != null ? Number(sumRows[0].review_count) : 0;

    // Parse categories
    let categories;
    try {
      categories = JSON.parse(product.category);
      if (!Array.isArray(categories)) {
        categories = [product.category];
      }
    } catch (e) {
      categories = [product.category];
    }

    // Format response with price range
    const meta = product.metadata ? JSON.parse(product.metadata) : null;
    const freeShippingMinAmount = parseFreeShippingMinAmount(meta?.free_shipping_min_amount);
    const priceRange = meta && meta.price_range && typeof meta.price_range === 'object' ? meta.price_range : null;
    // Fetch discount ranges
    console.log('Fetching discount ranges for productId:', productId);
    const [discountRanges] = await connection.query(
      'SELECT * FROM quantity_discount_ranges WHERE product_id = ? ORDER BY min_quantity ASC',
      [productId]
    );
    console.log('Discount ranges found:', discountRanges);
    const parsedProduct = {
      id: product.id,
      product_name: product.product_name,
      product_description: product.product_description,
      product_details: product.product_details || product.product_description,
      price: product.price,
      min_price: priceRange && priceRange.min != null ? Number(priceRange.min) : (product.discounted_price || product.price),
      max_price: priceRange && priceRange.max != null ? Number(priceRange.max) : product.price,
      discounted_price: product.discounted_price,
      categories: categories,
      category: categories[0],
      stock: product.stock,
      moq: product.moq ?? (meta && meta.moq) ?? 1,
      material: product.material,
      care_instructions: product.care_instructions,
      sku: product.sku,
      shipping_info: product.shipping_info,
      free_shipping: isFreeShippingEnabled(meta?.free_shipping),
      free_shipping_min_amount: freeShippingMinAmount,
      warranty: product.warranty,
      bulk_discount: product.bulk_discount,
      sizes: JSON.parse(product.sizes || '[]'),
      colors: JSON.parse(product.colors || '[]'),
      product_photos: product.images ? JSON.parse(product.images || '[]') : JSON.parse(product.product_photos || '[]'),
      tags: JSON.parse(product.tags || '[]'),
      features: JSON.parse(product.features || '[]'),
      slug: product.slug,
      sitemap_path: sitemapPath,
      status: product.status,
      featured: !!product.featured,
      thumbnail: product.thumbnail,
      attributes: product.attributes ? JSON.parse(product.attributes) : null,
      images: product.images ? JSON.parse(product.images) : null,
      metadata: meta,
      is_customizable: product.is_customizable ? 1 : 0,
      is_preorder: product.is_preorder ? 1 : 0,
      stock_status: product.stock_status || (product.is_preorder ? 'Pre-order' : 'In Stock'),
      customization_type: product.customization_type,
      customization_images: product.customization_images ? (typeof product.customization_images === 'string' ? JSON.parse(product.customization_images) : product.customization_images) : null,
      customization_dimensions: product.customization_dimensions ? (typeof product.customization_dimensions === 'string' ? JSON.parse(product.customization_dimensions) : product.customization_dimensions) : null,
      customization_mode: product.customization_mode || null,
      allow_customer_size_adjustment: product.allow_customer_size_adjustment ? 1 : 0,
      personalization_input_type: product.personalization_input_type || null,
      seo_title: product.seo_title,
      seo_description: product.seo_description,
      seo_keywords: product.seo_keywords,
      schema_json: product.schema_json ? (typeof product.schema_json === 'string' ? JSON.parse(product.schema_json) : product.schema_json) : null,
      created_at: product.created_at,
      updated_at: product.updated_at,
      rating: avgRating,
      review_count: reviewCount,
      discount_ranges: Array.isArray(discountRanges) ? discountRanges : []
    };
    const [variants] = await connection.query(
      'SELECT color, size, quantity FROM product_variants WHERE product_id = ? ORDER BY id ASC',
      [productId]
    );
    parsedProduct.variants = Array.isArray(variants) ? variants.map(v => ({ color: v.color, size: v.size, quantity: Number(v.quantity || 0) })) : [];
    connection.release();
    res.json(parsedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get all products endpoint
app.get('/api/products', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  try {
    const canViewInactive = req.query.includeInactive === 'true' && hasAdminSession(req);
    const requestedLimit = parseInt(req.query.limit, 10);
    const hasLimit = Number.isInteger(requestedLimit) && requestedLimit > 0;
    const connection = await pool.getConnection();
    const [products] = await connection.query(
      `SELECT * FROM products
       ${canViewInactive ? '' : 'WHERE status = "active" OR status IS NULL'}
       ORDER BY created_at DESC
       ${hasLimit ? 'LIMIT ?' : ''}`,
      hasLimit ? [requestedLimit] : []
    );
    const [summaries] = await connection.query(
      'SELECT product_id, ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM user_reviews WHERE is_approved = 1 GROUP BY product_id'
    );
    const [sitemapEntries] = await connection.query(
      'SELECT path, type FROM sitemap_entries WHERE type = "product" AND is_active = TRUE'
    );
    connection.release();

    const summaryMap = new Map();
    for (const s of summaries) {
      summaryMap.set(Number(s.product_id), {
        rating: s.avg_rating != null ? Number(s.avg_rating) : null,
        review_count: s.review_count != null ? Number(s.review_count) : 0
      });
    }

    const sitemapMap = new Map();
    for (const entry of sitemapEntries) {
      const pid = productSocialSeo.getProductIdFromSitemapPath(entry.path);
      if (pid) {
        sitemapMap.set(Number(pid), entry.path);
      }
    }

    const parsedProducts = products.map(product => {
      // Parse categories
      let categories;
      try {
        categories = JSON.parse(product.category);
        if (!Array.isArray(categories)) {
          categories = [product.category];
        }
      } catch (e) {
        categories = [product.category];
      }

      const meta = product.metadata ? JSON.parse(product.metadata) : null;
      const freeShippingMinAmount = parseFreeShippingMinAmount(meta?.free_shipping_min_amount);
      const priceRange = meta && meta.price_range && typeof meta.price_range === 'object' ? meta.price_range : null;

      const sum = summaryMap.get(Number(product.id)) || { rating: null, review_count: 0 };
      const sitemapPath = sitemapMap.get(Number(product.id)) || null;

      return {
        id: product.id,
        product_name: product.product_name,
        product_description: product.product_details || product.product_description,
        price: product.price,
        discounted_price: product.discounted_price,
        categories,
        category: categories[0],
        colors: JSON.parse(product.colors || '[]'),
        sizes: JSON.parse(product.sizes || '[]'),
        product_photos: product.images ? JSON.parse(product.images || '[]') : JSON.parse(product.product_photos || '[]'),
        metadata: meta,
        tags: JSON.parse(product.tags || '[]'),
        features: JSON.parse(product.features || '[]'),
        min_price: priceRange && priceRange.min != null ? Number(priceRange.min) : (product.discounted_price || product.price),
        max_price: priceRange && priceRange.max != null ? Number(priceRange.max) : product.price,
        slug: product.slug,
        sitemap_path: sitemapPath,
        status: product.status,
        featured: !!product.featured,
        is_customizable: product.is_customizable ? 1 : 0,
        is_preorder: product.is_preorder ? 1 : 0,
        stock_status: product.stock_status || (product.is_preorder ? 'Pre-order' : 'In Stock'),
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        seo_keywords: product.seo_keywords,
        schema_json: product.schema_json ? (typeof product.schema_json === 'string' ? JSON.parse(product.schema_json) : product.schema_json) : null,
        thumbnail: product.thumbnail,
        stock: product.stock,
        moq: product.moq ?? (meta && meta.moq) ?? 1,
        sku: product.sku,
        free_shipping: isFreeShippingEnabled(meta?.free_shipping),
        free_shipping_min_amount: freeShippingMinAmount,
        customization_mode: product.customization_mode || null,
        created_at: product.created_at,
        updated_at: product.updated_at,
        rating: sum.rating,
        review_count: sum.review_count
      };
    });

    res.json(parsedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const productId = req.params.id;
    const googleUid = (req.query && req.query.google_uid) ? String(req.query.google_uid) : null;
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    const connection = await pool.getConnection();
    const [reviews] = await connection.query(
      'SELECT id, user_id, google_uid, reviewer_name, reviewer_photo_url, rating, title, review_text, media_json, is_first_review, created_at FROM user_reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC',
      [productId]
    );
    const [sumRows] = await connection.query(
      'SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM user_reviews WHERE product_id = ? AND is_approved = 1 AND is_first_review = 1',
      [productId]
    );
    let youHaveRated = false;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [rows] = await connection.query('SELECT 1 FROM user_reviews WHERE product_id = ? AND user_id IN (SELECT id FROM user_profiles WHERE user_id = ?) AND is_first_review = 1 LIMIT 1', [productId, decoded.userId]);
        youHaveRated = rows.length > 0;
      } catch { }
    } else if (googleUid) {
      const [rows] = await connection.query('SELECT 1 FROM user_reviews WHERE product_id = ? AND google_uid = ? AND is_first_review = 1 LIMIT 1', [productId, googleUid]);
      youHaveRated = rows.length > 0;
    }
    connection.release();
    const summary = sumRows[0] || { avg_rating: null, review_count: 0 };
    res.json({ success: true, reviews, summary, you_have_rated: youHaveRated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

app.post('/api/products/:id/reviews', async (req, res) => {
  let connection;
  try {
    const productId = req.params.id;
    const { title, review_text } = req.body || {};
    const r = req.body && req.body.rating != null ? Number(req.body.rating) : null;
    connection = await pool.getConnection();
    let profileId = null;
    let nameResolved = (req.body && req.body.reviewer_name) || '';
    let photoUrl = (req.body && req.body.reviewer_photo_url) || null;
    const google_uid = (req.body && req.body.google_uid) || null;
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [rows] = await connection.query('SELECT id, first_name, last_name FROM user_profiles WHERE user_id = ? LIMIT 1', [decoded.userId]);
        if (rows.length > 0) {
          profileId = rows[0].id;
          if (!nameResolved) {
            const fn = rows[0].first_name || '';
            const ln = rows[0].last_name || '';
            nameResolved = `${fn} ${ln}`.trim();
          }
        }
      } catch { }
    }
    if (!profileId && !google_uid) {
      return res.status(400).json({ success: false, message: 'User identity required' });
    }

    if (!nameResolved) {
      if (google_uid && String(google_uid).startsWith('anon-')) {
        const code = String(google_uid).replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
        nameResolved = `Guest-${code}`;
        photoUrl = null;
      } else {
        nameResolved = 'Anonymous';
      }
    }

    const [existing] = await connection.query(
      'SELECT id, rating FROM user_reviews WHERE product_id = ? AND is_first_review = 1 AND ((? IS NOT NULL AND user_id = ?) OR (? IS NOT NULL AND google_uid = ?)) LIMIT 1',
      [productId, profileId, profileId, google_uid, google_uid]
    );
    const isFirst = existing.length === 0;
    if (isFirst && (r == null || isNaN(r) || r < 1 || r > 5)) {
      return res.status(400).json({ success: false, message: 'Rating required for first review' });
    }
    if (!isFirst && r != null && existing[0]) {
      await connection.query('UPDATE user_reviews SET rating = ? , updated_at = NOW() WHERE id = ?', [Math.round(r), existing[0].id]);
    }

    let mediaUrls = [];
    const uploadBuffer = (buf) => new Promise((resolve, reject) => {
      try {
        const stream = cloudinary.uploader.upload_stream({ folder: 'yokebud craft/reviews', resource_type: 'auto' }, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
        stream.end(buf);
      } catch (e) { reject(e); }
    });
    try {
      const files = req.files && (req.files.media || req.files.files || null);
      const arr = Array.isArray(files) ? files : (files ? [files] : []);
      const results = [];
      for (const f of arr) {
        if (f.tempFilePath) {
          try {
            const r = await cloudinary.uploader.upload(f.tempFilePath, { folder: 'yokebud craft/reviews', resource_type: 'auto' });
            results.push(r);
          } catch { }
        } else if (f.data) {
          try {
            const r = await uploadBuffer(f.data);
            results.push(r);
          } catch { }
        }
      }
      mediaUrls = results.map(r => r.secure_url);
    } catch { }

    try {
      const hasContent = (review_text && review_text.trim().length > 0) || mediaUrls.length > 0 || title;
      if (isFirst || hasContent) {
        await connection.query(
          'INSERT INTO user_reviews (product_id, user_id, google_uid, reviewer_name, reviewer_photo_url, rating, title, review_text, media_json, is_first_review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [productId, profileId, google_uid || null, nameResolved || 'Anonymous', photoUrl, isFirst ? Math.round(r) : null, title || null, review_text || null, mediaUrls.length ? JSON.stringify(mediaUrls) : null, isFirst ? 1 : 0]
        );
      }
    } catch (e) {
      if (String(e.code).toUpperCase() === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Already rated for this product' });
      }
      throw e;
    }
    const [sumRows] = await connection.query(
      'SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM user_reviews WHERE product_id = ? AND is_approved = 1 AND is_first_review = 1',
      [productId]
    );
    const avg = sumRows[0] && sumRows[0].avg_rating != null ? Number(sumRows[0].avg_rating) : null;
    await connection.query('UPDATE products SET rating = ? WHERE id = ?', [avg, productId]);
    connection.release();
    res.json({ success: true, summary: sumRows[0] || { avg_rating: avg, review_count: 0 }, is_first_review: isFirst });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

app.put('/api/products/:id/reviews/:reviewId', async (req, res) => {
  let connection;
  try {
    const reviewId = req.params.reviewId;
    const productId = req.params.id;
    connection = await pool.getConnection();
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    const google_uid = (req.body && req.body.google_uid) || null;
    let ownerClause = '';
    let ownerParams = [];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ownerClause = 'user_id IN (SELECT id FROM user_profiles WHERE user_id = ?)';
        ownerParams.push(decoded.userId);
      } catch { }
    } else if (google_uid) {
      ownerClause = 'google_uid = ?';
      ownerParams.push(google_uid);
    }
    if (!ownerClause) {
      connection.release();
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let mediaUrls = [];
    const uploadBuffer = (buf) => new Promise((resolve, reject) => {
      try {
        const stream = cloudinary.uploader.upload_stream({ folder: 'yokebud craft/reviews', resource_type: 'auto' }, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
        stream.end(buf);
      } catch (e) { reject(e); }
    });
    try {
      const files = req.files && (req.files.media || req.files.files || null);
      const arr = Array.isArray(files) ? files : (files ? [files] : []);
      const results = [];
      for (const f of arr) {
        if (f.tempFilePath) {
          try { const r = await cloudinary.uploader.upload(f.tempFilePath, { folder: 'yokebud craft/reviews', resource_type: 'auto' }); results.push(r); } catch { }
        } else if (f.data) {
          try { const r = await uploadBuffer(f.data); results.push(r); } catch { }
        }
      }
      mediaUrls = results.map(r => r.secure_url);
    } catch { }

    const text = (req.body && req.body.review_text) || null;
    const title = (req.body && req.body.title) || null;
    let existingFromClient = [];
    try {
      const incoming = req.body && req.body.existing_media_json;
      if (incoming) {
        existingFromClient = Array.isArray(incoming) ? incoming : JSON.parse(incoming);
      }
    } catch { }
    const merged = [...existingFromClient, ...mediaUrls].filter(Boolean);

    await connection.query(
      `UPDATE user_reviews SET review_text = ?, title = ?, media_json = ?, updated_at = NOW()
       WHERE id = ? AND product_id = ? AND ${ownerClause}`,
      [text, title, merged.length ? JSON.stringify(merged) : null, reviewId, productId, ...ownerParams]
    );

    connection.release();
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to update review' });
  }
});

app.delete('/api/products/:id/reviews/:reviewId', async (req, res) => {
  let connection;
  try {
    const reviewId = req.params.reviewId;
    const productId = req.params.id;
    connection = await pool.getConnection();
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    const google_uid = (req.query && req.query.google_uid) || null;
    let ownerClause = '';
    let ownerParams = [];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ownerClause = 'user_id IN (SELECT id FROM user_profiles WHERE user_id = ?)';
        ownerParams.push(decoded.userId);
      } catch { }
    } else if (google_uid) {
      ownerClause = 'google_uid = ?';
      ownerParams.push(google_uid);
    }
    if (!ownerClause) {
      connection.release();
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [rows] = await connection.query('SELECT is_first_review FROM user_reviews WHERE id = ? AND product_id = ? LIMIT 1', [reviewId, productId]);
    await connection.query(`DELETE FROM user_reviews WHERE id = ? AND product_id = ? AND ${ownerClause}`, [reviewId, productId, ...ownerParams]);

    if (rows.length && rows[0].is_first_review) {
      const [sumRows] = await connection.query('SELECT ROUND(AVG(rating),1) AS avg_rating FROM user_reviews WHERE product_id = ? AND is_approved = 1 AND is_first_review = 1', [productId]);
      const avg = sumRows[0] && sumRows[0].avg_rating != null ? Number(sumRows[0].avg_rating) : null;
      await connection.query('UPDATE products SET rating = ? WHERE id = ?', [avg, productId]);
    }

    connection.release();
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
});

// Categories API
app.get('/api/categories', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Ensure table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_id INT DEFAULT NULL,
        collection_section VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure parent_id column exists (migration for existing tables)
    try {
      await connection.query("SELECT parent_id FROM categories LIMIT 1");
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await connection.query("ALTER TABLE categories ADD COLUMN parent_id INT DEFAULT NULL");
      }
    }

    // Ensure collection_section column exists (migration for existing tables)
    try {
      await connection.query("SELECT collection_section FROM categories LIMIT 1");
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await connection.query("ALTER TABLE categories ADD COLUMN collection_section VARCHAR(255) DEFAULT NULL");
      }
    }

    const [rows] = await connection.query('SELECT id, name, type, image_url, created_at, updated_at, parent_id, collection_section, slug, seo_title, seo_description, seo_keywords, seo_content FROM categories ORDER BY id ASC');
    connection.release();
    res.json({ success: true, categories: rows });
  } catch (error) {
    if (connection) connection.release();
    console.error('Fetch categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { name, parent_id, type, image_url, slug, seo_title, seo_description, seo_keywords, seo_content, collection_section } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO categories (name, parent_id, collection_section, type, image_url, slug, seo_title, seo_description, seo_keywords, seo_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, parent_id || null, collection_section || null, type || 'craft', image_url || null, finalSlug, seo_title || null, seo_description || null, seo_keywords || null, seo_content || null]
    );

    connection.release();
    res.json({ success: true, message: 'Category created', category: { id: result.insertId, name, parent_id, collection_section: collection_section || null, type, image_url, slug: finalSlug } });
  } catch (error) {
    if (connection) connection.release();
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
});

// Delete category
app.delete('/api/categories/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if category exists
    const [rows] = await connection.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await connection.query('DELETE FROM categories WHERE id = ?', [id]);
    connection.release();
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    if (connection) connection.release();
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
});

// Delete product
app.delete('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const productId = req.params.id;

    const connection = await pool.getConnection();

    // Get product details for image cleanup
    const [products] = await connection.query(
      'SELECT images FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    const { images } = products[0];
    const photos = JSON.parse(images || '[]');

    // Delete the product from database
    await connection.query(
      'DELETE FROM products WHERE id = ?',
      [productId]
    );

    connection.release();

    // Delete product images from Cloudinary
    try {
      const deletePromises = photos.map(imageUrl => {
        const parts = String(imageUrl).split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        const after = uploadIndex >= 0 ? parts.slice(uploadIndex + 1).join('/') : parts.slice(-2).join('/');
        const publicId = after.split('?')[0].replace(/\.[^.]+$/, '');
        return cloudinary.uploader.destroy(publicId);
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Error deleting product images from Cloudinary:', err);
    }

    res.json({ success: true, message: 'Product deleted successfully' });

    // Auto-regenerate sitemap when a product is deleted
    regenerateSitemap().catch(err => console.error('Sitemap regeneration failed after product deletion:', err));
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.delete('/api/products/:id/images', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const productId = req.params.id;
    const { url, public_id } = req.body || {};
    if (!url && !public_id) {
      return res.status(400).json({ success: false, message: 'Image identifier required' });
    }
    const derivePublicId = (u) => {
      try {
        const parts = String(u).split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex >= 0) {
          const after = parts.slice(uploadIndex + 1).join('/');
          const noQuery = after.split('?')[0];
          const noExt = noQuery.replace(/\.[^.]+$/, '');
          return noExt;
        }
        const guess = String(u).split('/').slice(-2).join('/').split('.')[0];
        return guess;
      } catch {
        return '';
      }
    };
    const detectResourceType = (u) => {
      try {
        const s = String(u).toLowerCase();
        if (s.includes('/video/upload/') || s.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/)) return 'video';
        return 'image';
      } catch { return 'image'; }
    };
    const pid = public_id || derivePublicId(url);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT images FROM products WHERE id = ?', [productId]);
    if (!rows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    let currentImages;
    try {
      currentImages = JSON.parse(rows[0].images || '[]');
      if (!Array.isArray(currentImages)) currentImages = [];
    } catch {
      currentImages = [];
    }
    const updatedImages = currentImages.filter((x) => {
      if (x === url) return false;
      if (!pid) return true;
      const storedPid = derivePublicId(x);
      return storedPid !== pid;
    });
    await connection.query(
      'UPDATE products SET images = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedImages), productId]
    );
    await connection.commit();
    connection.release();
    if (pid) {
      try {
        const rtype = detectResourceType(url || '');
        await cloudinary.uploader.destroy(pid, { resource_type: rtype });
      } catch (e) {
        console.error('Cloudinary delete failed for product image', e && e.message ? e.message : e);
      }
    }
    return res.json({ success: true });
  } catch (error) {
    try { if (connection) await connection.rollback(); } catch { }
    if (connection) connection.release();
    return res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
});

// Get related products
app.get('/api/products/:id/related', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  try {
    const productId = req.params.id;
    const limit = parseInt(req.query.limit) || 4;
    const canViewInactive = hasAdminSession(req);

    const connection = await pool.getConnection();

    // First get the product's categories
    const [products] = await connection.query(
      `SELECT category FROM products
       WHERE id = ?
       ${canViewInactive ? '' : 'AND (status = "active" OR status IS NULL)'}`,
      [productId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    // Parse categories (could be JSON array or single string)
    let categories;
    try {
      categories = JSON.parse(products[0].category);
      if (!Array.isArray(categories)) {
        categories = [products[0].category];
      }
    } catch (e) {
      categories = [products[0].category];
    }

    // Get related products that share any of the categories
    const [relatedProducts] = await connection.query(
      `SELECT id, product_name, price, min_price, max_price, discounted_price, images 
       FROM products 
       WHERE id != ? 
       ${canViewInactive ? '' : 'AND (status = "active" OR status IS NULL)'}
       AND JSON_OVERLAPS(category, ?)
       LIMIT ?`,
      [productId, JSON.stringify(categories), limit]
    );

    connection.release();

    const parsedProducts = relatedProducts.map(product => ({
      id: product.id,
      product_name: product.product_name,
      price: product.price,
      min_price: product.discounted_price || product.price,
      max_price: product.price,
      discounted_price: product.discounted_price,
      firstImage: product.images ?
        (JSON.parse(product.images) || [])[0] : null
    }));

    res.json(parsedProducts);
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Failed to fetch related products' });
  }
});

// Shareable product page with server-rendered Open Graph tags
// Shareable product page with server-rendered Open Graph tags
// Shareable product page with server-rendered Open Graph tags
app.get('/share/products/:id/:slug?', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { img: imgParam } = req.query;
    
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM products WHERE id = ? AND (status = "active" OR status IS NULL) LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) {
      connection.release();
      res.status(404).send('<!doctype html><html><head><meta charset="utf-8"><title>Product Not Found</title></head><body>Product not found</body></html>');
      return;
    }

    const p = rows[0];
    const siteBase = productSocialSeo.PUBLIC_SITE_URL;
    const sitemapPath = await productSocialSeo.resolveProductSitemapPath(connection, id);
    connection.release();
    connection = null;

    const photos = productSocialSeo.parseProductPhotos(p);
    
    // Better image selection for sharing
    let imgIdx = 0;
    if (imgParam) {
      const parsed = parseInt(imgParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < photos.length) {
        imgIdx = parsed;
      }
    }
    
    // Use the new image function
    const firstImage = productSocialSeo.getImageUrlForSharing(photos[imgIdx], 1200, 630);
    
    const canonicalPath = productSocialSeo.buildCanonicalProductPath(p, sitemapPath, id);
    const canonicalUrl = `${siteBase}${canonicalPath}`;
    const meta = productSocialSeo.buildProductSocialMetaTags(p, { canonicalUrl, imageUrl: firstImage });

    // All product images for gallery sharing
    const allImages = photos.map((photo) => productSocialSeo.getImageUrlForSharing(photo, 1200, 630)).filter(Boolean);

    const name = p.product_name || 'Product';
    const desc = productSocialSeo.stripHtml(
      p.seo_description || p.product_details || p.product_description || ''
    ).slice(0, 200);

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name,
      description: desc,
      sku: p.sku || String(p.id || ''),
      image: allImages.slice(0, 5),
      brand: { '@type': 'Brand', name: 'Yokebud craft' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: Number(p.discounted_price ?? p.price ?? 0),
        availability: Number(p.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: canonicalUrl
      }
    };

    // Gallery images for Open Graph (Facebook supports multiple og:image tags)
    let galleryMetaTags = '';
    if (allImages.length > 1) {
      for (let i = 1; i < Math.min(allImages.length, 5); i++) {
        galleryMetaTags += `\n    <meta property="og:image" content="${productSocialSeo.escapeAttr(allImages[i])}" />`;
        galleryMetaTags += `\n    <meta property="og:image:width" content="1200" />`;
        galleryMetaTags += `\n    <meta property="og:image:height" content="630" />`;
      }
    }

    const schemaScripts = `
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteBase },
          { '@type': 'ListItem', position: 2, name: String(p.category || 'Products') || 'Products', item: `${siteBase}/` },
          { '@type': 'ListItem', position: 3, name: name, item: canonicalUrl }
        ]
      })}</script>
    `;

    const html = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${meta.tags}
      ${galleryMetaTags}
      ${schemaScripts}
      <meta http-equiv="refresh" content="0; url=${productSocialSeo.escapeAttr(canonicalUrl)}">
    </head><body>
      ${meta.noscriptBody}
      <a href="${productSocialSeo.escapeAttr(canonicalUrl)}" style="font-family: sans-serif; padding: 20px; display: inline-block;">Open product</a>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    try { if (connection) connection.release(); } catch { }
    res.status(500).send('<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body>Unexpected error</body></html>');
  }
});

app.get('/api/products/slug/:slug', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  try {
    const { slug } = req.params;
    const canViewInactive = hasAdminSession(req);
    const connection = await pool.getConnection();
    const [products] = await connection.query(
      `SELECT * FROM products
       WHERE slug = ?
       ${canViewInactive ? '' : 'AND (status = "active" OR status IS NULL)'}`,
      [slug]
    );
    connection.release();
    if (!products.length) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = products[0];
    let categories;
    try {
      categories = JSON.parse(product.category);
      if (!Array.isArray(categories)) {
        categories = [product.category];
      }
    } catch (e) {
      categories = [product.category];
    }
    const meta = product.metadata ? JSON.parse(product.metadata) : null;
    const freeShippingMinAmount = parseFreeShippingMinAmount(meta?.free_shipping_min_amount);
    res.json({
      id: product.id,
      product_name: product.product_name,
      product_description: product.product_details || product.product_description,
      product_details: product.product_details || product.product_description,
      price: product.price,
      min_price: product.discounted_price || product.price,
      max_price: product.price,
      discounted_price: product.discounted_price,
      categories,
      category: categories[0],
      stock: product.stock,
      moq: product.moq ?? (meta && meta.moq) ?? 1,
      material: product.material,
      care_instructions: product.care_instructions,
      sku: product.sku,
      shipping_info: product.shipping_info,
      free_shipping: isFreeShippingEnabled(meta?.free_shipping),
      free_shipping_min_amount: freeShippingMinAmount,
      warranty: product.warranty,
      bulk_discount: product.bulk_discount,
      sizes: JSON.parse(product.sizes || '[]'),
      colors: JSON.parse(product.colors || '[]'),
      product_photos: product.images ? JSON.parse(product.images || '[]') : JSON.parse(product.product_photos || '[]'),
      tags: JSON.parse(product.tags || '[]'),
      features: JSON.parse(product.features || '[]'),
      slug: product.slug,
      status: product.status,
      featured: !!product.featured,
      thumbnail: product.thumbnail,
      attributes: product.attributes ? JSON.parse(product.attributes) : null,
      images: product.images ? JSON.parse(product.images) : null,
      metadata: product.metadata ? JSON.parse(product.metadata) : null,
      created_at: product.created_at,
      updated_at: product.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.get('/api/products/featured', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  try {
    const limit = parseInt(req.query.limit) || 8;
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE status = ? AND featured = 1 ORDER BY updated_at DESC LIMIT ?', ['active', limit]);
    connection.release();
    const products = rows.map(product => {
      const meta = product.metadata ? JSON.parse(product.metadata) : null;
      return {
        id: product.id,
        product_name: product.product_name,
        product_description: product.product_details || product.product_description,
        price: product.price,
        discounted_price: product.discounted_price,
        min_price: product.discounted_price || product.price,
        max_price: product.price,
        slug: product.slug,
        thumbnail: product.thumbnail,
        product_photos: product.images ? JSON.parse(product.images || '[]') : JSON.parse(product.product_photos || '[]'),
        metadata: meta,
        free_shipping: isFreeShippingEnabled(meta?.free_shipping),
        free_shipping_min_amount: parseFreeShippingMinAmount(meta?.free_shipping_min_amount)
      };
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

app.put('/api/products/bulk', requireAdminAuth, async (req, res) => {
  try {
    const { ids, status, featured } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No product ids provided' });
    }
    const connection = await pool.getConnection();
    if (typeof status !== 'undefined') {
      await connection.query(`UPDATE products SET status = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [status, ...ids]);
    }
    if (typeof featured !== 'undefined') {
      await connection.query(`UPDATE products SET featured = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [featured ? 1 : 0, ...ids]);
    }
    connection.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to bulk update products' });
  }
});


// ==================== QUANTITY DISCOUNT RANGES API ====================

// Get all discount ranges for a product
app.get('/api/products/:productId/discount-ranges', async (req, res) => {
  let connection;
  try {
    const { productId } = req.params;
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      'SELECT * FROM quantity_discount_ranges WHERE product_id = ? ORDER BY min_quantity ASC',
      [productId]
    );
    
    connection.release();
    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error fetching discount ranges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch discount ranges' });
  }
});

// Add a new discount range
app.post('/api/products/:productId/discount-ranges', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { productId } = req.params;
    console.log('POST /discount-ranges req.body:', req.body);
    const { min_quantity, max_quantity, discount_percentage, discounted_price } = req.body;
    
    if (min_quantity === undefined || min_quantity === null || min_quantity < 1) {
      return res.status(400).json({ success: false, message: 'Minimum quantity is required and must be at least 1' });
    }
    
    if ((discount_percentage === undefined || discount_percentage === null) && (discounted_price === undefined || discounted_price === null)) {
      return res.status(400).json({ success: false, message: 'Either discount percentage or discounted price is required' });
    }
    
    connection = await pool.getConnection();
    
    // Check if product exists
    const [product] = await connection.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const [result] = await connection.query(
      `INSERT INTO quantity_discount_ranges 
       (product_id, min_quantity, max_quantity, discount_percentage, discounted_price) 
       VALUES (?, ?, ?, ?, ?)`,
      [productId, min_quantity, max_quantity || null, discount_percentage || 0, discounted_price || null]
    );
    
    connection.release();
    res.json({ success: true, message: 'Discount range added successfully', id: result.insertId });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error adding discount range:', error);
    res.status(500).json({ success: false, message: 'Failed to add discount range' });
  }
});

// Update a discount range
app.put('/api/products/:productId/discount-ranges/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { productId, id } = req.params;
    const { min_quantity, max_quantity, discount_percentage, discounted_price } = req.body;
    
    connection = await pool.getConnection();
    
    const [result] = await connection.query(
      `UPDATE quantity_discount_ranges 
       SET min_quantity = ?, max_quantity = ?, discount_percentage = ?, discounted_price = ?, updated_at = NOW()
       WHERE id = ? AND product_id = ?`,
      [min_quantity, max_quantity || null, discount_percentage || 0, discounted_price || null, id, productId]
    );
    
    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Discount range not found' });
    }
    
    connection.release();
    res.json({ success: true, message: 'Discount range updated successfully' });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error updating discount range:', error);
    res.status(500).json({ success: false, message: 'Failed to update discount range' });
  }
});

// Delete a discount range
app.delete('/api/products/:productId/discount-ranges/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { productId, id } = req.params;
    connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM quantity_discount_ranges WHERE id = ? AND product_id = ?',
      [id, productId]
    );
    
    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Discount range not found' });
    }
    
    connection.release();
    res.json({ success: true, message: 'Discount range deleted successfully' });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error deleting discount range:', error);
    res.status(500).json({ success: false, message: 'Failed to delete discount range' });
  }
});



// ==================== IMAGE UPLOAD HANDLING WITH CLOUDINARY ====================
app.post('/api/upload/:productId?', requireAdminAuth, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded.'
      });
    }

    const fileField = req.files.images || Object.values(req.files)[0];
    if (!fileField) {
      return res.status(400).json({
        success: false,
        message: 'No image files were provided.'
      });
    }

    const files = Array.isArray(fileField)
      ? fileField
      : [fileField];

    const uploadResults = [];
    const productId = req.params.productId;
    const productSlugHint = req.body && (req.body.productSlug || req.body.slug);
    const productNameHint = req.body && (req.body.productName || req.body.name);
    const toSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let targetFolder = 'yokebud craft/products';
    if (productId) {
      try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT slug, product_name FROM products WHERE id = ? LIMIT 1', [productId]);
        conn.release();
        if (rows.length > 0) {
          const safe = rows[0].slug || toSlug(rows[0].product_name);
          targetFolder = `${targetFolder}/${safe || `id-${productId}`}`;
        } else {
          targetFolder = `${targetFolder}/id-${productId}`;
        }
      } catch (_) {
        targetFolder = `${targetFolder}/id-${productId}`;
      }
    } else if (productSlugHint || productNameHint) {
      const safe = productSlugHint || toSlug(productNameHint);
      targetFolder = `${targetFolder}/${safe || 'misc'}`;
    } else {
      targetFolder = `${targetFolder}/misc`;
    }

    for (const file of files) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG, WebP and MP4/WEBM/OGG/MOV videos are allowed.'
        });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const isVideo = String(file.mimetype || '').toLowerCase().startsWith('video/');
          const rtype = isVideo ? 'video' : 'image';

          // Generate SEO-friendly public_id for images
          let publicId;
          if (!isVideo) {
            const cleanHint = (productNameHint || 'yokebud-craft')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');

            // Add SEO keywords like "custom", "handmade", "finland" if not present
            let seoBase = cleanHint;
            if (!seoBase.includes('laser') && !seoBase.includes('engraved')) {
              seoBase = `custom-laser-engraved-${seoBase}`;
            }
            if (!seoBase.includes('finland')) {
              seoBase = `${seoBase}-finland`;
            }

            publicId = `${seoBase}-${uuidv4().slice(0, 8)}`;
          } else {
            publicId = uuidv4();
          }

          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: targetFolder,
              public_id: publicId,
              resource_type: rtype,
              format: isVideo ? undefined : 'webp', // Force WebP for images
              quality: 'auto:good', // Optimized compression
              fetch_format: 'auto',
              transformation: isVideo ? undefined : [
                { width: 1200, height: 1200, crop: 'limit' }
              ]
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error);
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
            try {
              const readStream = fs.createReadStream(file.tempFilePath);
              readStream.on('error', reject);
              readStream.pipe(uploadStream);
            } catch (e) {
              try { uploadStream.end(file.data); } catch (e2) { reject(e2 || e); }
            }
          } else {
            uploadStream.end(file.data);
          }
        });

        uploadResults.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
    }

    if (productId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [products] = await connection.query(
          'SELECT images FROM products WHERE id = ?',
          [productId]
        );
        if (products.length > 0) {
          let currentImages;
          try {
            currentImages = JSON.parse(products[0].images || '[]');
            if (!Array.isArray(currentImages)) currentImages = [];
          } catch {
            currentImages = [];
          }
          const newUrls = uploadResults.map(r => r.url);
          const updatedImages = [...newUrls, ...currentImages];
          await connection.query(
            'UPDATE products SET images = ?, updated_at = NOW() WHERE id = ?',
            [JSON.stringify(updatedImages), productId]
          );
          await connection.commit();
        } else {
          await connection.rollback();
        }
      } catch (e) {
        try { await connection.rollback(); } catch { }
        throw e;
      } finally {
        connection.release();
      }
    }

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      images: uploadResults
    });
  } catch (error) {
    console.error('Upload endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});


// ==================== API DOCUMENTATION ====================
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'Yokebud API',
    version: '1.0',
    endpoints: [
      {
        method: 'POST', path: '/api/products', auth: 'admin cookie',
        body: {
          name: 'string', description: 'string', price: 'number', discounted_price: 'number|null',
          categories: 'string[]', stock: 'number', sku: 'string',
          material: 'string', care: 'string', shipping: 'string', warranty: 'string', bulk_discount: 'string',
          sizes: 'string[]', colors: 'string[]', tags: 'string[]', features: 'string[]',
          imageUrls: 'string[]', slug: 'string', status: 'string', featured: 'boolean', thumbnail: 'string',
          attributes: 'object', images: 'string[]', metadata: 'object', rating: 'number'
        },
        responses: { 200: { success: true, productId: 'number' }, 400: {}, 401: {}, 500: {} }
      },
      { method: 'PUT', path: '/api/products/:id', auth: 'admin cookie' },
      { method: 'DELETE', path: '/api/products/:id', auth: 'admin cookie' },
      { method: 'PUT', path: '/api/products/bulk', auth: 'admin cookie' },
      { method: 'POST', path: '/api/upload/:productId?', auth: 'admin cookie' },
      { method: 'GET', path: '/api/products', auth: 'public' },
      { method: 'GET', path: '/api/products/:id', auth: 'public' }
    ]
  };
  res.json(docs);
});






// ==================== ADMIN AUTHENTICATION (OTP + EMAIL SEPARATE) ====================

// Helper: create OTP row in admin_otp_attempts
async function createAdminOtpAttempt(ip) {
  const adminEmail = 'yokebud@gmail.com';
  const connection = await pool.getConnection();
  try {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const now = new Date();

    const [result] = await connection.query(
      `INSERT INTO admin_otp_attempts (admin_id, email, otp_code, status, ip, created_at, updated_at) 
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [ADMIN_ID, adminEmail, otp, ip, now, now]
    );

    const attemptId = result?.insertId || null;

    const [rows] = await connection.query(
      'SELECT id, admin_id, email, otp_code, status, ip, created_at, updated_at FROM admin_otp_attempts WHERE id = ?',
      [attemptId]
    );

    const otpRecord = rows[0] || {
      id: attemptId,
      admin_id: ADMIN_ID,
      email: adminEmail,
      otp_code: otp,
      status: 'pending',
      ip,
      created_at: now,
      updated_at: now
    };

    return otpRecord;
  } finally {
    connection.release();
  }
}

// 1. Admin: Generate OTP – only DB insert (no email)
app.post('/api/admin/send-otp', async (req, res) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();

    const otpRecord = await createAdminOtpAttempt(ip);

    console.log(
      `[ADMIN OTP] Generated OTP for admin_id=${otpRecord.admin_id}, email=${otpRecord.email}, attempt_id=${otpRecord.id}, ip=${otpRecord.ip}`
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'New security code generated successfully.',
      otp_code: otpRecord.otp_code,
      created_at: otpRecord.created_at
    });
  } catch (error) {
    console.error('OTP Generation Error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'System Error: Could not generate code.',
      error: error?.message || String(error)
    });
  }
});

// 1.b Admin: Send email for latest OTP (separate endpoint, DB‑centric)
app.post('/api/admin/send-otp-email', async (req, res) => {
  let connection;
  try {
    const adminEmail = 'yokebud@gmail.com';
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT * FROM admin_otp_attempts WHERE email = ? ORDER BY id DESC LIMIT 1",
      [adminEmail]
    );

    if (!rows.length) {
      connection.release();
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'No OTP found for admin.'
      });
    }

    const record = rows[0];

    const emailSent = await sendAdminOtpEmail(record);
    const status = emailSent ? 'sent' : 'failed';
    const now = new Date();

    await connection.query(
      "UPDATE admin_otp_attempts SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, record.id]
    );

    connection.release();
    connection = null;

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to send OTP email.',
        otp_code: record.otp_code,
        created_at: record.created_at
      });
    }

    res.json({
      success: true,
      status: 'success',
      message: 'Admin OTP email sent successfully.',
      otp_code: record.otp_code,
      created_at: record.created_at
    });
  } catch (error) {
    console.error('Admin OTP email send error:', error);
    if (connection) {
      try {
        connection.release();
      } catch (e) { }
    }
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'System Error: Could not send OTP email.',
      error: error?.message || String(error)
    });
  }
});

// 2. Admin: Verify OTP Route (Checks the LATEST OTP)
app.post('/api/admin/verify-otp', async (req, res) => {
  let connection;
  try {
    const { otp } = req.body;
    const adminEmail = 'yokebud@gmail.com';

    connection = await pool.getConnection();

    // পরিবর্তন: এখানে ORDER BY id DESC LIMIT 1 ব্যবহার করা হয়েছে
    // কারণ এখন ডাটাবেসে অনেকগুলো OTP থাকতে পারে, আমাদের শুধু সর্বশেষটি (Latest) দরকার।
    const [rows] = await connection.query(
      "SELECT * FROM admin_otp_attempts WHERE email = ? ORDER BY id DESC LIMIT 1",
      [adminEmail]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Access Denied.' });
    }

    const record = rows[0];

    // Debug Log
    // console.log(`Latest DB OTP: ${record.otp_code}, Input: ${otp}`);

    // Validate OTP
    if (String(record.otp_code).trim() !== String(otp).trim()) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Invalid Security Code.' });
    }

    // Validate Time (15 Minutes Validity)
    const otpTime = new Date(record.created_at).getTime();
    const currentTime = new Date().getTime();
    const timeDiff = (currentTime - otpTime) / 1000; // seconds

    if (timeDiff > 900) { // 900 seconds = 15 minutes
      connection.release();
      return res.status(400).json({ success: false, message: 'Code Expired. Please regenerate.' });
    }

    const now = new Date();
    await connection.query(
      "UPDATE admin_otp_attempts SET status = 'success', updated_at = ? WHERE id = ?",
      [now, record.id]
    );

    res.cookie('adminAuth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    // Generate admin token to include in response
    const adminToken = generateAdminToken();

    connection.release();
    res.json({ success: true, message: 'Authentication Verified', token: adminToken });

  } catch (error) {
    console.error('Verify Error:', error);
    if (connection) try { connection.release() } catch (e) { };
    res.status(500).json({ success: false, message: 'Verification Error' });
  }
});






// ==================== ADMIN DASHBOARD AND STATS ====================
// Admin dashboard
app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
  try {


    const connection = await pool.getConnection();

    const [unreadCount] = await connection.query(
      'SELECT COUNT(*) as count FROM messages WHERE is_read = 0'
    );

    const [totalCount] = await connection.query(
      'SELECT COUNT(*) as count FROM messages'
    );

    const [productCount] = await connection.query(
      'SELECT COUNT(*) as count FROM products'
    );

    const [orderCount] = await connection.query(
      'SELECT COUNT(*) as count FROM checkout_data WHERE status IN ("Pending", "Processing")'
    );

    connection.release();

    res.json({
      success: true,
      stats: {
        unreadMessages: unreadCount[0].count,
        totalMessages: totalCount[0].count,
        totalProducts: productCount[0].count,
        pendingOrders: orderCount[0].count
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: users summary (total users and recent activity)
app.get('/api/admin/users/summary', requireAdminAuth, async (req, res) => {
  try {


    const connection = await pool.getConnection();

    const [totalRows] = await connection.query(
      'SELECT COUNT(*) as count FROM user_profiles'
    );

    // Return last 60 days of signup timestamps for frontend growth/activity
    const [recentRows] = await connection.query(
      `SELECT created_at FROM user_profiles 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
       ORDER BY created_at DESC`
    );

    // Aggregate last 30 days by date for quick activity charting
    const [activityRows] = await connection.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM user_profiles
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`
    );

    connection.release();

    res.json({
      success: true,
      totalUsers: totalRows[0].count,
      recentSignups: recentRows.map(r => r.created_at),
      activity: activityRows
    });
  } catch (error) {
    console.error('Users summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: user profiles list for dashboard
app.get('/api/admin/user-profiles', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT id, user_id, first_name, last_name, phone, address, house_number,
             apartment, landmark, city, state, zip_code, country,
             profile_picture, date_of_birth, created_at, updated_at
      FROM user_profiles
      WHERE 1
      ORDER BY created_at DESC
    `);

    connection.release();
    res.json({ success: true, users: rows });
  } catch (error) {
    if (connection) connection.release();
    console.error('Admin user profiles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('adminAuth');
  res.clearCookie('adminLastActivity');
  res.clearCookie('adminOtp');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Public: total users count from user_profiles
app.get('/api/user-profiles/count', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_profiles'
    );
    connection.release();

    res.json({ success: true, totalUsers: rows[0]?.count || 0 });
  } catch (error) {
    console.error('User profiles count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});






// ==================== MESSAGE HANDLING ====================

// Contact form submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, whatsapp, message } = req.body;

    if (!name || !email || !whatsapp || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO messages (name, email, whatsapp, message, is_read, is_replied) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, whatsapp, message, 0, 0]
    );
    connection.release();

    // Send emails (admin and customer)
    await sendContactFormNotification(name, email, whatsapp, message);
    await sendContactFormConfirmation(name, email, message);

    res.status(200).json({ success: true, message: 'Message saved successfully' });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ success: false, message: 'Failed to save message' });
  }
});

// Get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT id, name, email, whatsapp, message, created_at, is_read, is_replied FROM messages ORDER by created_at DESC'
    );
    connection.release();

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const messageId = req.params.id;

    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE messages SET is_read = 1 WHERE id = ?',
      [messageId]
    );
    connection.release();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// ==================== NEWSLETTER SUBSCRIPTION SYSTEM ====================

// Generate unique subscription token
const generateSubscriptionToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const sendThisWeeksNewsletterToSubscriber = async (email, subscriptionToken) => {
  try {
    const collections = await fetchWeeklyNewsletterCollections();
    // Always attempt to send a newsletter to newly subscribed users even if there
    // are no new arrivals or discounted products this week. The newsletter
    // renderer will gracefully handle empty collections and show a short note.
    return await sendWeeklyNewsletter({ email, subscription_token: subscriptionToken }, collections);
  } catch (err) {
    console.error(`❌ Error while sending this week's newsletter to ${email}:`, err?.message || err);
    return false;
  }
};

// Subscribe to newsletter endpoint
app.post('/api/subscribe', async (req, res) => {
  let connection;
  let emailSaved = false;
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    console.log(`Processing subscription request for email: ${email}`);
    connection = await pool.getConnection();

    // Check if email already exists
    const [existingSubscribers] = await connection.query(
      'SELECT * FROM subscribers WHERE email = ?',
      [email]
    );

    if (existingSubscribers.length > 0) {
      const subscriber = existingSubscribers[0];

      if (subscriber.is_active) {
        console.log(`Email ${email} is already subscribed`);
        connection.release();
        return res.json({
          success: true,
          message: 'You are already subscribed to our newsletter!'
        });
      } else {
        // Reactivate subscription
        const token = generateSubscriptionToken();
        await connection.query(
          'UPDATE subscribers SET is_active = TRUE, subscription_token = ?, updated_at = NOW() WHERE email = ?',
          [token, email]
        );
        connection.release();
        emailSaved = true;

        // Send welcome email
        try {
          const welcomeOk = await sendWelcomeEmail(email, token);
          await sendNewSubscriberNotification(email);
          setTimeout(async () => {
            try {
              const sent = await sendThisWeeksNewsletterToSubscriber(email, token);
              if (!sent) {
                console.error(`❌ Initial newsletter send returned false for ${email}`);
              }
            } catch (e) {
              console.error(`❌ Initial newsletter send failed for ${email}:`, e);
            }
          }, 1500);
          if (!welcomeOk) {
            setTimeout(async () => {
              try {
                await sendWelcomeEmail(email, token);
              } catch { }
            }, 3000);
          }
        } catch (emailError) {
          console.error(`Error sending emails for reactivation: ${emailError.message}`);
          // We'll still return success since the DB was updated
        }

        return res.json({
          success: true,
          message: 'Successfully resubscribed to our newsletter!'
        });
      }
    }

    // Create new subscription
    const subscriptionToken = generateSubscriptionToken();

    await connection.query(
      'INSERT INTO subscribers (email, subscription_token, is_active) VALUES (?, ?, ?)',
      [email, subscriptionToken, true]
    );

    connection.release();
    emailSaved = true;

    // Send welcome email to subscriber with retry mechanism
    let emailSent = false;
    try {
      console.log(`Sending confirmation email to: ${email}`);
      const ok = await sendWelcomeEmail(email, subscriptionToken);
      if (ok) {
        console.log(`Confirmation email sent successfully to: ${email}`);
        emailSent = true;
      } else {
        console.error(`Confirmation email returned false for: ${email}`);
      }
    } catch (emailError) {
      console.error(`Failed to send confirmation email to ${email}:`, emailError);
    }

    if (!emailSent) {
      setTimeout(async () => {
        try {
          const ok = await sendWelcomeEmail(email, subscriptionToken);
          if (ok) console.log(`Retry: Confirmation email sent successfully to: ${email}`);
        } catch (retryError) {
          console.error(`Retry failed for confirmation email to ${email}:`, retryError);
        }
      }, 3000);
    }

    // Send notification to admin with retry mechanism
    try {
      console.log(`Sending notification email to admin`);
      await sendNewSubscriberNotification(email);
      console.log(`Admin notification email sent successfully`);
    } catch (emailError) {
      console.error(`Failed to send admin notification:`, emailError);
      // Retry once after a short delay
      setTimeout(async () => {
        try {
          await sendNewSubscriberNotification(email);
          console.log(`Retry: Admin notification email sent successfully`);
        } catch (retryError) {
          console.error(`Retry failed for admin notification:`, retryError);
        }
      }, 3000);
    }

    setTimeout(async () => {
      try {
        const sent = await sendThisWeeksNewsletterToSubscriber(email, subscriptionToken);
        if (!sent) {
          console.error(`❌ Initial newsletter send returned false for ${email}`);
        }
      } catch (e) {
        console.error(`❌ Initial newsletter send failed for ${email}:`, e);
      }
    }, 1500);

    // Always return success if the email was saved to the database
    res.json({
      success: true,
      message: emailSent
        ? 'Thank you for subscribing to our newsletter! Please check your email for confirmation.'
        : 'Thank you for subscribing to our newsletter! You have been added to our mailing list.'
    });
  } catch (error) {
    console.error('❌ Subscription error:', error);
    if (connection) connection.release();

    // If we already saved the email to the database but encountered other errors
    if (emailSaved) {
      return res.json({
        success: true,
        message: 'Thank you for subscribing to our newsletter! You have been added to our mailing list.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Subscription failed. Please try again.'
    });
  }
});

// Unsubscribe from newsletter endpoint
app.post('/api/unsubscribe', async (req, res) => {
  let connection;
  try {
    const { token, email } = req.body;

    if (!token && !email) {
      return res.status(400).json({
        success: false,
        message: 'Unsubscribe token or email is required'
      });
    }

    console.log(`🔄 Processing unsubscription request: ${token ? 'Using token' : `For email: ${email}`}`);

    // Set a timeout for database operations
    const getConnectionWithTimeout = async (timeout = 15000) => {
      return new Promise(async (resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Database connection timed out'));
        }, timeout);

        try {
          const conn = await pool.getConnection();
          clearTimeout(timer);
          resolve(conn);
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    };

    // Get connection with timeout
    connection = await getConnectionWithTimeout();
    console.log('✅ Database connection established');

    let subscriber;

    if (token) {
      // Unsubscribe by token (from email link)
      console.log(`🔍 Looking up subscriber by token: ${token.substring(0, 8)}...`);
      const [subscribers] = await connection.query(
        'SELECT * FROM subscribers WHERE subscription_token = ? AND is_active = TRUE',
        [token]
      );
      subscriber = subscribers[0];
    } else if (email) {
      // Unsubscribe by email (from unsubscribe page)
      console.log(`🔍 Looking up subscriber by email: ${email}`);
      const [subscribers] = await connection.query(
        'SELECT * FROM subscribers WHERE email = ? AND is_active = TRUE',
        [email]
      );
      subscriber = subscribers[0];
    }

    if (!subscriber) {
      console.log(`⚠️ No active subscription found for ${token ? 'token' : email}`);
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or already unsubscribed'
      });
    }

    console.log(`✅ Found active subscription for: ${subscriber.email}`);

    // Deactivate subscription with transaction
    try {
      await connection.beginTransaction();

      console.log(`🔄 Deactivating subscription for: ${subscriber.email}`);
      await connection.query(
        'UPDATE subscribers SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [subscriber.id]
      );

      await connection.commit();
      console.log(`✅ Successfully deactivated subscription for: ${subscriber.email}`);
    } catch (transactionError) {
      console.error('❌ Transaction error:', transactionError);
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    // Send unsubscribe confirmation email
    console.log(`📧 Sending unsubscribe confirmation email to: ${subscriber.email}`);
    sendUnsubscribeConfirmation(subscriber.email)
      .then(success => {
        if (success) {
          console.log(`✅ Unsubscribe confirmation email sent to: ${subscriber.email}`);
        } else {
          console.error(`❌ Failed to send unsubscribe confirmation to: ${subscriber.email}`);
        }
      })
      .catch(emailError => {
        console.error(`❌ Error sending unsubscribe confirmation to ${subscriber.email}:`, emailError);
      });

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter.'
    });
  } catch (error) {
    console.error('❌ Unsubscribe error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Unsubscribe failed. Please try again later.'
    });
  }
});

// Get subscription status endpoint
app.get('/api/subscription-status', async (req, res) => {
  let connection;
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    connection = await pool.getConnection();

    const [subscribers] = await connection.query(
      'SELECT is_active FROM subscribers WHERE email = ?',
      [email]
    );

    connection.release();

    const isSubscribed = subscribers.length > 0 && subscribers[0].is_active;

    res.json({
      success: true,
      isSubscribed
    });
  } catch (error) {
    console.error('❌ Subscription status error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status'
    });
  }
});

// Get subscriber count endpoint
// Get all subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM subscribers');
    console.log('Subscribers data:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

app.get('/api/subscribers/count', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [totalResult] = await connection.query(
      'SELECT COUNT(*) as total FROM subscribers WHERE is_active = TRUE'
    );

    const [todayResult] = await connection.query(
      'SELECT COUNT(*) as today FROM subscribers WHERE DATE(created_at) = CURDATE() AND is_active = TRUE'
    );

    connection.release();

    res.json({
      success: true,
      total: totalResult[0].total,
      today: todayResult[0].today
    });
  } catch (error) {
    console.error('❌ Subscriber count error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriber count'
    });
  }
});

// ==================== BLOG MANAGEMENT SYSTEM ====================

// 1. Ensure Blogs Table Exists (Call this function once when server starts)
async function ensureBlogsSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE IF NOT EXISTS blogs (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        excerpt TEXT NULL,
        content LONGTEXT NOT NULL,
        category VARCHAR(100) NULL,
        author VARCHAR(100) DEFAULT 'Admin',
        image_url VARCHAR(500) NULL,
        is_published BOOLEAN DEFAULT TRUE,
        view_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );

    // Backward-compat: older DBs may not have the slug column yet.
    // If missing, add it and backfill from title.
    const [slugCols] = await connection.query('SHOW COLUMNS FROM blogs LIKE "slug"');
    if (!slugCols || slugCols.length === 0) {
      console.log('⚠️ Adding missing slug column to blogs table and backfilling...');
      await connection.query('ALTER TABLE blogs ADD COLUMN slug VARCHAR(255) NULL');

      const [rows] = await connection.query('SELECT id, title FROM blogs');
      for (const row of rows || []) {
        const base = slugify(row.title || `blog-${row.id}`);
        const slug = base || `blog-${row.id}`;
        await connection.query('UPDATE blogs SET slug = ? WHERE id = ?', [slug, row.id]);
      }
    }

    // Ensure slug column has an index for fast lookup
    try {
      await connection.query('ALTER TABLE blogs ADD UNIQUE INDEX idx_blogs_slug (slug)');
    } catch (e) {
      // Ignore if index already exists
    }

    // Add priority blog topics if table is empty
    const [blogCount] = await connection.query('SELECT COUNT(*) as count FROM blogs');
    if (blogCount[0].count === 0) {
      const priorityBlogs = [
        {
          title: 'Best Laser Engraving Gift Ideas in Finland',
          excerpt: 'Discover the most unique and thoughtful personalized gift ideas using professional laser engraving technology in Finland.',
          content: '<p>Looking for the perfect gift? <strong>Laser engraving Finland</strong> offers a unique way to personalize gifts for your loved ones. From <strong>custom engraved wood</strong> frames to <strong>personalized leather wallets</strong>, the possibilities are endless. At Yokebud craft, we specialize in creating one-of-a-kind treasures that are both beautiful and durable. Learn more about our <a href="/?category=laser-engraving">laser engraving services</a> today.</p>',
          category: 'Gift Ideas',
          slug: 'best-laser-engraving-gift-ideas-finland'
        },
        {
          title: 'How Laser Engraving Works for Custom Gifts',
          excerpt: 'A deep dive into the technology behind precision laser engraving and why it is the best choice for high-quality custom gifts.',
          content: '<p>Ever wondered how we achieve such incredible detail on our products? Our <strong>laser cutting services</strong> and engraving systems use high-powered beams of light to precisely mark materials. This process ensures that every <strong>custom personalized gift</strong> we create is a masterpiece of precision. Whether it is metal, wood, or stone, laser engraving provides a permanent finish that never fades. Explore our <a href="/?category=laser-engraving">engraved gifts collection</a>.</p>',
          category: 'Technology',
          slug: 'how-laser-engraving-works-for-custom-gifts'
        },
        {
          title: 'Laser Cutting vs Traditional Crafting',
          excerpt: 'Comparing modern laser cutting technology with traditional handcrafted methods for creating custom wood and leather products.',
          content: '<p>While traditional crafting methods have their charm, <strong>laser cutting Helsinki</strong> brings a level of precision and consistency that is hard to match. By combining <strong>handmade in Finland</strong> quality with modern laser technology, Yokebud craft delivers the best of both worlds. Our <strong>laser-cut wooden craft</strong> showcase intricate designs that are durable and perfectly finished. Check out our <a href="/?category=laser-cutting-products">laser cutting products</a>.</p>',
          category: 'craftmanship',
          slug: 'laser-cutting-vs-traditional-crafting'
        },
        {
          title: 'Personalized Engraved Gift Trends Finland',
          excerpt: 'Stay up to date with the latest trends in personalized and engraved gifts in the Finnish market for 2026.',
          content: '<p>Personalization is more popular than ever in Finland. The latest trends show a high demand for <strong>custom engraved gifts</strong> that focus on sustainability and local craftmanship. From <strong>engraved stone decor</strong> to <strong>personalized apparel</strong>, Finnish consumers value quality and uniqueness. Stay ahead of the curve with Yokebud craft, your hub for <strong>laser engraving Finland</strong>. Discover our <a href="/?category=laser-engraving">latest arrivals</a>.</p>',
          category: 'Trends',
          slug: 'personalized-engraved-gift-trends-finland'
        }
      ];

      for (const b of priorityBlogs) {
        await connection.query(
          'INSERT INTO blogs (title, excerpt, content, category, slug, author, is_published) VALUES (?, ?, ?, ?, ?, "Admin", TRUE)',
          [b.title, b.excerpt, b.content, b.category, b.slug]
        );
      }
      console.log('✅ Priority blog topics added.');
    }

    console.log('✅ Blogs table checked/created successfully');
  } catch (e) {
    console.warn('⚠️ Blogs schema check failed:', e.message);
  } finally {
    if (connection) connection.release();
  }
}

// Initialize the table
ensureBlogsSchema();

// 2. Get all blogs (Public Route)
app.get('/api/blogs', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [blogs] = await connection.query(
      'SELECT * FROM blogs ORDER BY created_at DESC'
    );
    res.status(200).json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  } finally {
    if (connection) connection.release();
  }
});

// 3. Get single blog by ID (Public Route)
app.get('/api/blogs/:slug', async (req, res) => {
  let connection;
  try {
    const { slug } = req.params;
    connection = await pool.getConnection();

    // Increment view count
    await connection.query('UPDATE blogs SET view_count = view_count + 1 WHERE slug = ?', [slug]);

    const [blogs] = await connection.query(
      'SELECT * FROM blogs WHERE slug = ?',
      [slug]
    );

    if (blogs.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.status(200).json(blogs[0]);
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ error: 'Failed to fetch blog' });
  } finally {
    if (connection) connection.release();
  }
});

// 4. Create new blog (Admin Only)
app.post('/api/blogs', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { title, excerpt, content, category, author, image_url } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    let imageUrl = image_url || null;

    // Handle image upload to Cloudinary if a file is sent
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      try {
        const uploadResult = await cloudinary.uploader.upload(imageFile.tempFilePath, {
          folder: 'yokebud_blogs',
          transformation: [
            { width: 1200, height: 675, crop: 'fill', quality: 'auto:good' }
          ]
        });

        imageUrl = uploadResult.secure_url;

        if (fs.existsSync(imageFile.tempFilePath)) {
          fs.unlinkSync(imageFile.tempFilePath);
        }
      } catch (uploadError) {
        console.error('Error uploading blog image:', uploadError);
      }
    }

    connection = await pool.getConnection();
    const slug = await ensureUniqueSlug(connection, slugify(title), 'blogs');

    const [result] = await connection.query(
      'INSERT INTO blogs (title, slug, excerpt, content, category, author, image_url, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)',
      [title, slug, excerpt || '', content, category || null, author || 'Admin', imageUrl]
    );

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      blogId: result.insertId
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({ message: 'Failed to create blog' });
  } finally {
    if (connection) connection.release();
  }
});

// 5. Update blog (Admin Only)
app.put('/api/blogs/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { title, excerpt, content, category, author, image_url } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    connection = await pool.getConnection();

    // Get current blog data to check for existing image
    const [currentBlog] = await connection.query('SELECT image_url FROM blogs WHERE id = ?', [id]);

    if (currentBlog.length === 0) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    let imageUrl = (typeof image_url === 'string' && image_url.trim())
      ? image_url
      : currentBlog[0].image_url;

    // Handle new image upload
    if (req.files && req.files.image) {
      const imageFile = req.files.image;

      try {
        if (imageUrl && imageUrl.includes('cloudinary')) {
          const parts = imageUrl.split('/');
          const filename = parts.pop();
          const publicId = filename.split('.')[0];
        }

        const uploadResult = await cloudinary.uploader.upload(imageFile.tempFilePath, {
          folder: 'yokebud_blogs',
          transformation: [
            { width: 1200, height: 675, crop: 'fill', quality: 'auto:good' }
          ]
        });

        imageUrl = uploadResult.secure_url;

        if (fs.existsSync(imageFile.tempFilePath)) {
          fs.unlinkSync(imageFile.tempFilePath);
        }
      } catch (uploadError) {
        console.error('Error uploading blog image:', uploadError);
      }
    }

    const slug = await ensureUniqueSlug(connection, slugify(title), 'blogs');

    await connection.query(
      'UPDATE blogs SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, author = ?, image_url = ?, updated_at = NOW() WHERE id = ?',
      [title, slug, excerpt || '', content, category || null, author || 'Admin', imageUrl, id]
    );

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ message: 'Failed to update blog' });
  } finally {
    if (connection) connection.release();
  }
});

// 6. Delete blog (Admin Only)
app.delete('/api/blogs/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Get blog data to delete image
    const [blog] = await connection.query('SELECT image_url FROM blogs WHERE id = ?', [id]);

    if (blog.length === 0) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Optional: Delete image from Cloudinary logic here if needed

    // Delete blog from database
    await connection.query('DELETE FROM blogs WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ message: 'Failed to delete blog' });
  } finally {
    if (connection) connection.release();
  }
});

// ==================== WEEKLY NEWSLETTER CRON JOB ====================

const normalizeNewsletterProducts = (productList) => {
  return (productList || []).map(product => {
    let photos = [];
    try {
      photos = typeof product.images === 'string'
        ? JSON.parse(product.images)
        : product.images || typeof product.product_photos === 'string'
          ? JSON.parse(product.product_photos)
          : product.product_photos || [];
    } catch (e) {
      photos = [];
    }

    return {
      ...product,
      firstImage: photos.length > 0 ? photos[0] : null,
      min_price: product.discounted_price || product.price,
      max_price: product.price
    };
  });
};

const getWeeklyNewsletterCollections = async (connection) => {
  const [discountedProducts] = await connection.query(`
      SELECT p.*,
             JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) as firstImage
      FROM products p
      WHERE p.stock > 0
        AND p.status = 'active'
        AND p.discounted_price IS NOT NULL
        AND p.discounted_price < p.price
      ORDER BY p.updated_at DESC, p.created_at DESC
      LIMIT 4
    `);

  const discountedIds = discountedProducts.map(product => Number(product.id)).filter(Boolean);
  let latestProducts = [];

  if (discountedIds.length > 0) {
    const placeholders = discountedIds.map(() => '?').join(', ');
    const [latestWithoutDiscounts] = await connection.query(
      `
        SELECT p.*,
               JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) as firstImage
        FROM products p
        WHERE p.stock > 0
          AND p.status = 'active'
          AND p.id NOT IN (${placeholders})
        ORDER BY p.created_at DESC
        LIMIT 4
      `,
      discountedIds
    );
    latestProducts = latestWithoutDiscounts;
  } else {
    const [latestOnly] = await connection.query(`
        SELECT p.*,
               JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) as firstImage
        FROM products p
        WHERE p.stock > 0
          AND p.status = 'active'
        ORDER BY p.created_at DESC
        LIMIT 4
      `);
    latestProducts = latestOnly;
  }

  return {
    newArrivals: normalizeNewsletterProducts(latestProducts),
    discounted: normalizeNewsletterProducts(discountedProducts)
  };
};

const fetchWeeklyNewsletterCollections = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    return await getWeeklyNewsletterCollections(connection);
  } finally {
    if (connection) connection.release();
  }
};

const sendWeeklyNewsletters = async () => {
  let connection;
  try {
    console.log('🚀 Starting weekly newsletter distribution...');

    connection = await pool.getConnection();

    // Get all active subscribers
    const [subscribers] = await connection.query(
      'SELECT email, subscription_token FROM subscribers WHERE is_active = TRUE'
    );

    if (subscribers.length === 0) {
      console.log('ℹ️ No active subscribers found for weekly newsletter');
      connection.release();
      return;
    }

    const collections = await getWeeklyNewsletterCollections(connection);
    const hasAny = (collections.newArrivals && collections.newArrivals.length > 0) || (collections.discounted && collections.discounted.length > 0);
    if (!hasAny) {
      console.log('ℹ️ No new or discounted products found for weekly newsletter');
      connection.release();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Send newsletter to each subscriber
    for (const subscriber of subscribers) {
      try {
        const success = await sendWeeklyNewsletter(subscriber, collections);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }

        // Add delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to send newsletter to ${subscriber.email}:`, error);
        errorCount++;
      }
    }

    connection.release();

    console.log(`✅ Weekly newsletter distribution completed. Success: ${successCount}, Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Weekly newsletter distribution error:', error);
    if (connection) connection.release();
  }
};

// Schedule weekly newsletter (every Monday at 10:00 AM)
const scheduleWeeklyNewsletter = () => {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(10, 0, 0, 0);
  const isMonday = now.getDay() === 1;
  if (!(isMonday && now.getTime() < nextRun.getTime())) {
    const daysUntilMonday = (1 + 7 - now.getDay()) % 7;
    nextRun.setDate(now.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
    nextRun.setHours(10, 0, 0, 0);
  }

  const timeUntilNextRun = Math.max(0, nextRun.getTime() - now.getTime());

  console.log(`📅 Weekly newsletter scheduled for: ${nextRun}`);

  // Schedule first run
  setTimeout(() => {
    sendWeeklyNewsletters();
    // Set up recurring weekly interval
    setInterval(sendWeeklyNewsletters, 7 * 24 * 60 * 60 * 1000);
  }, timeUntilNextRun);
};

// Start the scheduler when server starts
scheduleWeeklyNewsletter();

// Manual trigger endpoint for testing (remove in production)
app.post('/api/send-test-newsletter', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not allowed in production' });
  }

  try {
    await sendWeeklyNewsletters();
    res.json({ success: true, message: 'Test newsletter sent' });
  } catch (error) {
    console.error('❌ Test newsletter error:', error);
    res.status(500).json({ success: false, message: 'Test newsletter failed' });
  }
});

// Get all subscribers (admin only)
app.get('/api/admin/subscribers', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [subscribers] = await connection.query(
      'SELECT email, is_active, created_at, updated_at FROM subscribers ORDER BY created_at DESC'
    );

    connection.release();

    res.json({
      success: true,
      subscribers
    });
  } catch (error) {
    console.error('❌ Get subscribers error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to get subscribers'
    });
  }
});
// ==================== KEEP-ALIVE MECHANISM ====================
// This will help keep the Render instance awake by pinging itself
const keepAlive = () => {
  const https = require('https');

  if (process.env.RENDER_EXTERNAL_URL) {
    console.log('Setting up keep-alive ping for:', process.env.RENDER_EXTERNAL_URL);

    setInterval(() => {
      https.get(`${process.env.RENDER_EXTERNAL_URL}/health`, (res) => {
        console.log(`Keep-alive ping successful - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.log('Keep-alive ping error:', err.message);
      });
    }, 14 * 60 * 1000); // Ping every 14 minutes (Render sleeps after 15 minutes of inactivity)
  }
};

// ==================== ERROR HANDLING MIDDLEWARE ====================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.get('/api/geo', async (req, res) => {
  try {
    const response = await axios.get('https://ipapi.co/json/');
    const data = response && response.data ? response.data : {};
    res.json(data);
  } catch (e) {
    res.json({ currency: 'EUR', country_name: 'Finland' });
  }
});

// ==================== FRONTEND STATIC (PRODUCTION) ====================
// Public dynamic sitemap endpoint so Hostinger frontend can delegate XML to this API.
// This always regenerates from DB and streams the canonical sitemap.xml.
app.get('/sitemap.xml', async (req, res) => {
  try {
    const result = await regenerateSitemap();
    const xml = fs.readFileSync(result.path, 'utf8');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Dynamic sitemap endpoint error:', error);
    res.status(500).send('Sitemap generation failed');
  }
});

// If the React production build exists, serve it with strict cache headers:
// - HTML (index.html): no-cache, no-store, must-revalidate
// - Hashed assets under /assets: public, max-age=31536000, immutable
// If the React production build exists, serve it with strict cache headers
try {
  const distDir = path.resolve(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, {
      index: false,
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          return;
        }
        if (filePath.includes(path.sep + 'assets' + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    }));

    // robots.txt
    app.get('/robots.txt', (req, res) => {
      res.type('text/plain');
      const robotsTxt = `User-agent: *
Allow: /
Allow: /shop
Allow: /products/
Allow: /blogs/
Allow: /about
Allow: /contact
Allow: /policy
Allow: /shipping
Allow: /return

# Block Admin and Private Routes
Disallow: /admin/
Disallow: /api/
Disallow: /Checkout
Disallow: /UserProfile
Disallow: /cart
Disallow: /MessagesPage
Disallow: /UnsubscribePage
Disallow: /forgot-password
Disallow: /signup
Disallow: /*?*

# Sitemap
Sitemap: https://www.yokebud.fi/sitemap.xml
`;
      res.send(robotsTxt);
    });

    // SPA fallback with Dynamic SEO for product pages
// SPA fallback with Dynamic SEO for product pages
app.get([
  '/',
  /^\/(?!api|uploads|assets|.*sitemap.*\.xml|sitemap\.xsl|robots\.txt|health|debug\/email-preview|.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|xsl)$).*/
], async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const indexPath = path.join(distDir, 'index.html');

  // Product pages: inject server-rendered Open Graph / Twitter Card meta for social crawlers
  if (productSocialSeo.extractProductIdFromRequestPath(req.path)) {
    try {
      const baseHtml = fs.readFileSync(indexPath, 'utf8');
      const html = await productSocialSeo.buildProductSocialHtml(pool, req.path, baseHtml);
      if (html) {
        return res.send(html);
      }
    } catch (err) {
      console.error('Error injecting product social meta tags:', err);
    }
  }

  // Default fallback
  res.sendFile(indexPath);
});
  }
} catch (_) { /* ignore */ }

// ==================== SEO CONTENT MANAGEMENT ====================

// Get SEO content by page name
app.get('/api/seo/:pageName', async (req, res) => {
  let connection;
  try {
    const { pageName } = req.params;
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM seo_content WHERE page_name = ?',
      [pageName]
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'SEO content not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch SEO content: ' + error.message });
  }
});

// Update SEO content (Admin only)
app.post('/api/seo/:pageName', requireAdminAuth, async (req, res) => {
  console.log('--- UPDATE SEO CONTENT ---');
  console.log('Request Body:', req.body);
  let connection;
  try {
    const { pageName } = req.params;
    const { title, content } = req.body;

    if (!title && !content) {
      return res.status(400).json({ success: false, message: 'Title or content is required.' });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO seo_content (page_name, title, content) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), updated_at = NOW()`,
      [pageName, title, content]
    );
    connection.release();

    if (result.affectedRows > 0) {
      console.log(`SEO content for '${pageName}' page updated successfully.`);
      res.json({ success: true, message: 'SEO content updated successfully' });
    } else {
      throw new Error('Failed to update database.');
    }

  } catch (error) {
    console.error('Error saving SEO content:', error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to update SEO content: ' + error.message });
  }
});

// ==================== SITEMAP MANAGEMENT API ====================

// Get all sitemap entries (Public for generation script)
app.get('/api/sitemap/entries', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM sitemap_entries WHERE is_active = TRUE');
    connection.release();
    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch sitemap entries' });
  }
});

// Get all sitemap entries including inactive ones (Public - matches WHERE 1)
app.get('/api/sitemap/entries/all', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id, path, priority, changefreq, type, is_active, created_at, updated_at FROM sitemap_entries WHERE 1');
    connection.release();
    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch all sitemap entries' });
  }
});

// Get all sitemap entries (Admin Protected)
app.get('/api/admin/sitemap', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM sitemap_entries ORDER BY type, path');
    connection.release();
    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch sitemap entries: ' + error.message });
  }
});

// Add new sitemap entry
app.post('/api/admin/sitemap', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { path, priority, changefreq, type } = req.body;
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO sitemap_entries (path, priority, changefreq, type) VALUES (?, ?, ?, ?)',
      [path, priority || '0.6', changefreq || 'weekly', type || 'static']
    );

    // Record revision
    await connection.query(
      'INSERT INTO sitemap_revisions (action, entry_id, new_data, admin_id) VALUES (?, ?, ?, ?)',
      ['ADD', result.insertId, JSON.stringify(req.body), ADMIN_ID]
    );

    await connection.commit();
    connection.release();

    // Trigger regeneration
    regenerateSitemap().catch(err => console.error('Regeneration error after ADD:', err));

    res.json({ success: true, message: 'Sitemap entry added successfully', id: result.insertId });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to add sitemap entry: ' + error.message });
  }
});

// Add or Sync sitemap entries (Multiple)
app.post('/api/admin/sitemap/sync', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { entries } = req.body;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Load existing product entries and product exclusions so that:
    // - Editing a product URL in the admin keeps the edited URL as the only one
    // - Deleting / excluding a product URL prevents it from being recreated by sync
    const [existingProductEntries] = await connection.query(
      'SELECT id, path, priority, changefreq, type, is_active FROM sitemap_entries WHERE type = "product"'
    );
    const [productExclusions] = await connection.query(
      'SELECT path FROM sitemap_entries WHERE type = "product_exclude"'
    );

    const existingByProductId = {};
    for (const row of existingProductEntries) {
      const pid = getProductIdFromPath(row.path);
      if (pid) {
        existingByProductId[pid] = row;
      }
    }

    const excludedProductIds = new Set();
    for (const row of productExclusions) {
      const pid = getProductIdFromPath(row.path);
      if (pid) {
        excludedProductIds.add(pid);
      }
    }

    for (const entry of entries) {
      const pid = getProductIdFromPath(entry.path);

      // Skip any product that has been explicitly excluded
      if (pid && excludedProductIds.has(pid)) {
        continue;
      }

      // If a product sitemap entry already exists for this productId,
      // update its metadata but KEEP the existing custom path.
      if (pid && existingByProductId[pid]) {
        const current = existingByProductId[pid];
        await connection.query(
          'UPDATE sitemap_entries SET priority = ?, changefreq = ?, type = ?, is_active = COALESCE(is_active, 1), updated_at = NOW() WHERE id = ?',
          [
            entry.priority || current.priority || '0.8',
            entry.changefreq || current.changefreq || 'weekly',
            'product',
            current.id
          ]
        );
        continue;
      }

      // Default behaviour: upsert by path for non-product / new product URLs
      await connection.query(
        `INSERT INTO sitemap_entries (path, priority, changefreq, type) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE priority = VALUES(priority), changefreq = VALUES(changefreq), type = VALUES(type)`,
        [entry.path, entry.priority || '0.8', entry.changefreq || 'weekly', entry.type || 'product']
      );
    }

    await connection.commit();
    connection.release();
    regenerateSitemap().catch(err => console.error('Regeneration error after SYNC:', err));
    res.json({ success: true, message: 'Sitemap synced and updated successfully' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to sync sitemap: ' + error.message });
  }
});

// Update sitemap entry
app.put('/api/admin/sitemap/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { path: newPath, priority, changefreq, type, is_active } = req.body;
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Get old data
    const [oldRows] = await connection.query('SELECT * FROM sitemap_entries WHERE id = ?', [id]);
    if (oldRows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    const oldEntry = oldRows[0];

    // Record redirect if path changed
    if (newPath && oldEntry.path !== newPath) {
      try {
        // First delete any existing redirect from old_path to avoid duplicates
        await connection.query('DELETE FROM url_redirects WHERE old_path = ?', [oldEntry.path]);
        // Insert new redirect
        await connection.query(
          'INSERT INTO url_redirects (old_path, new_path) VALUES (?, ?) ON DUPLICATE KEY UPDATE new_path = VALUES(new_path)',
          [oldEntry.path, newPath]
        );
        // Also update any existing redirects that point to the old path
        await connection.query('UPDATE url_redirects SET new_path = ? WHERE new_path = ?', [newPath, oldEntry.path]);
      } catch (redirectErr) {
        console.warn('Failed to record URL redirect:', redirectErr.message);
      }
    }

    await connection.query(
      'UPDATE sitemap_entries SET path = ?, priority = ?, changefreq = ?, type = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [newPath, priority, changefreq, type, is_active, id]
    );

    // If it's a product URL, update the slug in the products table
    const oldProductId = getProductIdFromPath(oldEntry.path);
    const newProductId = getProductIdFromPath(newPath);

    if (oldProductId && newProductId && oldProductId === newProductId && oldEntry.path !== newPath) {
      const newSlug = newPath.split('/').pop();
      if (newSlug) {
        await connection.query(
          'UPDATE products SET slug = ? WHERE id = ?',
          [newSlug, newProductId]
        );
      }
    }

    // Record revision
    await connection.query(
      'INSERT INTO sitemap_revisions (action, entry_id, old_data, new_data, admin_id) VALUES (?, ?, ?, ?, ?)',
      ['UPDATE', id, JSON.stringify(oldEntry), JSON.stringify(req.body), ADMIN_ID]
    );

    await connection.commit();
    connection.release();

    // Trigger regeneration
    regenerateSitemap().catch(err => console.error('Regeneration error after UPDATE:', err));

    res.json({ success: true, message: 'Sitemap entry updated and product slug synced successfully' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to update sitemap entry: ' + error.message });
  }
});

// Update sitemap entry with URL synchronization
app.put('/api/admin/sitemap/:id/sync', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { path, priority, changefreq, type, is_active, syncRelated = true } = req.body;
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Get old data
    const [oldRows] = await connection.query('SELECT * FROM sitemap_entries WHERE id = ?', [id]);
    if (oldRows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const oldEntry = oldRows[0];
    const oldPath = oldEntry.path;
    const newPath = path;

    // Update sitemap entry
    await connection.query(
      'UPDATE sitemap_entries SET path = ?, priority = ?, changefreq = ?, type = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [path, priority, changefreq, type, is_active, id]
    );

    let syncResults = [];

    // If URL changed and sync is requested, update related entries
    if (syncRelated && oldPath !== newPath) {
      // Helper to extract ID from URL patterns
      const extractIdFromPath = (pathStr, prefix) => {
        const match = pathStr.match(new RegExp(`^${prefix}/(\\d+)`));
        return match ? parseInt(match[1]) : null;
      };

      // Helper to generate new path with same ID but new structure
      const generateNewPath = (oldPath, newPath, id) => {
        const oldParts = oldPath.split('/');
        const newParts = newPath.split('/');

        // Keep the ID and any trailing slug parts
        const idIndex = oldParts.findIndex(part => part === id.toString());
        if (idIndex !== -1) {
          return newParts.slice(0, idIndex + 1).concat(oldParts.slice(idIndex + 1)).join('/');
        }
        return newPath;
      };

      // Update related sitemap entries based on type
      if (oldEntry.type === 'product' || oldPath.startsWith('/products/')) {
        const productId = extractIdFromPath(oldPath, '/products');
        if (productId) {
          // Find all related product URLs
          const [relatedEntries] = await connection.query(
            'SELECT * FROM sitemap_entries WHERE path LIKE ? AND id != ?',
            [`/products/${productId}/%`, id]
          );

          for (const entry of relatedEntries) {
            const newRelatedPath = generateNewPath(entry.path, newPath, productId);
            await connection.query(
              'UPDATE sitemap_entries SET path = ?, updated_at = NOW() WHERE id = ?',
              [newRelatedPath, entry.id]
            );
            syncResults.push({
              type: 'product',
              id: entry.id,
              oldPath: entry.path,
              newPath: newRelatedPath
            });
          }
        }
      }

      if (oldEntry.type === 'blog' || oldPath.startsWith('/blogs/')) {
        const blogId = extractIdFromPath(oldPath, '/blogs');
        if (blogId) {
          // Find all related blog URLs with the same blog ID (more specific pattern)
          const [relatedEntries] = await connection.query(
            'SELECT * FROM sitemap_entries WHERE path LIKE ? AND id != ? AND type = ?',
            [`/blogs/${blogId}/%`, id, 'blog']
          );

          for (const entry of relatedEntries) {
            const newRelatedPath = generateNewPath(entry.path, newPath, blogId);
            await connection.query(
              'UPDATE sitemap_entries SET path = ?, updated_at = NOW() WHERE id = ?',
              [newRelatedPath, entry.id]
            );
            syncResults.push({
              type: 'blog',
              id: entry.id,
              oldPath: entry.path,
              newPath: newRelatedPath
            });
          }
        }
      }

      if (oldEntry.type === 'category' || oldPath.startsWith('/category/')) {
        const categoryId = extractIdFromPath(oldPath, '/category');
        if (categoryId) {
          // Find all related category URLs
          const [relatedEntries] = await connection.query(
            'SELECT * FROM sitemap_entries WHERE path LIKE ? AND id != ?',
            [`/category/${categoryId}%`, id]
          );

          for (const entry of relatedEntries) {
            const newRelatedPath = generateNewPath(entry.path, newPath, categoryId);
            await connection.query(
              'UPDATE sitemap_entries SET path = ?, updated_at = NOW() WHERE id = ?',
              [newRelatedPath, entry.id]
            );
            syncResults.push({
              type: 'category',
              id: entry.id,
              oldPath: entry.path,
              newPath: newRelatedPath
            });
          }
        }
      }
    }

    // Record revision
    await connection.query(
      'INSERT INTO sitemap_revisions (action, entry_id, old_data, new_data, admin_id) VALUES (?, ?, ?, ?, ?)',
      ['UPDATE_SYNC', id, JSON.stringify(oldEntry), JSON.stringify({ ...req.body, syncResults }), ADMIN_ID]
    );

    await connection.commit();
    connection.release();

    // Emit WebSocket event for real-time client updates
    io.emit('sitemap_url_updated', {
      type: 'url_sync',
      entryId: id,
      oldPath,
      newPath,
      syncResults,
      timestamp: new Date().toISOString()
    });

    // Trigger regeneration
    regenerateSitemap().catch(err => console.error('Regeneration error after UPDATE_SYNC:', err));

    res.json({
      success: true,
      message: 'Sitemap entry updated successfully with URL synchronization',
      syncResults: syncResults,
      syncedCount: syncResults.length
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to update sitemap entry: ' + error.message });
  }
});

// Delete sitemap entry
app.delete('/api/admin/sitemap/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Get old data
    const [oldRows] = await connection.query('SELECT * FROM sitemap_entries WHERE id = ?', [id]);
    if (oldRows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const oldEntry = oldRows[0];

    // If this was a product URL, remember the productId as "excluded"
    // so that future "Sync All Products" actions don't recreate it.
    if (oldEntry.type === 'product') {
      const pid = getProductIdFromPath(oldEntry.path);
      if (pid) {
        const excludePath = `/products/${pid}/excluded`;
        await connection.query(
          `INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active)
           VALUES (?, '0.1', 'yearly', 'product_exclude', 1)
           ON DUPLICATE KEY UPDATE type = 'product_exclude'`,
          [excludePath]
        );
      }
    }

    await connection.query('DELETE FROM sitemap_entries WHERE id = ?', [id]);

    // Record revision
    await connection.query(
      'INSERT INTO sitemap_revisions (action, entry_id, old_data, admin_id) VALUES (?, ?, ?, ?)',
      ['DELETE', id, JSON.stringify(oldEntry), ADMIN_ID]
    );

    await connection.commit();
    connection.release();

    // Trigger regeneration
    regenerateSitemap().catch(err => console.error('Regeneration error after DELETE:', err));

    res.json({ success: true, message: 'Sitemap entry deleted successfully' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to delete sitemap entry: ' + error.message });
  }
});

// Import URLs from existing XML sitemap files into sitemap_entries
app.post('/api/admin/sitemap/import-xml', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const publicDir = path.join(__dirname, '..', 'client', 'public');
    const files = [
      'sitemap.xml',
      'page-sitemap.xml',
      'product-sitemap.xml',
      'category-sitemap.xml'
    ];

    const seenPaths = new Set();
    let importedCount = 0;

    const parseXmlUrls = (xmlContent) => {
      const urls = [];
      const urlRegex = /<url>([\s\S]*?)<\/url>/g;
      let match;
      while ((match = urlRegex.exec(xmlContent)) !== null) {
        const block = match[1];
        const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
        if (!locMatch) continue;
        const loc = locMatch[1].trim();
        let pathPart = loc;
        if (pathPart.startsWith(PUBLIC_SITE_URL)) {
          pathPart = pathPart.slice(PUBLIC_SITE_URL.length);
        }
        if (!pathPart.startsWith('/')) {
          pathPart = '/' + pathPart;
        }
        if (pathPart === '/')
          pathPart = '/';

        const priorityMatch = block.match(/<priority>([^<]+)<\/priority>/);
        const changefreqMatch = block.match(/<changefreq>([^<]+)<\/changefreq>/);
        const categoryMatch = block.match(/<category>([^<]+)<\/category>/);

        let type = 'static';
        const catText = (categoryMatch ? categoryMatch[1] : '').toLowerCase();
        if (catText.includes('product') || pathPart.startsWith('/products/')) {
          type = 'product';
        } else if (catText.includes('categor') || pathPart.includes('category=')) {
          type = 'category';
        }

        urls.push({
          path: pathPart,
          priority: priorityMatch ? priorityMatch[1].trim() : '0.6',
          changefreq: changefreqMatch ? changefreqMatch[1].trim() : 'weekly',
          type
        });
      }
      return urls;
    };

    for (const filename of files) {
      const fullPath = path.join(publicDir, filename);
      if (!fs.existsSync(fullPath)) continue;
      const xmlContent = fs.readFileSync(fullPath, 'utf8');
      const urls = parseXmlUrls(xmlContent);
      for (const u of urls) {
        if (seenPaths.has(u.path)) continue;
        seenPaths.add(u.path);
        await connection.query(
          `INSERT INTO sitemap_entries (path, priority, changefreq, type)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE priority = VALUES(priority), changefreq = VALUES(changefreq), type = VALUES(type)`,
          [u.path, u.priority, u.changefreq, u.type]
        );
        importedCount += 1;
      }
    }

    await connection.commit();
    connection.release();

    // Regenerate sitemap from the imported DB data
    regenerateSitemap().catch(err => console.error('Regeneration error after IMPORT XML:', err));

    res.json({
      success: true,
      message: 'Sitemap URLs imported from XML successfully',
      imported: importedCount
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to import sitemap from XML: ' + error.message });
  }
});

// Manual sitemap regeneration
app.post('/api/admin/sitemap/regenerate', requireAdminAuth, async (req, res) => {
  try {
    const result = await regenerateSitemap();
    res.json({ success: true, message: 'Sitemap regenerated successfully', ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sitemap regeneration failed: ' + error.message });
  }
});

// Sync XML files to database
app.post('/api/admin/sitemap/sync-xml', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Get all XML files in client/public directory
    const fs = require('fs');
    const path = require('path');
    const publicDir = path.join(__dirname, '..', 'client', 'public');
    const xmlFiles = fs.readdirSync(publicDir).filter(file => file.endsWith('-sitemap.xml') && file !== 'sitemap.xml');

    let totalSynced = 0;
    const baseUrl = process.env.PUBLIC_SITE_URL || 'https://www.yokebud.fi';

    for (const xmlFile of xmlFiles) {
      const xmlPath = path.join(publicDir, xmlFile);
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');

      // Extract URLs from XML
      const urlRegex = /<loc>(.*?)<\/loc>/g;
      const urls = [];
      let match;
      while ((match = urlRegex.exec(xmlContent)) !== null) {
        urls.push(match[1]);
      }

      // Extract other metadata
      const lastmodRegex = /<lastmod>(.*?)<\/lastmod>/g;
      const changefreqRegex = /<changefreq>(.*?)<\/changefreq>/g;
      const priorityRegex = /<priority>(.*?)<\/priority>/g;

      const lastmods = [];
      const changefreqs = [];
      const priorities = [];

      while ((match = lastmodRegex.exec(xmlContent)) !== null) {
        lastmods.push(match[1]);
      }
      while ((match = changefreqRegex.exec(xmlContent)) !== null) {
        changefreqs.push(match[1]);
      }
      while ((match = priorityRegex.exec(xmlContent)) !== null) {
        priorities.push(match[1]);
      }

      // Determine type from filename
      let type = 'static';
      if (xmlFile.includes('category')) type = 'category';
      else if (xmlFile.includes('product')) type = 'product';
      else if (xmlFile.includes('blog')) type = 'blog';
      else if (xmlFile.includes('page')) type = 'static';

      // Insert or update each URL in database
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        let path = url.startsWith(baseUrl) ? url.substring(baseUrl.length) : url;
        // Decode HTML entities
        path = path.replace(/&amp;/g, '&');

        const lastmod = lastmods[i] || new Date().toISOString().slice(0, 10);
        const changefreq = changefreqs[i] || 'weekly';
        const priority = priorities[i] || '0.6';

        // Check if entry already exists
        const [existing] = await connection.query(
          'SELECT id FROM sitemap_entries WHERE path = ?',
          [path]
        );

        if (existing.length === 0) {
          // Insert new entry
          const [result] = await connection.query(
            `INSERT INTO sitemap_entries (path, priority, changefreq, type, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, TRUE, ?, ?)`,
            [path, priority, changefreq, type, lastmod, lastmod]
          );

          // Log the action in revisions
          await connection.query(
            `INSERT INTO sitemap_revisions (entry_id, action, new_data, admin_id)
             VALUES (?, 'ADD', ?, 1)`,
            [result.insertId, JSON.stringify({ path, priority, changefreq, type })]
          );

          totalSynced++;
        } else {
          // Update existing entry
          await connection.query(
            `UPDATE sitemap_entries 
             SET priority = ?, changefreq = ?, type = ?, is_active = TRUE, updated_at = ?
             WHERE id = ?`,
            [priority, changefreq, type, lastmod, existing[0].id]
          );
        }
      }
    }

    res.json({
      success: true,
      message: `XML files synced successfully. ${totalSynced} new entries added.`,
      synced: totalSynced
    });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'XML sync failed: ' + error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get sitemap revisions
app.get('/api/admin/sitemap/revisions', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM sitemap_revisions ORDER BY created_at DESC LIMIT 50');
    connection.release();
    res.json({ success: true, data: rows });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch revisions: ' + error.message });
  }
});

// Revert to a revision
app.post('/api/admin/sitemap/revert/:id', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [revisions] = await connection.query('SELECT * FROM sitemap_revisions WHERE id = ?', [id]);
    if (revisions.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Revision not found' });
    }

    const revision = revisions[0];
    const oldData = revision.old_data ? (typeof revision.old_data === 'string' ? JSON.parse(revision.old_data) : revision.old_data) : null;
    const newData = revision.new_data ? (typeof revision.new_data === 'string' ? JSON.parse(revision.new_data) : revision.new_data) : null;

    await connection.beginTransaction();

    if (revision.action === 'ADD') {
      // Reverting an ADD means DELETE
      await connection.query('DELETE FROM sitemap_entries WHERE id = ?', [revision.entry_id]);
    } else if (revision.action === 'DELETE') {
      // Reverting a DELETE means INSERT
      if (oldData) {
        await connection.query(
          'INSERT INTO sitemap_entries (id, path, priority, changefreq, type, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [oldData.id, oldData.path, oldData.priority, oldData.changefreq, oldData.type, oldData.is_active]
        );
      }
    } else if (revision.action === 'UPDATE') {
      // Reverting an UPDATE means RESTORE OLD DATA
      if (oldData) {
        await connection.query(
          'UPDATE sitemap_entries SET path = ?, priority = ?, changefreq = ?, type = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
          [oldData.path, oldData.priority, oldData.changefreq, oldData.type, oldData.is_active, oldData.id]
        );
      }
    }

    await connection.query(
      'INSERT INTO sitemap_revisions (action, entry_id, new_data, admin_id) VALUES (?, ?, ?, ?)',
      ['REVERT', revision.entry_id, JSON.stringify({ reverted_from: id }), ADMIN_ID]
    );

    await connection.commit();
    connection.release();

    // Trigger regeneration
    regenerateSitemap().catch(err => console.error('Regeneration error after REVERT:', err));

    res.json({ success: true, message: 'Sitemap reverted successfully' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ success: false, message: 'Failed to revert sitemap: ' + error.message });
  }
});

// Redirect sitemap-indexed product paths
app.get(['/products/:id/:slug', '/p/:id/:slug', '/p/:id'], async (req, res, next) => {
  // This handles the standard SEO paths from sitemap
  // But we need to check if this is actually a valid product or needs to be served by React
  next();
});

// ==================== PROMO CODE SYSTEM ====================

// Ensure promo_codes and promo_code_usage tables exist
(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
        value DECIMAL(10,2) NOT NULL,
        usage_limit INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        user_specific TINYINT(1) NOT NULL DEFAULT 0,
        user_id VARCHAR(100) NULL,
        valid_from DATETIME NULL,
        valid_until DATETIME NULL,
        product_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS promo_code_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        promo_code_id INT NOT NULL,
        user_id VARCHAR(100) NULL,
        order_id VARCHAR(100) NULL,
        used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE
      )
    `);

    // Check if is_active column exists in promo_codes table, if not add it
    const [cols] = await conn.query("SHOW COLUMNS FROM promo_codes LIKE 'is_active'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE promo_codes ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
      console.log('Added is_active column to promo_codes table.');
    }

    conn.release();
    console.log('Promo code tables ready.');
  } catch (err) {
    if (conn) conn.release();
    console.error('Promo code table setup error:', err.message);
  }
})();

// GET /api/admin/users — list all users
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT uc.user_id, up.first_name, up.last_name, uc.email
      FROM user_credentials uc
      LEFT JOIN user_profiles up ON up.user_id = uc.user_id
      ORDER BY up.first_name ASC, up.last_name ASC
    `);
    conn.release();
    res.json({ success: true, users: rows });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/promo-codes — list all promo codes
app.get('/api/admin/promo-codes', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT pc.*, p.product_name
      FROM promo_codes pc
      LEFT JOIN products p ON p.id = pc.product_id
      ORDER BY pc.created_at DESC
    `);
    conn.release();
    res.json({ success: true, promoCodes: rows });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/promo-codes — create a new promo code
app.post('/api/admin/promo-codes', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { code, type, value, usage_limit, user_specific, user_id, valid_from, valid_until, product_id } = req.body;
    if (!code || !value) return res.status(400).json({ success: false, message: 'Code and value are required' });

    conn = await pool.getConnection();
    await conn.query(
      `INSERT INTO promo_codes (code, type, value, usage_limit, user_specific, user_id, valid_from, valid_until, product_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(code).toUpperCase().trim(),
        type || 'percentage',
        parseFloat(value),
        usage_limit ? parseInt(usage_limit) : null,
        user_specific ? 1 : 0,
        user_id || null,
        valid_from || null,
        valid_until || null,
        product_id ? parseInt(product_id) : null
      ]
    );
    conn.release();
    res.json({ success: true, message: 'Promo code created' });
  } catch (err) {
    if (conn) conn.release();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Promo code already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/promo-codes/:id — update a promo code
app.put('/api/admin/promo-codes/:id', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { code, type, value, usage_limit, user_specific, user_id, valid_from, valid_until, product_id } = req.body;

    conn = await pool.getConnection();
    await conn.query(
      `UPDATE promo_codes SET code=?, type=?, value=?, usage_limit=?, user_specific=?, user_id=?, valid_from=?, valid_until=?, product_id=?, updated_at=NOW()
       WHERE id=?`,
      [
        String(code).toUpperCase().trim(),
        type || 'percentage',
        parseFloat(value),
        usage_limit ? parseInt(usage_limit) : null,
        user_specific ? 1 : 0,
        user_id || null,
        valid_from || null,
        valid_until || null,
        product_id ? parseInt(product_id) : null,
        id
      ]
    );
    conn.release();
    res.json({ success: true, message: 'Promo code updated' });
  } catch (err) {
    if (conn) conn.release();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Promo code already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/promo-codes/:id — delete a promo code
app.delete('/api/admin/promo-codes/:id', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();
    await conn.query('DELETE FROM promo_codes WHERE id = ?', [id]);
    conn.release();
    res.json({ success: true, message: 'Promo code deleted' });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/promo-codes/validate — validate a promo code at checkout
app.post('/api/promo-codes/validate', async (req, res) => {
  let conn;
  try {
    const { code, productIds, userId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Promo code is required' });

    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 LIMIT 1',
      [String(code).toUpperCase().trim()]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Invalid promo code' });
    }

    const promo = rows[0];
    const now = new Date();

    // Check validity dates
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Promo code is not yet active' });
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Promo code has expired' });
    }

    // Check usage limit
    if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Promo code usage limit reached' });
    }

    // Check user-specific restriction
    if (promo.user_specific && promo.user_id) {
      if (!userId || String(userId) !== String(promo.user_id)) {
        conn.release();
        return res.status(403).json({ success: false, message: 'This promo code is not valid for your account' });
      }
    }

    // Check product-specific restriction
    if (promo.product_id) {
      const ids = Array.isArray(productIds) ? productIds.map(String) : [];
      const promoProductIdStr = String(promo.product_id);
      const matches = ids.some((pid) => {
        // Handle custom product IDs like "custom-123-0"
        const customMatch = pid.match(/^custom-(\d+)/);
        const resolvedId = customMatch ? customMatch[1] : pid;
        return resolvedId === promoProductIdStr;
      });
      if (!matches) {
        conn.release();
        return res.status(400).json({ success: false, message: 'This promo code is not valid for the products in your cart' });
      }
    }

    conn.release();

    // Return the valid promo code data
    res.json({
      success: true,
      promoCode: {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: parseFloat(promo.value),
        product_id: promo.product_id || null
      }
    });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/promo-codes/use — mark a promo code as used after successful order
app.post('/api/promo-codes/use', async (req, res) => {
  let conn;
  try {
    const { code, userId, orderId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 LIMIT 1', [String(code).toUpperCase().trim()]);
    if (rows.length === 0) { conn.release(); return res.status(404).json({ success: false, message: 'Promo code not found' }); }

    const promo = rows[0];
    await conn.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [promo.id]);
    await conn.query(
      'INSERT INTO promo_code_usage (promo_code_id, user_id, order_id) VALUES (?, ?, ?)',
      [promo.id, userId || null, orderId || null]
    );
    conn.release();
    res.json({ success: true, message: 'Promo code usage recorded' });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== END PROMO CODE SYSTEM ====================

// ==================== CUSTOM LASER ORDERS SYSTEM ====================

// Helper function to upload base64 images to Cloudinary
async function uploadToCloudinaryIfBase64(imageUrlOrBase64) {
  if (!imageUrlOrBase64 || typeof imageUrlOrBase64 !== 'string') return null;
  if (imageUrlOrBase64.startsWith('data:')) {
    try {
      const res = await cloudinary.uploader.upload(imageUrlOrBase64, {
        folder: 'yokebud craft/custom_orders',
        resource_type: 'auto'
      });
      return res.secure_url;
    } catch (e) {
      console.error('Cloudinary upload error in custom order:', e.message || e);
      throw new Error('Failed to upload image: ' + (e.message || String(e)));
    }
  }
  return imageUrlOrBase64;
}

// User: Submit a custom laser order
app.post('/api/custom-laser-orders', async (req, res) => {
  let conn;
  try {
    const { title, description, image_url, image_urls, width, height, depth, material, category } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    let profileId = null;

    conn = await pool.getConnection();

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        const [profileRows] = await conn.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
        if (profileRows.length > 0) {
          profileId = profileRows[0].id;
        }
      } catch (err) {
        console.warn('Token verification failed for custom laser order:', err.message);
      }
    }

    // Handle Cloudinary upload if images are base64
    let uploadedUrls = [];
    if (Array.isArray(image_urls) && image_urls.length > 0) {
      for (const img of image_urls) {
        const uploaded = await uploadToCloudinaryIfBase64(img);
        if (uploaded) uploadedUrls.push(uploaded);
      }
    } else if (image_url) {
      const uploaded = await uploadToCloudinaryIfBase64(image_url);
      if (uploaded) uploadedUrls.push(uploaded);
    }

    const [result] = await conn.query(
      `INSERT INTO custom_laser_orders (user_id, title, description, image_url, width, height, depth, material, status, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        profileId,
        title,
        description,
        uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
        width ? parseFloat(width) : null,
        height ? parseFloat(height) : null,
        depth ? parseFloat(depth) : null,
        material || null,
        category || null
      ]
    );

    conn.release();
    res.json({ success: true, message: 'Custom laser order submitted successfully', orderId: result.insertId });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper function to format order images
function formatOrderImages(rows) {
  return rows.map(order => {
    let images = [];
    if (order.image_url) {
      const trimmed = order.image_url.trim();
      if (trimmed.startsWith('[')) {
        try {
          images = JSON.parse(trimmed);
        } catch (_) {
          images = [trimmed];
        }
      } else {
        images = [trimmed];
      }
    }
    return {
      ...order,
      image_url: images[0] || null,
      image_urls: images
    };
  });
}

// User: Get own custom laser orders
app.get('/api/custom-laser-orders', async (req, res) => {
  let conn;
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    conn = await pool.getConnection();

    // Find profile integer ID
    const [profileRows] = await conn.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (profileRows.length === 0) {
      conn.release();
      return res.json({ success: true, orders: [] });
    }
    const profileId = profileRows[0].id;

    const [rows] = await conn.query(`
      SELECT clo.*, 
             up.first_name, up.last_name, up.phone,
             up.house_number, up.apartment, up.landmark,
             up.address, up.city, up.state, up.zip_code, up.country,
             uc.email
      FROM custom_laser_orders clo
      LEFT JOIN user_profiles up ON up.id = clo.user_id
      LEFT JOIN user_credentials uc ON uc.user_id = up.user_id
      WHERE clo.user_id = ?
      ORDER BY clo.created_at DESC
    `, [profileId]);

    conn.release();
    res.json({ success: true, orders: formatOrderImages(rows) });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get all custom laser orders
app.get('/api/admin/custom-laser-orders', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT clo.*, 
             up.first_name, up.last_name, up.phone,
             up.house_number, up.apartment, up.landmark,
             up.address, up.city, up.state, up.zip_code, up.country,
             uc.email
      FROM custom_laser_orders clo
      LEFT JOIN user_profiles up ON up.id = clo.user_id
      LEFT JOIN user_credentials uc ON uc.user_id = up.user_id
      ORDER BY clo.created_at DESC
    `);
    conn.release();
    res.json({ success: true, orders: formatOrderImages(rows) });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Update a custom laser order (status, price, and/or notes)
app.put('/api/admin/custom-laser-orders/:id', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { status, price, notes } = req.body;

    conn = await pool.getConnection();

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price ? parseFloat(price) : 0.00);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await conn.query(
      `UPDATE custom_laser_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    // If checkout was activated, update inquiry checkout state if linked
    if (status === 'quote_ready' || status === 'approved') {
      const [orders] = await conn.query('SELECT inquiry_id, price FROM custom_laser_orders WHERE id = ?', [id]);
      if (orders.length > 0 && orders[0].inquiry_id) {
        const order = orders[0];
        const priceVal = order.price || 0.00;
        await conn.query(
          'UPDATE inquiry_conversations SET is_checkout_active = TRUE, price_data = ?, status = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify({ price: priceVal }), 'quote_ready', order.inquiry_id]
        );
      }
    }

    conn.release();
    res.json({ success: true, message: 'Custom laser order updated successfully' });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper function to ensure inquiry exists for a custom laser order
const ensureInquiryForCustomOrder = async (orderId, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [orders] = await conn.query('SELECT * FROM custom_laser_orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Custom order not found' });
    }
    const order = orders[0];

    if (order.inquiry_id) {
      conn.release();
      return res.json({ success: true, inquiryId: order.inquiry_id });
    }

    const [userRows] = await conn.query(`
      SELECT uc.user_id as uuid, uc.email, up.first_name, up.last_name, up.phone, up.country
      FROM user_profiles up
      JOIN user_credentials uc ON uc.user_id = up.user_id
      WHERE up.id = ?
    `, [order.user_id]);

    if (userRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'User profile not found for this order' });
    }
    const userData = userRows[0];

    const inquiryId = `INQ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const inquiryNumber = `INQ-${Math.floor(100000 + Math.random() * 900000)}`;

    const initialMessages = [{
      sender: 'user',
      message: `I have submitted a custom order request: "${order.title}". Description: ${order.description}`,
      files: [],
      timestamp: new Date().toISOString(),
      is_read: true,
      status: 'sent'
    }];

    const productData = {
      id: 0,
      product_name: `Custom Order: ${order.title}`,
      isCustomOrder: true,
      customOrderId: order.id,
      description: order.description,
      width: order.width,
      height: order.height,
      depth: order.depth,
      material: order.material,
      category: order.category,
      price: order.price || 0
    };

    await conn.query(
      `INSERT INTO inquiry_conversations (
        id, user_id, product_id, inquiry_number, 
        customer_name, customer_email, customer_phone, customer_country,
        product_data, messages, status, created_at, updated_at, last_activity, unread_count, admin_unread_count
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'new', NOW(), NOW(), NOW(), 0, 1)`,
      [
        inquiryId,
        userData.uuid,
        inquiryNumber,
        `${userData.first_name} ${userData.last_name}`,
        userData.email,
        userData.phone || '',
        userData.country || '',
        JSON.stringify(productData),
        JSON.stringify(initialMessages)
      ]
    );

    await conn.query('UPDATE custom_laser_orders SET inquiry_id = ? WHERE id = ?', [inquiryId, order.id]);

    conn.release();
    res.json({ success: true, inquiryId });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Ensure inquiry exists for a custom laser order
app.post('/api/admin/custom-laser-orders/:id/ensure-inquiry', requireAdminAuth, async (req, res) => {
  await ensureInquiryForCustomOrder(req.params.id, res);
});

// User: Ensure inquiry exists for a custom laser order
app.post('/api/custom-laser-orders/:id/ensure-inquiry', async (req, res) => {
  await ensureInquiryForCustomOrder(req.params.id, res);
});

// ==================== END CUSTOM LASER ORDERS SYSTEM ====================

// ==================== VIDEO SYSTEM ====================

// Public: Get active videos (sorted)
app.get('/api/videos', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM videos WHERE is_active = TRUE ORDER BY sort_order ASC, created_at DESC'
    );
    conn.release();
    res.json({ success: true, videos: rows });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get all videos
app.get('/api/admin/videos', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM videos ORDER BY sort_order ASC, created_at DESC'
    );
    conn.release();
    res.json({ success: true, videos: rows });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Create new video
app.post('/api/admin/videos', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { title, embed_url, description, sort_order, is_active } = req.body;
    if (!embed_url) {
      return res.status(400).json({ success: false, message: 'Embed URL is required' });
    }

    conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO videos (title, embed_url, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        title || null,
        embed_url,
        description || null,
        Math.max(1, sort_order !== undefined ? parseInt(sort_order) : 1),
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );
    conn.release();
    res.json({ success: true, message: 'Video created successfully', videoId: result.insertId });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Update a video
app.put('/api/admin/videos/:id', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { title, embed_url, description, sort_order, is_active } = req.body;

    conn = await pool.getConnection();
    await conn.query(
      'UPDATE videos SET title = ?, embed_url = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [
        title || null,
        embed_url,
        description || null,
        Math.max(1, sort_order !== undefined ? parseInt(sort_order) : 1),
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
      ]
    );
    conn.release();
    res.json({ success: true, message: 'Video updated successfully' });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Delete a video
app.delete('/api/admin/videos/:id', requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();
    await conn.query('DELETE FROM videos WHERE id = ?', [id]);
    conn.release();
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (err) {
    if (conn) conn.release();
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== END VIDEO SYSTEM ====================



// Serve static files from client's build folder
const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_BUILD_PATH));

// Share endpoint for social crawlers
app.get('/share*', async (req, res) => {
  try {
    const originalPath = req.path.replace(/^\/share/, '') || '/';
    const indexPath = path.join(CLIENT_BUILD_PATH, 'index.html');
    
    // Check if index.html exists
    if (!fs.existsSync(indexPath)) {
      console.warn('Client index.html not found, falling back to default');
      return res.sendFile(path.join(__dirname, '../client/index.html'));
    }
    
    // Read index.html
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Try to build social HTML
    const socialHtml = await productSocialSeo.buildProductSocialHtml(pool, originalPath, html);
    if (socialHtml) {
      return res.send(socialHtml);
    }
    
    // Fallback to original index.html
    res.sendFile(indexPath);
  } catch (err) {
    console.error('Share endpoint error:', err);
    const indexPath = path.join(CLIENT_BUILD_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.sendFile(path.join(__dirname, '../client/index.html'));
    }
  }
});

// Fallback to client-side routing for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(CLIENT_BUILD_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback to source index.html if build doesn't exist
    res.sendFile(path.join(__dirname, '../client/index.html'));
  }
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Initial sitemap generation on startup
  try {
    await regenerateSitemap();
  } catch (err) {
    console.error('Initial sitemap generation failed:', err.message);
  }

  console.log(`Enhanced Socket.IO server with persistent unread count initialized`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize schemas
  try {
    await ensureSeoContentSchema();
    await ensureSitemapSchema();
  } catch (err) {
    console.error('Schema initialization failed:', err);
  }

  // Start keep-alive mechanism if running on Render
  if (process.env.RENDER) {
    keepAlive();
  }
});
