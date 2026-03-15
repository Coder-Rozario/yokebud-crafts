import fs from 'fs';
import path from 'path';
import axios from 'axios';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load DB credentials from Backend/.env
dotenv.config({ path: path.join(__dirname, '..', '..', 'Backend', '.env') });

const SITE_BASE = process.env.SITE_BASE || 'https://www.yokebud.fi';
const API_BASE = process.env.API_BASE || 'https://api.yokebud.fi';
const OUT_FILE = path.join(__dirname, '..', 'public', 'sitemap.xml');
const PRODUCT_SITEMAP_FILE = path.join(__dirname, '..', 'public', 'product-sitemap.xml');
const CATEGORY_SITEMAP_FILE = path.join(__dirname, '..', 'public', 'category-sitemap.xml');
const PAGE_SITEMAP_FILE = path.join(__dirname, '..', 'public', 'page-sitemap.xml');
const BLOG_SITEMAP_FILE = path.join(__dirname, '..', 'public', 'blog-sitemap.xml');

// DB Config from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  connectTimeout: 60000
};

const toSlug = (str) => {
  try {
    const s = String(str || '').toLowerCase().trim();
    return s.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
  } catch { return ''; }
};

const xmlEscape = (value) => {
  try {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  } catch {
    return '';
  }
};

async function fetchDataFromDB() {
  let connection;
  try {
    console.log('Connecting to database for sitemap data...');
    connection = await mysql.createConnection(dbConfig);
    
    // Always read all rows from sitemap_entries so XML reflects DB table
    const [entries] = await connection.query(
      'SELECT id, path, priority, changefreq, type, is_active, created_at, updated_at FROM sitemap_entries WHERE 1'
    );
    const [products] = await connection.query('SELECT * FROM products');
    
    console.log(`Fetched ${entries.length} entries and ${products.length} products from database.`);
    return { entries, products };
  } catch (error) {
    console.error('Failed to fetch from database:', error.message);
    return null;
  } finally {
    if (connection) await connection.end();
  }
}

async function fetchBlogsFromDB() {
  let connection;
  try {
    console.log('Connecting to database for blog sitemap data...');
    connection = await mysql.createConnection(dbConfig);
    const [blogs] = await connection.query(
      'SELECT title, excerpt, updated_at, created_at, is_published FROM blogs WHERE is_published = TRUE ORDER BY created_at DESC'
    );
    console.log(`Fetched ${blogs.length} blogs from database.`);
    return blogs;
  } catch (error) {
    console.error('Failed to fetch blogs from database:', error.message);
    return [];
  } finally {
    if (connection) await connection.end();
  }
}

async function fetchAllProducts() {
  try {
    const res = await axios.get(`${API_BASE}/api/products`, { timeout: 10000 });
    const data = res.data;
    const products = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
    console.log(`Fetched ${products.length} products from API.`);
    return products;
  } catch (e) {
    console.warn('API call for products failed, will try database or fallback.');
    return null;
  }
}

async function fetchSitemapEntries() {
  try {
    const res = await axios.get(`${API_BASE}/api/sitemap/entries`, { timeout: 10000 });
    if (res.data && res.data.success) {
      return res.data.data || [];
    }
    return null;
  } catch (e) {
    console.warn('API call for sitemap entries failed, will try database or fallback.');
    return null;
  }
}

async function fetchCategories() {
  try {
    const res = await axios.get(`${API_BASE}/api/categories`, { timeout: 10000 });
    const data = res.data;
    const categories = Array.isArray(data)
      ? data
      : (Array.isArray(data?.categories) ? data.categories : []);
    console.log(`Fetched ${categories.length} categories from API.`);
    return categories;
  } catch (e) {
    console.warn('API call for categories failed, continuing without category filters.');
    return [];
  }
}

