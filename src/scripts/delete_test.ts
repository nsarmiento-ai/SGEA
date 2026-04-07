import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findAndDeleteTest() {
  console.log('--- Finding "Test" equipment ---');
  const { data: eqData, error: eqError } = await supabase
    .from('equipamiento')
    .select('id, nombre')
    .eq('nombre', 'Test');

  if (eqError) {
    console.error('Error fetching equipment:', eqError);
    return;
  }

  if (eqData.length === 0) {
    console.log('No equipment named "Test" found.');
    return;
  }

  console.log('Found:', eqData);
  const id = eqData[0].id;

  console.log('--- Attempting to delete ---');
  const { error: delError } = await supabase
    .from('equipamiento')
    .delete()
    .eq('id', id);

  if (delError) {
    console.error('Error deleting equipment:', delError);
  } else {
    console.log('Equipment deleted successfully.');
  }
}

findAndDeleteTest();
