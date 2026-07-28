import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // data/** phải luôn bị ignore dù HMR bật hay tắt — đây là nơi SQLite ghi
      // pickdi.db-wal mỗi lần có request ghi DB (assign campaign, update creator...),
      // không phải source code. Không ignore thì mỗi lần ghi DB Vite lại coi là đổi
      // source và full-reload trang, xoá sạch state React (về lại tab Dashboard).
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**'] },
    },
  };
});