function buildXml({ entries, products, categories = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  const allUrls = [];
  const productUrls = [];
  const categoryUrls = [];
  const pageUrls = [];

  // Static and Category URLs from database
  for (const e of entries) {
    const type = String(e.type || '').trim().toLowerCase();
    const active =
      e.is_active === undefined || e.is_active === null
        ? true
        : !(e.is_active === 0 || e.is_active === '0' || e.is_active === false);
    if (!active) continue;

    const base = {
      loc: `${SITE_BASE}${e.path}`,
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
          : 'Other',
      images: []
    };

    allUrls.push(base);
    if (type === 'static') pageUrls.push(base);
    if (type === 'category') categoryUrls.push(base);
    if (type === 'product') productUrls.push(base);
  }

  // Products from Database if synced
  const productEntries = entries.filter(e => e.type === 'product');
  const excludedPaths = entries.filter(e => e.type === 'product_exclude').map(e => e.path);

  // Helper to find category for a path
  const findProductCategory = (path) => {
    const idMatch = path.match(/\/products\/(\d+)\//);
    if (idMatch) {
      const id = parseInt(idMatch[1]);
      const p = products.find(prod => (prod.id || prod.product_id) == id);
      if (p) {
        let category = 'Uncategorized';
        try {
          if (p.categories && Array.isArray(p.categories) && p.categories.length > 0) {
            category = p.categories[0];
          } else if (p.category) {
            const parsed = typeof p.category === 'string' && (p.category.startsWith('[') || p.category.startsWith('{')) ? JSON.parse(p.category) : p.category;
            category = Array.isArray(parsed) ? parsed[0] : parsed;
          }
        } catch {}
        return category;
      }
    }
    return 'Products';
  };

  for (const pe of productEntries) {
    if (excludedPaths.includes(pe.path)) continue;
    const item = {
      loc: `${SITE_BASE}${pe.path}`,
      priority: pe.priority || '0.8',
      changefreq: pe.changefreq || 'weekly',
      lastmod: today,
      category: findProductCategory(pe.path),
      images: [] // Optionally fetch images too
    };
    allUrls.push(item);
    productUrls.push(item);
  }

  // Any products NOT in database yet (Dynamic fallback)
  const syncedPaths = productEntries.map(e => e.path);
  for (const p of products) {
    const id = p.id || p.product_id || p._id || p.slug || '';
    const name = p.product_name || p.name || 'product';
    const slug = toSlug(name);
    const locPath = `/products/${id}/${slug}`;
    const loc = `${SITE_BASE}${locPath}`;
    
    if (excludedPaths.includes(locPath) || syncedPaths.includes(locPath)) continue;

    let category = 'Uncategorized';
    try {
      if (p.categories && Array.isArray(p.categories) && p.categories.length > 0) {
        category = p.categories[0];
      } else if (p.category) {
        const parsed = typeof p.category === 'string' && (p.category.startsWith('[') || p.category.startsWith('{')) ? JSON.parse(p.category) : p.category;
        category = Array.isArray(parsed) ? parsed[0] : parsed;
      }
    } catch {}

    let images = [];
    try {
      const rawImgs = p.images || p.product_photos || [];
      const imgList = typeof rawImgs === 'string' ? JSON.parse(rawImgs) : rawImgs;
      images = (Array.isArray(imgList) ? imgList : []).map(x => {
        const s = String(x || '');
        if (s.startsWith('http')) return s;
        const clean = s.startsWith('/') ? s : `/${s}`;
        return `${API_BASE}${clean}`;
      }).filter(Boolean).slice(0, 4);
    } catch {}

    const item = {
      loc,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: today,
      category,
      images
    };
    allUrls.push(item);
    productUrls.push(item);
  }

  // Dynamic category filter URLs that match Home.jsx / Navbar.jsx filter sidebar
  try {
    const craftsRoot = categories.find((c) => {
      const n = String(c.name || '').trim().toLowerCase();
      return (
        n === 'crafts items' ||
        n === 'crafts item' ||
        n === 'crafts' ||
        n === 'craft' ||
        n.includes('craft') ||
        n.includes('accessories')
      );
    });

    const apparelRoot = categories.find((c) => {
      const n = String(c.name || '').trim().toLowerCase();
      return (
        n === 'apparel' ||
        n === 'apparels' ||
        n === 'customize appriales' ||
        n === 'customize apparel' ||
        n === 'clothing' ||
        n === 'apprial' ||
        n === 'apprials' ||
        n.includes('apparel') ||
        n.includes('clothing')
      );
    });

    const craftsSub = categories.filter(
      (c) => craftsRoot && String(c.parent_id) === String(craftsRoot.id)
    );
    const apparelSub = categories.filter(
      (c) => apparelRoot && String(c.parent_id) === String(apparelRoot.id)
    );

    const dynamicTabs = [];

    for (const c of craftsSub) {
      const name = String(c.name || '').trim();
      if (!name) continue;
      dynamicTabs.push({ section: 'crafts', name });
    }
    for (const c of apparelSub) {
      const name = String(c.name || '').trim();
      if (!name) continue;
      dynamicTabs.push({ section: 'apparel', name });
    }

    // Also include the default tabs used in Home.jsx / Navbar.jsx
    const defaultCrafts = ['Jewelry', 'Show Pieces', 'Key Rings'];
    const defaultApparel = ['Hoodies', 'T-shirts'];

    defaultCrafts.forEach((name) => dynamicTabs.push({ section: 'crafts', name }));
    defaultApparel.forEach((name) => dynamicTabs.push({ section: 'apparel', name }));

    // Prevent duplicate URLs
    const existingCategoryPaths = new Set(
      categoryUrls.map((u) => {
        try {
          const url = new URL(u.loc);
          return url.pathname + (url.search || '');
        } catch {
          return u.loc.replace(SITE_BASE, '');
        }
      })
    );

    for (const tab of dynamicTabs) {
      const slug = toSlug(tab.name);
      if (!slug) continue;
      const path = `/?section=${tab.section}&category=${slug}`;
      if (existingCategoryPaths.has(path)) continue;

      const item = {
        loc: `${SITE_BASE}${path}`,
        priority: '0.6',
        changefreq: 'weekly',
        lastmod: today,
        category: 'Categories',
        images: []
      };

      existingCategoryPaths.add(path);
      categoryUrls.push(item);
      allUrls.push(item);
    }
  } catch (e) {
    console.warn('Failed to build dynamic category filter URLs:', e.message || e);
  }

  // Sort helper
  const sortUrls = (arr) => {
    arr.sort((a, b) => {
    const catComp = a.category.localeCompare(b.category);
    if (catComp !== 0) return catComp;
    return parseFloat(b.priority) - parseFloat(a.priority);
    });
  };

  sortUrls(allUrls);
  sortUrls(productUrls);
  sortUrls(categoryUrls);
  sortUrls(pageUrls);

  const buildXmlFromList = (list) => {
    const nodes = list.map(d => {
      const parts = [];
      parts.push('  <url>');
      parts.push(`    <loc>${xmlEscape(d.loc)}</loc>`);
      parts.push(`    <lastmod>${xmlEscape(d.lastmod)}</lastmod>`);
      parts.push(`    <changefreq>${xmlEscape(d.changefreq)}</changefreq>`);
      parts.push(`    <priority>${xmlEscape(d.priority)}</priority>`);
      if (d.category) {
        parts.push(`    <category>${xmlEscape(d.category)}</category>`);
      }
      for (const img of d.images || []) {
        if (!img) continue;
        parts.push('    <image:image>');
        parts.push(`      <image:loc>${xmlEscape(img)}</image:loc>`);
        parts.push('    </image:image>');
      }
      parts.push('  </url>');
      return parts.join('\n');
    });
    return `${header}\n${nodes.join('\n')}\n</urlset>\n`;
  };

  return {
    // Full URL list is still available if ever needed,
    // but we no longer write it to sitemap.xml in the client build.
    mainXml: buildXmlFromList(allUrls),
    productXml: buildXmlFromList(productUrls),
    categoryXml: buildXmlFromList(categoryUrls),
    pageXml: buildXmlFromList(pageUrls)
  };
}

function buildBlogSitemapXml(blogs = [], entries = []) {
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

  const findConfigForPath = (path) => {
    if (!Array.isArray(entries)) return undefined;
    return entries.find(
      (e) =>
        e &&
        typeof e.path === 'string' &&
        e.path === path &&
        (e.type === 'blog' || e.type === 'static' || e.type === 'category' || !e.type)
    );
  };

  const header =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
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
      `    <loc>${SITE_BASE}${mainPath}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>${mainFreq}</changefreq>\n` +
      `    <priority>${mainPriority}</priority>\n` +
      `  </url>`
    );
  }

  // Individual blog posts
  for (const b of blogs || []) {
    const slugFromTitle = createSlug(b.title, b.excerpt);
    const pathPart = slugFromTitle ? `/blogs/${slugFromTitle}` : `/blogs/${b.slug || ''}`;
    const cfg = findConfigForPath(pathPart);
    if (!isEntryActive(cfg)) continue;

    const loc = `${SITE_BASE}${pathPart}`;
    const lastmodSource = b.updated_at || b.created_at || new Date();
    const lastmod =
      lastmodSource instanceof Date
        ? lastmodSource.toISOString().slice(0, 10)
        : new Date(lastmodSource).toISOString().slice(0, 10);
    const freq = (cfg && cfg.changefreq) || 'weekly';
    const priority = (cfg && cfg.priority) || '0.5';

    nodes.push(
      `  <url>\n` +
      `    <loc>${loc}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${freq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n` +
      `  </url>`
    );
  }

  return `${header}\n${nodes.join('\n')}\n</urlset>\n`;
}

