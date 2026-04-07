import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwqqoesirkichqzxkgdd.supabase.co';
const supabaseAnonKey = 'sb_publishable_zdeF1N3sbK6-mk67-lbM9g_aQlGgS9H';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('equipamiento').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  }
}

run();
