import { supabase } from '../lib/supabase';

async function checkData() {
  console.log('--- Checking Equipment ---');
  const { data: eqData, error: eqError } = await supabase
    .from('equipamiento')
    .select('id, nombre, estado')
    .in('nombre', ['Canon EOS C300 Mark III', 'Sennheiser MKH 416']);

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
