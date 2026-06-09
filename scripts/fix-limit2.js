const fs = require('fs');
const file = '/var/www/central-whatsapp/backend/dist/app.js';
let c = fs.readFileSync(file, 'utf8');

// Fix any broken limit from previous attempts
c = c.replace(/app\.use\(express_1\.default\.json\([^)]*\)\);/g, "app.use(express_1.default.json({limit:'50mb'}));");
c = c.replace(/app\.use\(express_1\.default\.urlencoded\([^)]*\)\);/g, "app.use(express_1.default.urlencoded({ extended: true, limit:'50mb' }));");

fs.writeFileSync(file, c);
console.log("Successfully fixed limits in app.js");
