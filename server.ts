import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ImportLeadHttpError, importLeadFromSistemaQuer } from './api/_lib/import_lead';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/import-lead', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
      const data = await importLeadFromSistemaQuer({
        login: String(req.body?.login || ''),
        senha: String(req.body?.senha || ''),
        leadUrl: String(req.body?.leadUrl || ''),
      });

      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof ImportLeadHttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      console.error('ERRO:', error);
      return res.status(500).json({ error: 'Erro interno ao importar lead.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Rodando em http://localhost:${PORT}`));
}

startServer();
