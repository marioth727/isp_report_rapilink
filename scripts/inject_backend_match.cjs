const fs = require('fs');
const path = 'd:\\desarrollo antgra\\isp-reports-app\\scripts\\final_clean_sync.cjs';

let content = fs.readFileSync(path, 'utf8');

const newMatchLogic = `        const isMatch = (t, profile) => {
            const norm = (s) => (s || '').toString().toLowerCase().trim();
            const pWhId = norm(profile.wisphub_id);
            const pEmail = norm(profile.email);
            const pName = norm(profile.full_name);
            
            const tUser = norm(whTechUser || '');
            const tName = norm(whTechName || '');
            const tEmail = norm(whTechEmail || '');

            if (!pWhId && !pEmail && !pName) return false;

            // 1. Full Name Match
            if (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName))) {
                if (tName.length > 5 && pName.length > 5) return true;
            }

            // 2. Email/User Match (sistema vs sistemas)
            const pBase = pWhId.split('@')[0].replace(/s$/, '');
            const tBase = tUser.split('@')[0].replace(/s$/, '');
            if (pBase && tBase && pBase === tBase && pBase.length > 3) return true;

            if (tEmail && pEmail && tEmail === pEmail) return true;
            if (tUser && pWhId && tUser === pWhId) return true;

            // Special Alejandra/Maira
            if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

            return false;
        };

        const matchedUser = profiles.find(p => isMatch(ticket, p));`;

// Target from whTechEmail... down to profiles.find...
const targetRegex = /let whTechEmail = null;[\s\S]+?const matchedUser = profiles\.find\(p => \{[\s\S]+?\}\);/;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, `let whTechEmail = ticket.email_tecnico || null;\n\n${newMatchLogic}`);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated final_clean_sync.cjs with robust matching.');
} else {
    console.error('Could not find target regex in final_clean_sync.cjs');
}
