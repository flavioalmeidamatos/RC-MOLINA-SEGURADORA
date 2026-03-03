import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from 'cheerio';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/import-lead", async (req, res) => {
    const login = req.body.login?.trim();
    const senha = req.body.senha?.trim();
    const leadUrl = req.body.leadUrl?.trim();

    if (!login || !senha || !leadUrl) {
      return res.status(400).json({ error: "Faltam parâmetros" });
    }

    try {
      console.log('--- Iniciando Scraping (The Master Bridge) ---');
      const cookieJar = new Map<string, string>();

      const updateCookies = (response: any) => {
        // @ts-ignore
        const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : (response.headers.get('set-cookie') || '').split(/,(?=[^;]*=)/);
        setCookies.forEach((line: string) => {
          const main = line.split(';')[0];
          const eqIdx = main.indexOf('=');
          if (eqIdx > 0) {
            const key = main.substring(0, eqIdx).trim();
            const val = main.substring(eqIdx + 1).trim();
            if (val && val !== 'deleted') cookieJar.set(key, val);
          }
        });
      };

      const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

      // 1. Visitar a página de login oficial (HTTPS)
      const loginPageUrl = "https://sistemaquer.com.br/entrar.php";
      console.log('> Passo 1: Capturando token de segurança...');
      const r1 = await fetch(loginPageUrl, { headers: { 'User-Agent': ua } });
      updateCookies(r1);
      await sleep(800);

      // 2. Realizar o Login
      console.log('> Passo 2: Validando credenciais (rosilene@apss)...');
      const params = new URLSearchParams();
      params.append('login', login);
      params.append('validar', '1');
      params.append('senha', senha);

      let rLogin = await fetch(loginPageUrl, {
        method: 'POST',
        body: params,
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': getCookieHeader(),
          'User-Agent': ua,
          'Referer': loginPageUrl,
          'Origin': 'https://sistemaquer.com.br'
        }
      });
      updateCookies(rLogin);

      console.log('Status do Login:', rLogin.status);

      // Seguir redirecionamentos (Isso confirma se o login foi aceito)
      let currentRes = rLogin;
      let currentUrl = loginPageUrl;
      while ([301, 302, 303, 307, 308].includes(currentRes.status)) {
        const loc = currentRes.headers.get('location');
        if (!loc) break;
        const target = new URL(loc, currentUrl).href;
        console.log('  Encaminhando para:', target);
        currentRes = await fetch(target, {
          headers: { 'User-Agent': ua, 'Cookie': getCookieHeader(), 'Referer': currentUrl }
        });
        updateCookies(currentRes);
        currentUrl = target;

        // Se for redirecionado para index.php, sucesso!
        // Se voltar para entrar.php, falhou.
        if (target.includes('entrar.php')) {
          console.log('  ALERTA: Login recusado. Retornou à tela de entrada.');
          break;
        }
      }

      // 3. Acessar o Lead (Respeitando a URL do usuário, mas levando os cookies)
      console.log('> Passo 3: Buscando ficha do cliente...');
      const rFinal = await fetch(leadUrl, {
        headers: {
          'User-Agent': ua,
          'Cookie': getCookieHeader(),
          'Referer': 'https://sistemaquer.com.br/index.php'
        }
      });
      updateCookies(rFinal);

      const html = await rFinal.text();
      fs.writeFileSync('debug_lead_page.html', html);
      const $ = cheerio.load(html);

      // Verificação de Identidade Final
      const onLoginPage = html.includes('login100-form') || $('title').text().includes('Login');

      if (onLoginPage) {
        console.log('FALHA: O servidor não reconheceu a sessão logada.');

        // Busca mensagem de erro específica no código do site
        const erroHtml = $('.alert').text().trim() || $('#avisoDeEnvioErro').text().trim() || "";
        if (erroHtml) return res.status(401).json({ error: `Portal diz: "${erroHtml}"` });

        return res.status(401).json({ error: "Sessão recusada. Verifique se o login e senha (rosilene@apss) estão corretos no site do Sistema Quer." });
      }

      // 4. Extração de Dados Profunda
      const findData = (labels: string[]) => {
        let value = "";
        for (const label of labels) {
          // Busca em tabelas
          $(`td:contains('${label}')`).each((_, el) => {
            const sibling = $(el).next('td').text().trim();
            if (sibling && sibling.length > 2) value = sibling;
          });
          if (value) break;

          // Busca em campos de texto (inputs)
          const input = $(`input[name*='${label.toLowerCase()}']`);
          if (input.val()) value = input.val()?.toString().trim() || "";
          if (value) break;
        }
        return value;
      };

      const finalRecord = {
        nome: findData(['Nome', 'Cliente', 'Indicação', 'Aluno']) || "Não identificado",
        email: findData(['Email', 'E-mail', 'Correio']) || "Não identificado",
        telefone: findData(['Telefone', 'Celular', 'Fone', 'WhatsApp', 'Zap']) || "Não identificado",
        origem: "Sistema Quer",
        url_original: leadUrl
      };

      if (finalRecord.nome === "Não identificado") {
        // Fallback via texto bruto
        const text = $('body').text();
        const match = text.match(/Nome:?\s*([^\n\r<]+)/i);
        if (match) finalRecord.nome = match[1].trim();
      }

      console.log('RESULTADO:', finalRecord.nome);
      res.json({ success: true, data: finalRecord });

    } catch (error: any) {
      console.error("ERRO CRITICAL:", error);
      res.status(500).json({ error: "Sem resposta do portal externo. Verifique sua senha e tente novamente." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Rodando em http://localhost:3000`));
}

startServer();
