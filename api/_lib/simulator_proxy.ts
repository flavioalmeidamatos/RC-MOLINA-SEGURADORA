export const SIMULATOR_ORIGIN = 'https://app.simuladoronline.com';
export const SIMULATOR_PROXY_PREFIX = '/simulador-proxy';

export const getProxyRequestBody = (req: NodeJS.ReadableStream) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

export const rewriteSimulatorLocation = (location: string) => {
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

export const rewriteSimulatorCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${SIMULATOR_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

export const rewriteSimulatorText = (content: string, contentType: string) => {
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
        /(["'])\/(?!simulador-proxy\/)(static|js|files|login|inicio|logout|simulador|operadoras|cliente|agenda|admin|io|mig)\//g,
        `$1${SIMULATOR_PROXY_PREFIX}/$2/`
      );
  }

  return rewritten;
};

type ProxyHeaderValue = string | string[] | number | undefined;

export const buildSimulatorRequestHeaders = (headers: Record<string, ProxyHeaderValue>) => {
  const requestHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (!value) continue;

    const lowerName = name.toLowerCase();
    if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
      continue;
    }

    requestHeaders.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }

  requestHeaders.set('host', 'app.simuladoronline.com');
  requestHeaders.set('origin', SIMULATOR_ORIGIN);
  requestHeaders.set('referer', `${SIMULATOR_ORIGIN}/login/4602`);

  return requestHeaders;
};

export const getSimulatorSetCookies = (headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers);
  }

  const cookie = headers.get('set-cookie');
  return cookie ? [cookie] : [];
};
