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

const allowedHosts = new Set([
  'querplanodesaude.com.br',
  'www.querplanodesaude.com.br',
  'sistemaquer.com.br',
  'www.sistemaquer.com.br',
]);

const getUrlParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || '' : value || '';

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

  if (!allowedHosts.has(assetUrl.hostname)) {
    response.status(403).end('Host do anuncio nao permitido.');
    return;
  }

  try {
    const upstream = await fetch(assetUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: 'https://sistemaquer.com.br/',
      },
    });

    if (!upstream.ok) {
      response.status(502).end('Falha ao baixar anuncio remoto.');
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await upstream.arrayBuffer();
    const fileName = inferFileName(assetUrl, contentType);

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', String(arrayBuffer.byteLength));
    response.setHeader('X-Imported-File-Name', fileName);
    response.status(200).end(Buffer.from(arrayBuffer));
  } catch (_error) {
    response.status(500).end('Erro ao importar anuncio.');
  }
}
