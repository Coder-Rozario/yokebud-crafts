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

// URL Redirection Middleware
app.use(async (req, res, next) => {
  // Only handle GET requests for potential redirects
  if (req.method !== 'GET') return next();
  
  // Skip API, static files, and sitemap XMLs
  if (req.path.startsWith('/api') || 
      req.path.includes('.') || 
      req.path.endsWith('sitemap.xml')) {
    return next();
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT new_path FROM url_redirects WHERE old_path = ? LIMIT 1',
      [req.path]
    );
    
    if (rows.length > 0) {
      console.log(`Redirecting old path ${req.path} to ${rows[0].new_path}`);
      return res.redirect(301, rows[0].new_path);
    }
  } catch (err) {
    console.error('Redirect middleware error:', err.message);
  } finally {
    if (connection) connection.release();
  }
  next();
});

const ADMIN_ID = parseInt(process.env.ADMIN_ID || '1', 10);
const adminFailedAttempts = new Map();

const requireAdminAuth = (req, res, next) => {
  const isAdmin = req.cookies && req.cookies.adminAuth === 'authenticated';
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
        'INSERT INTO seo_content (page_name, title, content) VALUES ("home", "Welcome to Yokebud Crafts", "<p>Your SEO content here...</p>")'
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

// Helper: extract productId from a sitemap path like `/products/123/slug...`
function getProductIdFromPath(pathStr) {
  try {
    const m = String(pathStr || '').match(/^\/products\/(\d+)\//);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function regenerateSitemap() {
  const toSlug = (str) => {
    try {
      const s = String(str || '').toLowerCase().trim();
      return s.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
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
    const header = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
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

    // Write main sitemap
    const mainXml = buildXml(allUrls);
    const outPath = path.join(__dirname, '..', 'client', 'public', 'sitemap.xml');
    fs.writeFileSync(outPath, mainXml, 'utf8');

    // Write product-only sitemap
    const productXml = buildXml(productUrls);
    const productPath = path.join(__dirname, '..', 'client', 'public', 'product-sitemap.xml');
    fs.writeFileSync(productPath, productXml, 'utf8');

    // Write category-only sitemap
    const categoryXml = buildXml(categoryUrls);
    const categoryPath = path.join(__dirname, '..', 'client', 'public', 'category-sitemap.xml');
    fs.writeFileSync(categoryPath, categoryXml, 'utf8');

    // Write page-only sitemap (static pages)
    const pageXml = buildXml(pageUrls);
    const pagePath = path.join(__dirname, '..', 'client', 'public', 'page-sitemap.xml');
    fs.writeFileSync(pagePath, pageXml, 'utf8');

    // Write blog-only sitemap
    const blogXml = buildXml(blogUrls);
    const blogPath = path.join(__dirname, '..', 'client', 'public', 'blog-sitemap.xml');
    fs.writeFileSync(blogPath, blogXml, 'utf8');

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
      blogPath
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
  const payload = {
    sender,
    to: toList,
    subject: mailOptions.subject || '',
    htmlContent: mailOptions.html || '',
    textContent: mailOptions.text || undefined,
    replyTo: mailOptions.replyTo ? parseAddress(mailOptions.replyTo) : undefined
  };
  return brevoEmailApi.sendTransacEmail(payload);
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
      <title>${title || 'Yokebud Crafts'}</title>
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
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
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
          background: ${EMAIL_THEME.secondary};
          color: rgba(255, 255, 255, 0.8);
          padding: 30px;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
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
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        
        .social-link {
          display: inline-block;
          line-height: 0;
          text-decoration: none;
          transition: transform 0.2s ease;
          background: transparent !important;
          border-radius: 0 !important;
          margin: 0 6px;
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
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
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
          
          .cta-grid {
            flex-direction: column;
            align-items: center;
          }
          
          .primary-cta,
          .secondary-cta {
            width: 100%;
            max-width: 300px;
          }
          
          .social-links {
            gap: 15px;
          }
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
            <div class="brand-logo">YOKEBUD CRAFTS</div>
            <h1 class="email-title">${title || 'Yokebud Crafts'}</h1>
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
                <a href="${primaryCtaUrl}" class="primary-cta">
                  ${primaryCtaText}
                </a>
              ` : ''}
              
              ${secondaryCtaText && secondaryCtaUrl ? `
                <a href="${secondaryCtaUrl}" class="secondary-cta">
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
              <a href="https://www.facebook.com/share/1D9o7CoZB7/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://wa.me/+358440328124" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="WhatsApp" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.youtube.com/@yokebud" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.instagram.com/yokebud/" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
              <a href="https://www.tiktok.com/@yokebud" class="social-link" target="_blank" rel="noopener" style="display:inline-block;line-height:0;text-decoration:none;background:transparent;border-radius:0;margin:0 6px;">
                <img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" alt="TikTok" class="social-icon" style="width:24px;height:24px;display:block;background:transparent;border-radius:0;border:0;outline:none;vertical-align:middle;">
              </a>
            </div>
            ` : ''}
            
            <div class="contact-info">
              <p>Yokebud Crafts</p>
              <p>Pukinmäenaukio 4, 00720 Helsinki, Finland</p>
              <p>Email: yokebud@gmail.com | Phone: +358 440 328 124</p>
            </div>
            
            <div class="copyright">
              &copy; ${new Date().getFullYear()} Yokebud Crafts. All rights reserved.
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
          Use this OTP to login to your Yokebud Crafts account.
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
    title: 'Yokebud Crafts Admin',
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
      <h2 class="content-title">Welcome to Yokebud Crafts! 🎉</h2>
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
    title: 'Welcome to Yokebud Crafts',
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
        <p class="content-text">Your Yokebud Crafts account has been created successfully.</p>
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
    title: 'Welcome to Yokebud Crafts',
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
  
  const itemsHtml = items.map(item => `
    <div style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
      <div style="flex: 1;">
        <strong>${item.product_name || item.name}</strong>
        <div style="color: ${EMAIL_THEME.textLight}; font-size: 14px;">
          Quantity: ${item.quantity} × $${Number(item.discounted_price || item.price || 0).toFixed(2)}
          ${item.size ? ` • Size: ${item.size}` : ''}
          ${item.color ? ` • Color: ${item.color}` : ''}
        </div>
      </div>
      <div style="font-weight: 600;">
        $${(Number(item.quantity) * Number(item.discounted_price || item.price || 0)).toFixed(2)}
      </div>
    </div>
  `).join('');
  
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
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border};">
            <span>Subtotal:</span>
            <span>$${Number(totals.subtotal || 0).toFixed(2)}</span>
          </div>
          ${totals.shipping ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0;">
            <span>Shipping:</span>
            <span>$${Number(totals.shipping).toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border};">
            <span>Total:</span>
            <span style="color: ${EMAIL_THEME.primary};">$${Number(totals.total || 0).toFixed(2)}</span>
          </div>
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
        with tracking information once your order ships. Thank you for choosing Yokebud Crafts!
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
  const itemsHtml = items.map(item => `
    <div style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
      <div style="flex: 1;">
        <strong>${item.product_name || item.name}</strong>
        <div style="color: ${EMAIL_THEME.textLight}; font-size: 14px;">
          Quantity: ${item.quantity} × $${Number(item.discounted_price || item.price || 0).toFixed(2)}
          ${item.size ? ` • Size: ${item.size}` : ''}
          ${item.color ? ` • Color: ${item.color}` : ''}
        </div>
      </div>
      <div style="font-weight: 600;">
        $${(Number(item.quantity) * Number(item.discounted_price || item.price || 0)).toFixed(2)}
      </div>
    </div>
  `).join('');
  
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">New Order Received! 🚀</h2>
        <p class="content-text" style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
          Order #${orderId}
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Order Summary</h3>
        ${itemsHtml}
        <div style="padding: 15px;">
          <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid ${EMAIL_THEME.border};">
            <span>Subtotal:</span>
            <span>$${Number(totals.subtotal || 0).toFixed(2)}</span>
          </div>
          ${totals.shipping ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 0;">
            <span>Shipping:</span>
            <span>$${Number(totals.shipping).toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid ${EMAIL_THEME.border};">
            <span>Total:</span>
            <span style="color: ${EMAIL_THEME.primary};">$${Number(totals.total || 0).toFixed(2)}</span>
          </div>
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
        <h2 class="content-title">Hello ${customerInfo.firstName}! 👋</h2>
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
    footerNote: 'Thank you for choosing Yokebud Crafts!'
  });
};

// 3. NEWSLETTER SUBSCRIPTION NOTIFICATION (ADMIN)
const renderNewSubscriberNotificationEmail = (subscriberEmail) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">New Newsletter Subscriber! 🎯</h2>
        <p class="content-text">
          Someone just subscribed to your newsletter
        </p>
      </div>
      
      <div class="email-card">
        <h3 class="card-title">Subscriber Details</h3>
        <div style="padding: 15px;">
          <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <div style="flex: 1;">
              <strong style="display: block; color: ${EMAIL_THEME.text};">Email Address</strong>
              <span style="color: ${EMAIL_THEME.textLight};">${subscriberEmail}</span>
            </div>
            <div style="color: ${EMAIL_THEME.accent}; font-weight: 600;">
              ✅ Active
            </div>
          </div>
          
          <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <div style="flex: 1;">
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
            </div>
          </div>
          
          <div style="display: flex; align-items: center;">
            <div style="flex: 1;">
              <strong style="display: block; color: ${EMAIL_THEME.text};">Total Active Subscribers</strong>
              <span style="color: ${EMAIL_THEME.textLight}; font-size: 24px; font-weight: 700;">+1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  return renderThemedEmail({
    title: 'New Subscriber Alert',
    subtitle: 'Yokebud Crafts Newsletter System',
    contentHtml,
    primaryCtaText: 'View Subscriber Dashboard',
    primaryCtaUrl: `${process.env.ADMIN_URL || 'https://www.yokebud.com/admin'}`,
    footerNote: 'This is an automated notification from Yokebud Crafts Newsletter System'
  });
};

// 4. WEEKLY NEWSLETTER EMAIL
const renderWeeklyNewsletterEmail = (subscriber, products, token) => {
  const unsubscribeLink = `${PUBLIC_SITE_URL}/UnsubscribePage?token=${token}`;
  
  const productGrid = products.map(product => {
    const productLink = `${PUBLIC_SITE_URL}/products/${product.id}`;
    const imageUrl = product.firstImage || product.product_photos?.[0] || '';
    const price = product.min_price !== product.max_price 
      ? `$${product.min_price} - $${product.max_price}`
      : `$${product.min_price}`;

    return `
      <div style="border: 1px solid ${EMAIL_THEME.border}; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: white; transition: all 0.3s ease;">
        <div style="position: relative; width: 100%; height: 200px; overflow: hidden;">
          <img src="${imageUrl}" 
               alt="${product.product_name}" 
               style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;"
               onerror="this.style.display='none'">
        </div>
        <div style="padding: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; color: ${EMAIL_THEME.text}; font-weight: 600; line-height: 1.4;">
            ${product.product_name}
          </h3>
          <p style="margin: 0 0 10px 0; font-size: 18px; color: ${EMAIL_THEME.primary}; font-weight: 700;">
            ${price}
          </p>
          <p style="margin: 0 0 15px 0; font-size: 12px; color: ${EMAIL_THEME.textLight}; line-height: 1.4; height: 40px; overflow: hidden;">
            ${product.product_details ? product.product_details.substring(0, 80) + '...' : 'Premium quality product'}
          </p>
          <a href="${productLink}" 
             style="display: inline-block; background: linear-gradient(135deg, ${EMAIL_THEME.primary}, #FFD700); color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600; transition: all 0.3s ease;">
            View Product
          </a>
        </div>
      </div>
    `;
  }).join('');
  
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">This Week's Featured Products 🚀</h2>
        <p class="content-text">
          ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      
      <p class="content-text">
        Discover our latest wholesale fashion pieces carefully selected for your business. 
        From trendy designs to classic essentials, we've got everything you need.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0;">
        ${productGrid}
      </div>
      
      <p class="content-text">
        Don't miss out on these exclusive wholesale opportunities. All products are available 
        in various sizes and colors to meet your business needs.
      </p>
    </div>
  `;
  
  return renderThemedEmail({
    title: 'Weekly Product Update',
    subtitle: 'Fresh arrivals just for you',
    contentHtml,
    primaryCtaText: 'Browse All Products',
    primaryCtaUrl: PUBLIC_SITE_URL,
    secondaryCtaText: 'Unsubscribe',
    secondaryCtaUrl: unsubscribeLink,
    footerNote: 'Prices shown are wholesale prices. Minimum order quantities may apply.'
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
          or fashion insights from Yokebud Crafts.
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
    ? 'Thank you for signing up with Yokebud Crafts!' 
    : 'Use this OTP to login to your Yokebud Crafts account.';
  
  // Standalone HTML without external fonts or images
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subjectText} - Yokebud Crafts</title>
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
          background: #2D3748;
          color: rgba(255, 255, 255, 0.8);
          padding: 30px;
          text-align: center;
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
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
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
          <div class="brand-logo">YOKEBUD CRAFTS</div>
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
          <div class="contact-info">
            <p><strong>Yokebud Crafts</strong></p>
            <p>Pukinmäenaukio 4, 00720 Helsinki, Finland</p>
            <p>Email: yokebud@gmail.com | Phone: +358 440 328 124</p>
          </div>
          <div class="copyright">
            &copy; ${new Date().getFullYear()} Yokebud Crafts. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 7. ORDER STATUS UPDATE EMAIL
const renderOrderStatusUpdateEmail = (orderId, status, customerInfo, trackingNumber = null) => {
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
          <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <div style="flex: 1;">
              <strong style="display: block; color: ${EMAIL_THEME.text};">Order Status</strong>
              <span style="color: ${config.color}; font-weight: 600;">
                ${status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div style="font-size: 24px;">
              ${config.icon}
            </div>
          </div>
          
          ${trackingNumber ? `
          <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ${EMAIL_THEME.border};">
            <div style="flex: 1;">
              <strong style="display: block; color: ${EMAIL_THEME.text};">Tracking Number</strong>
              <span style="color: ${EMAIL_THEME.textLight}; font-family: monospace;">
                ${trackingNumber}
              </span>
            </div>
          </div>
          ` : ''}
          
          <div style="display: flex; align-items: center;">
            <div style="flex: 1;">
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
            </div>
          </div>
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

// 8. CONTACT FORM NOTIFICATION EMAIL (ADMIN)
const renderContactFormNotificationEmail = (name, email, whatsapp, message) => {
  const adminUrl = `${process.env.ADMIN_URL || 'https://www.yokebud.com/admin'}/messages`;
  
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
    footerNote: 'This is an automated notification from Yokebud Crafts website.'
  });
};

// 9. CONTACT FORM CONFIRMATION EMAIL (CUSTOMER)
const renderContactFormConfirmationEmail = (name, email, message) => {
  const contentHtml = `
    <div class="content-section">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 class="content-title">Message Received! ✨</h2>
        <p class="content-text">
          Thank you for contacting Yokebud Crafts
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
          ${isToAdmin ? `Customer <strong>${senderName}</strong> has sent a new message.` : `You have received a new message from Yokebud Crafts support.`}
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
    to: email,
    subject: '🎉 Welcome to Yokebud Crafts Newsletter - Thank You for Subscribing!',
    html,
    priority: 'high'
  };
  
  try {
    await sendMail(mailOptions);
    console.log(`📧 Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Welcome email error:', error);
    return false;
  }
};

// Send account welcome email (new user registration)
const sendAccountWelcomeEmail = async (email, name) => {
  const html = renderAccountWelcomeEmail(name);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <welcome@yokebud.com>',
    to: email,
    subject: '🎉 Welcome to Yokebud Crafts',
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
    to: customerInfo.email,
    subject: `✅ Order Confirmed #${orderId} - Yokebud Crafts`,
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts System <yokebud@gmail.com>',
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
    to: subscriber.email,
    subject: `🚀 Yokebud Crafts Weekly Update - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    html,
    priority: 'normal'
  };
  
  try {
    await sendMail(mailOptions);
    console.log(`📧 Weekly newsletter sent to ${subscriber.email}`);
    return true;
  } catch (error) {
    console.error('❌ Weekly newsletter error:', error);
    return false;
  }
};

// Send unsubscribe confirmation
const sendUnsubscribeConfirmation = async (email) => {
  const html = renderUnsubscribeConfirmationEmail(email);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <newsletter@yokebud.com>',
    to: email,
    subject: '👋 You have been unsubscribed from Yokebud Crafts Newsletter',
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
    ? 'Verify Your Email - Yokebud Crafts' 
    : type === 'admin_login'
    ? '🔐 Admin Login OTP - Yokebud Crafts'
    : 'Login OTP - Yokebud Crafts';
  
  const mailOptions = {
    from: customFrom || process.env.EMAIL_FROM || `Yokebud Crafts Security <${process.env.EMAIL_USER}>`,
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
        console.log(`⏳ Connection timeout. Retrying in ${waitTime/1000}s...`);
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
const sendOrderStatusUpdateEmail = async (orderId, status, customerInfo, trackingNumber = null) => {
  const html = renderOrderStatusUpdateEmail(orderId, status, customerInfo, trackingNumber);
  const mailOptions = {
    from: process.env.EMAIL_FROM || `Yokebud Crafts <${process.env.EMAIL_USER}>`,
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

// Send admin new order email
const sendAdminNewOrderEmail = async (orderId, customerInfo, items, totals) => {
  const html = renderAdminNewOrderEmail(orderId, customerInfo, items, totals);
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud Crafts System <yokebud@gmail.com>',
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
    to: customerInfo.email,
    subject: `✨ Update regarding Order #${orderId} - Yokebud Crafts`,
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
    from: process.env.EMAIL_FROM || `Yokebud Crafts <${process.env.EMAIL_USER}>`,
    replyTo: email,
    to: 'yokebud@gmail.com',
    subject: `📩 New Contact Message from ${name} - Yokebud Crafts`,
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
    to: email,
    subject: '✨ Thank you for contacting Yokebud Crafts',
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
  const senderName = isToAdmin ? inquiry.customer_name : 'Yokebud Crafts Support';
  
  // Parse product name safely
  let productName = 'Product Inquiry';
  try {
    const productData = typeof inquiry.product_data === 'string' 
      ? JSON.parse(inquiry.product_data) 
      : inquiry.product_data;
    productName = productData.product_name || 'Product Inquiry';
  } catch (e) {}

  const html = renderInquiryNotificationEmail(recipientName, senderName, inquiry.inquiry_number, productName, message, isToAdmin);
  
  const subject = isToAdmin 
    ? `📩 New Message: Inquiry #${inquiry.inquiry_number} - ${productName}`
    : `💬 New Message regarding Inquiry #${inquiry.inquiry_number} - Yokebud Crafts`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>',
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
    from: process.env.EMAIL_FROM || 'Yokebud Crafts Security <security@yokebud.com>',
    to: email,
    subject: '🔐 Password Reset Request - Yokebud Crafts',
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

const ensureUniqueSlug = async (connection, baseSlug) => {
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const [rows] = await connection.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
    if (!rows || rows.length === 0) return slug;
    slug = `${baseSlug}-${suffix++}`;
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
    images
  } = payload || {};
  if (!name || typeof name !== 'string') return { valid: false, message: 'Invalid name' };
  if (!description || typeof description !== 'string') return { valid: false, message: 'Invalid description' };
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) return { valid: false, message: 'Invalid price' };
  if (!Array.isArray(categories) || categories.length === 0) return { valid: false, message: 'Invalid categories' };
  if (stock == null || isNaN(parseInt(stock))) return { valid: false, message: 'Invalid stock' };
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

    const header = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    const nodes = rows.map(r => {
      const loc = `${PUBLIC_SITE_URL}${r.path}`;
      const lastmod = (r.updated_at ? new Date(r.updated_at) : new Date()).toISOString().slice(0, 10);
      const changefreq = r.changefreq || 'weekly';
      const priority = r.priority || (r.type === 'product' ? '0.8' : '0.6');
      const category =
        r.type === 'static'
          ? 'Pages'
          : r.type === 'category'
          ? 'Categories'
          : r.type === 'product'
          ? 'Products'
          : 'Other';

      return (
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${changefreq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n` +
        `    <category>${category}</category>\n` +
        `  </url>`
      );
    }).join('\n');

    return `${header}\n${nodes}\n</urlset>\n`;
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

// Serve XSL from same origin (api.yokebud.fi) so browser can apply it to sitemap XML (no cross-origin block)
app.get('/sitemap.xsl', (req, res) => {
  try {
    const xslPath = path.join(__dirname, '..', 'client', 'public', 'sitemap.xsl');
    if (!fs.existsSync(xslPath)) {
      return res.status(404).send('sitemap.xsl not found');
    }
    const xsl = fs.readFileSync(xslPath, 'utf8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xsl);
  } catch (err) {
    console.error('sitemap.xsl serve error:', err);
    res.status(500).send('Error loading stylesheet');
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    // Sitemap index: only points to other sitemaps (no URL list here)
    const today = new Date().toISOString().slice(0, 10);
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <sitemap>\n` +
      `    <loc>${PUBLIC_SITE_URL}/page-sitemap.xml</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `  </sitemap>\n` +
      `  <sitemap>\n` +
      `    <loc>${PUBLIC_SITE_URL}/category-sitemap.xml</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `  </sitemap>\n` +
      `  <sitemap>\n` +
      `    <loc>${PUBLIC_SITE_URL}/product-sitemap.xml</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `  </sitemap>\n` +
      `  <sitemap>\n` +
      `    <loc>${PUBLIC_SITE_URL}/blog-sitemap.xml</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `  </sitemap>\n` +
      `</sitemapindex>\n`;

    return sendXml(res, xml);
  } catch (error) {
    console.error('Sitemap index generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

app.get('/product-sitemap.xml', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Fetch only PRODUCT-type entries from the sitemap_entries table
    const [entries] = await connection.query(
      'SELECT path, priority, changefreq, is_active, created_at, updated_at FROM sitemap_entries WHERE type = "product"'
    );

    const today = new Date().toISOString().slice(0, 10);
    const header =
      `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    const nodes = (entries || [])
      .filter((e) => {
        // Treat anything that looks like 0 / '0' / false as inactive
        const active =
          e.is_active === undefined || e.is_active === null
            ? true
            : !(e.is_active === 0 || e.is_active === '0' || e.is_active === false);
        return active && e.path;
      })
      .map((e) => {
        const lastmodSource = e.updated_at || e.created_at;
        const lastmod =
          lastmodSource instanceof Date
            ? lastmodSource.toISOString().slice(0, 10)
            : lastmodSource
            ? new Date(lastmodSource).toISOString().slice(0, 10)
            : today;

        const loc = `${PUBLIC_SITE_URL}${e.path}`;
        const priority = e.priority || '0.8';
        const changefreq = e.changefreq || 'weekly';

        return [
          '  <url>',
          `    <loc>${loc}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          `    <changefreq>${changefreq}</changefreq>`,
          `    <priority>${priority}</priority>`,
          `    <category>Products</category>`,
          '  </url>'
        ].join('\n');
      })
      .join('\n');

    const xml = `${header}\n${nodes}\n</urlset>\n`;
    return sendXml(res, xml);
  } catch (error) {
    console.error('Product sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  } finally {
    if (connection) connection.release();
  }
});

app.get('/category-sitemap.xml', async (req, res) => {
  try {
    // Real-time from sitemap_entries (AdminSitemap edits reflected immediately)
    const xml = await generateSitemapXmlFromDb({ type: 'category' });
    return sendXml(res, xml);
  } catch (error) {
    console.error('Category sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  }
});

// Per-category product sitemap XML
// Example: /category-sitemap-jewelry.xml
app.get('/category-sitemap-:slug.xml', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).send('Bad request');

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

    let connection;
    try {
      connection = await pool.getConnection();
      const [cats] = await connection.query('SELECT name FROM categories');
      const categoryName =
        (cats || []).map((c) => c.name).find((name) => toSlug(name) === String(slug).toLowerCase()) || null;

      if (!categoryName) {
        const empty =
          `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
        return sendXml(res, empty);
      }

      // Fetch products that match this category
      // products.category can be JSON array or string; handle both.
      const [rows] = await connection.query(
        `SELECT id, product_name, sitemap_path, updated_at, category
         FROM products
         WHERE (
           category = ?
           OR JSON_CONTAINS(category, JSON_QUOTE(?))
         )`,
        [categoryName, categoryName]
      );

      const today = new Date().toISOString().slice(0, 10);
      const header = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

      const safeSlug = (name) =>
        String(name || 'product')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80);

      const nodes = (rows || [])
        .map((p) => {
          const path = p.sitemap_path || `/products/${p.id}/${safeSlug(p.product_name)}`;
          const loc = `${PUBLIC_SITE_URL}${path}`;
          const lastmod = (p.updated_at ? new Date(p.updated_at) : new Date(today)).toISOString().slice(0, 10);
          return (
            `  <url>\n` +
            `    <loc>${loc}</loc>\n` +
            `    <lastmod>${lastmod}</lastmod>\n` +
            `    <changefreq>weekly</changefreq>\n` +
            `    <priority>0.8</priority>\n` +
            `  </url>`
          );
        })
        .join('\n');

      const xml = `${header}\n${nodes}\n</urlset>\n`;
      return sendXml(res, xml);
    } finally {
      if (connection) connection.release();
    }
  } catch (error) {
    console.error('Per-category sitemap generation error:', error);
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

// Blog sitemap: list of /blog and individual blog posts
// Uses blog table for URLs and optionally overrides priority/changefreq/activation
// based on matching entries in sitemap_entries (editable from AdminSitemap).
app.get('/blog-sitemap.xml', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Do not depend on slug column existing; we generate slugs from title/excerpt.
    // Use all blogs to keep behavior consistent with sitemap.
    const [blogs] = await connection.query(
      'SELECT title, excerpt, updated_at, created_at, is_published FROM blogs ORDER BY created_at DESC'
    );

    // Optional overrides coming from sitemap_entries so admin can tune blog URLs.
    const [sitemapEntries] = await connection.query(
      "SELECT path, priority, changefreq, is_active, type FROM sitemap_entries WHERE path = '/blog' OR path LIKE '/blogs/%' OR type = 'blog'"
    );

    const today = new Date().toISOString().slice(0, 10);

    const createSlug = (title, excerpt) => {
      try {
        if (!title) return '';
        const base = String(title)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_]+/g, '-')
          .replace(/^-+|-+$/g, '');

        if (!excerpt) return base;
        const kw = String(excerpt)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_]+/g, '-')
          .replace(/^-+|-+$/g, '');

        return kw ? `${base}-${kw}` : base;
      } catch {
        return '';
      }
    };

    const isEntryActive = (entry) => {
      if (!entry) return true;
      const v = entry.is_active;
      if (v === undefined || v === null) return true;
      return !(v === 0 || v === '0' || v === false);
    };

    const findConfigForPath = (path) =>
      (sitemapEntries || []).find((e) => e.path === path);

    const header =
      `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    const nodes = [];

    // Main blog listing page
    const mainPath = '/blog';
    const mainCfg = findConfigForPath(mainPath);
    if (isEntryActive(mainCfg)) {
      const mainPriority = (mainCfg && mainCfg.priority) || '0.6';
      const mainFreq = (mainCfg && mainCfg.changefreq) || 'weekly';
      nodes.push(
        `  <url>\n` +
        `    <loc>${PUBLIC_SITE_URL}${mainPath}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${mainFreq}</changefreq>\n` +
        `    <priority>${mainPriority}</priority>\n` +
        `    <category>Blog</category>\n` +
        `  </url>`
      );
    }

    // Individual blog posts
    for (const b of blogs || []) {
      const slugFromTitle = createSlug(b.title, b.excerpt);
      const path = slugFromTitle ? `/blogs/${slugFromTitle}` : `/blogs/${b.slug || ''}`;
      const cfg = findConfigForPath(path);
      if (!isEntryActive(cfg)) continue; // allow admin to deactivate a single blog URL

      const loc = `${PUBLIC_SITE_URL}${path}`;
      const lastmod =
        (b.updated_at || b.created_at || new Date()).toISOString().slice(0, 10);
      const priority = (cfg && cfg.priority) || '0.5';
      const freq = (cfg && cfg.changefreq) || 'weekly';

      nodes.push(
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${freq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n` +
        `    <category>Blog</category>\n` +
        `  </url>`
      );
    }

    const xml = `${header}\n${nodes.join('\n')}\n</urlset>\n`;
    return sendXml(res, xml);
  } catch (error) {
    console.error('Blog sitemap generation error:', error);
    res.status(500).send('Sitemap unavailable');
  } finally {
    if (connection) connection.release();
  }
});

// robots.txt
app.get('/robots.txt', (req, res) => {
  const lines = [
    'User-agent: *',
    'Disallow: /admin',
    'Allow: /',
    `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`
  ];
  res.header('Content-Type', 'text/plain');
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
    const [inquiries] = await connection.query('SELECT id, customer_email, customer_name, product_data, messages FROM inquiry_conversations');
    connection.release();
    for (const inquiry of inquiries) {
      const product = (() => { try { return JSON.parse(inquiry.product_data || '{}'); } catch { return {}; } })();
      const messages = (() => { try { return JSON.parse(inquiry.messages || '[]'); } catch { return []; } })();
      let changed = false;
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const ts = msg && msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
        if (!msg || msg.is_read) continue;
        if (!ts || isNaN(ts)) continue;
        if ((Date.now() - ts) < 60 * 60 * 1000) continue;
        if (msg.reminder_sent) continue;
        const subject = 'Reminder: Unviewed message in your conversation';
        const preview = String(msg.message || '').trim().slice(0, 140);
        const content = `<p style="margin:0 0 12px 0;color:${EMAIL_THEME.textLight};">A new message has remained unviewed for over 1 hour in your conversation about <span style="color:${EMAIL_THEME.text};font-weight:700;">${product.product_name || 'your product'}</span>.</p><div style="background:#0D0D0D;border:1px solid #1a1a1a;border-radius:12px;padding:16px;margin-top:8px;"><div style="color:${EMAIL_THEME.textLight};font-size:12px;margin-bottom:6px;">Message preview</div><div style="color:${EMAIL_THEME.text};line-height:1.6;">${preview || 'No text'}</div></div>`;
        const clientUrl = `${process.env.CLIENT_URL || 'https://www.yokebud.com'}/messages`;
        const adminUrl = `${process.env.ADMIN_URL || 'https://www.yokebud.com/admin/inquiries'}`;
        const userHtml = renderThemedEmail({ title: 'Yokebud Crafts', subtitle: 'Message Reminder', contentHtml: content, ctaText: 'Open Conversation', ctaUrl: clientUrl });
        const adminHtml = renderThemedEmail({ title: 'Yokebud Crafts', subtitle: 'Message Reminder', contentHtml: content, ctaText: 'Review Inquiry', ctaUrl: adminUrl });
        const mailUser = { from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>', to: inquiry.customer_email, subject, html: userHtml };
        const mailAdmin = { from: process.env.EMAIL_FROM || 'Yokebud Crafts <yokebud@gmail.com>', to: 'yokebud@gmail.com', subject: `${subject} - ${inquiry.customer_name || ''}`, html: adminHtml };
        try { await sendMail(mailUser); } catch {}
        try { await sendMail(mailAdmin); } catch {}
        messages[i] = { ...msg, reminder_sent: true };
        changed = true;
      }
      if (changed) {
        const conn2 = await pool.getConnection();
        await conn2.query('UPDATE inquiry_conversations SET messages = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(messages), inquiry.id]);
        conn2.release();
      }
    }
  } catch {}
};

setInterval(() => { checkUnreadMessageReminders(); }, 5 * 60 * 1000);

// Create PaymentIntent endpoint for Stripe Checkout (simple, server-side)
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe not configured on server' });
  }

  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Stripe expects amount in cents
    const amountInCents = Math.round(Number(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      automatic_tax: { enabled: true },
    });

    return res.json({ success: true, clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    return res.status(500).json({ success: false, message: err.message || 'Stripe error' });
  }
});

// Create Stripe Checkout Session for redirect-to-checkout flow
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe not configured on server' });
  }

  try {
    const {
      items = [],
      currency = 'eur',
      customer = {},
      successUrl,
      cancelUrl,
      shipping = 0
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const origin = (req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173');

    const line_items = items.map((item) => {
      const unit = Number(item.discounted_price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const name = item.product_name || item.name || `Product ${item.id || ''}`;
      const images = Array.isArray(item.product_photos) ? item.product_photos.filter(Boolean) : [];
      return {
        price_data: {
          currency,
          product_data: {
            name,
            images: images.slice(0, 1)
          },
          unit_amount: Math.round(unit * 100)
        },
        quantity: qty
      };
    });

    if (shipping && Number(shipping) > 0) {
      line_items.push({
        price_data: {
          currency,
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(Number(shipping) * 100)
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      payment_method_types: ['card'],
      customer_email: customer.email || undefined,
      success_url: successUrl || `${origin}/Checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/cart`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false }
    });

    return res.json({ success: true, url: session.url, id: session.id });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Stripe error' });
  }
});


// Update admin_unread_count endpoint
app.put('/api/inquiries/:inquiryId/admin-unread', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { admin_unread_count } = req.body;
    
    connection = await pool.getConnection();
    
    await connection.query(
      'UPDATE inquiry_conversations SET admin_unread_count = ?, updated_at = NOW() WHERE id = ?',
      [admin_unread_count, inquiryId]
    );
    
    connection.release();
    
    res.json({ 
      success: true, 
      message: 'Admin unread count updated successfully' 
    });
  } catch (error) {
    console.error('Error updating admin unread count:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update admin unread count' 
    });
  }
});


// ==================== ENHANCED MESSAGE HANDLING WITH UNREAD COUNTS ====================

// Enhanced Socket.IO for real-time messaging with unread counts
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle new message with optimized unread counts
  socket.on('send_message', async (data) => {
    try {
      const { inquiryId, message, senderType, files = [], temporaryId } = data;
      
      console.log('Received message via socket:', { inquiryId, message, senderType, temporaryId });

      const connection = await pool.getConnection();
      
      // Get current inquiry
      const [inquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );

      if (inquiries.length === 0) {
        connection.release();
        socket.emit('message_error', { error: 'Inquiry not found', temporaryId });
        return;
      }

      const inquiry = inquiries[0];
      const currentMessages = JSON.parse(inquiry.messages || '[]');
      
      // Create new message
      const newMessage = {
        id: uuidv4(),
        sender_type: senderType,
        message: message,
        files: files,
        timestamp: new Date().toISOString(),
        is_read: false
      };

      // Add to messages array
      currentMessages.push(newMessage);

      // Calculate unread counts based on sender
      let newUnreadCount = inquiry.unread_count || 0;
      let newAdminUnreadCount = inquiry.admin_unread_count || 0;
      let hasNewMessage = inquiry.has_new_message || false;

      if (senderType === 'admin') {
        // Admin sent message - increment user's unread count
        newUnreadCount += 1;
        hasNewMessage = true;
      } else {
        // User sent message - increment admin's unread count
        newAdminUnreadCount += 1;
        hasNewMessage = true;
      }

      console.log(`Unread counts - User: ${newUnreadCount}, Admin: ${newAdminUnreadCount}, Sender: ${senderType}`);

      // Update inquiry in database
      await connection.query(
        `UPDATE inquiry_conversations SET 
          messages = ?, 
          last_activity = NOW(),
          updated_at = NOW(),
          unread_count = ?,
          admin_unread_count = ?,
          has_new_message = ?,
          status = CASE 
            WHEN status = 'new' AND ? = 'admin' THEN 'processing'
            WHEN status = 'new' AND ? = 'user' THEN 'pending'
            ELSE status
          END
         WHERE id = ?`,
        [JSON.stringify(currentMessages), newUnreadCount, newAdminUnreadCount, hasNewMessage, senderType, senderType, inquiryId]
      );

      connection.release();

      // Emit message to all clients in the room
      io.to(inquiryId).emit('new_message', {
        ...newMessage,
        inquiryId: inquiryId,
        temporaryId: temporaryId
      });

      // Send confirmation back to sender
      socket.emit('message_sent', {
        success: true,
        message: newMessage,
        temporaryId: temporaryId
      });
      
      // REAL-TIME NOTIFICATION: Only show toast for relevant users
      if (senderType === 'admin') {
        // Notify user about new admin message
        io.to(`user_${inquiry.user_id}`).emit('new_admin_message', {
          type: 'new_message',
          inquiryId: inquiryId,
          message: message,
          inquiryNumber: inquiry.inquiry_number,
          productName: JSON.parse(inquiry.product_data).product_name,
          unreadCount: newUnreadCount,
          timestamp: new Date().toISOString()
        });

        // Update navbar notification for user
        io.to(`user_${inquiry.user_id}`).emit('unread_count_update', {
          userId: inquiry.user_id,
          totalUnread: newUnreadCount
        });
        try { await sendInquiryNotification(inquiry, message, 'admin'); } catch (e) { console.error('Inquiry email error:', e); }
      } else {
        // Notify admin about new user message
        io.emit('admin_new_message', {
          type: 'new_user_message',
          inquiryId: inquiryId,
          customerName: inquiry.customer_name,
          productName: JSON.parse(inquiry.product_data).product_name,
          message: message,
          adminUnreadCount: newAdminUnreadCount,
          hasNewMessage: hasNewMessage,
          timestamp: new Date().toISOString()
        });
      }

      console.log('Message saved and broadcasted:', newMessage.id);

    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('message_error', { 
        error: 'Failed to send message', 
        temporaryId: data.temporaryId 
      });
    }
  });

  // Mark messages as read with unread count updates
  socket.on('mark_messages_read', async (data) => {
    try {
      const { inquiryId, userId, userType } = data;
      const connection = await pool.getConnection();

      // Get current inquiry
      const [inquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );

      if (inquiries.length > 0) {
        const inquiry = inquiries[0];
        const currentMessages = JSON.parse(inquiry.messages || '[]');
        
        // Mark messages as read based on user type and set status
        const updatedMessages = currentMessages.map(msg => {
          if (userType === 'user' && msg.sender_type === 'admin') {
            return { ...msg, is_read: true, status: 'read' };
          } else if (userType === 'admin' && msg.sender_type === 'user') {
            return { ...msg, is_read: true, status: 'read' };
          }
          return msg;
        });

        // Calculate new unread counts
        let newUnreadCount = inquiry.unread_count || 0;
        let newAdminUnreadCount = inquiry.admin_unread_count || 0;
        let hasNewMessage = inquiry.has_new_message;

        if (userType === 'user') {
          // User is reading - reset user's unread count
          newUnreadCount = 0;
        } else if (userType === 'admin') {
          // Admin is reading - reset admin's unread count
          newAdminUnreadCount = 0;
        }

        // Check if there are still any unread messages
        hasNewMessage = newUnreadCount > 0 || newAdminUnreadCount > 0;

        console.log(`Marking messages read - User: ${newUnreadCount}, Admin: ${newAdminUnreadCount}, UserType: ${userType}`);

        // Update in database
        await connection.query(
          'UPDATE inquiry_conversations SET messages = ?, unread_count = ?, admin_unread_count = ?, has_new_message = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(updatedMessages), newUnreadCount, newAdminUnreadCount, hasNewMessage, inquiryId]
        );

        connection.release();

        // Notify all clients in the room
        io.to(inquiryId).emit('messages_read', {
          inquiryId: inquiryId,
          userType: userType,
          newUnreadCount: newUnreadCount,
          newAdminUnreadCount: newAdminUnreadCount,
          hasNewMessage: hasNewMessage
        });

        // Update navbar notifications
        if (userType === 'user' && userId) {
          // Get total unread count for user
          const [userInquiries] = await connection.query(
            'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
            [userId]
          );
          const totalUnread = userInquiries[0].total_unread || 0;

          io.to(`user_${userId}`).emit('unread_count_update', {
            userId: userId,
            totalUnread: totalUnread
          });
        } else if (userType === 'admin') {
          // Get total admin unread count
          const [adminInquiries] = await connection.query(
            'SELECT SUM(admin_unread_count) as total_admin_unread FROM inquiry_conversations'
          );
          const totalAdminUnread = adminInquiries[0].total_admin_unread || 0;

          io.emit('admin_unread_count_update', {
            totalAdminUnread: totalAdminUnread
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Get unread counts
  socket.on('get_unread_counts', async (data) => {
    try {
      const { userId, userType } = data;
      const connection = await pool.getConnection();

      if (userType === 'user') {
        const [result] = await connection.query(
          'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
          [userId]
        );
        const totalUnread = result[0].total_unread || 0;

        socket.emit('unread_count_update', {
          userId: userId,
          totalUnread: totalUnread
        });
      } else if (userType === 'admin') {
        const [result] = await connection.query(
          'SELECT SUM(admin_unread_count) as total_admin_unread FROM inquiry_conversations'
        );
        const totalAdminUnread = result[0].total_admin_unread || 0;

        socket.emit('admin_unread_count_update', {
          totalAdminUnread: totalAdminUnread
        });
      }

      connection.release();
    } catch (error) {
      console.error('Error getting unread counts:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ==================== ENHANCED API ENDPOINTS ====================

// Mark messages as read with user type support
app.put('/api/inquiries/:inquiryId/messages/read', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { userId, userType } = req.body;
    
    connection = await pool.getConnection();

    // Get current inquiry
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE id = ?',
      [inquiryId]
    );

    if (inquiries.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    const inquiry = inquiries[0];
    const currentMessages = JSON.parse(inquiry.messages || '[]');
    
    // Mark messages as read based on user type
    const updatedMessages = currentMessages.map(msg => {
      if (userType === 'user' && msg.sender_type === 'admin') {
        return { ...msg, is_read: true };
      } else if (userType === 'admin' && msg.sender_type === 'user') {
        return { ...msg, is_read: true };
      }
      return msg;
    });

    // Calculate new unread counts
    let newUnreadCount = inquiry.unread_count || 0;
    let newAdminUnreadCount = inquiry.admin_unread_count || 0;
    let hasNewMessage = inquiry.has_new_message;

    if (userType === 'user') {
      newUnreadCount = 0;
    } else if (userType === 'admin') {
      newAdminUnreadCount = 0;
    }

    hasNewMessage = newUnreadCount > 0 || newAdminUnreadCount > 0;

    // Update inquiry in database
    await connection.query(
      'UPDATE inquiry_conversations SET messages = ?, unread_count = ?, admin_unread_count = ?, has_new_message = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedMessages), newUnreadCount, newAdminUnreadCount, hasNewMessage, inquiryId]
    );
    
    connection.release();

    // Emit real-time update
    io.to(inquiryId).emit('messages_read', {
      inquiryId: inquiryId,
      userType: userType,
      newUnreadCount: newUnreadCount,
      newAdminUnreadCount: newAdminUnreadCount,
      hasNewMessage: hasNewMessage
    });

    res.json({ 
      success: true, 
      message: 'Messages marked as read',
      newUnreadCount: newUnreadCount,
      newAdminUnreadCount: newAdminUnreadCount,
      hasNewMessage: hasNewMessage
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark messages as read: ' + error.message 
    });
  }
});

// Removed duplicate '/api/user/unread-count' (kept a single implementation later)
// Removed unused '/api/admin/unread-count'

// ==================== ENHANCED SOCKET.IO WITH PERSISTENT UNREAD COUNT ====================

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their user ID
  socket.on('user_join', (userId) => {
    connectedUsers.set(socket.id, { userId, type: 'user' });
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  // Admin joins inquiry room
  socket.on('join_inquiry', (inquiryId) => {
    socket.join(inquiryId);
    connectedUsers.set(socket.id, { inquiryId, type: 'admin' });
    console.log(`Admin ${socket.id} joined room: ${inquiryId}`);
  });

  // User joins their personal room for notifications
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined personal notification room`);
  });

  // Handle new message with PERSISTENT UNREAD COUNT
  socket.on('send_message', async (data) => {
    try {
      const { inquiryId, message, senderType, files = [], temporaryId } = data;
      
      console.log('Received message via socket:', { inquiryId, message, senderType, temporaryId });

      const connection = await pool.getConnection();
      
      // Get current inquiry with unread_count
      const [inquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );

      if (inquiries.length === 0) {
        connection.release();
        socket.emit('message_error', { error: 'Inquiry not found', temporaryId });
        return;
      }

      const inquiry = inquiries[0];
      const currentMessages = JSON.parse(inquiry.messages || '[]');
      
      // Duplicate check: block identical content from same sender within 60s
      const lastMsg = currentMessages[currentMessages.length - 1];
      const isDup = lastMsg && lastMsg.sender_type === senderType &&
        (String(lastMsg.message || '').trim() === String(message || '').trim()) &&
        (Math.abs(new Date(lastMsg.timestamp).getTime() - Date.now()) < 60000);
      if (isDup) {
        connection.release();
        socket.emit('message_error', { error: 'Duplicate message detected', temporaryId, duplicate: true });
        return;
      }

      // Create new message
      const newMessage = {
        id: uuidv4(),
        sender_type: senderType,
        message: message,
        files: files,
        timestamp: new Date().toISOString(),
        is_read: senderType === 'admin',
        status: 'delivered'
      };

      // Add to messages array
      currentMessages.push(newMessage);

      // Calculate new unread count - CRITICAL: Only increment for admin messages
      let newUnreadCount = inquiry.unread_count || 0;
      if (senderType === 'admin') {
        newUnreadCount += 1; // Increment unread count for new admin messages
      }

      console.log(`Unread count update - Before: ${inquiry.unread_count}, After: ${newUnreadCount}, Sender: ${senderType}`);

      // Update inquiry in database with new unread count
      await connection.query(
        `UPDATE inquiry_conversations SET 
          messages = ?, 
          last_activity = NOW(),
          updated_at = NOW(),
          unread_count = ?,
          status = CASE 
            WHEN status = 'new' AND ? = 'admin' THEN 'processing'
            WHEN status = 'new' AND ? = 'user' THEN 'pending'
            ELSE status
          END
         WHERE id = ?`,
        [JSON.stringify(currentMessages), newUnreadCount, senderType, senderType, inquiryId]
      );

      connection.release();

      // Emit message to all clients in the room
      io.to(inquiryId).emit('new_message', {
        ...newMessage,
        inquiryId: inquiryId,
        temporaryId: temporaryId
      });

      // Send confirmation back to sender
      socket.emit('message_sent', {
        success: true,
        message: newMessage,
        temporaryId: temporaryId
      });
      
      // REAL-TIME NOTIFICATION: Notify user about new admin message
      if (senderType === 'admin') {
        // Emit to user's personal room
        io.to(`user_${inquiry.user_id}`).emit('new_admin_message', {
          type: 'new_message',
          inquiryId: inquiryId,
          message: message,
          inquiryNumber: inquiry.inquiry_number,
          productName: JSON.parse(inquiry.product_data).product_name,
          unreadCount: newUnreadCount,
          timestamp: new Date().toISOString()
        });

        // Also emit global notification for navbar with PERSISTENT count
        io.to(`user_${inquiry.user_id}`).emit('unread_count_update', {
          userId: inquiry.user_id,
          totalUnread: newUnreadCount
        });

        console.log(`Notification sent to user ${inquiry.user_id} for new admin message, unread count: ${newUnreadCount}`);
        try { await sendInquiryNotification(inquiry, message, 'admin'); } catch (e) { console.error('Inquiry email error:', e); }
      }

      console.log('Message saved and broadcasted:', newMessage.id);

    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('message_error', { 
        error: 'Failed to send message', 
        temporaryId: data.temporaryId 
      });
    }
  });

  // Handle message read status with PERSISTENT unread count update
  socket.on('mark_messages_read', async (data) => {
    try {
      const { inquiryId, messageIds, userId } = data;
      const connection = await pool.getConnection();

      // Get current inquiry
      const [inquiries] = await connection.query(
        'SELECT messages, user_id, unread_count FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );

      if (inquiries.length > 0) {
        const inquiry = inquiries[0];
        const currentMessages = JSON.parse(inquiry.messages || '[]');
        
        // Mark messages as read and update status
        const updatedMessages = currentMessages.map(msg => {
          if (messageIds.includes(msg.id) || (messageIds.length === 0 && msg.sender_type === 'admin')) {
            return { ...msg, is_read: true, status: 'read' };
          }
          return msg;
        });

        // Calculate EXACT unread count - only unread admin messages
        const newUnreadCount = updatedMessages.filter(msg => 
          msg.sender_type === 'admin' && !msg.is_read
        ).length;

        console.log(`Marking messages read - Before: ${inquiry.unread_count}, After: ${newUnreadCount}`);

        // Update in database with exact count
        await connection.query(
          'UPDATE inquiry_conversations SET messages = ?, unread_count = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(updatedMessages), newUnreadCount, inquiryId]
        );

        connection.release();

        // Notify all clients in the room
        io.to(inquiryId).emit('messages_read', {
          inquiryId: inquiryId,
          messageIds: messageIds.length === 0 ? 
            currentMessages.filter(msg => msg.sender_type === 'admin').map(msg => msg.id) : 
            messageIds,
          newUnreadCount: newUnreadCount
        });

        // Update navbar notification for user with PERSISTENT count
        if (userId) {
          // Get total unread count for user from database
          const [userInquiries] = await connection.query(
            'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
            [userId]
          );

          const totalUnread = userInquiries[0].total_unread || 0;

          io.to(`user_${userId}`).emit('unread_count_update', {
            userId: userId,
            totalUnread: totalUnread
          });

          console.log(`Total unread count for user ${userId}: ${totalUnread}`);
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Mark all messages as read for a user - PERSISTENT VERSION
  socket.on('mark_all_messages_read', async (data) => {
    try {
      const { userId } = data;
      const connection = await pool.getConnection();

      // Get all user inquiries
      const [inquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE user_id = ?',
        [userId]
      );

      for (const inquiry of inquiries) {
        const currentMessages = JSON.parse(inquiry.messages || '[]');
        const updatedMessages = currentMessages.map(msg => ({
          ...msg,
          is_read: msg.sender_type === 'admin' ? true : msg.is_read
        }));

        // Set unread_count to 0 for this inquiry
        await connection.query(
          'UPDATE inquiry_conversations SET messages = ?, unread_count = 0, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(updatedMessages), inquiry.id]
        );

        // Emit to inquiry room that messages are read
        io.to(inquiry.id).emit('messages_read', {
          inquiryId: inquiry.id,
          messageIds: currentMessages.filter(msg => msg.sender_type === 'admin').map(msg => msg.id),
          newUnreadCount: 0
        });
      }

      // Emit notification update for navbar
      io.to(`user_${userId}`).emit('unread_count_update', {
        userId: userId,
        totalUnread: 0
      });

      connection.release();

      console.log(`All messages marked as read for user ${userId}`);
    } catch (error) {
      console.error('Socket error marking all messages read:', error);
    }
  });

  // Get real-time unread count when user connects - FROM DATABASE
  socket.on('get_unread_count', async (data) => {
    try {
      const { userId } = data;
      const connection = await pool.getConnection();

      const [result] = await connection.query(
        'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
        [userId]
      );

      const totalUnread = result[0].total_unread || 0;

      connection.release();

      // Send current unread count from database to user
      socket.emit('unread_count_update', {
        userId: userId,
        totalUnread: totalUnread
      });

      console.log(`Initial unread count for user ${userId}: ${totalUnread}`);

    } catch (error) {
      console.error('Error getting unread count:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      connectedUsers.delete(socket.id);
    }
  });
});
// ==================== ENHANCED TIME FORMATTING ====================
const formatTimeForDisplay = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  try {
    const now = new Date();
    const time = new Date(timestamp);
    
    // Validate the date
    if (isNaN(time.getTime())) {
      return 'Invalid date';
    }
    
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show actual date and time
    return time.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Time error';
  }
};

// ==================== ENHANCED SOCKET.IO WITH PROPER TIMESTAMPS ====================
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle new message with PROPER TIMESTAMP
  socket.on('send_message', async (data) => {
    try {
      const { inquiryId, message, senderType, files = [], temporaryId } = data;
      
      console.log('Received message via socket:', { inquiryId, message, senderType, temporaryId });

      const connection = await pool.getConnection();
      
      // Get current inquiry
      const [inquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );

      if (inquiries.length === 0) {
        connection.release();
        socket.emit('message_error', { error: 'Inquiry not found', temporaryId });
        return;
      }

      const inquiry = inquiries[0];
      const currentMessages = JSON.parse(inquiry.messages || '[]');
      
      // Duplicate check: block identical content from same sender within 60s
      const lastMsg = currentMessages[currentMessages.length - 1];
      const isDup = lastMsg && lastMsg.sender_type === senderType &&
        (String(lastMsg.message || '').trim() === String(message || '').trim()) &&
        (Math.abs(new Date(lastMsg.timestamp).getTime() - Date.now()) < 60000);
      if (isDup) {
        connection.release();
        socket.emit('message_error', { error: 'Duplicate message detected', temporaryId, duplicate: true });
        return;
      }

      // Create new message with PROPER TIMESTAMP
      const newMessage = {
        id: uuidv4(),
        sender_type: senderType,
        message: message,
        files: files,
        timestamp: new Date().toISOString(),
        is_read: false,
        status: 'delivered'
      };

      // Add to messages array
      currentMessages.push(newMessage);

      // Calculate new unread count
      let newUnreadCount = inquiry.unread_count || 0;
      if (senderType === 'admin') {
        newUnreadCount += 1;
      }

      console.log(`Unread count update - Before: ${inquiry.unread_count}, After: ${newUnreadCount}, Sender: ${senderType}`);

      // Update inquiry in database
      await connection.query(
        `UPDATE inquiry_conversations SET 
          messages = ?, 
          last_activity = NOW(),
          updated_at = NOW(),
          unread_count = ?,
          status = CASE 
            WHEN status = 'new' AND ? = 'admin' THEN 'processing'
            WHEN status = 'new' AND ? = 'user' THEN 'pending'
            ELSE status
          END
         WHERE id = ?`,
        [JSON.stringify(currentMessages), newUnreadCount, senderType, senderType, inquiryId]
      );

      connection.release();

      // Emit message to all clients in the room WITH PROPER TIMESTAMP
      io.to(inquiryId).emit('new_message', {
        ...newMessage,
        inquiryId: inquiryId,
        temporaryId: temporaryId,
        formattedTime: formatTimeForDisplay(newMessage.timestamp) // ADD FORMATTED TIME
      });

      // Send confirmation back to sender
      socket.emit('message_sent', {
        success: true,
        message: newMessage,
        temporaryId: temporaryId
      });
      
      // REAL-TIME NOTIFICATION: Only show toast for admin messages
      if (senderType === 'admin') {
        // Emit to user's personal room
        io.to(`user_${inquiry.user_id}`).emit('new_admin_message', {
          type: 'new_message',
          inquiryId: inquiryId,
          message: message,
          inquiryNumber: inquiry.inquiry_number,
          productName: JSON.parse(inquiry.product_data).product_name,
          unreadCount: newUnreadCount,
          timestamp: new Date().toISOString(),
          formattedTime: formatTimeForDisplay(new Date().toISOString())
        });

        // Also emit global notification for navbar
        io.to(`user_${inquiry.user_id}`).emit('unread_count_update', {
          userId: inquiry.user_id,
          totalUnread: newUnreadCount
        });

        console.log(`Notification sent to user ${inquiry.user_id} for new admin message`);
        try { await sendInquiryNotification(inquiry, message, 'admin'); } catch (e) { console.error('Inquiry email error:', e); }
      }

      console.log('Message saved and broadcasted:', newMessage.id);

    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('message_error', { 
        error: 'Failed to send message', 
        temporaryId: data.temporaryId 
      });
    }
  });

  // ... rest of your existing socket code
});

// ==================== MARK ALL MESSAGES READ ENDPOINT - PERSISTENT ====================
app.put('/api/inquiries/mark-all-read', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    connection = await pool.getConnection();

    // Get all user inquiries
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE user_id = ?',
      [userId]
    );

    // Mark all admin messages as read in each inquiry and set unread_count to 0
    for (const inquiry of inquiries) {
      const currentMessages = JSON.parse(inquiry.messages || '[]');
      const updatedMessages = currentMessages.map(msg => ({
        ...msg,
        is_read: msg.sender_type === 'admin' ? true : msg.is_read
      }));

      await connection.query(
        'UPDATE inquiry_conversations SET messages = ?, unread_count = 0, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(updatedMessages), inquiry.id]
      );
    }

    connection.release();

    // Emit socket event for real-time update
    io.to(`user_${userId}`).emit('unread_count_update', {
      userId: userId,
      totalUnread: 0
    });

    res.json({ 
      success: true, 
      message: 'All messages marked as read' 
    });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark messages as read' 
    });
  }
});

// ==================== GET USER'S UNREAD COUNT ENDPOINT - FROM DATABASE ====================
app.get('/api/user/unread-count', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    connection = await pool.getConnection();

    const [result] = await connection.query(
      'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
      [userId]
    );

    connection.release();

    const totalUnread = result[0].total_unread || 0;

    res.json({ 
      success: true, 
      totalUnread: totalUnread 
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get unread count' 
    });
  }
});

// ==================== ENHANCED INQUIRY SYSTEM WITH PERSISTENT UNREAD COUNT ====================

// Create or get inquiry - INITIALIZE unread_count to 0
app.post('/api/inquiries', async (req, res) => {
  let connection;
  try {
    const { userId, product, customerInfo } = req.body;
    
    if (!userId || !product || !customerInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // NEW: Check for initial message to prevent empty inquiry creation
    const { initialMessage } = req.body;
    
    connection = await pool.getConnection();

    // Check if inquiry already exists for this user-product combination
    const [existingInquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE user_id = ? AND product_id = ?',
      [userId, product.id]
    );

    let inquiry;
    
    if (existingInquiries.length > 0) {
      // Existing inquiry found - use the existing one
      inquiry = existingInquiries[0];
      
      // Update inquiry timestamp but keep unread_count
      await connection.query(
        'UPDATE inquiry_conversations SET last_activity = NOW(), updated_at = NOW() WHERE id = ?',
        [inquiry.id]
      );

      console.log('Existing inquiry found:', inquiry.id, 'unread_count:', inquiry.unread_count);
    } else {
      // If creating NEW inquiry, REQUIRE an initial message
      if (!initialMessage || !initialMessage.trim()) {
         connection.release();
         // If no message, we return success: false but with a specific code or just don't create it.
         // However, the frontend expects a success if it wants to just "check".
         // But "check" should be done via GET /api/inquiries/user/... or similar.
         // This POST is for CREATION/RETRIEVAL.
         // If we strictly want to prevent empty creation, we fail here.
         return res.status(400).json({
            success: false,
            message: 'Initial message required for new inquiry'
         });
      }

      const inquiryId = generateInquiryId(userId, product.id);
      const inquiryNumber = generateInquiryNumber();

      // Prepare initial messages array
      const initialMessages = [{
          id: uuidv4(),
          sender_type: 'user',
          message: initialMessage,
          files: [],
          timestamp: new Date().toISOString(),
          is_read: true, // User's own message is read
          status: 'sent'
      }];

      // Create new inquiry with unread_count = 0 (or 1? No, user sent it, admin hasn't read it? 
      // The schema says unread_count. Is it for User or Admin?
      // Usually unread_count in this app seems to be for User (based on GET /api/user/unread-count).
      // So if User sends message, unread_count for User is 0.
      // Admin unread count is tracked differently or derived?
      // Wait, line 2610: "if (senderType === 'admin') newUnreadCount += 1".
      // So unread_count is "Unread by User".
      // So creating new inquiry (by User), unread_count = 0.
      
      await connection.query(
        `INSERT INTO inquiry_conversations (
          id, user_id, product_id, inquiry_number, 
          customer_name, customer_email, customer_phone, customer_country,
          product_data, messages, status, created_at, updated_at, last_activity, unread_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?)`,
        [
          inquiryId,
          userId,
          product.id,
          inquiryNumber,
          customerInfo.name,
          customerInfo.email,
          customerInfo.phone,
          customerInfo.country,
          JSON.stringify({
            ...product,
            selectedSize: product.selectedSize || 'Customizable',
            quantity: product.quantity || 1
          }),
          JSON.stringify(initialMessages), // Initialize with first message
          'new',
          0 // Initial unread_count = 0
        ]
      );

      const [newInquiries] = await connection.query(
        'SELECT * FROM inquiry_conversations WHERE id = ?',
        [inquiryId]
      );
      
      inquiry = newInquiries[0];
      console.log('New inquiry created:', inquiryId, 'unread_count: 0');

      // Notify admin about new inquiry via Socket.IO
      io.emit('admin_notification', {
        type: 'new_inquiry',
        inquiryId: inquiryId,
        message: 'New inquiry received',
        customerName: customerInfo.name,
        productName: product.name
      });

      // ALSO Emit specific event that AdminInquiry.jsx listens for
      io.emit('admin_new_inquiry', {
        inquiryId: inquiryId,
        customerName: customerInfo.name,
        productName: product.name,
        timestamp: new Date().toISOString()
      });

      // Send email notification for new inquiry
      try {
        await sendInquiryNotification(inquiry, initialMessage, 'user');
      } catch (emailError) {
        console.error('Failed to send new inquiry email:', emailError);
      }
    }

    // Parse the messages
    const messages = JSON.parse(inquiry.messages || '[]');

    connection.release();

    res.json({ 
      success: true, 
      inquiry: {
        ...inquiry,
        product_data: JSON.parse(inquiry.product_data),
        messages: messages,
        price_data: inquiry.price_data ? JSON.parse(inquiry.price_data) : null
      },
      isNewInquiry: existingInquiries.length === 0
    });
  } catch (error) {
    console.error('Error managing inquiry:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to manage inquiry: ' + error.message 
    });
  }
});

// Get user's inquiries - RETURN PERSISTENT unread_count
app.get('/api/inquiries/user/:userId', async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    
    connection = await pool.getConnection();
    
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE user_id = ? ORDER BY last_activity DESC',
      [userId]
    );

    const parsedInquiries = inquiries.map(inquiry => ({
      ...inquiry,
      product_data: JSON.parse(inquiry.product_data),
      messages: JSON.parse(inquiry.messages || '[]'),
      price_data: inquiry.price_data ? JSON.parse(inquiry.price_data) : null
    }));

    connection.release();

    res.json({ 
      success: true, 
      inquiries: parsedInquiries 
    });
  } catch (error) {
    console.error('Error fetching user inquiries:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user inquiries: ' + error.message 
    });
  }
});

// Get specific inquiry with real-time support
app.get('/api/inquiries/:inquiryId', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    
    connection = await pool.getConnection();
    
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE id = ?',
      [inquiryId]
    );

    if (inquiries.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    const inquiry = inquiries[0];
    const parsedInquiry = {
      ...inquiry,
      product_data: JSON.parse(inquiry.product_data),
      messages: JSON.parse(inquiry.messages || '[]'),
      price_data: inquiry.price_data ? JSON.parse(inquiry.price_data) : null
    };

    connection.release();

    res.json({ 
      success: true, 
      inquiry: parsedInquiry 
    });
  } catch (error) {
    console.error('Error fetching inquiry details:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch inquiry details: ' + error.message 
    });
  }
});

