# Configuration Files & Package Dependencies

## 1. Frontend package.json

```json
{
  "name": "yokebud-crafts-frontend",
  "version": "1.0.0",
  "description": "E-commerce frontend for Yokebud Crafts",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "analyze": "vite build --mode analyze"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "react-helmet-async": "^2.0.4",
    "axios": "^1.6.5",
    "lucide-react": "^0.321.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.11",
    "rollup-plugin-visualizer": "^5.12.0",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "@axe-core/react": "^4.8.4"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

## 2. Backend package.json

```json
{
  "name": "yokebud-crafts-backend",
  "version": "1.0.0",
  "description": "E-commerce backend API for Yokebud Crafts",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --coverage",
    "migrate": "node scripts/migrate.js"
  },
  "keywords": ["ecommerce", "api", "nodejs", "express", "mysql"],
  "author": "Yokebud Crafts",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.9.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express-rate-limit": "^7.1.5",
    "express-mongo-sanitize": "^2.2.0",
    "xss-clean": "^0.1.4",
    "compression": "^1.7.4",
    "node-cache": "^5.1.2",
    "sharp": "^0.33.2",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.3",
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

## 3. Vite Configuration (vite.config.js)

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
      // Remove React DevTools in production
      babel: {
        plugins: mode === 'production' ? ['babel-plugin-react-remove-properties'] : [],
      },
    }),
    // Bundle analyzer
    mode === 'analyze' && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },

  // Build optimization
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        dead_code: true,
        unused: true,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk for React libraries
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          
          // Separate chunk for icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          
          // Separate chunk for axios
          if (id.includes('node_modules/axios')) {
            return 'http';
          }
          
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg|webp)$/.test(name ?? '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    
    // Source maps for production debugging (optional)
    sourcemap: false,
  },

  // Development server
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'https://api.yokebud.fi',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },

  // CSS optimization
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
}));
```

## 4. ESLint Configuration (.eslintrc.cjs)

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: '18.2',
    },
  },
  plugins: ['react', 'react-hooks', 'react-refresh'],
  rules: {
    'react/prop-types': 'off', // Turn off if using TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed in React 18+
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
```

## 5. Environment Variables

### Frontend (.env)

```bash
# .env.development
VITE_API_URL=https://api.yokebud.fi/api
VITE_ENV=development

# .env.production
VITE_API_URL=https://your-backend.onrender.com/api
VITE_ENV=production
VITE_SITE_URL=https://yourdomain.com
```

### Backend (.env)

```bash
# .env
NODE_ENV=production
PORT=5000

# Database Configuration
DB_HOST=your-mysql-host.com
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=yokebud_crafts
DB_PORT=3306

# Frontend URL (CORS)
FRONTEND_URL=https://yourdomain.com

# App URL (for keep-alive)
APP_URL=https://your-backend.onrender.com

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRE=7d
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache
ENABLE_KEEP_ALIVE=false

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Email (optional - for order confirmations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 6. .gitignore

```gitignore
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build
/dist

# Environment Variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Uploads
uploads/

# Cache
.cache/
.parcel-cache/

# Build analysis
stats.html
```

## 7. Hostinger Deployment Configuration

### Build Settings for Hostinger

Create a `build.sh` script:

```bash
#!/bin/bash
# build.sh

echo "Installing dependencies..."
npm ci

echo "Building production bundle..."
npm run build

echo "Build complete! Files are in dist/ directory"
ls -la dist/
```

### .htaccess (for Hostinger/Apache)

Create this file in your `public/` directory:

```apache
# public/.htaccess

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Enable browser caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType application/pdf "access plus 1 month"
  ExpiresByType image/x-icon "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "DENY"
  Header set X-XSS-Protection "1; mode=block"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# SPA routing - redirect all to index.html
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## 8. Render.com Configuration (Backend)

### render.yaml

```yaml
services:
  - type: web
    name: yokebud-crafts-api
    env: node
    region: ohio # Choose region closest to your users
    plan: starter # or free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DB_HOST
        sync: false # Set manually in Render dashboard
      - key: DB_USER
        sync: false
      - key: DB_PASSWORD
        sync: false
      - key: DB_NAME
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: FRONTEND_URL
        value: https://yourdomain.com
    healthCheckPath: /health
    autoDeploy: true
```

## 9. MySQL Database Schema

```sql
-- database/schema.sql

CREATE DATABASE IF NOT EXISTS yokebud_crafts;
USE yokebud_crafts;

-- Products table
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  image VARCHAR(500),
  in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_price (price),
  INDEX idx_created_at (created_at),
  FULLTEXT INDEX idx_search (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('customer', 'admin') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  shipping_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order items table
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cart table
CREATE TABLE cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_product (user_id, product_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 10. Deployment Checklist

### Frontend (Hostinger)

```bash
# 1. Build the production bundle
npm run build

# 2. Upload dist/ folder contents to Hostinger public_html/
# Use FileZilla or Hostinger's File Manager

# 3. Ensure .htaccess is in place

# 4. Set environment variables in Hostinger control panel:
#    - VITE_API_URL=https://your-backend.onrender.com/api
#    - VITE_SITE_URL=https://yourdomain.com

# 5. Test the deployment
# Visit https://yourdomain.com
# Check console for errors
# Run Lighthouse audit
```

### Backend (Render)

```bash
# 1. Push code to GitHub
git add .
git commit -m "Production ready"
git push origin main

# 2. Connect GitHub repo to Render

# 3. Set environment variables in Render dashboard:
#    - NODE_ENV=production
#    - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
#    - JWT_SECRET
#    - FRONTEND_URL=https://yourdomain.com

# 4. Deploy and monitor logs

# 5. Test API endpoints
curl https://your-backend.onrender.com/health
curl https://your-backend.onrender.com/api/products
```

## Installation Commands Summary

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install

# Run development
npm run dev  # in both directories

# Build for production
npm run build  # frontend only
```

## Expected File Structure

```
yokebud-crafts/
├── frontend/
│   ├── public/
│   │   ├── .htaccess
│   │   ├── robots.txt
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── App.jsx
│   ├── .env.development
│   ├── .env.production
│   ├── vite.config.js
│   ├── package.json
│   └── .gitignore
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── database/
│   ├── .env
│   ├── server.js
│   ├── package.json
│   └── render.yaml
└── README.md
```
