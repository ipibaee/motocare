// lib/supabaseClient.js
// Initialize Supabase Client from injected variables or localStorage

const getSupabaseKeys = () => {
  const url = (typeof window !== 'undefined' && (
    window.VITE_SUPABASE_URL || 
    localStorage.getItem('motocare_supabase_url')
  )) || '';

  const key = (typeof window !== 'undefined' && (
    window.VITE_SUPABASE_ANON_KEY || 
    localStorage.getItem('motocare_supabase_anon_key')
  )) || '';

  return { url: url.trim(), key: key.trim() };
};

let supabase = null;
const { url, key } = getSupabaseKeys();

if (url && key && typeof window !== 'undefined' && window.supabase) {
  try {
    supabase = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log("Supabase client initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
} else {
  console.log("Supabase credentials not configured. Using offline localStorage mode.");
}

// Attach globally for browser use
if (typeof window !== 'undefined') {
  window.supabaseClient = supabase;
}
