import { createClient } from '@supabase/supabase-js';
const url = 'https://pbmnuwxnddjvupvgkmsw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibW51d3huZGRqdnVwdmdrbXN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMjM0MjAsImV4cCI6MjA5OTg5OTQyMH0.8y2ZfxG5VzV42zMBb30u2ox1qN23xUD5DRYsJlzpVBo';
const supabase = createClient(url, key);

async function main() {
    const appts = await supabase.from('appointments').select('id, client_phone, client_name, doctor_id, appointment_at, status, notes').limit(5);
  const docs = await supabase.from('doctors').select('id, name, initial').limit(5);
  const completed = await supabase.from('completed_clients').select('id').limit(1);
  const future = await supabase.from('appointments').select('id, appointment_at, status').gt('appointment_at', new Date().toISOString()).order('appointment_at', { ascending: true }).limit(20);
  const output = [
    { table: 'appointments', data: appts.data, error: appts.error, status: appts.status, statusText: appts.statusText },
    { table: 'future_appointments', data: future.data, error: future.error, status: future.status, statusText: future.statusText },
    { table: 'doctors', data: docs.data, error: docs.error, status: docs.status, statusText: docs.statusText },
    { table: 'completed_clients', data: completed.data, error: completed.error, status: completed.status, statusText: completed.statusText }
  ];
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('SCRIPT ERROR', err);
  process.exit(1);
});
