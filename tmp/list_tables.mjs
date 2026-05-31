import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://gfvbyyjmnuugrdonwpje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdmJ5eWptbnV1Z3Jkb253cGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTE0OTIsImV4cCI6MjA5NTA2NzQ5Mn0.lv_rCVBfASWi7BoP5dktP8AI3sVNd6yZxOIooNUa8Ko";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const { data, error } = await supabase.from('medications').select('*').limit(1);
    console.log("Meds success! Columns:", Object.keys(data[0] || {}));

    // List tables using postgrest internal if possible (sometimes works)
    const { data: tables, error: err } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    console.log("Tables:", tables, err);
}
test();