// Get all inquiries for admin - IMPROVED WITH REAL-TIME SUPPORT
app.get('/api/inquiries', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations ORDER BY last_activity DESC'
    );

    const parsedInquiries = inquiries.map(inquiry => {
      const messages = JSON.parse(inquiry.messages || '[]');
      return {
        ...inquiry,
        product_data: JSON.parse(inquiry.product_data),
        messages: messages,
        price_data: inquiry.price_data ? JSON.parse(inquiry.price_data) : null
      };
    });

    connection.release();

    res.json(parsedInquiries);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch inquiries: ' + error.message 
    });
  }
});

// Send message to inquiry - WITH PERSISTENT UNREAD COUNT
app.post('/api/inquiries/:inquiryId/messages', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { message, senderType, files = [] } = req.body;
    
    if ((!message || !message.trim()) && files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message or files are required' 
      });
    }

    connection = await pool.getConnection();

    // Get current inquiry with unread_count
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE id = ?',
      [inquiryId]
    );

    if (inquiries.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    const inquiry = inquiries[0];
    const currentMessages = JSON.parse(inquiry.messages || '[]');
    
    // Create new message
    const newMessage = {
      id: uuidv4(),
      sender_type: senderType,
      message: (message || '').trim(),
      files: files,
      timestamp: new Date().toISOString(),
      is_read: senderType === 'admin'
    };

    // Add to messages array
    currentMessages.push(newMessage);

    // Calculate new unread count - ONLY increment for admin messages
    let newUnreadCount = inquiry.unread_count || 0;
    if (senderType === 'admin') {
      newUnreadCount += 1;
    }

    console.log(`API Message - Before: ${inquiry.unread_count}, After: ${newUnreadCount}, Sender: ${senderType}`);

    // Determine new status
    let newStatus = inquiry.status;
    if (senderType === 'admin' && inquiry.status === 'new') {
      newStatus = 'processing';
    } else if (senderType === 'user' && inquiry.status === 'new') {
      newStatus = 'pending';
    }

    // Update inquiry in database with PERSISTENT unread_count
    await connection.query(
      `UPDATE inquiry_conversations SET 
        messages = ?, 
        status = ?,
        last_activity = NOW(),
        updated_at = NOW(),
        unread_count = ?
       WHERE id = ?`,
      [JSON.stringify(currentMessages), newStatus, newUnreadCount, inquiryId]
    );

    connection.release();

    // Emit real-time message to all connected clients
    io.to(inquiryId).emit('new_message', {
      ...newMessage,
      inquiryId: inquiryId
    });

    // REAL-TIME NOTIFICATION: Notify user about new admin message
    if (senderType === 'admin') {
      // Emit to user's personal room
      io.to(`user_${inquiry.user_id}`).emit('new_admin_message', {
        type: 'new_message',
        inquiryId: inquiryId,
        message: message,
        inquiryNumber: inquiry.inquiry_number,
        productName: JSON.parse(inquiry.product_data).product_name,
        unreadCount: newUnreadCount,
        timestamp: new Date().toISOString()
      });

      // Also emit global notification for navbar with PERSISTENT count
      io.to(`user_${inquiry.user_id}`).emit('unread_count_update', {
        userId: inquiry.user_id,
        totalUnread: newUnreadCount
      });
    }

    // Notify admin about new user message
    if (senderType === 'user') {
      io.emit('admin_notification', {
        type: 'new_message',
        inquiryId: inquiryId,
        message: 'New message from customer',
        customerName: inquiry.customer_name
      });
    }

    // Send email notification
    try {
      await sendInquiryNotification(inquiry, message, senderType);
    } catch (emailError) {
      console.error('Failed to send inquiry notification email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      messageData: newMessage,
      status: newStatus,
      unreadCount: newUnreadCount
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message: ' + error.message 
    });
  }
});

