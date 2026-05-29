import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Faltan variables de entorno REACT_APP_SUPABASE_URL y/o REACT_APP_SUPABASE_ANON_KEY. " +
      "Configúralas en frontend/.env (local) y en Vercel (Project Settings → Environment Variables)."
  );
}

export const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
