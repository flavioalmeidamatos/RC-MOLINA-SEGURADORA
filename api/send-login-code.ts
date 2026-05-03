import type { Request, Response } from 'express';
import { usuariosEmailExiste, usuariosGerarCodigoLogin } from './_lib/local_db';

const EMAIL_RFC5322_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const isValidEmail = (email: string): boolean => EMAIL_RFC5322_RE.test(email);

const respond = (res: Response, status: number, body: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const buildEmailHtml = (codigo: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#121212;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#121212;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #333;overflow:hidden;">
        <tr><td style="background:#000;padding:24px;text-align:center;">
          <div style="color:#d4af37;font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:6px;">RC MOLINA</div>
          <div style="color:#fff;font-size:9px;letter-spacing:4px;margin-top:4px;">CORRETORA DE SEGUROS</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Codigo de Acesso Seguro</h2>
          <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Voce solicitou um codigo para acessar sua conta. Use o codigo abaixo:
          </p>
          <div style="background:#121212;border:2px solid #ccff00;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="color:#ccff00;font-size:36px;font-weight:bold;letter-spacing:12px;font-family:monospace;">${codigo}</span>
          </div>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0 0 8px;">
            Este codigo expira em <strong style="color:#fff;">10 minutos</strong>.
          </p>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0 0 8px;">
            Maximo de <strong style="color:#fff;">5 tentativas</strong> por codigo.
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#1e1e1e;border-radius:8px;padding:16px;border-left:3px solid #d4af37;">
            <p style="color:#d4af37;font-size:12px;font-weight:bold;margin:0 0 4px;">AVISO DE SEGURANCA</p>
            <p style="color:#888;font-size:12px;line-height:1.5;margin:0;">
              Se voce nao solicitou este codigo, ignore este e-mail.
              Nunca compartilhe seu codigo com terceiros.
            </p>
          </div>
        </td></tr>
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

export default async function handler(req: Request, res: Response) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'RC Molina Seguradora <onboarding@resend.dev>';

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    respond(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    respond(res, 400, { error: 'Informe um e-mail valido.' });
    return;
  }

  if (!resendApiKey) {
    respond(res, 500, { error: 'Servico de envio de e-mail nao configurado. Configure RESEND_API_KEY.' });
    return;
  }

  const emailExists = await usuariosEmailExiste(email);

  if (!emailExists) {
    respond(res, 200, { ok: true });
    return;
  }

  let payload: { codigo?: string } | null = null;
  try {
    payload = await usuariosGerarCodigoLogin(email);
  } catch (error) {
    if ((error as Error).name === 'RATE_LIMIT') {
      respond(res, 429, { error: 'Aguarde 60 segundos entre solicitacoes de codigo.' });
      return;
    }

    respond(res, 200, { ok: true });
    return;
  }

  const codigo = payload?.codigo;

  if (!codigo) {
    respond(res, 200, { ok: true });
    return;
  }

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: email,
      subject: 'Codigo de Acesso Seguro - RC Molina',
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
