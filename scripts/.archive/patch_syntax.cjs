const fs = require('fs');
const path = 'd:\\desarrollo antgra\\isp-reports-app\\scripts\\final_clean_sync.cjs';

let content = fs.readFileSync(path, 'utf8');

// Fix the missing comma between status: 'PE' and participant_type: 'U'
content = content.replace(/status: 'PE'\s+participant_type: 'U'/g, "status: 'PE',\n                        participant_type: 'U'");

// Fix the closing brace formatting issue if it was broken
content = content.replace(/participant_type: 'U',\s+?\}\);/g, "participant_type: 'U',\n                    });");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed syntax in final_clean_sync.cjs');
