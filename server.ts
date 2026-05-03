import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ImportLeadHttpError, importLeadFromSistemaQuer } from './api/_lib/import_lead';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SIMULATOR_ORIGIN = 'https://app.simuladoronline.com';
const SIMULATOR_PROXY_PREFIX = '/simulador-proxy';

const getRequestBody = (req: express.Request) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const rewriteSimulatorLocation = (location: string) => {
  if (location.startsWith(SIMULATOR_ORIGIN)) {
    return `${SIMULATOR_PROXY_PREFIX}${location.slice(SIMULATOR_ORIGIN.length)}`;
  }

  if (location.startsWith('//app.simuladoronline.com')) {
    return `${SIMULATOR_PROXY_PREFIX}${location.slice('//app.simuladoronline.com'.length)}`;
  }

  if (location.startsWith('/')) {
    return `${SIMULATOR_PROXY_PREFIX}${location}`;
  }

  return location;
};

const rewriteSimulatorCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${SIMULATOR_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const rewriteSimulatorText = (content: string, contentType: string) => {
  const proxyOrigin = SIMULATOR_PROXY_PREFIX;
  let rewritten = content
    .replaceAll(SIMULATOR_ORIGIN, proxyOrigin)
    .replaceAll('http://app.simuladoronline.com', proxyOrigin)
    .replaceAll('//app.simuladoronline.com', proxyOrigin);

  if (contentType.includes('text/html')) {
    rewritten = rewritten
      .replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, `<base href="${SIMULATOR_PROXY_PREFIX}/" />`)
      .replace(/\b(href|src|action)=["']\/(?!\/|simulador-proxy\/)/gi, `$1="${SIMULATOR_PROXY_PREFIX}/`)
      .replace(/window\.BASE_URL\s*=\s*['"][^'"]*['"]/g, `window.BASE_URL = '${SIMULATOR_PROXY_PREFIX}/'`)
      .replace(/window\.ASSETS_URL\s*=\s*['"][^'"]*['"]/g, `window.ASSETS_URL = '${SIMULATOR_PROXY_PREFIX}/static/'`)
      .replace(
        /<input([^>]*id=["']login_usuario["'][^>]*?)\s*\/?>/i,
        '<input$1 value="Rosilene Rodrigues" autocomplete="off" data-lpignore="true">'
      )
      .replace(
        /<input([^>]*id=["']login_senha["'][^>]*?)\s*\/?>/i,
        '<input$1 value="123" autocomplete="off" data-lpignore="true">'
      );
  }

  if (contentType.includes('text/css') || contentType.includes('javascript')) {
    rewritten = rewritten
      .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${SIMULATOR_PROXY_PREFIX}/`)
      .replace(/(["'])\/(?!simulador-proxy\/)(static|js|files|login|inicio|logout|simulador|operadoras|cliente|agenda|admin|io|mig)\//g, `$1${SIMULATOR_PROXY_PREFIX}/$2/`);
  }

  return rewritten;
};

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

  app.all(`${SIMULATOR_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = req.originalUrl.slice(SIMULATOR_PROXY_PREFIX.length) || '/login/4602';
    const upstreamUrl = new URL(upstreamPath, SIMULATOR_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;

      const lowerName = name.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
        continue;
      }

      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    requestHeaders.set('host', 'app.simuladoronline.com');
    requestHeaders.set('origin', SIMULATOR_ORIGIN);
    requestHeaders.set('referer', `${SIMULATOR_ORIGIN}/login/4602`);

    try {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lowerName)) {
          return;
        }

        if (lowerName === 'location') {
          res.setHeader('Location', rewriteSimulatorLocation(value));
          return;
        }

        if (lowerName === 'set-cookie') {
          return;
        }

        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteSimulatorCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

      if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
        res.send(rewriteSimulatorText(responseBuffer.toString('utf8'), contentType));
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY DO SIMULADOR:', error);
      res.status(502).send('Erro ao carregar o proxy do simulador.');
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