// Mark messages as read - WITH PERSISTENT UNREAD COUNT
app.put('/api/inquiries/:inquiryId/messages/read', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { messageIds, userId } = req.body;
    
    connection = await pool.getConnection();

    // Get current inquiry
    const [inquiries] = await connection.query(
      'SELECT * FROM inquiry_conversations WHERE id = ?',
      [inquiryId]
    );

    if (inquiries.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    const inquiry = inquiries[0];
    const currentMessages = JSON.parse(inquiry.messages || '[]');
    
    // Mark messages as read
    const updatedMessages = currentMessages.map(msg => {
      if (messageIds && messageIds.includes(msg.id)) {
        return { ...msg, is_read: true };
      } else if (!messageIds && msg.sender_type === 'admin') {
        return { ...msg, is_read: true };
      }
      return msg;
    });

    // Calculate EXACT new unread count - only unread admin messages
    const newUnreadCount = updatedMessages.filter(msg => 
      msg.sender_type === 'admin' && !msg.is_read
    ).length;

    console.log(`API Mark Read - Before: ${inquiry.unread_count}, After: ${newUnreadCount}`);

    // Update inquiry in database with exact count
    await connection.query(
      'UPDATE inquiry_conversations SET messages = ?, unread_count = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedMessages), newUnreadCount, inquiryId]
    );

    connection.release();

    // Emit real-time update
    io.to(inquiryId).emit('messages_read', {
      inquiryId: inquiryId,
      messageIds: messageIds || currentMessages.filter(msg => msg.sender_type === 'admin').map(msg => msg.id),
      newUnreadCount: newUnreadCount
    });

    // Update navbar notification for user if userId provided
    if (userId) {
      // Get total unread count for user from database
      const [userInquiries] = await connection.query(
        'SELECT SUM(unread_count) as total_unread FROM inquiry_conversations WHERE user_id = ?',
        [userId]
      );

      const totalUnread = userInquiries[0].total_unread || 0;

      io.to(`user_${userId}`).emit('unread_count_update', {
        userId: userId,
        totalUnread: totalUnread
      });
    }

    res.json({ 
      success: true, 
      message: 'Messages marked as read',
      newUnreadCount: newUnreadCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark messages as read: ' + error.message 
    });
  }
});

