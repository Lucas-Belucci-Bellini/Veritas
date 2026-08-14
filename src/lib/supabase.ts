import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfig = {
  url: url?.trim() ?? '',
  publishableKey: publishableKey?.trim() ?? '',
  configured: Boolean(url?.trim() && publishableKey?.trim()),
}

/**
 * Cliente público: a chave publishable só identifica o projeto; a autorização
 * continua sendo feita pela sessão JWT e pelas policies RLS do Supabase.
 */
export const supabase: SupabaseClient | null = supabaseConfig.configured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
