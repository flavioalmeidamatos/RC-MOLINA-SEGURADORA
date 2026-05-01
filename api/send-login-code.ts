import type { Request, Response } from 'express';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'RC Molina Seguradora <onboarding@resend.dev>';

const respond = (res: Response, status: number, body: Record<string, unknown>) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
};

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    respond(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    respond(res, 400, { error: 'Informe um e-mail valido.' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    respond(res, 500, { error: 'Servico de codigo seguro sem configuracao do Supabase.' });
    return;
  }

  if (!resendApiKey) {
    respond(res, 500, { error: 'Servico de envio de e-mail nao configurado. Configure RESEND_API_KEY.' });
    return;
  }

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
    respond(res, 502, { error: 'Nao foi possivel consultar o cadastro do e-mail.' });
    return;
  }

  const emailExists = await existsResponse.json();

  if (!emailExists) {
    respond(res, 404, { error: 'E-mail nao cadastrado. Crie sua conta antes de pedir o codigo seguro.' });
    return;
  }

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
    respond(res, 502, { error: 'Nao foi possivel gerar o codigo seguro.' });
    return;
  }

  const [payload] = await codeResponse.json();
  const codigo = payload?.codigo;

  if (!codigo) {
    respond(res, 500, { error: 'Codigo seguro nao foi gerado.' });
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
      subject: 'Codigo seguro RC Molina',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>RC Molina Seguradora</h2>
          <p>Use o codigo abaixo para entrar no sistema:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${codigo}</p>
          <p>Este codigo expira em 10 minutos.</p>
        </div>
      `,
      text: `Seu codigo seguro RC Molina e: ${codigo}. Ele expira em 10 minutos.`,
    }),
  });

  if (!emailResponse.ok) {
    respond(res, 502, { error: 'Codigo gerado, mas o e-mail nao foi enviado.' });
    return;
  }

  respond(res, 200, { ok: true });
}