async function main() {
  // 1) Try to fetch everything directly from the database (primary source of truth)
  let entries = null;
  let products = null;

  const dbData = await fetchDataFromDB();
  if (dbData) {
    entries = dbData.entries;
    products = dbData.products;
  }

  // 2) If DB is missing anything, fall back to API
  if (!entries || !products) {
    console.log('Database incomplete, attempting API as fallback...');
    if (!entries) {
      entries = await fetchSitemapEntries();
    }
    if (!products) {
      products = await fetchAllProducts();
    }
  }

  // Final fallbacks if everything else fails
  if (!entries) {
    console.warn('Using hardcoded fallback for sitemap entries');
    entries = [
      { path: '/', priority: '1.0', changefreq: 'weekly', type: 'static' },
      { path: '/about', priority: '0.8', changefreq: 'monthly', type: 'static' },
      { path: '/contact', priority: '0.8', changefreq: 'monthly', type: 'static' },
      { path: '/cart', priority: '0.6', changefreq: 'weekly', type: 'static' },
      { path: '/policy', priority: '0.5', changefreq: 'yearly', type: 'static' },
      { path: '/return', priority: '0.5', changefreq: 'yearly', type: 'static' },
      { path: '/shipping', priority: '0.5', changefreq: 'yearly', type: 'static' }
    ];
  }
  if (!products) {
    products = [];
  }

  const blogs = await fetchBlogsFromDB();
  const categories = await fetchCategories();

  const { mainXml, productXml, categoryXml, pageXml } = buildXml({ entries, products, categories });
  const blogXml = buildBlogSitemapXml(blogs, entries);

  // For static deployment (Netlify, etc.) we want /sitemap.xml to be
  // a sitemap INDEX that links to the four child sitemaps, not a huge
  // list of every product/page URL. The backend server route already
  // does this; we mirror that structure here for the built client.
  const today = new Date().toISOString().slice(0, 10);
  const indexXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE_BASE}/page-sitemap.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE_BASE}/category-sitemap.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE_BASE}/product-sitemap.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `  <sitemap>\n` +
    `    <loc>${SITE_BASE}/blog-sitemap.xml</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `  </sitemap>\n` +
    `</sitemapindex>\n`;

  // Write index plus the section sitemaps
  fs.writeFileSync(OUT_FILE, indexXml, 'utf8');
  fs.writeFileSync(PRODUCT_SITEMAP_FILE, productXml, 'utf8');
  fs.writeFileSync(CATEGORY_SITEMAP_FILE, categoryXml, 'utf8');
  fs.writeFileSync(PAGE_SITEMAP_FILE, pageXml, 'utf8');
  fs.writeFileSync(BLOG_SITEMAP_FILE, blogXml, 'utf8');

  console.log(`Sitemaps generated:
- main: ${OUT_FILE}
- product: ${PRODUCT_SITEMAP_FILE}
- category: ${CATEGORY_SITEMAP_FILE}
- page: ${PAGE_SITEMAP_FILE}
- blog: ${BLOG_SITEMAP_FILE}
Entries: ${entries.length}, Products: ${products.length}, Blogs: ${blogs.length}`);
}

main().catch((e) => {
  console.error('Sitemap generation failed:', e.message || e);
  process.exitCode = 1;
});
