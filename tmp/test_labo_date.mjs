import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://gfvbyyjmnuugrdonwpje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdmJ5eWptbnV1Z3Jkb253cGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTE0OTIsImV4cCI6MjA5NTA2NzQ5Mn0.lv_rCVBfASWi7BoP5dktP8AI3sVNd6yZxOIooNUa8Ko";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const { data, error } = await supabase.from('labo_orders').select('*').gte('date', '2000-01-01');
    console.log("Error:", error);
    console.log("Data:", data);
}
test();
