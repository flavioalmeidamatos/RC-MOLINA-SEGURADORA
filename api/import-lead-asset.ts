import * as cheerio from 'cheerio';

type VercelRequest = {
  method?: string;
  query?: {
    url?: string | string[];
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  end: (body?: string | Uint8Array) => void;
};

const allowedHosts = [
  'querplanodesaude.com.br',
  'www.querplanodesaude.com.br',
  'sistemaquer.com.br',
  'www.sistemaquer.com.br',
];

const getUrlParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || '' : value || '';

const isAllowedHost = (hostname: string): boolean =>
  allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));

const inferFileName = (assetUrl: URL, contentType: string): string => {
  const lastSegment = assetUrl.pathname.split('/').filter(Boolean).pop() || '';
  if (lastSegment.includes('.')) {
    return lastSegment;
  }

  const baseName = lastSegment || 'anuncio-importado';

  if (contentType.includes('png')) return `${baseName}.png`;
  if (contentType.includes('webp')) return `${baseName}.webp`;
  if (contentType.includes('gif')) return `${baseName}.gif`;
  if (contentType.includes('svg')) return `${baseName}.svg`;
  return `${baseName}.jpg`;
};

const fetchWithBrowserHeaders = (targetUrl: string, referer: string) =>
  fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8,text/html;q=0.7',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      Referer: referer,
    },
    redirect: 'follow',
  });

const resolveHtmlImageUrl = (pageUrl: URL, html: string): URL | null => {
  const $ = cheerio.load(html);
  const candidates = [
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
    $('img[src*="/anuncios/"]').first().attr('src'),
    $('img').first().attr('src'),
  ]
    .map((value) => (value || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      return new URL(candidate, pageUrl);
    } catch (_error) {
      // Ignore malformed candidate.
    }
  }

  return null;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'GET');

  if (request.method !== 'GET') {
    response.status(405).end('Metodo nao permitido.');
    return;
  }

  const rawUrl = getUrlParam(request.query?.url).trim();

  if (!rawUrl) {
    response.status(400).end('URL do anuncio nao informada.');
    return;
  }

  let assetUrl: URL;

  try {
    assetUrl = new URL(rawUrl);
  } catch (_error) {
    response.status(400).end('URL do anuncio invalida.');
    return;
  }

  if (!isAllowedHost(assetUrl.hostname)) {
    response.status(403).end('Host do anuncio nao permitido.');
    return;
  }

  try {
    let upstream = await fetchWithBrowserHeaders(assetUrl.toString(), 'https://sistemaquer.com.br/');

    if (!upstream.ok) {
      response.status(502).end('Falha ao baixar anuncio remoto.');
      return;
    }

    let contentType = upstream.headers.get('content-type') || 'image/jpeg';
    let finalAssetUrl = assetUrl;

    if (contentType.includes('text/html')) {
      const html = await upstream.text();
      const resolvedImageUrl = resolveHtmlImageUrl(assetUrl, html);

      if (!resolvedImageUrl || !isAllowedHost(resolvedImageUrl.hostname)) {
        response.status(502).end('Nao foi possivel localizar a imagem do anuncio.');
        return;
      }

      finalAssetUrl = resolvedImageUrl;
      upstream = await fetchWithBrowserHeaders(finalAssetUrl.toString(), assetUrl.origin);

      if (!upstream.ok) {
        response.status(502).end('Falha ao baixar a imagem do anuncio.');
        return;
      }

      contentType = upstream.headers.get('content-type') || 'image/jpeg';
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const fileName = inferFileName(finalAssetUrl, contentType);

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', String(arrayBuffer.byteLength));
    response.setHeader('X-Imported-File-Name', fileName);
    response.status(200).end(Buffer.from(arrayBuffer));
  } catch (_error) {
    response.status(500).end('Erro ao importar anuncio.');
  }
}
