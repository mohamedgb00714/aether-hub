import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDev = mode === 'development';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        electron([
          {
            // Main process entry file
            entry: 'electron/main.ts',
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: [
                    'electron', 
                    'electron-store', 
                    'electron-updater', 
                    'better-sqlite3', 
                    'WAWebPollsVotesSchema',
                    'whatsapp-web.js',
                    'qrcode',
                    'puppeteer',
                    'discord.js-selfbot-v13',
                    'node-cron',
                    'node:sqlite',
                    /^node:/  // Externalize all node: prefixed built-ins
                  ],
                  output: {
                    format: 'es'
                  }
                }
              }
            }
          }
        ]),
        renderer()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      base: './', // Important for Electron file:// protocol
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          external: ['electron']
        }
      }
    };
});