// Update inquiry status
app.put('/api/inquiries/:inquiryId/status', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required' 
      });
    }

    connection = await pool.getConnection();

    const [result] = await connection.query(
      'UPDATE inquiry_conversations SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, inquiryId]
    );

    // Emit status update via Socket.IO
    io.to(inquiryId).emit('inquiry_status_updated', {
      inquiryId: inquiryId,
      status: status,
      updated_at: new Date().toISOString()
    });

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update status: ' + error.message 
    });
  }
});

// Activate checkout for inquiry
app.put('/api/inquiries/:inquiryId/activate-checkout', async (req, res) => {
  let connection;
  try {
    const { inquiryId } = req.params;
    const { prices, status = 'completed' } = req.body;
    
    if (!prices || Object.keys(prices).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Price data is required' 
      });
    }

    connection = await pool.getConnection();

    const [result] = await connection.query(
      'UPDATE inquiry_conversations SET price_data = ?, status = ?, is_checkout_active = TRUE, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(prices), status, inquiryId]
    );

    // Emit checkout activation via Socket.IO
    io.to(inquiryId).emit('checkout_activated', {
      inquiryId: inquiryId,
      prices: prices,
      status: status
    });

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Checkout activated successfully',
      status: status
    });
  } catch (error) {
    console.error('Error activating checkout:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to activate checkout: ' + error.message 
    });
  }
});

