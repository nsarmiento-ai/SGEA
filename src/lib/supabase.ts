import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing!');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

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

export async function logResourceHistory(data: {
  recurso_id: string;
  usuario_responsable: string;
  materia: string;
  accion: 'Reserva' | 'Préstamo' | 'Devolución' | 'Service';
  estado_detalle: string;
  pañolero_turno: string;
}) {
  const { error } = await supabase
    .from('historial_recursos')
    .insert([
      {
        ...data,
        fecha_movimiento: new Date().toISOString(),
      },
    ]);

  if (error) {
    console.error('Error logging resource history:', error);
  }

  // Also update the equipment's last observation for quick view
  await supabase
    .from('equipamiento')
    .update({ last_observation: data.estado_detalle })
    .eq('id', data.recurso_id);
}
