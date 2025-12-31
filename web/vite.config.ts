import { defineConfig } from 'vite'
import path from 'path'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'

export default defineConfig({
  plugins: [
    monacoEditorPlugin({})
  ],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