// File upload for inquiry attachments
app.post('/api/inquiries/:inquiryId/upload', async (req, res) => {
  let connection;
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files were uploaded.' 
      });
    }

    const { inquiryId } = req.params;
    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
    const uploadResults = [];

    // Validate inquiry exists
    connection = await pool.getConnection();
    const [inquiries] = await connection.query(
      'SELECT id, user_id FROM inquiry_conversations WHERE id = ?',
      [inquiryId]
    );

    if (inquiries.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Inquiry not found' 
      });
    }

    const toSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let inquiryFolder = `yokebud crafts/inquiries/${inquiryId}`;
    try {
      const uid = inquiries[0] && inquiries[0].user_id;
      if (uid) {
        const [userRows] = await connection.query('SELECT first_name, last_name FROM user_profiles WHERE user_id = ? LIMIT 1', [uid]);
        let name = `user-${uid}`;
        if (userRows.length > 0) {
          const fn = userRows[0].first_name || '';
          const ln = userRows[0].last_name || '';
          const full = `${fn} ${ln}`.trim();
          name = full || name;
        }
        const userSlug = toSlug(name);
        inquiryFolder = `yokebud crafts/users/${userSlug}/inquiries/${inquiryId}`;
      }
    } catch (_) {}

    // Upload each file to Cloudinary
    for (const file of files) {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf', 
        'text/plain', 
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/vnd.rar'
      ];
      
      if (!allowedTypes.includes(file.mimetype)) {
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid file type. Only images, PDF, documents, and archives are allowed.' 
        });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: inquiryFolder,
              public_id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              resource_type: 'auto'
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
          uploadStream.end(file.data);
        });

        uploadResults.push({
          url: result.secure_url,
          public_id: result.public_id,
          name: file.name,
          type: file.mimetype,
          size: file.size
        });
      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        continue;
      }
    }

    connection.release();

    res.json({ 
      success: true, 
      message: `${uploadResults.length} file(s) uploaded successfully`,
      files: uploadResults 
    });
  } catch (error) {
    console.error('Upload endpoint error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload files',
      error: error.message 
    });
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Error', 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// Email template preview
app.get('/debug/email-preview', (req, res) => {
  const sampleContent = `<div style="color:${EMAIL_THEME.text};">
    <h2 style="margin:0 0 12px 0;color:${EMAIL_THEME.text};">Sample Notification</h2>
    <p style="margin:0;color:${EMAIL_THEME.textLight};line-height:1.7;">This is a sample preview for the current email template without logo.</p>
  </div>`;
  const html = renderThemedEmail({
    title: 'Yokebud Crafts',
    subtitle: 'Template Preview',
    contentHtml: sampleContent,
    primaryCtaText: 'Visit Website',
    primaryCtaUrl: process.env.CLIENT_URL || 'https://www.yokebud.com'
  });
  res.header('Content-Type', 'text/html');
  res.send(html);
});

// ==================== ENHANCED USER AUTHENTICATION & PROFILE ====================

// Generate OTP with 1 minute expiry
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email for enhanced authentication
const sendEnhancedOTPEmail = async (email, otp, type = 'registration') => {
  return await sendOTPEmail(email, otp, type);
};

// User Registration - Send OTP
app.post('/api/user/register/send-otp', async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    
    console.log('Registration OTP request for email:', email);
    
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
        message: 'Invalid email format'
      });
    }

    connection = await pool.getConnection();

    // Check if email already exists
    const [existingUsers] = await connection.query(
      'SELECT user_id FROM user_credentials WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (existingUsers.length > 0) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Generate and save OTP with 1 minute expiry
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

    console.log('Generated registration OTP:', otp, 'Expires at:', expiresAt);

    // Delete any existing OTPs for this email
    await connection.query(
      'DELETE FROM user_otps WHERE email = ? AND otp_type = ?',
      [email, 'registration']
    );

    // Insert new OTP
    await connection.query(
      'INSERT INTO user_otps (email, otp_code, otp_type, expires_at, attempt_count) VALUES (?, ?, ?, ?, ?)',
      [email, otp, 'registration', expiresAt, 0]
    );

    connection.release();

    // Send OTP email
    const emailSent = await sendEnhancedOTPEmail(email, otp, 'registration');

    if (!emailSent) {
      throw new Error('Failed to send OTP email');
    }

    console.log('Registration OTP sent successfully to:', email);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully' 
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP: ' + error.message 
    });
  }
});

// Verify OTP for Registration and create user
app.post('/api/user/register/verify-otp', async (req, res) => {
  let connection;
  try {
    const { email, otp, userData } = req.body;
    
    console.log('Registration OTP verification request:', { email, otp, userData });
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    connection = await pool.getConnection();

    // Verify OTP with attempt count check
    const [otps] = await connection.query(
      `SELECT * FROM user_otps 
       WHERE email = ? 
       AND otp_code = ? 
       AND otp_type = ? 
       AND is_used = 0 
       AND expires_at > NOW()
       AND attempt_count < 5`,
      [email, otp, 'registration']
    );

    console.log('Found registration OTPs:', otps);

    if (otps.length === 0) {
      // Check why OTP is invalid
      const [expiredOtps] = await connection.query(
        `SELECT * FROM user_otps 
         WHERE email = ? AND otp_code = ? AND otp_type = ?`,
        [email, otp, 'registration']
      );
      
      if (expiredOtps.length > 0) {
        if (expiredOtps[0].is_used) {
          console.log('Registration OTP already used');
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has already been used' 
          });
        } else if (expiredOtps[0].attempt_count >= 5) {
          console.log('Registration OTP exceeded max attempts');
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has been blocked due to too many failed attempts. Please request a new OTP.' 
          });
        } else {
          console.log('Registration OTP expired at:', expiredOtps[0].expires_at);
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has expired' 
          });
        }
      } else {
        // Increment attempt count for invalid OTP
        const [invalidOtps] = await connection.query(
          `SELECT * FROM user_otps 
           WHERE email = ? 
           AND otp_type = ? 
           AND is_used = 0 
           AND expires_at > NOW()`,
          [email, 'registration']
        );

        if (invalidOtps.length > 0) {
          await connection.query(
            'UPDATE user_otps SET attempt_count = attempt_count + 1 WHERE id = ?',
            [invalidOtps[0].id]
          );
        }

        console.log('No valid registration OTP found for this email and code');
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid OTP code' 
        });
      }
    }

    const otpData = otps[0];

    // Generate user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start transaction
    await connection.beginTransaction();

    try {
      // Check if user already exists (double check)
      const [existingUsers] = await connection.query(
        'SELECT user_id FROM user_credentials WHERE email = ? AND is_active = TRUE',
        [email]
      );

      if (existingUsers.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Email already registered' 
        });
      }

      // Create user credentials without password
      await connection.query(
        'INSERT INTO user_credentials (user_id, email, is_verified, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [userId, email, true]
      );

      // Create user profile with provided data
      await connection.query(
        `INSERT INTO user_profiles (
          user_id, first_name, last_name, phone,
          house_number, apartment, landmark,
          address, city, state, zip_code, country, date_of_birth, gender,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          userData?.firstName || userData?.first_name || '',
          userData?.lastName || userData?.last_name || '',
          userData?.phone || '',
          userData?.house_number || '',
          userData?.apartment || '',
          userData?.landmark || '',
          userData?.address || '',
          userData?.city || '',
          userData?.state || '',
          userData?.zipCode || userData?.zip_code || '',
          userData?.country || '',
          userData?.dateOfBirth || userData?.date_of_birth || null,
          userData?.gender || ''
        ]
      );

      // Mark OTP as used
      await connection.query(
        'UPDATE user_otps SET is_used = 1 WHERE id = ?',
        [otpData.id]
      );

      await connection.commit();

      // Get complete user data
      const [userDataResult] = await connection.query(
        `SELECT uc.user_id, uc.email, uc.firebase_uid, 
                up.first_name, up.last_name, up.phone,
                up.house_number, up.apartment, up.landmark,
                up.address, up.city, up.state, up.zip_code, up.country
       FROM user_credentials uc 
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id 
       WHERE uc.user_id = ? AND uc.is_active = TRUE`,
        [userId]
      );

      connection.release();

      if (userDataResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found after creation'
        });
      }

      const user = userDataResult[0];
      
      // Check if profile needs completion
      const needsProfileCompletion = !user.first_name || !user.last_name || !user.phone;

      console.log('New user profile completion status:', {
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        needsCompletion: needsProfileCompletion
      });

      // Generate JWT token using the function
      const token = generateToken(userId);

      try {
        await sendAccountWelcomeEmail(email, user.first_name);
      } catch (emailError) {
        console.error('Failed to send account welcome email:', emailError);
      }

      console.log('Registration completed successfully for user:', email, 'User ID:', userId);
      
      res.json({ 
        success: true, 
        message: 'Registration successful',
        token,
        user: user,
        isNewUser: true,
        needsProfileCompletion
      });

    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error('Registration OTP verification error:', error);
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed: ' + error.message 
    });
  }
});

// Send Login OTP
app.post('/api/user/login/send-otp', async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    
    console.log('Login OTP request for email:', email);
    
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
        message: 'Invalid email format'
      });
    }

    connection = await pool.getConnection();

    // Check if user exists
    const [users] = await connection.query(
      'SELECT user_id FROM user_credentials WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Email not registered' 
      });
    }

    // Generate and save OTP with 1 minute expiry
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

    console.log('Generated login OTP:', otp, 'Expires at:', expiresAt);

    // Delete any existing OTPs for this email
    await connection.query(
      'DELETE FROM user_otps WHERE email = ? AND otp_type = ?',
      [email, 'email_verification']
    );

    // Insert new OTP
    await connection.query(
      'INSERT INTO user_otps (email, otp_code, otp_type, expires_at, attempt_count) VALUES (?, ?, ?, ?, ?)',
      [email, otp, 'email_verification', expiresAt, 0]
    );

    connection.release();

    // Send OTP email
    await sendEnhancedOTPEmail(email, otp, 'email_verification');

    console.log('Login OTP sent successfully to:', email);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Login OTP error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP: ' + error.message 
    });
  }
});

// Verify Login OTP
app.post('/api/user/login/verify-otp', async (req, res) => {
  let connection;
  try {
    const { email, otp } = req.body;
    
    console.log('Login OTP verification request:', { email, otp });
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    connection = await pool.getConnection();

    // Verify OTP with attempt count check
    const [otps] = await connection.query(
      `SELECT * FROM user_otps 
       WHERE email = ? 
       AND otp_code = ? 
       AND otp_type = ? 
       AND is_used = 0 
       AND expires_at > NOW()
       AND attempt_count < 5`,
      [email, otp, 'email_verification']
    );

    console.log('Found login OTPs:', otps);

    if (otps.length === 0) {
      // Check why OTP is invalid
      const [expiredOtps] = await connection.query(
        `SELECT * FROM user_otps 
         WHERE email = ? AND otp_code = ? AND otp_type = ?`,
        [email, otp, 'email_verification']
      );
      
      if (expiredOtps.length > 0) {
        if (expiredOtps[0].is_used) {
          console.log('Login OTP already used');
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has already been used' 
          });
        } else if (expiredOtps[0].attempt_count >= 5) {
          console.log('Login OTP exceeded max attempts');
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has been blocked due to too many failed attempts. Please request a new OTP.' 
          });
        } else {
          console.log('Login OTP expired at:', expiredOtps[0].expires_at);
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'OTP has expired' 
          });
        }
      } else {
        // Increment attempt count for invalid OTP
        const [invalidOtps] = await connection.query(
          `SELECT * FROM user_otps 
           WHERE email = ? 
           AND otp_type = ? 
           AND is_used = 0 
           AND expires_at > NOW()`,
          [email, 'email_verification']
        );

        if (invalidOtps.length > 0) {
          await connection.query(
            'UPDATE user_otps SET attempt_count = attempt_count + 1 WHERE id = ?',
            [invalidOtps[0].id]
          );
        }

        console.log('No valid login OTP found for this email and code');
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid OTP code' 
        });
      }
    }

    // Get user data
    const [users] = await connection.query(
      `SELECT uc.user_id, uc.email, uc.firebase_uid, 
              up.first_name, up.last_name, up.phone,
              up.house_number, up.apartment, up.landmark,
              up.address, up.city, up.state, up.zip_code, up.country,
              up.date_of_birth
       FROM user_credentials uc 
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id 
       WHERE uc.email = ? AND uc.is_active = TRUE`,
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = users[0];
    
    // Check if profile needs completion
    const needsProfileCompletion = !user.first_name || !user.last_name || !user.phone;

    console.log('Login user profile completion status:', {
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      needsCompletion: needsProfileCompletion
    });

    // Mark OTP as used
    await connection.query(
      'UPDATE user_otps SET is_used = 1 WHERE id = ?',
      [otps[0].id]
    );

    connection.release();

    // Generate JWT token using the function
    const token = generateToken(user.user_id);

    console.log('Login OTP verification successful for user:', user.email);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: user,
      isNewUser: false,
      needsProfileCompletion
    });
  } catch (error) {
    console.error('Login verify error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Login failed: ' + error.message 
    });
  }
});

// ==================== PASSWORD RESET ====================

// Forgot Password - Send Reset Link
app.post('/api/user/forgot-password', async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    connection = await pool.getConnection();

    // Check if user exists
    const [users] = await connection.query(
      'SELECT user_id, email FROM user_credentials WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      // For security, do not reveal if user exists
      return res.json({ success: true, message: 'If your email is registered, you will receive a password reset link.' });
    }

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save to password_resets table (upsert)
    await connection.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?, created_at = NOW()',
      [email, resetToken, expiresAt, resetToken, expiresAt]
    );

    connection.release();

    // Send email
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    res.json({ success: true, message: 'If your email is registered, you will receive a password reset link.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// Reset Password - Update Password
app.post('/api/user/reset-password', async (req, res) => {
  let connection;
  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    connection = await pool.getConnection();

    // Verify token
    const [resets] = await connection.query(
      'SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()',
      [email, token]
    );

    if (resets.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await connection.query(
      'UPDATE user_credentials SET password_hash = ? WHERE email = ?',
      [hashedPassword, email]
    );

    // Delete reset token
    await connection.query(
      'DELETE FROM password_resets WHERE email = ?',
      [email]
    );

    connection.release();

    res.json({ success: true, message: 'Password has been reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// ==================== FIREBASE GOOGLE AUTHENTICATION ====================

app.post('/api/user/auth/firebase-google', async (req, res) => {
  let connection;
  try {
    const { user: firebaseUser } = req.body;
    
    console.log('Firebase Google auth request:', { email: firebaseUser?.email });
    
    if (!firebaseUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Firebase user data is required' 
      });
    }

    const { uid: firebaseUid, email, displayName, photoURL, emailVerified } = firebaseUser;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required from Firebase'
      });
    }

    // Extract first and last name from displayName
    let firstName = '';
    let lastName = '';
    if (displayName) {
      const nameParts = displayName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    connection = await pool.getConnection();

    // Check if user exists with this Firebase UID or email
    const [users] = await connection.query(
      `SELECT uc.user_id, uc.email, uc.firebase_uid, 
              up.first_name, up.last_name, up.phone,
              up.house_number, up.apartment, up.landmark,
              up.address, up.city, up.state, up.zip_code, up.country
       FROM user_credentials uc 
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id 
       WHERE uc.firebase_uid = ? OR uc.email = ?`,
      [firebaseUid, email]
    );

    let userId;
    let isNewUser = false;
    let needsProfileCompletion = false;

    if (users.length > 0) {
      // User exists
      const existingUser = users[0];
      userId = existingUser.user_id;
      
      // Check if profile needs completion
      needsProfileCompletion = !existingUser.first_name || !existingUser.last_name || !existingUser.phone;
      
      console.log('Existing user profile completion status:', {
        first_name: existingUser.first_name,
        last_name: existingUser.last_name,
        phone: existingUser.phone,
        needsCompletion: needsProfileCompletion
      });
      
      // Update Firebase UID if not set or different
      if (!existingUser.firebase_uid || existingUser.firebase_uid !== firebaseUid) {
        await connection.query(
          'UPDATE user_credentials SET firebase_uid = ?, is_verified = TRUE WHERE user_id = ?',
          [firebaseUid, userId]
        );
      }

      // Update names if they are empty but available from Firebase
      if ((!existingUser.first_name || !existingUser.last_name) && displayName) {
        await connection.query(
          'UPDATE user_profiles SET first_name = ?, last_name = ? WHERE user_id = ?',
          [firstName, lastName, userId]
        );
        // Update the needsProfileCompletion after potential update
        needsProfileCompletion = !firstName || !lastName || !existingUser.phone;
      }
    } else {
      // Create new user
      isNewUser = true;
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      needsProfileCompletion = true; // New users always need profile completion

      // Start transaction
      await connection.beginTransaction();

      try {
        // Create credentials
        await connection.query(
          'INSERT INTO user_credentials (user_id, email, firebase_uid, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          [userId, email, firebaseUid, emailVerified || true]
        );

        // Create profile with Firebase data
        await connection.query(
          `INSERT INTO user_profiles (
            user_id, first_name, last_name, created_at, updated_at
          ) VALUES (?, ?, ?, NOW(), NOW())`,
          [userId, firstName, lastName]
        );

        await connection.commit();
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      }
    }

    // Get complete user data
    const [userData] = await connection.query(
      `SELECT uc.user_id, uc.email, uc.firebase_uid, 
              up.first_name, up.last_name, up.phone,
              up.house_number, up.apartment, up.landmark,
              up.address, up.city, up.state, up.zip_code, up.country
       FROM user_credentials uc
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id
       WHERE uc.user_id = ? AND uc.is_active = TRUE`,
      [userId]
    );

    connection.release();

    if (userData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userData[0];
    
    // Double check needsProfileCompletion status
    const finalNeedsProfileCompletion = !user.first_name || !user.last_name || !user.phone;

    // Generate JWT token using the function
    const token = generateToken(userId);

    // Send welcome email for new users
    if (isNewUser) {
      try {
        await sendAccountWelcomeEmail(email, firstName || displayName || 'Valued Customer');
      } catch (emailError) {
        console.error('Failed to send welcome email for Google auth:', emailError);
      }
    }

    console.log('Firebase Google auth successful for user:', email, 'isNewUser:', isNewUser, 'needsProfileCompletion:', finalNeedsProfileCompletion);
    
    res.json({ 
      success: true, 
      message: isNewUser ? 'Registration successful' : 'Login successful',
      token,
      user: user,
      isNewUser,
      needsProfileCompletion: finalNeedsProfileCompletion
    });
  } catch (error) {
    console.error('Firebase Google auth error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Firebase authentication failed: ' + error.message 
    });
  }
});

// Get User Profile
app.get('/api/user/profile', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT uc.user_id, uc.email, uc.firebase_uid, 
              up.first_name, up.last_name, up.phone,
              up.house_number, up.apartment, up.landmark,
              up.address, up.city, up.state, up.zip_code, up.country
       FROM user_credentials uc
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id
       WHERE uc.user_id = ? AND uc.is_active = TRUE`,
      [userId]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    connection.release();

    res.json({ 
      success: true, 
      user: users[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get profile: ' + error.message 
    });
  }
});

