import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const isLocalhost = (host: string) => host === 'localhost' || host === '127.0.0.1';

const apiPort = process.env.API_PORT || '3002';

export default defineConfig(() => {
  const host = process.env.VITE_HOST || '0.0.0.0';
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: path.resolve(__dirname, '../../deploy/dist'),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Forward API calls to the backend during development.
      // API_PORT points at the PHP backend (:3002). See `npm run dev`.
      proxy: {
        '/api': {
          target: `http://${host}:${apiPort}`,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const originHost = req.headers.host;
              if (originHost && !isLocalhost(originHost)) {
                proxyReq.setHeader('host', `localhost:${String(options.target).split(':').pop()}`);
              }
            });
          },
        },
      },
    },
  };
});
