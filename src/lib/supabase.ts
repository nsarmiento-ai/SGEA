import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper for audit logging
export async function logAction(responsable: string, action: string, details: any) {
  const { error } = await supabase
    .from('audit_logs')
    .insert([
      {
        responsable_nombre: responsable,
        accion: action,
        detalles: details,
      },
    ]);
  
  if (error) {
    console.error('Error logging action:', error);
  }
}