// Update User Profile
app.put('/api/user/profile', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const userData = req.body;

    console.log('Profile update request for user:', userId, 'data:', userData);

    connection = await pool.getConnection();

    // Upsert user profile (insert if not exists, update if exists)
    // Assumes user_profiles.user_id is PRIMARY KEY or UNIQUE
    const [updateResult] = await connection.query(
      `UPDATE user_profiles SET
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone = COALESCE(?, phone),
          house_number = COALESCE(?, house_number),
          apartment = COALESCE(?, apartment),
          landmark = COALESCE(?, landmark),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state = COALESCE(?, state),
          zip_code = COALESCE(?, zip_code),
          country = COALESCE(?, country),
          updated_at = NOW()
       WHERE user_id = ?`,
      [
        userData.first_name === undefined ? null : userData.first_name,
        userData.last_name === undefined ? null : userData.last_name,
        userData.phone === undefined ? null : userData.phone,
        userData.house_number === undefined ? null : userData.house_number,
        userData.apartment === undefined ? null : userData.apartment,
        userData.landmark === undefined ? null : userData.landmark,
        userData.address === undefined ? null : userData.address,
        userData.city === undefined ? null : userData.city,
        userData.state === undefined ? null : userData.state,
        userData.zip_code === undefined ? null : userData.zip_code,
        userData.country === undefined ? null : userData.country,
        userId
      ]
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Profile not found for update'
      });
    }

    // Get updated profile
    const [users] = await connection.query(
      `SELECT uc.user_id, uc.email, uc.firebase_uid, 
              up.first_name, up.last_name, up.phone,
              up.house_number, up.apartment, up.landmark,
              up.address, up.city, up.state, up.zip_code, up.country
       FROM user_credentials uc
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id
       WHERE uc.user_id = ? AND uc.is_active = TRUE`,
      [userId]
    );

    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('Profile updated successfully for user:', userId);
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: users[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update profile: ' + error.message 
    });
  }
});

    // Get countries list (try DB, fallback to static list)
    app.get('/api/countries', async (req, res) => {
      let connection;
      try {
        connection = await pool.getConnection();

        // Try to query a countries table if it exists
        try {
          const [rows] = await connection.query('SELECT code, name FROM countries ORDER BY name');
          connection.release();
          if (rows && rows.length > 0) {
            return res.json({ success: true, countries: rows });
          }
        } catch (dbErr) {
          // If table doesn't exist or query fails, fall back to static list
          connection.release();
        }

        // Fallback static list (code, name)
        const staticCountries = [
          { code: 'AF', name: 'Afghanistan' },{ code: 'AL', name: 'Albania' },{ code: 'DZ', name: 'Algeria' },{ code: 'AD', name: 'Andorra' },{ code: 'AO', name: 'Angola' },{ code: 'AR', name: 'Argentina' },{ code: 'AM', name: 'Armenia' },{ code: 'AU', name: 'Australia' },{ code: 'AT', name: 'Austria' },{ code: 'AZ', name: 'Azerbaijan' },{ code: 'BD', name: 'Bangladesh' },{ code: 'BB', name: 'Barbados' },{ code: 'BY', name: 'Belarus' },{ code: 'BE', name: 'Belgium' },{ code: 'BJ', name: 'Benin' },{ code: 'BT', name: 'Bhutan' },{ code: 'BO', name: 'Bolivia' },{ code: 'BA', name: 'Bosnia and Herzegovina' },{ code: 'BW', name: 'Botswana' },{ code: 'BR', name: 'Brazil' },{ code: 'BN', name: 'Brunei' },{ code: 'BG', name: 'Bulgaria' },{ code: 'BF', name: 'Burkina Faso' },{ code: 'BI', name: 'Burundi' },{ code: 'KH', name: 'Cambodia' },{ code: 'CM', name: 'Cameroon' },{ code: 'CA', name: 'Canada' },{ code: 'CV', name: 'Cabo Verde' },{ code: 'CL', name: 'Chile' },{ code: 'CN', name: 'China' },{ code: 'CO', name: 'Colombia' },{ code: 'CR', name: 'Costa Rica' },{ code: 'HR', name: 'Croatia' },{ code: 'CU', name: 'Cuba' },{ code: 'CY', name: 'Cyprus' },{ code: 'CZ', name: 'Czech Republic' },{ code: 'DK', name: 'Denmark' },{ code: 'DO', name: 'Dominican Republic' },{ code: 'EC', name: 'Ecuador' },{ code: 'EG', name: 'Egypt' },{ code: 'SV', name: 'El Salvador' },{ code: 'EE', name: 'Estonia' },{ code: 'ET', name: 'Ethiopia' },{ code: 'FI', name: 'Finland' },{ code: 'FR', name: 'France' },{ code: 'DE', name: 'Germany' },{ code: 'GH', name: 'Ghana' },{ code: 'GR', name: 'Greece' },{ code: 'GT', name: 'Guatemala' },{ code: 'GN', name: 'Guinea' },{ code: 'GY', name: 'Guyana' },{ code: 'HT', name: 'Haiti' },{ code: 'HN', name: 'Honduras' },{ code: 'HU', name: 'Hungary' },{ code: 'IS', name: 'Iceland' },{ code: 'IN', name: 'India' },{ code: 'ID', name: 'Indonesia' },{ code: 'IR', name: 'Iran' },{ code: 'IQ', name: 'Iraq' },{ code: 'IE', name: 'Ireland' },{ code: 'IL', name: 'Israel' },{ code: 'IT', name: 'Italy' },{ code: 'JP', name: 'Japan' },{ code: 'JO', name: 'Jordan' },{ code: 'KZ', name: 'Kazakhstan' },{ code: 'KE', name: 'Kenya' },{ code: 'KR', name: 'South Korea' },{ code: 'KW', name: 'Kuwait' },{ code: 'KG', name: 'Kyrgyzstan' },{ code: 'LV', name: 'Latvia' },{ code: 'LB', name: 'Lebanon' },{ code: 'LT', name: 'Lithuania' },{ code: 'LU', name: 'Luxembourg' },{ code: 'MK', name: 'North Macedonia' },{ code: 'MG', name: 'Madagascar' },{ code: 'MW', name: 'Malawi' },{ code: 'MY', name: 'Malaysia' },{ code: 'MV', name: 'Maldives' },{ code: 'ML', name: 'Mali' },{ code: 'MT', name: 'Malta' },{ code: 'MH', name: 'Marshall Islands' },{ code: 'MR', name: 'Mauritania' },{ code: 'MU', name: 'Mauritius' },{ code: 'MX', name: 'Mexico' },{ code: 'MD', name: 'Moldova' },{ code: 'MC', name: 'Monaco' },{ code: 'MN', name: 'Mongolia' },{ code: 'ME', name: 'Montenegro' },{ code: 'MA', name: 'Morocco' },{ code: 'MZ', name: 'Mozambique' },{ code: 'MM', name: 'Myanmar' },{ code: 'NA', name: 'Namibia' },{ code: 'NP', name: 'Nepal' },{ code: 'NL', name: 'Netherlands' },{ code: 'NZ', name: 'New Zealand' },{ code: 'NI', name: 'Nicaragua' },{ code: 'NG', name: 'Nigeria' },{ code: 'NO', name: 'Norway' },{ code: 'OM', name: 'Oman' },{ code: 'PK', name: 'Pakistan' },{ code: 'PW', name: 'Palau' },{ code: 'PA', name: 'Panama' },{ code: 'PG', name: 'Papua New Guinea' },{ code: 'PY', name: 'Paraguay' },{ code: 'PE', name: 'Peru' },{ code: 'PH', name: 'Philippines' },{ code: 'PL', name: 'Poland' },{ code: 'PT', name: 'Portugal' },{ code: 'QA', name: 'Qatar' },{ code: 'RO', name: 'Romania' },{ code: 'RU', name: 'Russia' },{ code: 'SA', name: 'Saudi Arabia' },{ code: 'SN', name: 'Senegal' },{ code: 'RS', name: 'Serbia' },{ code: 'SC', name: 'Seychelles' },{ code: 'SL', name: 'Sierra Leone' },{ code: 'SG', name: 'Singapore' },{ code: 'SK', name: 'Slovakia' },{ code: 'SI', name: 'Slovenia' },{ code: 'SB', name: 'Solomon Islands' },{ code: 'SO', name: 'Somalia' },{ code: 'ZA', name: 'South Africa' },{ code: 'ES', name: 'Spain' },{ code: 'LK', name: 'Sri Lanka' },{ code: 'SD', name: 'Sudan' },{ code: 'SR', name: 'Suriname' },{ code: 'SE', name: 'Sweden' },{ code: 'CH', name: 'Switzerland' },{ code: 'SY', name: 'Syria' },{ code: 'TW', name: 'Taiwan' },{ code: 'TJ', name: 'Tajikistan' },{ code: 'TZ', name: 'Tanzania' },{ code: 'TH', name: 'Thailand' },{ code: 'TL', name: 'Timor-Leste' },{ code: 'TG', name: 'Togo' },{ code: 'TO', name: 'Tonga' },{ code: 'TT', name: 'Trinidad and Tobago' },{ code: 'TN', name: 'Tunisia' },{ code: 'TR', name: 'Turkey' },{ code: 'TM', name: 'Turkmenistan' },{ code: 'TV', name: 'Tuvalu' },{ code: 'UG', name: 'Uganda' },{ code: 'UA', name: 'Ukraine' },{ code: 'AE', name: 'United Arab Emirates' },{ code: 'GB', name: 'United Kingdom' },{ code: 'US', name: 'United States' },{ code: 'UY', name: 'Uruguay' },{ code: 'UZ', name: 'Uzbekistan' },{ code: 'VU', name: 'Vanuatu' },{ code: 'VA', name: 'Vatican City' },{ code: 'VE', name: 'Venezuela' },{ code: 'VN', name: 'Vietnam' },{ code: 'YE', name: 'Yemen' },{ code: 'ZM', name: 'Zambia' },{ code: 'ZW', name: 'Zimbabwe' }
        ];

        return res.json({ success: true, countries: staticCountries });
      } catch (error) {
        console.error('Countries endpoint error:', error);
        if (connection) connection.release();
        res.status(500).json({ success: false, message: 'Failed to get countries' });
      }
    });

// Get User Orders
app.get('/api/user/orders', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    connection = await pool.getConnection();

    // Lookup user email from credentials to match orders by email as a fallback
    const [credRows] = await connection.query(
      'SELECT email FROM user_credentials WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const userEmail = credRows && credRows[0] ? credRows[0].email : null;

    const [rows] = await connection.query(
      `SELECT * FROM orders 
       WHERE user_id = ? ${userEmail ? 'OR JSON_UNQUOTE(JSON_EXTRACT(customer_info, "$.email")) = ?' : ''}
       ORDER BY created_at DESC`,
      userEmail ? [userId, userEmail] : [userId]
    );

    connection.release();

    const parsed = (rows || []).map(o => {
      let customer_info = o.customer_info;
      let items = o.items;
      let totals = o.totals;
      let shipping_address = o.shipping_address;
      try { customer_info = typeof customer_info === 'string' ? JSON.parse(customer_info) : customer_info; } catch {}
      try { items = typeof items === 'string' ? JSON.parse(items) : items; } catch {}
      try { totals = typeof totals === 'string' ? JSON.parse(totals) : totals; } catch {}
      try { shipping_address = typeof shipping_address === 'string' ? JSON.parse(shipping_address) : shipping_address; } catch {}
      const firstItem = Array.isArray(items) && items[0] ? items[0] : null;
      const product_details = firstItem ? { 
        product_name: firstItem.product_name || firstItem.name || 'N/A',
        image: firstItem.image || null,
        price: firstItem.price || 0,
        quantity: firstItem.quantity || 1
      } : { product_name: 'N/A' };
      return {
        order_id: o.order_id,
        items: Array.isArray(items) ? items : [],
        product_details,
        order_date: o.created_at,
        status: o.status,
        total_amount: totals && typeof totals.total !== 'undefined' ? totals.total : null,
        shipping_address,
        payment_method: o.payment_method,
        tracking_number: o.tracking_number || null,
        shipping_status: o.shipping_status || o.status || null,
        notes: o.notes || null
      };
    });

    res.json({ success: true, orders: parsed });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to get orders: ' + error.message });
  }
});

