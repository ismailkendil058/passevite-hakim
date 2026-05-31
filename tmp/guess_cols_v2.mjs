import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://gfvbyyjmnuugrdonwpje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdmJ5eWptbnV1Z3Jkb253cGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTE0OTIsImV4cCI6MjA5NTA2NzQ5Mn0.lv_rCVBfASWi7BoP5dktP8AI3sVNd6yZxOIooNUa8Ko";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const cols = ['id', 'doctor_id', 'nom_prenom', 'patient_name', 'client_name', 'statut', 'status', 'laboratoire', 'labo_name'];
    for (const col of cols) {
        const { error: e } = await supabase.from('labo_orders').select(col).limit(1);
        if (!e) {
            console.log(`Success! Column '${col}' exists.`);
        } else {
            console.log(`Column '${col}' does NOT exist. Error:`, e.message);
        }
    }
}
test();
