import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

function isValidSupabaseUrl(url: string): boolean {
  // Check if the URL looks like a valid Supabase URL
  // Valid URLs should start with https:// and contain supabase
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && url.includes('supabase')
  } catch {
    return false
  }
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check for missing or placeholder values
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured')
  }

  // Check for placeholder values that aren't real URLs
  if (!isValidSupabaseUrl(supabaseUrl)) {
    throw new Error('Supabase URL appears to be a placeholder or invalid. Please set a valid Supabase URL.')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Export a proxy that lazily creates the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
