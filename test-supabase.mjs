import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://gfvbyyjmnuugrdonwpje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdmJ5eWptbnV1Z3Jkb253cGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTE0OTIsImV4cCI6MjA5NTA2NzQ5Mn0.lv_rCVBfASWi7BoP5dktP8AI3sVNd6yZxOIooNUa8Ko";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function test() {
    const { data, error } = await supabase.from('sessions').insert({ opened_by: '9c2f6d21-f094-4d83-93d3-73d8f85f57bb' }).select();
    console.log("Error:", error);
    console.log("Data:", data);
}
test();
