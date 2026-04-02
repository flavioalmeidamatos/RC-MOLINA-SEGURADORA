import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError = isSupabaseConfigured
  ? ''
  : 'As variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas no ambiente.';

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.invalid',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
);
