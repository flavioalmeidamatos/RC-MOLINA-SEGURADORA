import { query } from './gmail_db.js';
import { decryptText, encryptText } from './gmail_token_crypto.js';

// Helper to check if email is Microsoft provider
export function isMicrosoftEmail(email) {
  const lower = String(email || '').toLowerCase().trim();
  return lower.endsWith('@hotmail.com') || lower.endsWith('@outlook.com') || lower.endsWith('@live.com');
}

// Retrieves and refreshes the Access Token for MS Graph
export async function getMicrosoftAccessToken(accountEmail) {
  const lowerEmail = String(accountEmail).trim().toLowerCase();
  
  const result = await query(
    `select * from user_email_integrations 
     where provider = 'microsoft' 
       and (lower(provider_email) = $1 or lower(user_email) = $1)
       and status = 'connected'`,
    [lowerEmail]
  );
  
  if (result.rowCount === 0) {
    throw new Error(`Integração da conta Microsoft não encontrada ou desconectada para o e-mail: ${accountEmail}`);
  }
  
  const integration = result.rows[0];
  let accessToken = decryptText(integration.access_token);
  const expiresAt = new Date(integration.expires_at);
  
  // If expired or expiring in less than 5 minutes, refresh
  if (expiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    console.log(`[MICROSOFT SERVICE] Renovando token de acesso para: ${lowerEmail}`);
    const refreshToken = decryptText(integration.refresh_token);
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite'
    });
    
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      // Set status to disconnected on auth failure
      await query(
        `update user_email_integrations set status = 'disconnected', updated_at = now() where id = $1`,
        [integration.id]
      );
      throw new Error(`Falha ao renovar token da Microsoft: ${errorText}`);
    }
    
    const tokenData = await response.json();
    const encryptedAccess = encryptText(tokenData.access_token);
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    
    let updateQuery = `update user_email_integrations set access_token = $1, expires_at = $2, updated_at = now()`;
    let updateParams = [encryptedAccess, newExpiresAt];
    
    if (tokenData.refresh_token) {
      const encryptedRefresh = encryptText(tokenData.refresh_token);
      updateQuery = `update user_email_integrations set access_token = $1, refresh_token = $2, expires_at = $3, updated_at = now()`;
      updateParams = [encryptedAccess, encryptedRefresh, newExpiresAt];
    }
    
    updateQuery += ` where id = $${updateParams.length + 1}`;
    updateParams.push(integration.id);
    
    await query(updateQuery, updateParams);
    
    accessToken = tokenData.access_token;
  }
  
  return accessToken;
}

// Convert MS Graph message representation to CRM message summary
function toMessageSummary(msg) {
  const fromAddress = msg.from?.emailAddress?.address || '';
  const fromName = msg.from?.emailAddress?.name || '';
  const fromString = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

  const toRecipients = (msg.toRecipients || []).map(r => {
    const addr = r.emailAddress?.address || '';
    const name = r.emailAddress?.name || '';
    return name ? `"${name}" <${addr}>` : addr;
  }).join(', ');

  const labelIds = [];
  if (msg.parentFolderId) {
    labelIds.push(msg.parentFolderId);
  }
  if (!msg.isRead) {
    labelIds.push('UNREAD');
  }

  return {
    id: msg.id,
    threadId: msg.conversationId || msg.id,
    labelIds,
    from: fromString,
    to: toRecipients,
    subject: msg.subject || '(sem assunto)',
    date: msg.receivedDateTime,
    snippet: msg.bodyPreview || '',
    size: 0,
    unread: !msg.isRead,
    internalDate: msg.receivedDateTime
  };
}

// Map frontend folder to MS Graph folder ID
function mapFolderId(folder) {
  switch (folder) {
    case 'inbox': return 'inbox';
    case 'sent': return 'sentitems';
    case 'trash': return 'deleteditems';
    case 'drafts': return 'drafts';
    default: return 'inbox';
  }
}

