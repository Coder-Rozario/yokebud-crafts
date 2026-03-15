import React, { useState } from 'react'
import styles from './Newsletter.module.scss'
import { apiFetch } from '../utils/api'

const Newsletter = () => {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async (e) => {
    e.preventDefault()
    const val = email.trim()
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    if (!isValid) { setMessage('Please enter a valid email address.'); return }

    try {
      if (loading) return
      setLoading(true)
      setMessage('Processing subscription…')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await apiFetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { email: val },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage(data.message || 'Subscription successful! Weekly newsletter will be sent.')
        try { localStorage.setItem('userEmail', val) } catch {}
        setEmail('')
      } else {
        setMessage(data.message || 'Subscription failed. Please try again.')
      }
      setTimeout(() => setMessage(''), 4000)
    } catch (error) {
      setMessage(error.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Subscription failed. Please try again.')
    }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.newsletter}>
      <input
        id="emailInput"
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <button onClick={handleSubscribe} disabled={loading}>{loading ? 'Please wait…' : 'Subscribe'}</button>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  )
}

export default Newsletter
