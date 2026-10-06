import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { privacyRedact } from 'privacy-redact/vite';
import { playgroundApi } from './server.js';

/** Dev server: the guide, the review model's files, and the text redaction route. */
export default defineConfig({
  plugins: [
    react(),
    privacyRedact(),
    {
      name: 'playground-api',
      configureServer(server) {
        server.middlewares.use(playgroundApi);
      },
    },
  ],
  server: { host: '127.0.0.1', port: 8791, strictPort: true },
  preview: { host: '127.0.0.1', port: 8791, strictPort: true },
});
