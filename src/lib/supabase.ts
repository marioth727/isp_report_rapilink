
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required in .env');
}

// 🛡️ STORAGE ANTI-500: Previene que Supabase borre la sesión si falla el refresh token
const safeStorage = {
  getItem: (key: string) => {
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    // Si la sesión cae por error de red 500, no borramos el localStorage
    if (key.includes('sb-rapilink-auth-token') && !(window as any).__isIntentionalLogout) {
      console.warn(`[Supabase:Storage] 🛡️ Ignorando intento de borrar '${key}'. Posible error 500 de API.`);
      return; 
    }
    window.localStorage.removeItem(key);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    storageKey: 'sb-rapilink-auth-token'
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