// List messages from MS Graph
export async function listMicrosoftMessages(accountEmail, { folder = 'inbox', maxResults = 25, pageToken, content }) {
  const token = await getMicrosoftAccessToken(accountEmail);
  const folderId = mapFolderId(folder);
  
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
  
  if (pageToken) {
    // If a nextLink pageToken is provided, use it directly
    url = pageToken;
  }

  if (content && !pageToken) {
    // Apply search query if specified and not paginating with a full URL token
    url += `&$search="${encodeURIComponent(content)}"`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar mensagens do Graph: ${errorText}`);
  }

  const data = await response.json();
  const messages = (data.value || []).map(toMessageSummary);
  
  return {
    messages,
    nextPageToken: data['@odata.nextLink'] || null,
    resultSizeEstimate: messages.length
  };
}

// Get full message details (including body and attachments)
export async function getMicrosoftMessage(accountEmail, messageId) {
  const token = await getMicrosoftAccessToken(accountEmail);
  
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,receivedDateTime,subject,from,toRecipients,ccRecipients,bccRecipients,body,hasAttachments,bodyPreview,conversationId,isRead`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao carregar detalhes da mensagem do Graph: ${errorText}`);
  }

  const msg = await response.json();
  const summary = toMessageSummary(msg);
  
  // Format body content
  let bodyText = msg.body?.content || '';
  let bodyHtml = '';
  
  if (msg.body?.contentType === 'html') {
    bodyHtml = msg.body.content;
    // Simple HTML strip for plaintext representation
    bodyText = msg.body.content.replace(/<[^>]*>/g, '').trim();
  } else {
    bodyHtml = `<div style="white-space: pre-wrap;">${msg.body?.content || ''}</div>`;
  }

  // Fetch attachments list
  let attachments = [];
  if (msg.hasAttachments) {
    const attResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (attResponse.ok) {
      const attData = await attResponse.json();
      attachments = (attData.value || []).map(att => ({
        attachmentId: att.id,
        filename: att.name || 'attachment',
        mimeType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        inline: att.isInline || false,
        contentId: att.contentId || undefined
      }));
    }
  }

  // Format headers
  const ccRecipients = (msg.ccRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(', ');
  const bccRecipients = (msg.bccRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(', ');

  const headers = [
    { name: 'From', value: summary.from },
    { name: 'To', value: summary.to },
    { name: 'Cc', value: ccRecipients },
    { name: 'Bcc', value: bccRecipients },
    { name: 'Subject', value: summary.subject },
    { name: 'Date', value: summary.date }
  ];

  return {
    ...summary,
    bodyText,
    bodyHtml,
    attachments,
    headers
  };
}

// Download attachment binary content
export async function downloadMicrosoftAttachment(accountEmail, messageId, attachmentId) {
  const token = await getMicrosoftAccessToken(accountEmail);
  
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao baixar anexo da Microsoft: ${errorText}`);
  }

  const att = await response.json();
  if (!att.contentBytes) {
    throw new Error('Este anexo da Microsoft não possui bytes de conteúdo.');
  }

  return {
    data: Buffer.from(att.contentBytes, 'base64'),
    filename: att.name || 'file',
    mimeType: att.contentType || 'application/octet-stream'
  };
}

