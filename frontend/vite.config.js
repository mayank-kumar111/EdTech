import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Keep the legacy MediaPipe FaceMesh bundle out of Vite's dependency optimizer.
// Its UMD constructor can be transformed into a non-constructable namespace by
// pre-bundling, producing "XS.FaceMesh is not a constructor" at runtime.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@mediapipe/face_mesh', '@webgazer-ts/core'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
})
