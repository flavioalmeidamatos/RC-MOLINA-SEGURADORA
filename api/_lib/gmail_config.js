function readFirstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

const defaultPort = Number(process.env.PORT || 3000);
const getDefaultBaseUrl = () =>
  normalizeBaseUrl(readFirstEnv('GMAIL_PUBLIC_BASE_URL', 'PUBLIC_BASE_URL', 'APP_URL'))
  || `http://localhost:${defaultPort}`;

function buildConfigError(message, missing = []) {
  const error = new Error(message);
  error.status = 503;
  error.code = 'gmail_not_configured';
  error.details = { missing };
  return error;
}

export const gmailConfig = {
  get databaseUrl() {
    return readFirstEnv('GMAIL_DATABASE_URL', 'DATABASE_URL');
  },
  get tokenEncryptionKey() {
    return readFirstEnv('GMAIL_TOKEN_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY');
  },
  google: {
    get clientId() {
      return readFirstEnv('GMAIL_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
    },
    get clientSecret() {
      return readFirstEnv('GMAIL_GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
    },
    get redirectUri() {
      return (
        readFirstEnv('GMAIL_GOOGLE_REDIRECT_URI', 'GOOGLE_REDIRECT_URI')
        || `${getDefaultBaseUrl()}/api/gmail/callback`
      );
    },
    get allowedAccount() {
      return (
        readFirstEnv('GMAIL_ALLOWED_ACCOUNT', 'ALLOWED_GMAIL_ACCOUNT')
        || 'rcmolina.invest.segurosaude@gmail.com'
      );
    },
  },
};

export function ensureGmailOAuthConfig() {
  const missing = [];

  if (!gmailConfig.google.clientId) missing.push('GMAIL_GOOGLE_CLIENT_ID|GOOGLE_CLIENT_ID');
  if (!gmailConfig.google.clientSecret) missing.push('GMAIL_GOOGLE_CLIENT_SECRET|GOOGLE_CLIENT_SECRET');
  if (!gmailConfig.google.redirectUri) missing.push('GMAIL_GOOGLE_REDIRECT_URI|GOOGLE_REDIRECT_URI');
  if (!gmailConfig.tokenEncryptionKey) {
    missing.push('GMAIL_TOKEN_ENCRYPTION_KEY|TOKEN_ENCRYPTION_KEY');
  }

  if (missing.length > 0) {
    throw buildConfigError(
      'Configure as credenciais do Gmail antes de usar o Webmail.',
      missing,
    );
  }
}

export function ensureAllowedAccount(accountEmail) {
  // Para permitir que múltiplos usuários configurem suas próprias contas de Gmail/Webmail,
  // permitimos qualquer e-mail que seja autenticado via fluxo OAuth do Google.
  return;
}
