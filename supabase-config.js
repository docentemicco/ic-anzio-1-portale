// Supabase browser configuration for I.C. Anzio I
// Only the Publishable Key belongs here. Never put a Supabase Secret/Service Role key in this file.
window.SUPABASE_URL = 'https://vnpzhhpkymfxxajvvxtj.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qIq-kTzwKFl7YWyWUyZVTA_v_AN386T';
window.supabaseClient = window.supabase
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY)
  : null;
