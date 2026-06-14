import { google } from 'googleapis';
import { gmailConfig } from './gmail_config.js';

export interface IEmailProvider {
  getAuthUrl(email: string, state: string): string;
  getProviderName(): string;
}

export class GmailProvider implements IEmailProvider {
  getProviderName(): string {
    return 'gmail';
  }

  getAuthUrl(email: string, state: string): string {
    const oauth2Client = new google.auth.OAuth2(
      gmailConfig.google.clientId,
      gmailConfig.google.clientSecret,
      gmailConfig.google.redirectUri
    );
    
    // Scopes for Gmail, matches getAuthUrl in gmail_service.js
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/contacts',
      'https://mail.google.com/' // Trash scope
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state,
      login_hint: email,
    });
  }
}

export class MicrosoftGraphProvider implements IEmailProvider {
  getProviderName(): string {
    return 'microsoft';
  }

  getAuthUrl(email: string, state: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID || '';
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'User.Read',
      'Mail.Read',
      'Mail.Send',
      'Mail.ReadWrite'
    ];
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      state: state,
      login_hint: email,
      prompt: 'consent',
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }
}

export class EmailProviderFactory {
  static getProvider(email: string): IEmailProvider {
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail.endsWith('@gmail.com')) {
      return new GmailProvider();
    }
    if (
      lowerEmail.endsWith('@hotmail.com') ||
      lowerEmail.endsWith('@outlook.com') ||
      lowerEmail.endsWith('@live.com')
    ) {
      return new MicrosoftGraphProvider();
    }
    throw new Error(`Nenhum provedor configurado para o domínio do e-mail: ${email}`);
  }
}
