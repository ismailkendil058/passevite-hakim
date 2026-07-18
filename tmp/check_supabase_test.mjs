import { createClient } from '@supabase/supabase-js';
const url = 'https://pbmnuwxnddjvupvgkmsw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibW51d3huZGRqdnVwdmdrbXN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMjM0MjAsImV4cCI6MjA5OTg5OTQyMH0.8y2ZfxG5VzV42zMBb30u2ox1qN23xUD5DRYsJlzpVBo';
const supabase = createClient(url, key, { global: { headers: { apikey: key, Authorization: `Bearer ${key}` } } });
const { data, error, status, statusText } = await supabase.from('roles').select('*').eq('username','accueil').eq('password','accueil123').single();
console.log({ status, statusText, data, error });
