import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('--- Checking Equipment ---');
  const { data: eqData, error: eqError } = await supabase
    .from('equipamiento')
    .select('id, nombre, estado')
    .or('nombre.eq.Canon EOS C300 Mark III,nombre.eq.Sennheiser MKH 416');

  if (eqError) {
    console.error('Error fetching equipment:', eqError);
  } else {
    console.log('Equipment:', eqData);
  }

  console.log('--- Checking Active Loans ---');
  const { data: loanData, error: loanError } = await supabase
    .from('prestamos')
    .select('id, equipos_ids, estado')
    .eq('estado', 'Activo');

  if (loanError) {
    console.error('Error fetching loans:', loanError);
  } else {
    console.log('Active Loans:', loanData);
  }
}

checkData();
