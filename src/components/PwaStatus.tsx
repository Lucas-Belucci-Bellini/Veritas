import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnline } from '../hooks/useOnline'

/**
 * Avisos do modo offline.
 *
 * Mostra três coisas, todas discretas: que o aplicativo já está guardado para
 * uso sem internet, que existe uma versão nova esperando um recarregamento, e
 * que a conexão caiu (caso em que o Veritas continua funcionando inteiro).
 */
export function PwaStatus() {
  const online = useOnline()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const [showReady, setShowReady] = useState(false)

  useEffect(() => {
    if (!offlineReady) return
    setShowReady(true)
    const timer = window.setTimeout(() => {
      setShowReady(false)
      setOfflineReady(false)
    }, 6000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {!online && (
        <Toast tone="amber" icon={<WifiOff size={16} />}>
          Sem internet — o Veritas continua funcionando normalmente.
        </Toast>
      )}

      {showReady && (
        <Toast tone="emerald" icon={<CloudOff size={16} />}>
          Pronto para usar offline. Dá até para instalar como aplicativo.
        </Toast>
      )}

      {needRefresh && (
        <Toast tone="brand" icon={<RefreshCw size={16} />}>
          <span className="flex flex-wrap items-center gap-3">
            Uma versão nova do Veritas está pronta.
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              aria-label="Dispensar aviso de atualização"
              className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={15} />
            </button>
          </span>
        </Toast>
      )}
    </div>
  )
}

const TONES = {
  amber:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  brand:
    'border-brand-300 bg-white text-slate-700 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-200',
}

function Toast({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg ${TONES[tone]}`}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </div>
  )
}