// Get user wishlist
app.get('/api/user/wishlist', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    connection = await pool.getConnection();
    const [profileRows] = await connection.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profileRows || profileRows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Profile not found for user' });
    }
    const profileId = profileRows[0].id;
    const [rows] = await connection.query(
      `SELECT uw.product_id AS _id,
              p.product_name,
              COALESCE(p.discounted_price, p.price) AS price,
              p.images
       FROM user_wishlist uw
       JOIN products p ON p.id = uw.product_id
       WHERE uw.user_id = ?
       ORDER BY uw.added_at DESC`,
      [profileId]
    );
    connection.release();

    const wishlist = (rows || []).map(r => {
      let firstImage = null;
      try {
        const imgs = typeof r.images === 'string' ? JSON.parse(r.images || '[]') : (r.images || []);
        if (Array.isArray(imgs) && imgs.length > 0) {
          firstImage = imgs[0] || null;
        }
      } catch {}
      const image = firstImage
        ? (String(firstImage).startsWith('http') ? firstImage : `https://api.yokebud.fi${String(firstImage).startsWith('/') ? '' : '/'}${firstImage}`)
        : null;
      return { _id: r._id, product_name: r.product_name, price: r.price, image };
    });

    res.json({ success: true, wishlist });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist: ' + error.message });
  }
});

// Add item to wishlist
app.post('/api/user/wishlist', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const { product_id } = req.body || {};

    const pid = parseInt(product_id);
    if (!pid || isNaN(pid)) {
      return res.status(400).json({ success: false, message: 'Invalid product_id' });
    }

    connection = await pool.getConnection();
    const [profileRows] = await connection.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profileRows || profileRows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Profile not found for user' });
    }
    const profileId = profileRows[0].id;
    const [exists] = await connection.query('SELECT id FROM products WHERE id = ? LIMIT 1', [pid]);
    if (!exists || exists.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    try {
      await connection.query(
        'INSERT INTO user_wishlist (user_id, product_id) VALUES (?, ?)',
        [profileId, pid]
      );
      connection.release();
      return res.json({ success: true, message: 'Added to wishlist' });
    } catch (e) {
      connection.release();
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.json({ success: true, message: 'Already in wishlist' });
      }
      if (e && (e.code === 'ER_NO_REFERENCED_ROW_2' || e.errno === 1452)) {
        return res.status(400).json({ success: false, message: 'Cannot add: related user or product not found' });
      }
      return res.status(500).json({ success: false, message: 'Failed to add to wishlist: ' + (e.message || e) });
    }
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to add to wishlist: ' + error.message });
  }
});

// Remove item from wishlist
app.delete('/api/user/wishlist/:productId', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const pid = parseInt(req.params.productId);
    if (!pid || isNaN(pid)) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }

    connection = await pool.getConnection();
    const [profileRows] = await connection.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profileRows || profileRows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Profile not found for user' });
    }
    const profileId = profileRows[0].id;
    const [result] = await connection.query('DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?', [profileId, pid]);
    connection.release();
    const removed = result && result.affectedRows > 0;
    res.json({ success: true, removed });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist: ' + error.message });
  }
});

// Check if product exists in wishlist
app.get('/api/user/wishlist/check/:productId', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(200).json({ success: true, exists: false });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const pid = parseInt(req.params.productId);
    if (!pid || isNaN(pid)) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }
    connection = await pool.getConnection();
    const [profileRows] = await connection.query('SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profileRows || profileRows.length === 0) {
      connection.release();
      return res.json({ success: true, exists: false });
    }
    const profileId = profileRows[0].id;
    const [rows] = await connection.query('SELECT 1 FROM user_wishlist WHERE user_id = ? AND product_id = ? LIMIT 1', [profileId, pid]);
    connection.release();
    res.json({ success: true, exists: !!(rows && rows.length) });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to check wishlist: ' + error.message });
  }
});

// Delete User Account
app.delete('/api/user/account', async (req, res) => {
  let connection;
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    console.log('Account deletion request for user:', userId);

    connection = await pool.getConnection();

    // Soft delete user (set is_active to false)
    await connection.query(
      'UPDATE user_credentials SET is_active = FALSE, updated_at = NOW() WHERE user_id = ?',
      [userId]
    );

    connection.release();

    console.log('Account deleted successfully for user:', userId);
    
    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    console.error('Delete account error:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete account: ' + error.message 
    });
  }
});

// Logout
app.post('/api/user/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // In a real app, you might want to blacklist the token
      // For now, we'll just return success
      console.log('User logout with token');
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Logout failed: ' + error.message 
    });
  }
});


// ==================== ORDER MANAGEMENT API ====================

// Save order from checkout
  app.post('/api/checkout', async (req, res) => {
  let connection;
  try {
    const {
      customerInfo,
      paymentMethod,
      paymentId,
      items,
      customizationNotes,
      customizationFile,
      totals,
      estimatedDelivery,
      productionTime
    } = req.body;

    console.log('Received order data:', {
      customerInfo,
      paymentMethod,
      itemsCount: items?.length,
      totals
    });

    // Validate required fields
    if (!customerInfo || !items || !totals) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order data'
      });
    }

    connection = await pool.getConnection();

    const authHeader = req.headers.authorization || '';
    const tokenRaw = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    let authUserId = null;
    if (tokenRaw) {
      try {
        const decoded = jwt.verify(tokenRaw, JWT_SECRET);
        authUserId = decoded && decoded.userId ? decoded.userId : null;
      } catch (_) {}
    }

    if (paymentId) {
      const [existing] = await connection.query(
        'SELECT order_id FROM orders WHERE payment_id = ? LIMIT 1',
        [paymentId]
      );
      if (existing && existing.length) {
        connection.release();
        return res.json({
          success: true,
          message: 'Order already recorded',
          orderId: existing[0].order_id
        });
      }
    }

    await connection.beginTransaction();

    try {
      const arrItems = Array.isArray(items) ? items : [];
      for (const it of arrItems) {
        const pid = it && it.id != null ? Number(it.id) : null;
        const qty = it && it.quantity != null ? Number(it.quantity) : 0;
        if (!pid || qty <= 0) continue;
        const [prodRows] = await connection.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [pid]);
        if (!prodRows || prodRows.length === 0) throw new Error('Product not found');
        const currentStock = Number(prodRows[0].stock || 0);
        if (currentStock < qty) throw new Error('Insufficient stock');

        const [variantRows] = await connection.query('SELECT color, size, quantity FROM product_variants WHERE product_id = ? FOR UPDATE', [pid]);
        const units = Array.isArray(it.units) ? it.units : [];
        const hasVariants = Array.isArray(variantRows) && variantRows.length > 0;
        if (hasVariants && units.length > 0) {
          const map = new Map();
          for (const u of units) {
            const c = u && u.color != null ? String(u.color) : null;
            const s = u && u.size != null ? String(u.size) : null;
            const key = `${c ?? ''}|${s ?? ''}`;
            map.set(key, (map.get(key) || 0) + 1);
          }
          for (const [key, need] of map.entries()) {
            const parts = key.split('|');
            const c = parts[0] !== '' ? parts[0] : null;
            const s = parts[1] !== '' ? parts[1] : null;
            const match = (variantRows || []).find(v => (v.color == null ? c == null : String(v.color) === String(c)) && (v.size == null ? s == null : String(v.size) === String(s)));
            const available = match ? Number(match.quantity || 0) : 0;
            if (available < need) throw new Error('Insufficient variant stock');
          }
          for (const [key, dec] of map.entries()) {
            const parts = key.split('|');
            const c = parts[0] !== '' ? parts[0] : null;
            const s = parts[1] !== '' ? parts[1] : null;
            await connection.query(
              'UPDATE product_variants SET quantity = quantity - ? WHERE product_id = ? AND color <=> ? AND size <=> ?',
              [dec, pid, c, s]
            );
          }
        }
        await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, pid]);
      }
    } catch (e) {
      try { await connection.rollback(); } catch {}
      connection.release();
      return res.status(400).json({ success: false, message: e.message || 'Stock update failed' });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Prepare order data for database
    const orderData = {
      order_id: orderId,
      user_id: authUserId || null,
      customer_info: JSON.stringify(customerInfo),
      items: JSON.stringify(items),
      totals: JSON.stringify(totals),
      payment_method: paymentMethod,
      payment_id: paymentId || null,
      status: 'Pending',
      customization_data: JSON.stringify({
        notes: customizationNotes,
        file: customizationFile,
        customizationData: req.body.customizationData || {}
      }),
      design_files: JSON.stringify(req.body.designFiles || req.body.design_files || []),
      estimated_delivery: estimatedDelivery,
      production_time: productionTime,
      shipping_address: JSON.stringify({
        address: customerInfo.address,
        city: customerInfo.city,
        state: customerInfo.state,
        zip: customerInfo.zip,
        country: customerInfo.country
      }),
      billing_address: JSON.stringify({
        name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        email: customerInfo.email,
        phone: customerInfo.phone,
        address: customerInfo.address,
        city: customerInfo.city,
        state: customerInfo.state,
        zip: customerInfo.zip,
        country: customerInfo.country
      }),
      notes: customizationNotes
    };

    // Insert order into database
    const [result] = await connection.query(
      `INSERT INTO orders SET ?`,
      [orderData]
    );

    await connection.commit();
    connection.release();

    console.log('Order saved successfully:', orderId);

    // Send order confirmation email
    try {
      await sendOrderConfirmationEmail(orderId, customerInfo, items, totals);
      // Send admin notification
      await sendAdminNewOrderEmail(orderId, customerInfo, items, totals);
    } catch (e) {
      console.error('Order email error:', e.message || e);
    }

    res.json({
      success: true,
      message: 'Order placed successfully',
      orderId: orderId
    });

  } catch (error) {
    console.error('Order save error:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to save order: ' + error.message
    });
  }
});

// Upload design files for checkout
app.post('/api/checkout/upload-design', async (req, res) => {
  let connection;
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files were uploaded.' });
    }

    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
    const uploadResults = [];

    for (const file of files) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: 'Invalid file type. Only images are allowed.' });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'yokebud crafts/checkout/designs', public_id: `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, resource_type: 'auto' },
            (error, result) => { if (error) reject(error); else resolve(result); }
          );
          uploadStream.end(file.data);
        });

        uploadResults.push({ url: result.secure_url, public_id: result.public_id, name: file.name, type: file.mimetype, size: file.size });
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Failed to upload file', error: e.message });
      }
    }

    res.json({ success: true, files: uploadResults });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to upload files', error: error.message });
  }
});

// Get all orders for admin
app.get('/api/orders', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [orders] = await connection.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );

    const parsedOrders = (orders || []).map(order => {
      let customer_info = order.customer_info;
      let items = order.items;
      let totals = order.totals;
      let customization_data = order.customization_data;
      let design_files = order.design_files;
      let shipping_address = order.shipping_address;
      let billing_address = order.billing_address;
      try { customer_info = typeof customer_info === 'string' ? JSON.parse(customer_info) : customer_info; } catch {}
      try { items = typeof items === 'string' ? JSON.parse(items) : items; } catch {}
      try { totals = typeof totals === 'string' ? JSON.parse(totals) : totals; } catch {}
      try { customization_data = typeof customization_data === 'string' ? JSON.parse(customization_data) : customization_data; } catch {}
      try { design_files = typeof design_files === 'string' ? JSON.parse(design_files) : design_files; } catch {}
      try { shipping_address = typeof shipping_address === 'string' ? JSON.parse(shipping_address) : shipping_address; } catch {}
      try { billing_address = typeof billing_address === 'string' ? JSON.parse(billing_address) : billing_address; } catch {}
      const product_name = (Array.isArray(items) && items[0] && (items[0].product_name || items[0].name)) || order.product_name || 'N/A';
      return {
        ...order,
        customer_info,
        items,
        totals,
        customization_data,
        design_files,
        shipping_address,
        billing_address,
        customer_name: (customer_info && (customer_info.firstName || customer_info.lastName))
          ? `${customer_info.firstName || ''} ${customer_info.lastName || ''}`.trim()
          : 'N/A',
        customer_email: customer_info && customer_info.email ? customer_info.email : null,
        customer_phone: customer_info && customer_info.phone ? customer_info.phone : null,
        product_name
      };
    });

    connection.release();
    res.json({ success: true, orders: parsedOrders });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to fetch orders: ' + error.message });
  }
});

// Get single order details
app.get('/api/orders/:orderId', async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    
    connection = await pool.getConnection();
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    await connection.query("SET collation_connection = 'utf8mb4_unicode_ci'");

    const [orders] = await connection.query(`
      SELECT 
        o.*,
        up.first_name,
        up.last_name,
        up.phone,
        up.address as profile_address,
        up.city as profile_city,
        up.state as profile_state,
        up.zip_code as profile_zip,
        up.country as profile_country
      FROM orders o
      LEFT JOIN user_profiles up ON o.user_id = up.user_id
      WHERE BINARY o.order_id = ?
    `, [orderId]);

    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];
    
    // Parse all JSON fields
    const safeParse = (val) => {
      try {
        if (typeof val === 'string' && val.trim()) return JSON.parse(val);
      } catch (_) {}
      return val;
    };

    const parsedOrder = {
      ...order,
      customer_info: safeParse(order.customer_info),
      items: safeParse(order.items),
      totals: safeParse(order.totals),
      customization_data: safeParse(order.customization_data),
      design_files: safeParse(order.design_files),
      shipping_address: safeParse(order.shipping_address),
      billing_address: safeParse(order.billing_address)
    };

    connection.release();

    res.json({
      success: true,
      order: parsedOrder
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order: ' + error.message
    });
  }
});

// Send manual email to customer
app.post('/api/orders/:orderId/send-email', requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    connection = await pool.getConnection();
    
    const [orders] = await connection.query('SELECT customer_info FROM orders WHERE order_id = ?', [orderId]);
    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const order = orders[0];
    let customerInfo = order.customer_info;
    try { customerInfo = typeof customerInfo === 'string' ? JSON.parse(customerInfo) : customerInfo; } catch {}
    
    connection.release();
    
    await sendManualNotificationEmail(orderId, customerInfo);
    
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to send email: ' + error.message });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    const { status, delivered_at } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    connection = await pool.getConnection();

    const deliveredValue = (status && String(status).toLowerCase() === 'delivered')
      ? (delivered_at ? new Date(delivered_at) : new Date())
      : null;
    const [result] = await connection.query(
      'UPDATE orders SET status = ?, delivered_at = ?, updated_at = NOW() WHERE order_id = ?',
      [status, deliveredValue, orderId]
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get updated order
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_id = ?',
      [orderId]
    );

    const order = orders[0];
    
    // Parse JSON fields
    const parsedOrder = {
      ...order,
      customer_info: typeof order.customer_info === 'string' ? 
        JSON.parse(order.customer_info) : order.customer_info,
      items: typeof order.items === 'string' ? 
        JSON.parse(order.items) : order.items,
      totals: typeof order.totals === 'string' ? 
        JSON.parse(order.totals) : order.totals
    };

    connection.release();

    // Send order status update email
    try {
      await sendOrderStatusUpdateEmail(orderId, status, parsedOrder.customer_info, parsedOrder.tracking_number);
    } catch (e) {
      console.error('Status email error:', e.message || e);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: parsedOrder
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      message: 'Failed to update order status: ' + error.message
    });
  }
});

// Update tracking info
app.put('/api/orders/:orderId/tracking', async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    const { tracking_number, shipping_status } = req.body;
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE orders SET tracking_number = ?, shipping_status = ?, updated_at = NOW() WHERE order_id = ?',
      [tracking_number || null, shipping_status || null, orderId]
    );
    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const [orders] = await connection.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    const order = orders[0];
    let parsed = order;
    try {
      parsed = {
        ...order,
        customer_info: typeof order.customer_info === 'string' ? JSON.parse(order.customer_info) : order.customer_info,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        totals: typeof order.totals === 'string' ? JSON.parse(order.totals) : order.totals
      };

      // Send tracking update email
      if (tracking_number || shipping_status) {
        try {
          const statusToSend = shipping_status || 'Tracking Updated';
          await sendOrderStatusUpdateEmail(orderId, statusToSend, parsed.customer_info, tracking_number);
        } catch (e) {
          console.error('Tracking email error:', e.message || e);
        }
      }
    } catch {}
    connection.release();
    res.json({ success: true, order: parsed });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, message: 'Failed to update tracking: ' + error.message });
  }
});



// ==================== PRODUCT MANAGEMENT ====================

// Create product endpoint
app.post('/api/products', requireAdminAuth, async (req, res) => {
  try {
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
      is_customizable
    } = req.body;
    
    const validation = validateProductPayload(req.body);
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
    
    const connection = await pool.getConnection();
    
    // Check for duplicate SKU
    const [existingProducts] = await connection.query(
      'SELECT id FROM products WHERE sku = ?',
      [sku]
    );
    
    if (existingProducts.length > 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'SKU already exists' });
    }

    const baseSlug = slugify(slug || name);
    const uniqueSlug = await ensureUniqueSlug(connection, baseSlug);
    const imageArray = Array.isArray(images) ? images : (Array.isArray(imageUrls) ? imageUrls : []);
    const thumb = thumbnail || (imageArray[0] || null);

    // Insert product into database
    const attributesJson = JSON.stringify({ material, sizes: processedSizes, colors });
    const imagesJson = JSON.stringify(imageArray);
    const metadataJson = JSON.stringify({ tags, features, moq, shipping, warranty, bulk_discount });

    const [result] = await connection.query(
      `INSERT INTO products (
        product_name,
        product_description,
        price,
        discounted_price,
        category,
        stock,
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
        is_customizable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        finalPrice,
        finalDiscountedPrice,
        JSON.stringify(categories),
        parseInt(stock),
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
        status || 'active',
        featured ? 1 : 0,
        thumb,
        attributesJson,
        imagesJson,
        metadataJson,
        rating || 0,
        is_customizable ? 1 : 0
      ]
    );
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    for (const v of variants) {
      const qty = v && v.quantity != null ? parseInt(v.quantity) : 0;
      await connection.query(
        'INSERT INTO product_variants (product_id, color, size, quantity) VALUES (?, ?, ?, ?)',
        [result.insertId, v && v.color ? String(v.color) : null, v && v.size ? String(v.size) : null, isNaN(qty) ? 0 : qty]
      );
    }
    connection.release();

    res.json({ 
      success: true, 
      message: 'Product created successfully',
      productId: result.insertId 
    });

    // Auto-regenerate sitemap when a new product is added
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
      is_customizable
    } = req.body;

    const validation = validateProductPayload({
      name,
      description,
      price,
      categories,
      stock,
      sku,
      imageUrls
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
      'SELECT sku FROM products WHERE id = ?',
      [productId]
    );
    
    if (products.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const currentSku = products[0].sku;
    
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
    const metadataJson = JSON.stringify({ tags, features, shipping, warranty, bulk_discount });

    const [result] = await connection.query(
      `UPDATE products SET 
        product_name = ?,
        product_description = ?,
        price = ?,
        discounted_price = ?,
        category = ?,
        stock = ?,
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
        updated_at = NOW()
      WHERE id = ?`,
      [
        name,
        description,
        finalPrice,
        finalDiscountedPrice,
        JSON.stringify(categories),
        parseInt(stock),
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
        'active',
        0,
        (imageUrls[0] || null),
        attributesJson,
        imagesJson,
        metadataJson,
        0,
        is_customizable ? 1 : 0,
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
    try { if (connection) await connection.rollback(); } catch {}
    console.error('Product update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update product',
      error: error.message 
    });
  }
});

