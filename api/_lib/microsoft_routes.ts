import express from 'express';
import crypto from 'crypto';
import { query } from './gmail_db.js';
import { encryptText } from './gmail_token_crypto.js';
import { EmailProviderFactory } from './email_providers.js';

export const microsoftRouter = express.Router();

// 1. Initial connect trigger from frontend
microsoftRouter.post('/api/microsoft/auth', (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail) {
      return res.status(400).json({ error: 'E-mail do usuário não fornecido.' });
    }

    const appUrl = process.env.APP_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const connectUrl = `${appUrl}/auth/microsoft/connect?userEmail=${encodeURIComponent(userEmail)}`;
    
    return res.json({ url: connectUrl });
  } catch (error: any) {
    console.error('[MICROSOFT AUTH] Erro ao gerar URL de conexão:', error);
    return res.status(500).json({ error: 'Erro interno ao iniciar a conexão.' });
  }
});

// 2. Connector endpoint (runs in the browser popup window)
microsoftRouter.get('/auth/microsoft/connect', async (req, res) => {
  try {
    const userEmail = String(req.query.userEmail || '').trim().toLowerCase();
    if (!userEmail) {
      return res.status(400).send('Parâmetro userEmail é obrigatório.');
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[MICROSOFT CONNECT] Credenciais da Microsoft ausentes no arquivo .env.local.');
      return res.status(500).send('Erro: Credenciais do Azure AD/Microsoft Graph (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI) não estão configuradas no servidor.');
    }

    // Generate state and persist temporarily for security verification
    const state = crypto.randomBytes(24).toString('hex');
    await query(
      'insert into oauth_states (state, requested_email, user_email) values ($1, $2, $3)',
      [state, userEmail, userEmail]
    );

    // Get authorization URL from Microsoft Graph Provider via Factory
    const provider = EmailProviderFactory.getProvider(userEmail);
    const authUrl = provider.getAuthUrl(userEmail, state);

    return res.redirect(authUrl);
  } catch (error: any) {
    console.error('[MICROSOFT CONNECT] Erro ao redirecionar para a Microsoft:', error);
    return res.status(500).send('Erro interno ao iniciar autenticação.');
  }
});

// 3. Callback endpoint (destination from Azure AD redirect)
microsoftRouter.get('/auth/microsoft/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[MICROSOFT CALLBACK] Erro retornado pela Microsoft:', error, error_description);
      return res.status(400).send(`Erro na autorização da Microsoft: ${error_description || error}`);
    }

    if (!code || !state) {
      return res.status(400).send('Parâmetros de callback (code/state) inválidos.');
    }

    // Verify and consume the state
    const stateResult = await query(
      `select * from oauth_states 
       where state = $1 
         and consumed_at is null 
         and created_at > now() - interval '15 minutes'`,
      [String(state)]
    );

    if (stateResult.rowCount === 0) {
      return res.status(400).send('OAuth state inválido ou expirado.');
    }

    const stateRow = stateResult.rows[0];
    const userEmail = stateRow.user_email;

    await query('update oauth_states set consumed_at = now() where state = $1', [String(state)]);

    // Exchange authorization code for Microsoft access and refresh tokens
    const tokenParams = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      code: String(code),
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Troca de token falhou: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as any;

    // Get user details from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      throw new Error(`Busca de perfil Graph falhou: ${errorText}`);
    }

    const profileData = await profileResponse.json() as any;
    const providerEmail = (profileData.mail || profileData.userPrincipalName || '').trim().toLowerCase();

    if (!providerEmail) {
      throw new Error('Não foi possível obter o e-mail da conta Microsoft autenticada.');
    }

    // Encrypt access and refresh tokens
    const encryptedAccess = encryptText(tokenData.access_token);
    const encryptedRefresh = encryptText(tokenData.refresh_token);
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Save tokens and associate with the CRM user
    await query(
      `insert into user_email_integrations (
         user_email, provider, provider_email, access_token, refresh_token, expires_at, status
       )
       values ($1, 'microsoft', $2, $3, $4, $5, 'connected')
       on conflict (user_email, provider) do update set
         provider_email = excluded.provider_email,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         status = 'connected',
         updated_at = now()`,
      [userEmail, providerEmail, encryptedAccess, encryptedRefresh, expiresAt]
    );

    // Return a beautiful success page that closes itself
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Conexão Concluída</title>
        <style>
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            background-color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            color: #1e293b;
          }
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 1.5rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            text-align: center;
            max-width: 400px;
            width: 100%;
            border: 1px solid #e2e8f0;
          }
          .icon {
            font-size: 3rem;
            color: #10b981;
            margin-bottom: 1rem;
          }
          h1 {
            font-size: 1.5rem;
            margin: 0 0 0.5rem 0;
            font-weight: 700;
          }
          p {
            font-size: 0.95rem;
            color: #64748b;
            line-height: 1.5;
            margin: 0 0 1.5rem 0;
          }
          .btn {
            background-color: #1e293b;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 0.9rem;
          }
          .btn:hover {
            background-color: #0f172a;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Conexão Concluída!</h1>
          <p>Sua conta Microsoft <strong>${providerEmail}</strong> foi conectada com sucesso ao CRM.</p>
          <p style="font-size: 0.85rem; color: #94a3b8;">Esta janela será fechada automaticamente em instantes.</p>
          <button class="btn" onclick="window.close()">Fechar Janela</button>
        </div>
        <script>
          // Tenta fechar a janela do navegador automaticamente após 3 segundos
          setTimeout(function() {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('[MICROSOFT CALLBACK] Erro no fluxo OAuth:', error);
    return res.status(500).send(`Erro ao concluir a integração da conta: ${error.message}`);
  }
});
