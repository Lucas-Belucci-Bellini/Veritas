import { useState, type FormEvent } from 'react'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

export function AuthPanel() {
  const { configured, loading, user, error, signIn, signUp, signOut, clearError } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!configured) {
    return (
      <span className="hidden text-xs text-slate-400 sm:inline" title="Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para ativar a nuvem">
        Nuvem desativada
      </span>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-36 truncate text-xs text-slate-500 sm:inline dark:text-slate-400" title={user.email ?? undefined}>
          {user.email}
        </span>
        <button type="button" className="key" onClick={() => void signOut()} disabled={loading} aria-label="Sair da conta" title="Sair">
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    clearError()
    try {
      if (mode === 'sign-in') {
        await signIn(email, password)
        setOpen(false)
        setPassword('')
      } else {
        const result = await signUp(email, password)
        setFeedback(
          result.confirmationRequired
            ? 'Conta criada. Confirme seu e-mail antes de entrar.'
            : 'Conta criada e sessão iniciada.',
        )
        if (!result.confirmationRequired) setOpen(false)
      }
    } catch {
      // A mensagem normalizada pelo AuthProvider aparece no formulário.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <button type="button" className="key flex items-center gap-2 text-xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <UserRound size={16} />
        <span className="hidden sm:inline">Entrar</span>
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {mode === 'sign-in' ? 'Entrar no Veritas' : 'Criar conta'}
              </h2>
              <p className="text-[11px] text-slate-400">Sincronize circuitos entre dispositivos.</p>
            </div>
            <LogIn size={16} className="text-brand-600" />
          </div>
          <form className="grid gap-2" onSubmit={submit}>
            <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
              E-mail
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:text-slate-100" />
            </label>
            <label className="grid gap-1 text-xs text-slate-500 dark:text-slate-400">
              Senha
              <input type="password" required minLength={6} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-slate-700 dark:text-slate-100" />
            </label>
            {(error || feedback) && <p className={`text-xs ${error ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{error ?? feedback}</p>}
            <button type="submit" disabled={submitting} className="mt-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {submitting ? 'Aguarde…' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
          <button type="button" className="mt-3 text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => { setMode((value) => value === 'sign-in' ? 'sign-up' : 'sign-in'); setFeedback(null); clearError() }}>
            {mode === 'sign-in' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}
          </button>
        </div>
      )}
    </div>
  )
}
