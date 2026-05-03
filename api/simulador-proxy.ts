import {
  SIMULATOR_ORIGIN,
  buildSimulatorRequestHeaders,
  getProxyRequestBody,
  getSimulatorSetCookies,
  rewriteSimulatorCookie,
  rewriteSimulatorLocation,
  rewriteSimulatorText,
} from './_lib/simulator_proxy.js';

type VercelProxyRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | number | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type VercelProxyResponse = {
  status: (code: number) => VercelProxyResponse;
  setHeader: (name: string, value: string | string[]) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
  appendHeader?: (name: string, value: string) => void;
  end: (body?: string | Buffer) => void;
};

export const config = {
  maxDuration: 60,
};

const appendHeader = (res: VercelProxyResponse, name: string, value: string) => {
  if (typeof res.appendHeader === 'function') {
    res.appendHeader(name, value);
    return;
  }

  const currentValue = res.getHeader?.(name);
  if (Array.isArray(currentValue)) {
    res.setHeader(name, [...currentValue.map(String), value]);
    return;
  }

  if (typeof currentValue === 'string' || typeof currentValue === 'number') {
    res.setHeader(name, [String(currentValue), value]);
    return;
  }

  res.setHeader(name, value);
};

const getProxyPath = (value: string | string[] | undefined) => {
  const rawPath = Array.isArray(value) ? value.join('/') : value;
  const safePath = rawPath?.replace(/^\/+/, '') || 'login/4602';
  return `/${safePath}`;
};

export default async function handler(req: VercelProxyRequest, res: VercelProxyResponse) {
  const requestUrl = new URL(req.url || '', 'http://localhost');
  const upstreamPath = getProxyPath(req.query?.path || requestUrl.searchParams.get('path') || undefined);
  requestUrl.searchParams.delete('path');
  const upstreamUrl = new URL(`${upstreamPath}${requestUrl.search}`, SIMULATOR_ORIGIN);

  try {
    const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await getProxyRequestBody(req);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: buildSimulatorRequestHeaders(req.headers),
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

    for (const cookie of getSimulatorSetCookies(upstreamResponse.headers)) {
      appendHeader(res, 'Set-Cookie', rewriteSimulatorCookie(cookie));
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

    if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
      res.end(rewriteSimulatorText(responseBuffer.toString('utf8'), contentType));
      return;
    }

    res.end(responseBuffer);
  } catch (error) {
    console.error('ERRO NO PROXY DO SIMULADOR:', error);
    res.status(502).end('Erro ao carregar o proxy do simulador.');
  }
}
