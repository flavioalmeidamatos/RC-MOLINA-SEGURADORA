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
    const originalLeadUrl = req.body.leadUrl?.trim();

    if (!login || !senha || !originalLeadUrl) {
      return res.status(400).json({ error: "Faltam parâmetros" });
    }

    try {
      console.log('--- Iniciando Scraping (Deep Data Extraction) ---');
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
            if (val && val !== 'deleted' && val !== '""') cookieJar.set(key, val);
          }
        });
      };

      const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const commonHeaders = {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      };

      // 1. Login Flow (The Ghost Protocol)
      const rInit = await fetch("https://sistemaquer.com.br/entrar.php", { headers: commonHeaders });
      updateCookies(rInit);
      await sleep(1000);

      const body = new URLSearchParams();
      body.append('login', login);
      body.append('validar', '1');
      body.append('senha', senha);

      const rLogin = await fetch("https://sistemaquer.com.br/entrar.php", {
        method: 'POST',
        body: body,
        redirect: 'manual',
        headers: {
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': getCookieHeader(),
          'Origin': 'https://sistemaquer.com.br',
          'Referer': 'https://sistemaquer.com.br/entrar.php'
        }
      });
      updateCookies(rLogin);

      let currentUrl = "https://sistemaquer.com.br/entrar.php";
      let currentRes = rLogin;
      let depth = 0;
      while ([301, 302, 303, 307, 308].includes(currentRes.status) && depth < 5) {
        const loc = currentRes.headers.get('location');
        if (!loc) break;
        const nextUrl = new URL(loc, currentUrl).href;
        currentRes = await fetch(nextUrl, {
          headers: { ...commonHeaders, 'Cookie': getCookieHeader(), 'Referer': currentUrl }
        });
        updateCookies(currentRes);
        currentUrl = nextUrl;
        depth++;
      }

      await sleep(1500);

      // 2. Acesso ao Lead
      const targetLeadUrl = originalLeadUrl.replace('http://', 'https://');
      let rFinal = await fetch(targetLeadUrl, {
        headers: { ...commonHeaders, 'Cookie': getCookieHeader(), 'Referer': 'https://sistemaquer.com.br/index.php' }
      });
      updateCookies(rFinal);

      let finalHtml = await rFinal.text();
      fs.writeFileSync('debug_lead_page.html', finalHtml);
      const $ = cheerio.load(finalHtml);

      if (finalHtml.includes('login100-form') || $('title').text().includes('Login')) {
        return res.status(401).json({ error: "Sessão expirada. Tente importar novamente." });
      }

      // 3. Extração Profunda de Campos
      const findVal = (keywords: string[]) => {
        let found = "";
        // Busca em labels TD
        $('td').each((_, el) => {
          const txt = $(el).text().trim().toLowerCase();
          if (keywords.some(k => txt.includes(k.toLowerCase()))) {
            let val = $(el).next('td').text().trim();
            if (!val) {
              // Às vezes o valor está dentro de um input/textarea no próximo TD
              val = $(el).next('td').find('input, textarea, select').val()?.toString().trim() || "";
            }
            if (val && val.length > 1) {
              if (keywords.includes('Telefone')) val = val.replace(/^p:/i, '').replace(/\D/g, '');
              found = val;
              return false; // break each
            }
          }
        });
        // Busca direta por inputs/IDs (mais certeiro para campos editáveis)
        if (!found) {
          for (const k of keywords) {
            const selector = `input[name*='${k.toLowerCase()}'], input[id*='${k.toLowerCase()}'], textarea[name*='${k.toLowerCase()}'], textarea[id*='${k.toLowerCase()}']`;
            $(selector).each((_, el) => {
              let val = $(el).val()?.toString().trim() || "";
              if (val) {
                if (keywords.includes('Telefone')) val = val.replace(/^p:/i, '').replace(/\D/g, '');
                found = val;
                return false;
              }
            });
            if (found) break;
          }
        }
        return found;
      };

      const leadData = {
        nome: findVal(['nome', 'indicação', 'cliente', 'aluno']),
        email: findVal(['email', 'e-mail', 'correio']),
        telefone: findVal(['telefone', 'celular', 'whatsapp', 'fone celular']),
        // Dados Extras (Demanda do usuário)
        endereco: findVal(['endereço', 'rua', 'logradouro']),
        numero: findVal(['número', 'numero']),
        bairro: findVal(['bairro']),
        cidade: findVal(['cidade']),
        nascimento: findVal(['nascimento']),
        cpf_cnpj: findVal(['cpf_cpnj', 'cpf', 'cnpj', 'documento']),
        // Dados do Cálculo / Observações (VITAL)
        observacao: findVal(['observacao', 'observação', 'dados do cálculo']),
        // Faixas Etárias (Extração técnica)
        vidas: {
          '00-18': $('#idade_00_18').val() || "0",
          '19-23': $('#idade_19_23').val() || "0",
          '24-28': $('#idade_24_28').val() || "0",
          '29-33': $('#idade_29_33').val() || "0",
          '34-38': $('#idade_34_38').val() || "0",
          '39-43': $('#idade_39_43').val() || "0",
          '44-48': $('#idade_44_48').val() || "0",
          '49-53': $('#idade_49_53').val() || "0",
          '54-58': $('#idade_54_58').val() || "0",
          '59+': $('#idade_60').val() || "0"
        },
        origem: "Sistema Quer",
        url_original: originalLeadUrl
      };

      // Fallback Visual do card
      if (!leadData.nome || leadData.nome === "Não identificado") {
        leadData.nome = $('.card-header h4').first().text().trim() ||
          $('.card-title').first().text().trim() ||
          "Não identificado";
      }

      // Limpeza de Telefone
      if (leadData.telefone && leadData.telefone.length >= 10) {
        const t = leadData.telefone;
        leadData.telefone = t.length === 11
          ? `(${t.substring(0, 2)}) ${t.substring(2, 7)}-${t.substring(7)}`
          : `(${t.substring(0, 2)}) ${t.substring(2, 6)}-${t.substring(6)}`;
      }

      console.log('DEEP EXTRACTION SUCCESS:', leadData.nome);
      res.json({ success: true, data: leadData });

    } catch (error: any) {
      console.error("ERRO:", error);
      res.status(500).json({ error: "Erro na extração completa de campos." });
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
