// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // IMPORTANT : Remplace 'EquaMotion974' par le nom EXACT de ton dépôt GitHub
  // Si ton dépôt s'appelle 'mon-projet', mets base: '/mon-projet/'
  base: '/EquaMotion974/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});