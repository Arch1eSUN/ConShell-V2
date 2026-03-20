import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix cbw-sdk / Coinbase Wallet preact resolution
      'preact/hooks': 'preact/hooks',
    },
  },
  optimizeDeps: {
    exclude: ['cbw-sdk'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4200',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4200',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['preact/hooks', 'preact'],
      output: {
        manualChunks: {
          // ── Web3 stack → dedicated chunks (not on critical path) ──
          'web3-core': [
            'wagmi',
            'viem',
            '@tanstack/react-query',
          ],
          'web3-ui': [
            '@rainbow-me/rainbowkit',
          ],
          // ── React core ──
          'react-vendor': [
            'react',
            'react-dom',
          ],
        },
      },
    },
  },
});
