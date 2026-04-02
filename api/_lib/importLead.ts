import * as cheerio from 'cheerio';

export interface ImportLeadPayload {
  login: string;
  senha: string;
  leadUrl: string;
}

export interface ImportLeadResult {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  nascimento: string;
  cpf_cnpj: string;
  observacao: string;
  vidas: Record<string, string>;
  origem: string;
  url_original: string;
}

export class ImportLeadHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getSetCookieLines = (response: Response) => {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };

  if (typeof responseHeaders.getSetCookie === 'function') {
    return responseHeaders.getSetCookie();
  }

  const rawCookieHeader = response.headers.get('set-cookie');
  return rawCookieHeader ? rawCookieHeader.split(/,(?=[^;]*=)/) : [];
};

export async function importLeadFromSistemaQuer({
  login,
  senha,
  leadUrl,
}: ImportLeadPayload): Promise<ImportLeadResult> {
  const safeLogin = login.trim();
  const safeSenha = senha.trim();
  const originalLeadUrl = leadUrl.trim();

  if (!safeLogin || !safeSenha || !originalLeadUrl) {
    throw new ImportLeadHttpError(400, 'Faltam parametros');
  }

  try {
    console.log('--- Iniciando scraping da lead ---');

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

    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    const commonHeaders = {
      'User-Agent': userAgent,
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

    const leadData: ImportLeadResult = {
      nome: findValue(['nome', 'indicacao', 'cliente', 'aluno']),
      email: findValue(['email', 'e-mail', 'correio']),
      telefone: findValue(['telefone', 'celular', 'whatsapp', 'fone celular']),
      endereco: findValue(['endereco', 'rua', 'logradouro']),
      numero: findValue(['numero']),
      bairro: findValue(['bairro']),
      cidade: findValue(['cidade']),
      nascimento: findValue(['nascimento']),
      cpf_cnpj: findValue(['cpf_cnpj', 'cpf', 'cnpj', 'documento']),
      observacao: findValue(['observacao', 'dados do calculo']),
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

    console.log('Lead importada com sucesso:', leadData.nome);
    return leadData;
  } catch (error) {
    if (error instanceof ImportLeadHttpError) {
      throw error;
    }

    console.error('Erro ao importar lead:', error);
    throw new ImportLeadHttpError(500, 'Erro na extracao completa de campos.');
  }
}
