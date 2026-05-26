// Libraries
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Part 1: Export the Vite configuration for the project, including the React plugin and build settings
export default defineConfig({
  plugins: [
    react()
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})