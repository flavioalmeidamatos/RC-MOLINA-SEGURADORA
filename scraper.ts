import * as cheerio from 'cheerio';

async function testScraping(login: string, senha: string, indicacao_id: string) {
  try {
    // 1. Fazer o Login
    const loginParams = new URLSearchParams();
    loginParams.append('login', login);
    loginParams.append('senha', senha);
    loginParams.append('validar', '1');

    console.log('Tentando login...');
    const loginRes = await fetch('http://sistemaquer.com.br/', {
      method: 'POST',
      body: loginParams,
      redirect: 'manual', // Não queremos seguir o redirecionamento automaticamente
    });

    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('Cookies recebidos:', setCookieHeader);

    if (!setCookieHeader) {
      console.log('Falha no login ou nenhum cookie retornado.');
      return;
    }

    // Pega o PHPSESSID ou outro cookie
    const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');

    // 2. Acessar a página
    console.log('Acessando indicação...', indicacao_id);
    const indicacaoRes = await fetch(`http://sistemaquer.com.br/alterar-indicacao.php?indicacao_id=${indicacao_id}`, {
      headers: {
        'Cookie': cookies
      }
    });

    const html = await indicacaoRes.text();
    const $ = cheerio.load(html);

    // TODO: extrair os dados. Vamos só ver o title por enquanto
    console.log('Título da página logada:', $('title').text());

  } catch (error) {
    console.error('Erro:', error);
  }
}

// execute
testScraping('demo', 'demo', '274959');
