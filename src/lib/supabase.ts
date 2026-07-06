import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing!');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Helper for audit logging
export async function logAction(responsable: string, action: string, details: any) {
  // No-op: Audit logging has been completely disabled to optimize storage space.
}
