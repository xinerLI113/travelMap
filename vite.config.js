import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [
    react(),
    cesium(),
    {
      name: 'preload-cesium',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          return html.replace(
            /<script src="([^"]+\/Cesium\.js)"><\/script>/,
            '<link rel="preload" as="script" href="$1">',
          );
        },
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
