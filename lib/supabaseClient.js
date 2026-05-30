// lib/supabaseClient.js
// Initialize Supabase Client from injected variables

const getSupabaseKeys = () => {
  const url = (typeof window !== 'undefined' && window.VITE_SUPABASE_URL) || '';
  const key = (typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) || '';

  return { url: url.trim(), key: key.trim() };
};

let supabase = null;
let errorMsg = null;
const { url, key } = getSupabaseKeys();

if (typeof window !== 'undefined') {
  // Clear any legacy manual credentials from localStorage to avoid interference
  localStorage.removeItem('motocare_supabase_url');
  localStorage.removeItem('motocare_supabase_anon_key');

  if (!window.supabase) {
    errorMsg = 'Library Supabase gagal dimuat dari CDN (unpkg.com). Periksa koneksi internet atau matikan adblocker.';
  } else if (!url || !key) {
    errorMsg = 'URL atau Anon Key Supabase kosong. Harap isi Environment Variables VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di dashboard Vercel, lalu redeploy.';
  } else {
    try {
      supabase = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      console.log("Supabase client initialized successfully!");
    } catch (err) {
      errorMsg = 'Gagal inisialisasi Supabase: ' + (err.message || err);
      console.error("Failed to initialize Supabase client:", err);
    }
  }
}

// Attach globally for browser use
if (typeof window !== 'undefined') {
  window.supabaseClient = supabase;
  window.supabaseError = errorMsg;
}
