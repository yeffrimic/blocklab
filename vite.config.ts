import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Rutas relativas: la carpeta `dist` funciona en la raíz de un dominio, en un
  // subdirectorio o abierta desde el disco, sin reconstruir nada.
  base: './',
  plugins: [react()],
});
