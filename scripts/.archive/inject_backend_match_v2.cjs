const fs = require('fs');
const path = 'd:\\desarrollo antgra\\isp-reports-app\\scripts\\final_clean_sync.cjs';

let content = fs.readFileSync(path, 'utf8');

const isMatchDef = `        const isMatch = (t, profile) => {
            const norm = (s) => (s || '').toString().toLowerCase().trim();
            const pWhId = norm(profile.wisphub_id);
            const pEmail = norm(profile.email);
            const pName = norm(profile.full_name);
            
            const tUser = norm(whTechUser || '');
            const tName = norm(whTechName || '');
            const tEmail = norm(whTechEmail || '');

            if (!pWhId && !pEmail && !pName) return false;

            if (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName))) {
                if (tName.length > 5 && pName.length > 5) return true;
            }

            const pBase = pWhId.split('@')[0].replace(/s$/, '');
            const tBase = tUser.split('@')[0].replace(/s$/, '');
            if (pBase && tBase && pBase === tBase && pBase.length > 3) return true;

            if (tEmail && pEmail && tEmail === pEmail) return true;
            if (tUser && pWhId && tUser === pWhId) return true;

            if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

            return false;
        };`;

// Find where whTechEmail is defined and matchedUser is assigned
const targetLine = "        let whTechEmail = null;";
const endLine = "        const matchedUser = profiles.find(p => isMatch(ticket, p));"; // If already partially replaced?

// Let's just find the whole block from "let whTechName" to "const matchedUser = profiles.find..."
const blockStart = /let whTechName = ticket\.nombre_tecnico \|\| ticket\.tecnico \|\| "Sin asignar";/;
const blockEnd = /let matchedUser = profiles\.find\(p => \{[\s\S]+?\}\);/;

if (blockStart.test(content) && blockEnd.test(content)) {
    const newBlock = `        let whTechName = ticket.nombre_tecnico || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.nombre : ticket.tecnico) || "Sin asignar";
        let whTechUser = ticket.tecnico_usuario || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.usuario : null);
        let whTechEmail = ticket.email_tecnico || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.email : null);

        ${isMatchDef}

        const matchedUser = profiles.find(p => isMatch(ticket, p));`;

    // Replace the range
    const combinedRegex = /let whTechName = ticket\.nombre_tecnico \|\| [\s\S]+?let matchedUser = profiles\.find\(p => \{[\s\S]+?\}\);/;
    content = content.replace(combinedRegex, newBlock);

    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated final_clean_sync.cjs.');
} else {
    console.log('Could not find block in final_clean_sync.cjs');
}
