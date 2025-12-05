import { defineConfig } from 'vite';

export default defineConfig({
  // CORRECTION ICI : Le nom doit être celui de ton repo entre deux slashs
  base: '/pezali974/', 
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});