'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px'
      }}>
        <h1 style={{ color: '#f0eee8', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
          Clear<span style={{ color: '#7c6af5' }}>path</span>
        </h1>
        <p style={{ color: '#5a5868', fontSize: '0.85rem', marginBottom: '32px' }}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </p>
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%', background: '#18181f', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '12px 14px', color: '#f0eee8',
            fontSize: '0.88rem', outline: 'none', marginBottom: '10px', boxSizing: 'border-box'
          }}
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            width: '100%', background: '#18181f', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '12px 14px', color: '#f0eee8',
            fontSize: '0.88rem', outline: 'none', marginBottom: '16px', boxSizing: 'border-box'
          }}
        />
        {error && <p style={{ color: error.includes('Check') ? '#4eca8b' : '#e05555', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', background: '#7c6af5', border: 'none', borderRadius: '10px',
          padding: '12px', color: '#fff', fontSize: '0.9rem', fontWeight: 500,
          cursor: 'pointer', marginBottom: '16px'
        }}>
          {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
        <p style={{ color: '#5a5868', fontSize: '0.82rem', textAlign: 'center' }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#7c6af5', cursor: 'pointer' }}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </span>
        </p>
      </div>
    </div>
  )
}