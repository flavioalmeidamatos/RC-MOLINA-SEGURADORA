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
  estado: string;
  nascimento: string;
  cpf_cnpj: string;
  observacao: string;
  vidas: Record<string, string>;
  origem: string;
  url_original: string;
  indicacao_id: string;
  anuncio_url: string;
}

export class ImportLeadHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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
  'estado',
  'uf',
  'indicacao id',
  'indicacao_id',
  'codigo',
]);

const stateByNormalizedNameOrUf = new Map([
  ['ac', 'AC'],
  ['acre', 'AC'],
  ['al', 'AL'],
  ['alagoas', 'AL'],
  ['ap', 'AP'],
  ['amapa', 'AP'],
  ['am', 'AM'],
  ['amazonas', 'AM'],
  ['ba', 'BA'],
  ['bahia', 'BA'],
  ['ce', 'CE'],
  ['ceara', 'CE'],
  ['df', 'DF'],
  ['distrito federal', 'DF'],
  ['es', 'ES'],
  ['espirito santo', 'ES'],
  ['go', 'GO'],
  ['goias', 'GO'],
  ['mg', 'MG'],
  ['minas gerais', 'MG'],
  ['ms', 'MS'],
  ['mato grosso do sul', 'MS'],
  ['mt', 'MT'],
  ['mato grosso', 'MT'],
  ['pa', 'PA'],
  ['para', 'PA'],
  ['pb', 'PB'],
  ['paraiba', 'PB'],
  ['pe', 'PE'],
  ['pernambuco', 'PE'],
  ['pi', 'PI'],
  ['piaui', 'PI'],
  ['pr', 'PR'],
  ['parana', 'PR'],
  ['rj', 'RJ'],
  ['rio de janeiro', 'RJ'],
  ['rn', 'RN'],
  ['rio grande do norte', 'RN'],
  ['ro', 'RO'],
  ['rondonia', 'RO'],
  ['rr', 'RR'],
  ['roraima', 'RR'],
  ['rs', 'RS'],
  ['rio grande do sul', 'RS'],
  ['sc', 'SC'],
  ['santa catarina', 'SC'],
  ['se', 'SE'],
  ['sergipe', 'SE'],
  ['sp', 'SP'],
  ['sao paulo', 'SP'],
  ['to', 'TO'],
  ['tocantins', 'TO'],
]);

const knownCityByNormalizedName = new Map([
  ['rio de janeiro', 'Rio de Janeiro'],
  ['niteroi', 'Niterói'],
  ['petropolis', 'Petrópolis'],
  ['volta redonda', 'Volta Redonda'],
  ['sao paulo', 'São Paulo'],
  ['campinas', 'Campinas'],
  ['santos', 'Santos'],
  ['ribeirao preto', 'Ribeirão Preto'],
  ['belo horizonte', 'Belo Horizonte'],
  ['juiz de fora', 'Juiz de Fora'],
  ['uberlandia', 'Uberlândia'],
  ['contagem', 'Contagem'],
]);

