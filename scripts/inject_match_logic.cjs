const fs = require('fs');
const path = 'd:\\desarrollo antgra\\isp-reports-app\\src\\lib\\workflowService.ts';

let content = fs.readFileSync(path, 'utf8');

const isMatchLogic = `            const isMatch = (t: any, profile: any) => {
                const norm = (s: any) => (s || '').toString().toLowerCase().trim();
                const pWhId = norm(profile.wisphub_id);
                const pEmail = norm(profile.email);
                const pName = norm(profile.full_name);
                
                const tUser = norm(t.tecnico_usuario || t.usuario || '');
                const tName = norm(t.nombre_tecnico || t.tecnico || '');

                if (!pWhId && !pEmail && !pName) return false;

                // Root comparison (sistema vs sistemas)
                const pRoot = pWhId.split('@')[0].replace(/s$/, '');
                const tRoot = tUser.split('@')[0].replace(/s$/, '');
                if (pRoot && tRoot && pRoot === tRoot) return true;

                if (tUser && pWhId && (tUser.includes(pWhId) || pWhId.includes(tUser))) return true;
                if (tUser && pEmail && (tUser.includes(pEmail) || pEmail.includes(tUser))) return true;
                if (tName && pName && (pName.includes(tName) || tName.includes(pName))) return true;
                if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

                return false;
            };

            const matchedUser = profiles.find(p => isMatch(ticket, p));`;

// Target block for existing tickets (approx line 602 in my previous view)
const targetBlock = /const targetClean = cleanName\(currentTechName\);\s+const matchedUser = profiles\.find\(p => \{[\s\S]+?\}\);/;

if (targetBlock.test(content)) {
    content = content.replace(targetBlock, isMatchLogic);
    console.log('Successfully replaced matching logic in existing ticket block.');
} else {
    console.error('Could not find the target block for existing tickets.');
}

fs.writeFileSync(path, content, 'utf8');
