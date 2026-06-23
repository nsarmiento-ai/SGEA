import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'generateSW',
        injectRegister: 'auto',
        includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'robots.txt'],
        manifest: {
          name: "SGEA - Escuela de Cine UNT",
          short_name: "SGEA",
          description: "Sistema de Gestión de Equipamiento Audiovisual",
          start_url: "/",
          display: "standalone",
          background_color: "#0f172a",
          theme_color: "#0f172a",
          orientation: "portrait-primary",
          icons: [
            {
              src: "https://res.cloudinary.com/divij23kk/image/upload/v1779979569/launchericon-192x192_uuquvy.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "https://res.cloudinary.com/divij23kk/image/upload/v1779979569/launchericon-512x512_nyeojx.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "https://res.cloudinary.com/divij23kk/image/upload/v1779979569/launchericon-192x192_uuquvy.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: "https://res.cloudinary.com/divij23kk/image/upload/v1779979569/launchericon-512x512_nyeojx.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: "https://res.cloudinary.com/divij23kk/image/upload/v1779979587/1024_guwudh.png",
              sizes: "1024x1024",
              type: "image/png",
              purpose: "any"
            }
          ],
          categories: ["education", "productivity"],
          lang: "es-AR"
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
          cleanupOutdatedCaches: true,
          importScripts: ['/custom-push-listener.js'],
          runtimeCaching: []
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-utils': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge', 'motion'],
            'vendor-db': ['@supabase/supabase-js'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
