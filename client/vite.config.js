// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      include: ['**/*.jsx', '**/*.js'],
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', {
            runtime: 'automatic'
          }]
        ]
      }
    })
  ],
  server: {
    host: true, // ✅ Enable access from other devices on same network
    hmr: {
      port: 5174, // Ensure HMR uses the same port
    },
    proxy: {
      '/api': {
        target: 'https://api.yokebud.fi',
        changeOrigin: true,
        secure: false,
      }
      // NOTE: All sitemap XML files (sitemap.xml, page-sitemap.xml, product-sitemap.xml,
      // category-sitemap.xml, blog-sitemap.xml, etc.) are now served statically
      // from the React client's public folder instead of being proxied to the API.
    }
  },
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion', 'react-icons'],
          utils: ['axios', 'react-router-dom']
        }
      }
    },
    // Enable source maps for debugging but compress them
    sourcemap: false,
    // Use esbuild minifier to avoid Rollup/Terser getter mutation bug
    minify: 'esbuild',
    // Optimize CSS
    cssCodeSplit: true,
    // Set chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Enable gzip compression
    reportCompressedSize: false,
    // Optimize assets
    assetsInlineLimit: 4096
  },
  // Esbuild options for minification
  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug']
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', '@mui/material', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage']
  }
});
