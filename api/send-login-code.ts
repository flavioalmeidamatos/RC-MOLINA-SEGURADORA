import type { Request, Response } from 'express';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'RC Molina Seguradora <onboarding@resend.dev>';

/* ── RFC 5322 e-mail validation (server-side) ─────────────────────── */
const EMAIL_RFC5322_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const isValidEmail = (email: string): boolean => EMAIL_RFC5322_RE.test(email);

/* ── Helper ───────────────────────────────────────────────────────── */
const respond = (res: Response, status: number, body: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

/* ── E-mail HTML template profissional ────────────────────────────── */
const buildEmailHtml = (codigo: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#121212;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#121212;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #333;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#000;padding:24px;text-align:center;">
          <div style="color:#d4af37;font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:6px;">RC MOLINA</div>
          <div style="color:#fff;font-size:9px;letter-spacing:4px;margin-top:4px;">CORRETORA DE SEGUROS</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Codigo de Acesso Seguro</h2>
          <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Voce solicitou um codigo para acessar sua conta. Use o codigo abaixo:
          </p>
          <div style="background:#121212;border:2px solid #ccff00;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="color:#ccff00;font-size:36px;font-weight:bold;letter-spacing:12px;font-family:monospace;">${codigo}</span>
          </div>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0 0 8px;">
            ⏱ Este codigo expira em <strong style="color:#fff;">10 minutos</strong>.
          </p>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0 0 8px;">
            🔒 Maximo de <strong style="color:#fff;">5 tentativas</strong> por codigo.
          </p>
        </td></tr>
        <!-- Security warning -->
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#1e1e1e;border-radius:8px;padding:16px;border-left:3px solid #d4af37;">
            <p style="color:#d4af37;font-size:12px;font-weight:bold;margin:0 0 4px;">⚠ AVISO DE SEGURANCA</p>
            <p style="color:#888;font-size:12px;line-height:1.5;margin:0;">
              Se voce nao solicitou este codigo, ignore este e-mail.
              Nunca compartilhe seu codigo com terceiros.
            </p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0d0d0d;padding:20px;text-align:center;">
          <p style="color:#555;font-size:11px;margin:0;">
            RC Molina Corretora de Seguros &copy; ${new Date().getFullYear()}
          </p>
          <p style="color:#444;font-size:10px;margin:4px 0 0;">
            Este e-mail foi gerado automaticamente. Nao responda.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const buildEmailText = (codigo: string) =>
  `RC Molina Corretora de Seguros\n\nSeu codigo de acesso seguro e: ${codigo}\n\nEste codigo expira em 10 minutos.\nMaximo de 5 tentativas por codigo.\n\nSe voce nao solicitou este codigo, ignore este e-mail.`;

/* ── Handler principal ────────────────────────────────────────────── */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    respond(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const email = String(req.body?.email || '').trim().toLowerCase();

  // Melhoria #7: Validação RFC 5322 no servidor (em vez de simples @)
  if (!email || !isValidEmail(email)) {
    respond(res, 400, { error: 'Informe um e-mail valido.' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    respond(res, 500, { error: 'Servico de código seguro sem configuracao do Supabase.' });
    return;
  }

  if (!resendApiKey) {
    respond(res, 500, { error: 'Servico de envio de e-mail nao configurado. Configure RESEND_API_KEY.' });
    return;
  }

  // Melhoria #6: Anti-enumeração — sempre retorna sucesso para o frontend
  // Internamente, verifica se o e-mail existe e só processa se existir
  const existsResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/usuarios_email_existe`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_email: email }),
  });

  if (!existsResponse.ok) {
    // Erro interno — não revelamos que foi falha de consulta
    respond(res, 200, { ok: true });
    return;
  }

  const emailExists = await existsResponse.json();

  if (!emailExists) {
    // Melhoria #6: Retornamos 200 mesmo se e-mail não existe
    // Atacante não consegue enumerar e-mails cadastrados
    respond(res, 200, { ok: true });
    return;
  }

  // Melhoria #4: Rate limiting agora também é verificado no servidor (banco)
  const codeResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/usuarios_gerar_codigo_login`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_email: email }),
  });

  if (!codeResponse.ok) {
    const errorBody = await codeResponse.text().catch(() => '');
    // Melhoria #4: Trata rate limit do servidor
    if (errorBody.includes('RATE_LIMIT')) {
      respond(res, 429, { error: 'Aguarde 60 segundos entre solicitacoes de codigo.' });
      return;
    }
    // Outros erros — resposta genérica
    respond(res, 200, { ok: true });
    return;
  }

  const [payload] = await codeResponse.json();
  const codigo = payload?.codigo;

  if (!codigo) {
    respond(res, 200, { ok: true });
    return;
  }

  // Melhoria #5: Template de e-mail profissional com branding
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: email,
      subject: 'Codigo de Acesso Seguro — RC Molina',
      html: buildEmailHtml(codigo),
      text: buildEmailText(codigo),
    }),
  });

  if (!emailResponse.ok) {
    respond(res, 502, { error: 'Codigo gerado, mas o e-mail nao foi enviado.' });
    return;
  }

  respond(res, 200, { ok: true });
}
