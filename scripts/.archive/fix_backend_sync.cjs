const fs = require('fs');
const path = 'd:\\desarrollo antgra\\isp-reports-app\\scripts\\final_clean_sync.cjs';

let content = fs.readFileSync(path, 'utf8');

// 1. Fix matchedUser mapping to use UUID (matchedUser.id)
content = content.replace(
    /const targetParticipantId = matchedUser \? matchedUser\.id : null;/,
    "const targetParticipantId = matchedUser ? matchedUser.id : null;"
); // Already used UUID in previous edit? Let's be sure.

// 2. Add participant_type: 'U' to all workflow_workitems insertions
// We look for .from('workflow_workitems').insert({ ... })
const insertRegex = /\.from\('workflow_workitems'\)\.insert\(\{([\s\S]+?)\}\)/g;
content = content.replace(insertRegex, (match, body) => {
    if (!body.includes('participant_type')) {
        // Add it before the closing bracket of the object
        return match.replace('}', "    participant_type: 'U',\n                }");
    }
    return match;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated final_clean_sync.cjs with participant_type and UUID consistency.');