const cleanObservationLine = (line: string): string =>
  line
    .replace(/\*/g, '')
    .replace(/^[\s>•▶✅]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const splitObservationSegments = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .flatMap((line) => cleanObservationLine(line).split(/\s+-\s+/).map(cleanObservationLine))
    .filter(Boolean);

const normalizeObservationLabel = (value: string): string =>
  normalizeText(value).replace(/[^a-z0-9_ -]/g, '').trim();

const formatObservationLabel = (value: string): string =>
  cleanObservationLine(value)
    .replace(/[?]+$/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR');

const normalizeObservationValue = (value: string): string =>
  normalizeText(cleanObservationLine(value))
    .replace(/[^a-z0-9@._+-]+/g, ' ')
    .trim();

const normalizeComparableDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
};

const matchesMappedObservationValue = (line: string, mappedValues: string[]): boolean => {
  const normalizedLine = normalizeObservationValue(line);
  const lineDigits = normalizeComparableDigits(line);

  return mappedValues.some((value) => {
    const normalizedValue = normalizeObservationValue(value);

    if (normalizedLine && normalizedValue && normalizedLine === normalizedValue) {
      return true;
    }

    const valueDigits = normalizeComparableDigits(value);
    return lineDigits.length >= 8 && valueDigits.length >= 8 && lineDigits === valueDigits;
  });
};

const shouldDiscardObservationLine = (line: string, mappedValues: string[]): boolean => {
  if (!line || /^[-_=]{5,}$/.test(line)) return true;

  const normalizedLine = normalizeText(line);

  if (
    normalizedLine.includes('chegou um novo lead de planos de saude') ||
    normalizedLine.includes('form instant') ||
    normalizedLine.includes('clique no numero de telefone e entre em contato agora mesmo') ||
    normalizedLine === 'informacoes'
  ) {
    return true;
  }

  if (matchesMappedObservationValue(line, mappedValues)) {
    return true;
  }

  const labelMatch = line.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
  if (!labelMatch) return false;

  const normalizedLabel = normalizeObservationLabel(labelMatch[1]);
  return mappedObservationLabels.has(normalizedLabel);
};

const formatObservationLine = (line: string): string => {
  const labelMatch = line.match(/^([^:：]{1,80})[:：]\s*(.*)$/);

  if (!labelMatch) {
    return line.toLocaleUpperCase('pt-BR');
  }

  const label = formatObservationLabel(labelMatch[1]);
  const value = cleanObservationLine(labelMatch[2]).toLocaleUpperCase('pt-BR');
  return value ? `${label}: ${value}` : label;
};

const sanitizeObservation = (value: string, mappedValues: string[]): string =>
  splitObservationSegments(value)
    .filter((line) => !shouldDiscardObservationLine(line, mappedValues))
    .map(formatObservationLine)
    .join(' - ')
    .trim();

const extractStateFromObservation = (value: string): string => {
  for (const line of splitObservationSegments(value)) {
    const labelMatch = line.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
    const candidate =
      labelMatch && ['estado', 'uf'].includes(normalizeObservationLabel(labelMatch[1]))
        ? labelMatch[2]
        : line;
    const state = stateByNormalizedNameOrUf.get(normalizeObservationValue(candidate));

    if (state) {
      return state;
    }
  }

  return '';
};

const extractCityFromObservation = (value: string): string => {
  for (const line of splitObservationSegments(value)) {
    const labelMatch = line.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
    const isCityLabel = labelMatch && normalizeObservationLabel(labelMatch[1]) === 'cidade';
    const candidate = isCityLabel ? labelMatch[2] : line;

    if (isCityLabel && cleanObservationLine(candidate)) {
      return cleanObservationLine(candidate);
    }

    const city = knownCityByNormalizedName.get(normalizeObservationValue(candidate));

    if (city) {
      return city;
    }
  }

  return '';
};

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
  const indicacaoId = extractIndicacaoId(originalLeadUrl);

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

    const leadData: ImportLeadResult = {
      nome: findValue(['nome', 'indicacao', 'cliente', 'aluno']),
      email: findValue(['email', 'e-mail', 'correio']),
      telefone: findValue(['telefone', 'celular', 'fone celular']),
      endereco: findValue(['endereco', 'rua', 'logradouro']),
      numero: findValue(['numero']),
      bairro: findValue(['bairro']),
      cidade: findValue(['cidade']),
      estado: findValue(['estado', 'uf']),
      nascimento: findValue(['nascimento']),
      cpf_cnpj: findValue(['cpf_cnpj', 'cpf', 'cnpj', 'documento']),
      observacao: '',
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

    if (!leadData.cidade) {
      leadData.cidade = extractCityFromObservation(rawObservation);
    }

    if (!leadData.estado) {
      leadData.estado = extractStateFromObservation(rawObservation);
    }

    if (leadData.telefone && leadData.telefone.length >= 10) {
      const digits = leadData.telefone;
      leadData.telefone =
        digits.length === 11
          ? `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`
          : `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
    }

    leadData.observacao = sanitizeObservation(rawObservation, [
      leadData.nome,
      leadData.email,
      leadData.telefone,
      leadData.endereco,
      leadData.numero,
      leadData.bairro,
      leadData.cidade,
      leadData.estado,
      leadData.nascimento,
      leadData.cpf_cnpj,
      leadData.indicacao_id,
    ]);

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
