import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { registerLocalAuthRoutes } from './api/_lib/local_auth_routes';
import { ImportLeadHttpError, importLeadFromSistemaQuer } from './api/_lib/import_lead';
import importLeadAssetHandler from './api/import-lead-asset';
import sendLoginCodeHandler from './api/send-login-code';
import { aniversariantesMesHandler, createClienteHandler, listClientesHandler, nextClienteCodigoHandler, searchClientesHandler, updateClienteHandler, deleteClienteHandler } from './api/clientes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });
const SIMULATOR_ORIGIN = 'https://app.simuladoronline.com';
const SIMULATOR_PROXY_PREFIX = '/simulador-proxy';
const SIMULATOR_PROXY_PREFIX_ESCAPED = SIMULATOR_PROXY_PREFIX.replace(/\//g, '\\/');
const SIMULATOR_APP_PATHS =
  'static|js|files|login|login_check|inicio|logout|simulador|operadoras|cliente|clientes|agenda|admin|io|mig|recuperar-senha|favicon\\.ico';
const SULAMERICA_ORIGIN = 'https://os11.sulamerica.com.br';
const SULAMERICA_PROXY_PREFIX = '/sulamerica-proxy';
const SULAMERICA_PROXY_PREFIX_ESCAPED = SULAMERICA_PROXY_PREFIX.replace(/\//g, '\\/');
const SULAMERICA_LOGIN_PATH = '/SaudeCotador/LoginVendedor.aspx';
const SULAMERICA_APP_PATHS =
  'SaudeCotador|WebPatterns|EPA_Taskbox|PerformanceProbe|RichWidgets|favicon\\.ico|_osjs\\.js|_OSGlobalJS\\.pt-BR\\.js|Theme\\.SaudeCotador\\.css';
const SIMULATOR_BLOCKED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'content-security-policy',
  'content-security-policy-report-only',
  'connection',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'transfer-encoding',
  'x-frame-options',
]);

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

const rewriteSimulatorAppPaths = (content: string) =>
  content
    .replace(
      new RegExp(`(["'=:(,]\\s*)/(?!/|simulador-proxy/)(${SIMULATOR_APP_PATHS})(?=/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!simulador-proxy\\\\/)(${SIMULATOR_APP_PATHS})(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX_ESCAPED}\\/$2`
    );

const rewriteSulamericaLocation = (location: string) => {
  if (location.startsWith(SULAMERICA_ORIGIN)) {
    return `${SULAMERICA_PROXY_PREFIX}${location.slice(SULAMERICA_ORIGIN.length)}`;
  }

  if (location.startsWith('//os11.sulamerica.com.br')) {
    return `${SULAMERICA_PROXY_PREFIX}${location.slice('//os11.sulamerica.com.br'.length)}`;
  }

  if (location.startsWith('/')) {
    return `${SULAMERICA_PROXY_PREFIX}${location}`;
  }

  return location;
};

const rewriteSulamericaCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${SULAMERICA_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const rewriteSulamericaAppPaths = (content: string) =>
  content
    .replace(
      new RegExp(`(["'=:(,]\\s*)/(?!/|sulamerica-proxy/)(${SULAMERICA_APP_PATHS})(?=/|\\?|["'])`, 'gi'),
      `$1${SULAMERICA_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!sulamerica-proxy\\\\/)(${SULAMERICA_APP_PATHS})(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${SULAMERICA_PROXY_PREFIX_ESCAPED}\\/$2`
    );

const rewriteSulamericaText = (content: string, contentType: string, upstreamPath: string) => {
  let rewritten = content
    .replaceAll(SULAMERICA_ORIGIN, SULAMERICA_PROXY_PREFIX)
    .replaceAll('http://os11.sulamerica.com.br', SULAMERICA_PROXY_PREFIX)
    .replaceAll('//os11.sulamerica.com.br', SULAMERICA_PROXY_PREFIX);

  if (contentType.includes('text/html')) {
    const basePath = upstreamPath.includes('/') ? upstreamPath.slice(0, upstreamPath.lastIndexOf('/') + 1) : '/';
    rewritten = rewritten
      .replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, '')
      .replace(/<head([^>]*)>/i, `<head$1><base href="${SULAMERICA_PROXY_PREFIX}${basePath}" />`)
      .replace(/\b(href|src|action)=["']\/(?!\/|sulamerica-proxy\/)/gi, `$1="${SULAMERICA_PROXY_PREFIX}/`);
  }

  if (contentType.includes('text/css') || contentType.includes('javascript')) {
    rewritten = rewritten
      .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${SULAMERICA_PROXY_PREFIX}/`)
      .replace(
        new RegExp(`(["'])/(?!sulamerica-proxy/)(${SULAMERICA_APP_PATHS})(?=/|\\?)`, 'gi'),
        `$1${SULAMERICA_PROXY_PREFIX}/$2`
      );
  }

  return rewriteSulamericaAppPaths(rewritten);
};

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
      .replace(
        new RegExp(`(["'])/(?!simulador-proxy/)(${SIMULATOR_APP_PATHS})/`, 'gi'),
        `$1${SIMULATOR_PROXY_PREFIX}/$2/`
      );
  }

  return rewriteSimulatorAppPaths(rewritten);
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(uploadDir));

  registerLocalAuthRoutes(app);

  app.post('/api/send-login-code', sendLoginCodeHandler);

  app.post('/api/clientes', createClienteHandler);
  app.get('/api/clientes', listClientesHandler);
  app.get('/api/clientes/next-code', nextClienteCodigoHandler);
  app.get('/api/clientes/aniversariantes-mes', aniversariantesMesHandler);
  app.get('/api/clientes/search', searchClientesHandler);
  app.put('/api/clientes/:id', updateClienteHandler);
  app.delete('/api/clientes/:id', deleteClienteHandler);

  app.get('/api/import-lead-asset', (req, res) => {
    importLeadAssetHandler(req, res);
  });

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
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) {
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

  app.all(`${SULAMERICA_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = req.originalUrl.slice(SULAMERICA_PROXY_PREFIX.length) || SULAMERICA_LOGIN_PATH;
    const upstreamUrl = new URL(upstreamPath, SULAMERICA_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;

      const lowerName = name.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
        continue;
      }

      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    requestHeaders.set('host', 'os11.sulamerica.com.br');
    requestHeaders.set('origin', SULAMERICA_ORIGIN);
    requestHeaders.set('referer', `${SULAMERICA_ORIGIN}${SULAMERICA_LOGIN_PATH}`);

    try {
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) {
          return;
        }

        if (lowerName === 'location') {
          res.setHeader('Location', rewriteSulamericaLocation(value));
          return;
        }

        if (lowerName === 'set-cookie') {
          return;
        }

        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteSulamericaCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

      if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
        res.send(rewriteSulamericaText(responseBuffer.toString('utf8'), contentType, upstreamPath));
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY SULAMERICA:', error);
      res.status(502).send('Erro ao carregar o proxy SulAmerica.');
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
