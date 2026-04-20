import * as cheerio from 'cheerio';

type ImportLeadPayload = {
  login: string;
  senha: string;
  leadUrl: string;
};

class ImportLeadHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type VercelRequest = {
  method?: string;
  body?: {
    login?: string;
    senha?: string;
    leadUrl?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
  json: (body: unknown) => void;
};

export const config = {
  maxDuration: 60,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const anuncioBaseUrl = 'https://querplanodesaude.com.br/anuncios/';

const extractIndicacaoId = (leadUrl: string): string => {
  const directMatch = leadUrl.match(/[?&]indicacao_id=(\d+)/);
  if (directMatch?.[1]) return directMatch[1];

  try {
    const parsedUrl = new URL(leadUrl);
    return parsedUrl.searchParams.get('indicacao_id') || '';
  } catch (_error) {
    return '';
  }
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const mappedObservationLabels = new Set([
  'nome',
  'indicacao',
  'cliente',
  'aluno',
  'telefone',
  'celular',
  'whatsapp',
  'fone celular',
  'email',
  'e-mail',
  'correio',
  'cpf_cnpj',
  'cpf',
  'cnpj',
  'documento',
  'nascimento',
  'data nascimento',
  'data de nascimento',
  'endereco',
  'rua',
  'logradouro',
  'numero',
  'bairro',
  'cidade',
  'indicacao id',
  'indicacao_id',
  'codigo',
]);

const cleanObservationLine = (line: string): string =>
  line
    .replace(/\*/g, '')
    .replace(/^[\s>•▶✅]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const shouldDiscardObservationLine = (line: string): boolean => {
  if (!line || /^[-_=]{5,}$/.test(line)) return true;

  const normalizedLine = normalizeText(line);

  if (
    normalizedLine.includes('chegou um novo lead de planos de saude - form instant') ||
    normalizedLine.includes('clique no numero de telefone e entre em contato agora mesmo') ||
    normalizedLine === 'informacoes'
  ) {
    return true;
  }

  const labelMatch = line.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
  if (!labelMatch) return false;

  const normalizedLabel = normalizeText(labelMatch[1]).replace(/[^a-z0-9_ -]/g, '').trim();
  return mappedObservationLabels.has(normalizedLabel);
};

const sanitizeObservation = (value: string): string =>
  value
    .split(/\r?\n/)
    .map(cleanObservationLine)
    .filter((line) => !shouldDiscardObservationLine(line))
    .join('\n')
    .trim();

const getSetCookieLines = (response: Response) => {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };

  if (typeof responseHeaders.getSetCookie === 'function') {
    return responseHeaders.getSetCookie();
  }

  const rawCookieHeader = response.headers.get('set-cookie');
  return rawCookieHeader ? rawCookieHeader.split(/,(?=[^;]*=)/) : [];
};

const importLeadFromSistemaQuer = async ({ login, senha, leadUrl }: ImportLeadPayload) => {
  const safeLogin = login.trim();
  const safeSenha = senha.trim();
  const originalLeadUrl = leadUrl.trim();
  const indicacaoId = extractIndicacaoId(originalLeadUrl);

  if (!safeLogin || !safeSenha || !originalLeadUrl) {
    throw new ImportLeadHttpError(400, 'Faltam parametros');
  }

  try {
    const cookieJar = new Map<string, string>();

    const updateCookies = (response: Response) => {
      const setCookieLines = getSetCookieLines(response);

      setCookieLines.forEach((line) => {
        const mainCookie = line.split(';')[0];
        const separatorIndex = mainCookie.indexOf('=');

        if (separatorIndex <= 0) {
          return;
        }

        const key = mainCookie.substring(0, separatorIndex).trim();
        const value = mainCookie.substring(separatorIndex + 1).trim();

        if (value && value !== 'deleted' && value !== '""') {
          cookieJar.set(key, value);
        }
      });
    };

    const getCookieHeader = () =>
      Array.from(cookieJar.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const initialResponse = await fetch('https://sistemaquer.com.br/entrar.php', { headers: commonHeaders });
    updateCookies(initialResponse);
    await sleep(1000);

    const loginBody = new URLSearchParams();
    loginBody.append('login', safeLogin);
    loginBody.append('validar', '1');
    loginBody.append('senha', safeSenha);

    const loginResponse = await fetch('https://sistemaquer.com.br/entrar.php', {
      method: 'POST',
      body: loginBody,
      redirect: 'manual',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: getCookieHeader(),
        Origin: 'https://sistemaquer.com.br',
        Referer: 'https://sistemaquer.com.br/entrar.php',
      },
    });
    updateCookies(loginResponse);

    let currentUrl = 'https://sistemaquer.com.br/entrar.php';
    let currentResponse = loginResponse;
    let redirectDepth = 0;

    while ([301, 302, 303, 307, 308].includes(currentResponse.status) && redirectDepth < 5) {
      const nextLocation = currentResponse.headers.get('location');
      if (!nextLocation) {
        break;
      }

      const nextUrl = new URL(nextLocation, currentUrl).href;
      currentResponse = await fetch(nextUrl, {
        headers: {
          ...commonHeaders,
          Cookie: getCookieHeader(),
          Referer: currentUrl,
        },
      });
      updateCookies(currentResponse);
      currentUrl = nextUrl;
      redirectDepth += 1;
    }

    await sleep(1500);

    const targetLeadUrl = originalLeadUrl.replace('http://', 'https://');
    const finalResponse = await fetch(targetLeadUrl, {
      headers: {
        ...commonHeaders,
        Cookie: getCookieHeader(),
        Referer: 'https://sistemaquer.com.br/index.php',
      },
    });
    updateCookies(finalResponse);

    const finalHtml = await finalResponse.text();
    const $ = cheerio.load(finalHtml);

    if (finalHtml.includes('login100-form') || $('title').text().includes('Login')) {
      throw new ImportLeadHttpError(401, 'Sessao expirada. Tente importar novamente.');
    }

    const findValue = (keywords: string[]) => {
      let foundValue = '';
      const normalizedKeywords = keywords.map(normalizeText);

      $('td').each((_, element) => {
        const cellText = normalizeText($(element).text().trim());

        if (normalizedKeywords.some((keyword) => cellText.includes(keyword))) {
          let value = $(element).next('td').text().trim();

          if (!value) {
            value = $(element).next('td').find('input, textarea, select').val()?.toString().trim() || '';
          }

          if (value && value.length > 1) {
            if (normalizedKeywords.includes('telefone')) {
              value = value.replace(/\D/g, '');
            }

            foundValue = value;
            return false;
          }
        }

        return undefined;
      });

      if (!foundValue) {
        for (const keyword of normalizedKeywords) {
          const selector =
            `input[name*='${keyword}'], input[id*='${keyword}'], textarea[name*='${keyword}'], textarea[id*='${keyword}']`;

          $(selector).each((_, element) => {
            let value = $(element).val()?.toString().trim() || '';

            if (value) {
              if (normalizedKeywords.includes('telefone')) {
                value = value.replace(/\D/g, '');
              }

              foundValue = value;
              return false;
            }

            return undefined;
          });

          if (foundValue) {
            break;
          }
        }
      }

      return foundValue;
    };

    const findAnuncioUrl = () => {
      let anuncioUrl = '';

      $('a').each((_, element) => {
        const href = $(element).attr('href') || '';
        const text = normalizeText($(element).text().trim());

        if (href.includes('/anuncios/') || text.includes('ver anuncio')) {
          anuncioUrl = new URL(href, targetLeadUrl).href;
          return false;
        }

        return undefined;
      });

      return anuncioUrl || (indicacaoId ? `${anuncioBaseUrl}${indicacaoId}.png` : '');
    };

    const rawObservation = findValue(['observacao', 'dados do calculo']);

    const leadData = {
      nome: findValue(['nome', 'indicacao', 'cliente', 'aluno']),
      email: findValue(['email', 'e-mail', 'correio']),
      telefone: findValue(['telefone', 'celular', 'whatsapp', 'fone celular']),
      endereco: findValue(['endereco', 'rua', 'logradouro']),
      numero: findValue(['numero']),
      bairro: findValue(['bairro']),
      cidade: findValue(['cidade']),
      nascimento: findValue(['nascimento']),
      cpf_cnpj: findValue(['cpf_cnpj', 'cpf', 'cnpj', 'documento']),
      observacao: sanitizeObservation(rawObservation),
      vidas: {
        '00-18': $('#idade_00_18').val()?.toString() || '0',
        '19-23': $('#idade_19_23').val()?.toString() || '0',
        '24-28': $('#idade_24_28').val()?.toString() || '0',
        '29-33': $('#idade_29_33').val()?.toString() || '0',
        '34-38': $('#idade_34_38').val()?.toString() || '0',
        '39-43': $('#idade_39_43').val()?.toString() || '0',
        '44-48': $('#idade_44_48').val()?.toString() || '0',
        '49-53': $('#idade_49_53').val()?.toString() || '0',
        '54-58': $('#idade_54_58').val()?.toString() || '0',
        '59+': $('#idade_60').val()?.toString() || '0',
      },
      origem: 'Sistema Quer',
      url_original: originalLeadUrl,
      indicacao_id: indicacaoId,
      anuncio_url: findAnuncioUrl(),
    };

    if (!leadData.nome || leadData.nome === 'Nao identificado') {
      leadData.nome = $('.card-header h4').first().text().trim() || $('.card-title').first().text().trim() || 'Nao identificado';
    }

    if (leadData.telefone && leadData.telefone.length >= 10) {
      const digits = leadData.telefone;
      leadData.telefone =
        digits.length === 11
          ? `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`
          : `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
    }

    return leadData;
  } catch (error) {
    if (error instanceof ImportLeadHttpError) {
      throw error;
    }

    console.error('Erro ao importar lead:', error);
    throw new ImportLeadHttpError(500, 'Erro na extracao completa de campos.');
  }
};

const applyHeaders = (response: VercelResponse) => {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Surrogate-Control', 'no-store');
  response.setHeader('Allow', 'POST, OPTIONS');
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Metodo nao permitido.' });
  }

  try {
    const data = await importLeadFromSistemaQuer({
      login: String(request.body?.login || ''),
      senha: String(request.body?.senha || ''),
      leadUrl: String(request.body?.leadUrl || ''),
    });

    return response.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ImportLeadHttpError) {
      return response.status(error.status).json({ error: error.message });
    }

    console.error('Erro inesperado na function import-lead:', error);
    return response.status(500).json({ error: 'Erro interno ao importar lead.' });
  }
}
