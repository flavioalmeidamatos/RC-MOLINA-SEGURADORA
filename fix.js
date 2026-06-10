const fs = require('fs');
let t = fs.readFileSync('src/components/configuracoes/configuracoes.tsx', 'utf8');
t = t.replace('celular: row.celular ? \\`\\'\\${row.celular}\\` : row.celular,', 'celular: row.celular ? `\\'${row.celular}` : row.celular,');
fs.writeFileSync('src/components/configuracoes/configuracoes.tsx', t, 'utf8');