// Send email via MS Graph
export async function sendMicrosoftMessage(accountEmail, emailData, files = []) {
  const token = await getMicrosoftAccessToken(accountEmail);

  // Parse recipient strings to MS Graph format
  const parseRecipients = (field) => {
    if (!field) return [];
    const arr = typeof field === 'string' ? field.split(',') : field;
    return arr.map(email => {
      const trimmed = email.trim();
      const match = trimmed.match(/^(?:"?([^"]*)"?\s+)?<([^>]+)>$/);
      if (match) {
        return {
          emailAddress: {
            name: match[1] || '',
            address: match[2]
          }
        };
      }
      return {
        emailAddress: {
          address: trimmed
        }
      };
    }).filter(r => r.emailAddress.address);
  };

  // Convert uploaded files to MS Graph attachment attachments
  const attachments = files.map(file => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: file.originalname,
    contentType: file.mimetype,
    contentBytes: file.buffer.toString('base64')
  }));

  const requestBody = {
    message: {
      subject: emailData.subject || '(sem assunto)',
      body: {
        contentType: emailData.html ? 'HTML' : 'text',
        content: emailData.html || emailData.text || ''
      },
      toRecipients: parseRecipients(emailData.to),
      ccRecipients: parseRecipients(emailData.cc),
      bccRecipients: parseRecipients(emailData.bcc),
      attachments
    }
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao enviar e-mail pelo Graph: ${errorText}`);
  }

  // Graph sendMail returns 202 Accepted on success with no body
  return { id: 'ms-sent-' + Date.now() };
}

// Modify message status (read/unread/trash/archive/restore) in MS Graph
export async function modifyMicrosoftMessage(accountEmail, messageId, action) {
  const token = await getMicrosoftAccessToken(accountEmail);

  if (action === 'mark_read') {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isRead: true })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao marcar como lido na Microsoft: ${text}`);
    }
    const data = await response.json();
    return toMessageSummary(data);
  }

  if (action === 'mark_unread') {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isRead: false })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao marcar como não lido na Microsoft: ${text}`);
    }
    const data = await response.json();
    return toMessageSummary(data);
  }

  if (action === 'trash') {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ destinationId: 'deleteditems' })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao mover para lixeira na Microsoft: ${text}`);
    }
    const data = await response.json();
    return toMessageSummary(data);
  }

  if (action === 'archive') {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ destinationId: 'archive' })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao arquivar na Microsoft: ${text}`);
    }
    const data = await response.json();
    return toMessageSummary(data);
  }

  if (action === 'restore') {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ destinationId: 'inbox' })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao restaurar na Microsoft: ${text}`);
    }
    const data = await response.json();
    return toMessageSummary(data);
  }

  throw new Error(`Ação de modificação desconhecida: ${action}`);
}

// Create draft in MS Graph
export async function createMicrosoftDraft(accountEmail, emailData, files = []) {
  const token = await getMicrosoftAccessToken(accountEmail);

  const parseRecipients = (field) => {
    if (!field) return [];
    const arr = typeof field === 'string' ? field.split(',') : field;
    return arr.map(email => {
      const trimmed = email.trim();
      const match = trimmed.match(/^(?:"?([^"]*)"?\s+)?<([^>]+)>$/);
      if (match) {
        return {
          emailAddress: {
            name: match[1] || '',
            address: match[2]
          }
        };
      }
      return {
        emailAddress: {
          address: trimmed
        }
      };
    }).filter(r => r.emailAddress.address);
  };

  const attachments = files.map(file => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: file.originalname,
    contentType: file.mimetype,
    contentBytes: file.buffer.toString('base64')
  }));

  const requestBody = {
    subject: emailData.subject || '',
    body: {
      contentType: emailData.html ? 'HTML' : 'text',
      content: emailData.html || emailData.text || ''
    },
    toRecipients: parseRecipients(emailData.to),
    ccRecipients: parseRecipients(emailData.cc),
    bccRecipients: parseRecipients(emailData.bcc),
    attachments
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao criar rascunho na Microsoft: ${errorText}`);
  }

  const data = await response.json();
  return { id: data.id, message: toMessageSummary(data) };
}

// Send Microsoft draft
export async function sendMicrosoftDraft(accountEmail, draftId) {
  const token = await getMicrosoftAccessToken(accountEmail);
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draftId}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao enviar rascunho na Microsoft: ${errorText}`);
  }

  return { success: true };
}

// Delete Microsoft draft
export async function deleteMicrosoftDraft(accountEmail, id) {
  const token = await getMicrosoftAccessToken(accountEmail);
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Erro ao excluir rascunho na Microsoft: ${errorText}`);
  }
  return { success: true };
}

