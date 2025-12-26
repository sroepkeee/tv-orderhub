// Supabase client with multi-environment support
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Valores padrão de produção (fallback se variáveis não estiverem definidas)
const DEFAULT_SUPABASE_URL = "https://wejkyyjhckdlttieuyku.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlamt5eWpoY2tkbHR0aWV1eWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzMxNzYsImV4cCI6MjA3NDc0OTE3Nn0.iS9y0xOEbv1N7THwbmeQ2DLB5ablnUU6rDs7XDVGG3c";

// Usar variáveis de ambiente com fallback para produção
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

// Configuração de ambiente
export const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'production';
export const isHomolog = ENVIRONMENT === 'homolog';
export const isProduction = ENVIRONMENT === 'production';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});