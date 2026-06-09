const fs = require('fs');
const path = '/var/www/central-whatsapp/backend/dist/app.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/max:\s*120,/, 'max: 120000,');
fs.writeFileSync(path, content, 'utf8');
