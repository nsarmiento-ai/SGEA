import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixData() {
  const idsToFix = ['470ce4b4-84ed-41f0-9f60-e6efe1689c82', '8b578924-fe33-42ae-a591-8fd65aed9794'];
  
  console.log('Fixing equipment status...');
  const { error } = await supabase
    .from('equipamiento')
    .update({ estado: 'disponible' })
    .in('id', idsToFix);

  if (error) {
    console.error('Error fixing equipment:', error);
  } else {
    console.log('Equipment fixed successfully.');
  }
}

fixData();
