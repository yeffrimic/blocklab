import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Rutas relativas: la carpeta `dist` funciona en la raíz de un dominio, en un
  // subdirectorio o abierta desde el disco, sin reconstruir nada.
  base: './',
  plugins: [react()],
  // Dos páginas: la presentación en la raíz y el editor en `app/`.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      },
    },
  },
});
