
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

const s = createClient(supabaseUrl, supabaseKey);

const fs = require('fs');

async function check() {
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync('results_63003.txt', msg + '\n');
    };
    fs.writeFileSync('results_63003.txt', '');

    log("=== VERIFICACIÓN TICKET 63003 ===");

    // 1. WISPHUB API
    const res = await fetch('https://api.wisphub.io/api/tickets/63003/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const t = await res.json();
    log("WispHub API:");
    log(` - Técnico: ${t.nombre_tecnico || t.tecnico}`);
    log(` - Usuario Técnico: ${t.tecnico_usuario || (t.tecnico && t.tecnico.username) || "N/A"}`);
    log(` - Estado: ${t.estado}`);

    // 2. SUPABASE DB
    const { data: procs } = await s.from('workflow_processes')
        .select('id, title, status')
        .ilike('title', '%63003%');

    if (procs && procs.length > 0) {
        log(`\nSupabase DB (Encontrados ${procs.length} procesos):`);
        for (const proc of procs) {
            log(`\n Proceso ${proc.id}:`);
            log(` - Título: ${proc.title}`);
            log(` - Estado: ${proc.status}`);

            const { data: wis } = await s.from('workflow_workitems')
                .select('id, participant_id, status, profiles(full_name, email)')
                .eq('process_id', proc.id)
                .neq('status', 'CA');

            if (wis && wis.length > 0) {
                wis.forEach(wi => {
                    log(`   * Tarea ${wi.id}:`);
                    log(`   * Asignado a: ${wi.profiles?.full_name} (${wi.profiles?.email || 'No email'})`);
                    log(`   * Estado Tarea: ${wi.status}`);
                });
            } else {
                log("   No se encontraron tareas (workitems) activas para este proceso.");
            }
        }
    } else {
        log("\nSupabase DB: No se encontró proceso para el ticket 63003.");
    }
}

check();