// Get single product endpoint
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    const connection = await pool.getConnection();
    const [products] = await connection.query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [sitemapPathRows] = await connection.query(
      'SELECT path FROM sitemap_entries WHERE path LIKE ? AND type = "product" LIMIT 1',
      [`/products/${productId}/%`]
    );
    const sitemapPath = sitemapPathRows.length > 0 ? sitemapPathRows[0].path : null;

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
    const priceRange = meta && meta.price_range && typeof meta.price_range === 'object' ? meta.price_range : null;
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
      moq: product.moq,
      material: product.material,
      care_instructions: product.care_instructions,
      sku: product.sku,
      shipping_info: product.shipping_info,
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
      created_at: product.created_at,
      updated_at: product.updated_at,
      rating: avgRating,
      review_count: reviewCount
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
  try {
    const connection = await pool.getConnection();
    const [products] = await connection.query(
      'SELECT * FROM products ORDER BY created_at DESC'
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
      const match = entry.path.match(/\/products\/(\d+)\//);
      if (match) {
        sitemapMap.set(Number(match[1]), entry.path);
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
        tags: JSON.parse(product.tags || '[]'),
        features: JSON.parse(product.features || '[]'),
        min_price: priceRange && priceRange.min != null ? Number(priceRange.min) : (product.discounted_price || product.price),
        max_price: priceRange && priceRange.max != null ? Number(priceRange.max) : product.price,
        slug: product.slug,
        sitemap_path: sitemapPath,
        status: product.status,
        featured: !!product.featured,
        is_customizable: product.is_customizable ? 1 : 0,
        thumbnail: product.thumbnail,
        stock: product.stock,
        sku: product.sku,
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
      } catch {}
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
      } catch {}
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
        const stream = cloudinary.uploader.upload_stream({ folder: 'yokebud crafts/reviews', resource_type: 'auto' }, (err, result) => {
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
            const r = await cloudinary.uploader.upload(f.tempFilePath, { folder: 'yokebud crafts/reviews', resource_type: 'auto' });
            results.push(r);
          } catch {}
        } else if (f.data) {
          try {
            const r = await uploadBuffer(f.data);
            results.push(r);
          } catch {}
        }
      }
      mediaUrls = results.map(r => r.secure_url);
    } catch {}

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
      } catch {}
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
        const stream = cloudinary.uploader.upload_stream({ folder: 'yokebud crafts/reviews', resource_type: 'auto' }, (err, result) => {
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
          try { const r = await cloudinary.uploader.upload(f.tempFilePath, { folder: 'yokebud crafts/reviews', resource_type: 'auto' }); results.push(r); } catch {}
        } else if (f.data) {
          try { const r = await uploadBuffer(f.data); results.push(r); } catch {}
        }
      }
      mediaUrls = results.map(r => r.secure_url);
    } catch {}

    const text = (req.body && req.body.review_text) || null;
    const title = (req.body && req.body.title) || null;
    let existingFromClient = [];
    try {
      const incoming = req.body && req.body.existing_media_json;
      if (incoming) {
        existingFromClient = Array.isArray(incoming) ? incoming : JSON.parse(incoming);
      }
    } catch {}
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
      } catch {}
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

    const [rows] = await connection.query('SELECT * FROM categories ORDER BY name ASC');
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
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
      [name, parent_id || null]
    );
    
    connection.release();
    res.json({ success: true, message: 'Category created', category: { id: result.insertId, name, parent_id } });
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
    try { if (connection) await connection.rollback(); } catch {}
    if (connection) connection.release();
    return res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
});

// Get related products
app.get('/api/products/:id/related', async (req, res) => {
  try {
    const productId = req.params.id;
    const limit = parseInt(req.query.limit) || 4;
    
    const connection = await pool.getConnection();
    
    // First get the product's categories
    const [products] = await connection.query(
      'SELECT category FROM products WHERE id = ?',
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
app.get('/share/products/:id/:slug?', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    connection.release();
    if (!rows || rows.length === 0) {
      res.status(404).send('<!doctype html><html><head><meta charset="utf-8"><title>Product Not Found</title></head><body>Product not found</body></html>');
      return;
    }

    const p = rows[0];
    const siteBase = process.env.PUBLIC_SITE_URL || 'https://www.yokebud.fi';
    const backendBase = process.env.PUBLIC_API_BASE || 'https://api.yokebud.fi';

    function toSlug(str) {
      try {
        return String(str || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80);
      } catch { return ''; }
    }

    function escapeAttr(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function absoluteImageUrl(path) {
      if (!path) return 'https://www.yokebud.fi/src/assades/LOGO.png';
      const s = String(path);
      if (s.startsWith('http')) return s;
      const clean = s.startsWith('/') ? s : `/${s}`;
      return `${backendBase}${clean}`;
    }

    let photos = [];
    try { 
      photos = p.images ? JSON.parse(p.images) : JSON.parse(p.product_photos || '[]'); 
    } catch { 
      photos = []; 
    }
    
    // Allow selecting specific image via ?img=INDEX
    let imgIdx = 0;
    if (req.query.img) {
      const parsed = parseInt(req.query.img);
      if (!isNaN(parsed) && parsed >= 0 && parsed < photos.length) {
        imgIdx = parsed;
      }
    }
    const firstImage = absoluteImageUrl(photos && photos[imgIdx]);

    const name = p.product_name || 'Product';
    const desc = String(p.product_details || p.product_description || '').slice(0, 160);
    const slug = toSlug(name);
    const [sitemapRows] = await connection.query(
      'SELECT path FROM sitemap_entries WHERE path LIKE ? AND type = "product" LIMIT 1',
      [`/products/${p.id}/%`]
    );
    const sitemapPath = sitemapRows.length > 0 ? sitemapRows[0].path : `/products/${p.id}/${slug}`;
    const canonicalUrl = `${siteBase}${sitemapPath}`;

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name,
      description: String(p.product_description || p.product_details || ''),
      sku: p.sku || String(p.id || ''),
      image: photos.map(absoluteImageUrl).slice(0, 4),
      brand: { '@type': 'Brand', name: 'Yokebud Crafts' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: Number(p.discounted_price ?? p.price ?? 0),
        availability: Number(p.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: canonicalUrl
      }
    };

    const tags = `
      <title>${escapeAttr(name)} | Yokebud Crafts</title>
      <meta name="description" content="${escapeAttr(desc)}">
      <link rel="canonical" href="${canonicalUrl}">
      <meta property="og:type" content="product">
      <meta property="og:title" content="${escapeAttr(name)}">
      <meta property="og:description" content="${escapeAttr(desc)}">
      <meta property="og:url" content="${canonicalUrl}">
      <meta property="og:site_name" content="Yokebud Crafts">
      <meta property="og:image" content="${firstImage}">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${escapeAttr(name)}">
      <meta name="twitter:description" content="${escapeAttr(desc)}">
      <meta name="twitter:image" content="${firstImage}">
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
      ${tags}
      <meta http-equiv="refresh" content="0; url=${canonicalUrl}">
    </head><body>
      <a href="${canonicalUrl}" style="font-family: sans-serif; padding: 20px; display: inline-block;">Open product</a>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    try { if (connection) connection.release(); } catch {}
    res.status(500).send('<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body>Unexpected error</body></html>');
  }
});

app.get('/api/products/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const connection = await pool.getConnection();
    const [products] = await connection.query('SELECT * FROM products WHERE slug = ?', [slug]);
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
      moq: product.moq,
      material: product.material,
      care_instructions: product.care_instructions,
      sku: product.sku,
      shipping_info: product.shipping_info,
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
  try {
    const limit = parseInt(req.query.limit) || 8;
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE status = ? AND featured = 1 ORDER BY updated_at DESC LIMIT ?', ['active', limit]);
    connection.release();
    const products = rows.map(product => ({
      id: product.id,
      product_name: product.product_name,
      product_description: product.product_details || product.product_description,
      price: product.price,
      discounted_price: product.discounted_price,
      min_price: product.discounted_price || product.price,
      max_price: product.price,
      slug: product.slug,
      thumbnail: product.thumbnail,
      product_photos: product.images ? JSON.parse(product.images || '[]') : JSON.parse(product.product_photos || '[]')
    }));
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
    let targetFolder = 'yokebud crafts/products';
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
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: targetFolder,
              public_id: uuidv4(),
              resource_type: rtype
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
        try { await connection.rollback(); } catch {}
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
      } catch (e) {}
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

    connection.release();
    res.json({ success: true, message: 'Authentication Verified' });

  } catch (error) {
    console.error('Verify Error:', error);
    if (connection) try { connection.release() } catch(e) {};
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
          await sendWelcomeEmail(email, token);
          await sendNewSubscriberNotification(email);
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
      await sendWelcomeEmail(email, subscriptionToken);
      console.log(`Confirmation email sent successfully to: ${email}`);
      emailSent = true;
    } catch (emailError) {
      console.error(`Failed to send confirmation email to ${email}:`, emailError);
      // Retry once after a short delay
      setTimeout(async () => {
        try {
          await sendWelcomeEmail(email, subscriptionToken);
          console.log(`Retry: Confirmation email sent successfully to: ${email}`);
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
    
    const slug = slugify(title);
    
    connection = await pool.getConnection();
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
    
    const slug = slugify(title);
    
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

    // Get latest products (limit to 6 for newsletter)
    const [products] = await connection.query(`
      SELECT p.*, 
             JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) as firstImage
      FROM products p 
      WHERE p.stock > 0 
      ORDER BY p.created_at DESC 
      LIMIT 6
    `);

    if (products.length === 0) {
      console.log('ℹ️ No products found for weekly newsletter');
      connection.release();
      return;
    }

    // Process product data for email
    const processedProducts = products.map(product => {
      const photos = typeof product.images === 'string' 
        ? JSON.parse(product.images) 
        : product.images || typeof product.product_photos === 'string'
        ? JSON.parse(product.product_photos)
        : product.product_photos || [];
      
      return {
        ...product,
        firstImage: photos.length > 0 ? photos[0] : null,
        min_price: product.min_price || product.price,
        max_price: product.max_price || product.price
      };
    });

    let successCount = 0;
    let errorCount = 0;

    // Send newsletter to each subscriber
    for (const subscriber of subscribers) {
      try {
        const success = await sendWeeklyNewsletter(subscriber, processedProducts);
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
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
  nextMonday.setHours(10, 0, 0, 0);

  const timeUntilNextMonday = nextMonday.getTime() - now.getTime();

  console.log(`📅 Weekly newsletter scheduled for: ${nextMonday}`);

  // Schedule first run
  setTimeout(() => {
    sendWeeklyNewsletters();
    // Set up recurring weekly interval
    setInterval(sendWeeklyNewsletters, 7 * 24 * 60 * 60 * 1000);
  }, timeUntilNextMonday);
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
// Public dynamic sitemap endpoints so Hostinger frontend can delegate XML to this API.
// These always regenerate from DB and then stream fresh XML, so sitemap URLs
// stay in sync with AdminSitemap changes without redeploying the dist.
app.get(['/sitemap.xml', '/product-sitemap.xml', '/category-sitemap.xml', '/page-sitemap.xml', '/blog-sitemap.xml'], async (req, res) => {
  try {
    const result = await regenerateSitemap();

    const mapPath = (() => {
      if (req.path === '/product-sitemap.xml') return result.productPath;
      if (req.path === '/category-sitemap.xml') return result.categoryPath;
      if (req.path === '/page-sitemap.xml') return result.pagePath;
      if (req.path === '/blog-sitemap.xml') return result.blogPath;
      return result.path;
    })();

    const xml = fs.readFileSync(mapPath, 'utf8');
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
        // Long-term cache for hashed assets Vite places in /assets/
        if (filePath.includes(path.sep + 'assets' + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }
        // Default: rely on ETag/Last-Modified
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    }));

    // Explicitly serve robots.txt (sitemaps are served dynamically from DB above)

    app.get('/robots.txt', (req, res) => {
      res.type('text/plain');
      res.sendFile(path.join(distDir, 'robots.txt'), (err) => {
        if (err) {
          res.sendFile(path.join(__dirname, '..', 'client', 'public', 'robots.txt'));
        }
      });
    });

    // SPA fallback with Dynamic SEO for product pages
    app.get([
      '/',
      /^\/(?!api|uploads|assets|.*sitemap.*\.xml|sitemap\.xsl|robots\.txt|health|debug\/email-preview|.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|xsl)$).*/
    ], async (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const indexPath = path.join(distDir, 'index.html');
      
      // If the request is for a product page, inject dynamic meta tags
      const productMatch = req.path.match(/\/products\/(\d+)/);
      if (productMatch) {
        const productId = productMatch[1];
        let connection;
        try {
          connection = await pool.getConnection();
          const [rows] = await connection.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
          connection.release();

          if (rows.length > 0) {
            const product = rows[0];
            let html = fs.readFileSync(indexPath, 'utf8');

            const name = product.product_name || 'Product';
            const desc = (product.product_description || '').replace(/<[^>]*>?/gm, '').slice(0, 160);
            
            let imageUrl = 'https://www.yokebud.fi/logo.jpg';
            try {
              const images = JSON.parse(product.images || product.product_photos || '[]');
              if (images.length > 0) {
                const firstImg = images[0];
                imageUrl = firstImg.startsWith('http') ? firstImg : `https://api.yokebud.fi${firstImg.startsWith('/') ? '' : '/'}${firstImg}`;
              }
            } catch (e) {}

            const url = `https://www.yokebud.fi${req.originalUrl}`;

            // Inject Meta Tags
            const metaTags = `
    <!-- Dynamic Meta Tags for ${name} -->
    <title>${name} | Yokebud Crafts</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="product" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${name}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${imageUrl}" />
            `;

            // Replace existing meta tags or inject into head
            // Simple approach: remove common meta tags and inject our own
            html = html.replace(/<title>.*?<\/title>/, '');
            html = html.replace(/<meta name="description" content=".*?" \/>/, '');
            html = html.replace(/<meta property="og:.*?" content=".*?" \/>/g, '');
            html = html.replace(/<meta name="twitter:.*?" content=".*?" \/>/g, '');
            
            html = html.replace('<head>', `<head>${metaTags}`);

            return res.send(html);
          }
        } catch (err) {
          console.error('Error injecting dynamic meta tags:', err);
          if (connection) connection.release();
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
      ['UPDATE_SYNC', id, JSON.stringify(oldEntry), JSON.stringify({...req.body, syncResults}), ADMIN_ID]
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

app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
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
