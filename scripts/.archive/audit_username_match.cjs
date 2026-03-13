
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

function log(msg) {
    console.log(msg);
    if (typeof msg !== 'string') msg = JSON.stringify(msg, null, 2);
    fs.appendFileSync('audit_log.txt', msg + '\n');
}

async function audit() {
    fs.writeFileSync('audit_log.txt', '');
    log("=== AUDITORÍA DE MAPEO POR STRING (Protocolo Forense) ===");

    // 1. ANÁLISIS DE RESPUESTA API (RAW JSON)
    log("\n[FASE 1] Análisis de Respuesta API (Ticket 63337)");
    const tRes = await fetch(`https://api.wisphub.io/api/tickets/63337/`, {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });

    if (!tRes.ok) {
        log(`❌ Error fetching ticket: ${tRes.status}`);
        return;
    }

    const t = await tRes.json();
    log("--> Campos Relevantes del Ticket (RAW):");
    log(`   - tecnico (Type: ${typeof t.tecnico}): ${JSON.stringify(t.tecnico)}`);
    log(`   - nombre_tecnico (Type: ${typeof t.nombre_tecnico}): ${JSON.stringify(t.nombre_tecnico)}`);
    log(`   - tecnico_usuario (Type: ${typeof t.tecnico_usuario}): ${JSON.stringify(t.tecnico_usuario)}`);

    // 2. VERIFICACIÓN DE USUARIO LOCAL (Supabase)
    log("\n[FASE 2] Verificación de Usuario Local (Supabase)");
    // Check if 'wisphub_id' column exists conceptually by checking data
    // We'll fetch profiles for 'Mario' and 'Lucia/Cartera'

    const { data: profiles, error } = await s.from('profiles')
        .select('*')
        .or('wisphub_id.neq.null,email.neq.null');

    if (error) {
        log("❌ Error fetching profiles: " + JSON.stringify(error));
        return;
    }

    log(`--> Perfiles cargados: ${profiles.length}`);
    log("--> Buscando columnas clave: 'wisphub_id' existe en los resultados.");

    // 3. PRUEBA DE NORMALIZACIÓN DE STRINGS
    log("\n[FASE 3] Prueba de Normalización y Match");

    // Simulating the lookup logic
    // A. Fetch Staff to resolve Name -> Username
    const staffRes = await fetch('https://api.wisphub.io/api/staff/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const staffData = await staffRes.json();
    const staffList = staffData.results || staffData || [];

    const rawNameFromTicket = t.nombre_tecnico || t.tecnico; // e.g. "LUCIA ACUÑA"
    log(`--> Nombre en Ticket: '${rawNameFromTicket}'`);

    const cleanName = (n) => n ? n.toLowerCase().trim() : '';
    const targetClean = cleanName(rawNameFromTicket);
    log(`--> Nombre Normalizado (Target): '${targetClean}'`);

    const foundStaff = staffList.find(s => cleanName(s.nombre) === targetClean);

    let resolvedUsername = null;
    if (foundStaff) {
        log(`--> ✅ MATCH en Staff List de WispHub:`);
        log(`    - Nombre Staff: '${foundStaff.nombre}'`);
        log(`    - Usuario/Username Staff: '${foundStaff.usuario || foundStaff.username}'`);
        resolvedUsername = foundStaff.usuario || foundStaff.username;
    } else {
        log(`--> ❌ NO MATCH en Staff List.`);
    }

    // B. Match against Local Profile
    log("\n--> Comparando con Base de Datos Local:");
    if (resolvedUsername) {
        const pUser = resolvedUsername.toLowerCase().trim();
        log(`   API Username (Normalizado): '${pUser}'`);

        const match = profiles.find(p => {
            const localVid = p.wisphub_id ? p.wisphub_id.toLowerCase().trim() : '';
            const isMatch = localVid === pUser;

            // Log only relevant ones
            if (p.full_name?.toLowerCase().includes('lucia') || p.full_name?.toLowerCase().includes('mario') || p.email?.includes('cartera') || p.wisphub_id?.includes(pUser)) {
                log(`   VS Local User: '${p.full_name}' (wisphub_id: '${localVid}') -> MATCH? ${isMatch}`);
            }
            return isMatch;
        });

        if (match) {
            log(`\n✅ RESULTADO FINAL: MATCH EXITOSO con '${match.full_name}' (ID: ${match.id})`);
        } else {
            log(`\n❌ RESULTADO FINAL: FALLO. No existe perfil local con wisphub_id = '${resolvedUsername}'`);
        }
    } else {
        log("\n⚠️ No se puede proceder al match local porque no se resolvió el Username de WispHub.");
    }
}

audit();
