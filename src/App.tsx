import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/Auth/LoginPage'
import AppShell from './layouts/AppShell'

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const [scale, setScale] = useState(() => {
    const saved = localStorage.getItem('app-scale')
    return saved ? parseFloat(saved) : 0.9
  })

  useEffect(() => {
    // Reset document element zoom to 1, and let layout wrapper handle the scaling.
    (document.documentElement.style as any).zoom = '1'
    localStorage.setItem('app-scale', scale.toString())
  }, [scale])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          setScale(s => Math.min(1.3, s + 0.05))
        } else if (e.key === '-') {
          e.preventDefault()
          setScale(s => Math.max(0.7, s - 0.05))
        } else if (e.key === '0') {
          e.preventDefault()
          setScale(0.9)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      style={{
        zoom: scale,
        height: `calc(100vh / ${scale})`,
        width: `calc(100vw / ${scale})`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--clr-bg)'
      }}
    >
      <Toaster
        position="bottom-left"
        toastOptions={{
          duration: 20000,
          style: {
            background: 'rgba(13,13,31,0.95)',
            color: '#f0f0fa',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            fontFamily: 'Cairo, sans-serif',
            direction: 'rtl',
          },
        }}
      />
      {isAuthenticated ? <AppShell scale={scale} setScale={setScale} /> : <LoginPage />}
    </div>
  )
}
