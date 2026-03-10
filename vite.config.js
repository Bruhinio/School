import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SchoolLMS — Sistema Escolar',
        short_name: 'SchoolLMS',
        description: 'Plataforma de gestión escolar',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2F2F7',
        theme_color: '#007AFF',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
