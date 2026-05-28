import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const VAPID_PUBLIC_KEY = 'BC6rfEDScAcEgMc050TDVwtImqRkBQNKBEgmjNWi-gxba6tane4rLhKio6IcpeVLjPHDqLuzW4Ajjth2lL0dXLg'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotification() {
  const [permissao, setPermissao] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [inscrito, setInscrito] = useState(false)

  const registrarEScrever = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const existente = await registration.pushManager.getSubscription()
    if (existente) {
      setInscrito(true)
      return
    }

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await api.post('/push/subscribe', { subscription: sub.toJSON() })
    setInscrito(true)
  }, [])

  // Tenta registrar automaticamente se já há permissão granted
  useEffect(() => {
    if (permissao === 'granted') {
      registrarEScrever().catch(() => {})
    }
  }, [permissao, registrarEScrever])

  const solicitarPermissao = useCallback(async () => {
    if (!('Notification' in window)) return
    const resultado = await Notification.requestPermission()
    setPermissao(resultado)
    if (resultado === 'granted') {
      await registrarEScrever().catch(() => {})
    }
  }, [registrarEScrever])

  return { permissao, inscrito, solicitarPermissao }
}
