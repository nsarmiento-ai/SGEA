import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('--- prestamos ---');
  const { data: data1, error: error1 } = await supabase.from('prestamos').select('*').limit(1);
  if (data1 && data1.length > 0) {
    console.log('Columns:', Object.keys(data1[0]));
  } else {
    console.log('No data or error:', error1);
  }

  console.log('--- audit_logs ---');
  const { data: data2, error: error2 } = await supabase.from('audit_logs').select('*').limit(1);
  if (data2 && data2.length > 0) {
    console.log('Columns:', Object.keys(data2[0]));
  } else {
    console.log('No data or error:', error2);
  }
}

run();
