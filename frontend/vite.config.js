import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// envDir '..': read .env / .env.example from the repository root, next to the backend.
export default defineConfig({ plugins: [react()], server: { port: 5173 }, envDir: '..' })
