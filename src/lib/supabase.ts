
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-rapilink-auth-token',
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        if (value) localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        // Permitimos el borrado nativo para evitar bucles infinitos con tokens corruptos
        console.warn(`[Auth] 🚨 Supabase eliminó el token local '${key}'.`);
        localStorage.removeItem(key);
      }
    }
  }
});

/**
 * Helper resiliente para obtener el usuario evitando AbortError críticos
 * que ocurren durante el doble montaje de React StrictMode o recargas rápidas.
 */
export async function safeGetUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message?.includes('aborted') || (error as any).name === 'AbortError') {
        console.warn('[Supabase:Auth] ⚠️ getUser() abortado por el navegador (ignore si es recarga)');
        return { data: { user: null }, error: null };
      }
      throw error;
    }
    return { data, error: null };
  } catch (e: any) {
    if (e.message?.includes('aborted') || e.name === 'AbortError') {
      return { data: { user: null }, error: null };
    }
    console.error('[Supabase:Auth] ❌ Error crítico en safeGetUser:', e);
    return { data: { user: null }, error: e };
  }
}
