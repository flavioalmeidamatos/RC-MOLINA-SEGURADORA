import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const replacements = [
  { from: /Nao foi possivel/g, to: 'Não foi possível' },
  { from: /operacao\./g, to: 'operação.' },
  { from: /Historico/g, to: 'Histórico' },
  { from: /historico/g, to: 'histórico' },
  { from: /Sessao ativa/g, to: 'Sessão ativa' },
  { from: / sessao/g, to: ' sessão' },
  { from: /Simbolos/g, to: 'Símbolos' },
  { from: /Renovacao/g, to: 'Renovação' },
  { from: /Italico/g, to: 'Itálico' },
  { from: /midia/g, to: 'mídia' },
  { from: /espaco /g, to: 'espaço ' },
  { from: /formatacao/g, to: 'formatação' },
  { from: /sera feito/g, to: 'será feito' },
  { from: /concluido/g, to: 'concluído' },
  { from: /usuarios do sistema/g, to: 'usuários do sistema' },
  { from: /Nenhum usuario/g, to: 'Nenhum usuário' },
  { from: /Usuarios do banco/g, to: 'Usuários do banco' },
  { from: /não identificado/g, to: 'não identificado' }, // already has accent but doesn't hurt
  { from: / usuarios/g, to: ' usuários' },
];

walkDir('d:/APRENDIZADO APP/RC-MOLINA-SEGURADORA/src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (let r of replacements) {
      content = content.replace(r.from, r.to);
    }
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  }
});
