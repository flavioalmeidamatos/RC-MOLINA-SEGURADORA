const API_BASE = '/api';

export type Folder = 'inbox' | 'sent' | 'trash' | 'drafts';

export type Account = {
  email: string;
  scope: string;
  expiry_date: string;
  connected_at: string;
  updated_at: string;
  missingScopes?: string[];
  needsReconnect?: boolean;
  missingTrashScopes?: string[];
  needsTrashReconnect?: boolean;
};

export class ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;

  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export type MessageSummary = {
  id: string;
  threadId: string;
  labelIds: string[];
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  size: number;
  unread: boolean;
  internalDate: string | null;
};

export type Attachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  contentLocation?: string;
  contentData?: string;
  inline?: boolean;
};

export type FullMessage = MessageSummary & {
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
};

export type DraftSummary = MessageSummary & {
  draftId: string;
  gmailMessageId: string;
};

export type OutboxMessage = {
  id: string;
  account_email: string;
  to_recipients: string[];
  cc_recipients?: string[];
  bcc_recipients?: string[];
  subject: string;
  body_text: string;
  body_html: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  error_message: string | null;
  created_at: string;
  attachment_count?: number;
};

export type EmailLog = {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SearchFilters = {
  from?: string;
  subject?: string;
  content?: string;
  q?: string;
  after?: string;
  before?: string;
  status?: string;
  hasAttachment?: boolean;
};

export type GmailApiActor = {
  userId?: string | null;
  userEmail?: string | null;
};

export type GmailConnectionStatus = {
  connected: boolean;
  email?: string;
  scope?: string;
  userId?: string | null;
  status?: string;
  missingScopes?: string[];
  needsReconnect?: boolean;
  missingTrashScopes?: string[];
  needsTrashReconnect?: boolean;
};

function buildActorHeaders(actor?: GmailApiActor) {
  const headers = new Headers();
  if (actor?.userId) headers.set('x-rcm-user-id', actor.userId);
  if (actor?.userEmail) headers.set('x-rcm-user-email', actor.userEmail);
  return headers;
}

async function request<T>(path: string, init?: RequestInit, actor?: GmailApiActor): Promise<T> {
  const headers = new Headers(init?.headers || undefined);
  buildActorHeaders(actor).forEach((value, key) => headers.set(key, value));

  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || 'Erro ao chamar API', data.code, data.details);
  }

  return data as T;
}

function params(values: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export function createGmailApi(actor?: GmailApiActor) {
  return {
  async startOAuth(email: string) {
    return request<{ url: string }>(`/gmail/auth/url?${params({ email, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, undefined, actor);
  },
  async status(email: string) {
    return request<GmailConnectionStatus>(`/gmail/status?${params({ accountEmail: email, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, undefined, actor);
  },
  async disconnect(email: string) {
    return request<{ success: boolean }>(`/gmail/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail: email, userId: actor?.userId, userEmail: actor?.userEmail }),
    }, actor);
  },
  async accounts() {
    return request<{ accounts: Account[] }>(`/gmail/accounts?${params({ userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, undefined, actor);
  },
  async messages(accountEmail: string, folder: Folder, filters: SearchFilters) {
    let path = `/gmail/messages`;
    let nextFilters = { ...filters };

    if (nextFilters.content) {
      nextFilters = { ...nextFilters, q: nextFilters.content };
      delete nextFilters.content;
    }

    return request<{ messages: MessageSummary[]; nextPageToken: string | null }>(
      `${path}?${params({ accountEmail, folder, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined, ...nextFilters })}`,
      undefined,
      actor,
    );
  },
  async drafts(accountEmail: string, filters?: SearchFilters) {
    let nextFilters = { ...filters };

    if (nextFilters && nextFilters.content) {
      nextFilters = { ...nextFilters, q: nextFilters.content };
      delete nextFilters.content;
    }

    return request<{ drafts: DraftSummary[]; nextPageToken: string | null }>(
      `/gmail/drafts?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined, ...nextFilters })}`,
      undefined,
      actor,
    );
  },
  async message(accountEmail: string, messageId: string) {
    return request<{ message: FullMessage }>(
      `/gmail/messages/${messageId}?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`,
      undefined,
      actor,
    );
  },
  async messageAction(accountEmail: string, messageId: string, action: string) {
    const actionMap: Record<string, { path: string; method: 'PATCH' | 'POST' | 'DELETE' }> = {
      mark_read: { path: `/gmail/messages/${messageId}/read`, method: 'POST' },
      mark_unread: { path: `/gmail/messages/${messageId}/unread`, method: 'POST' },
      archive: { path: `/gmail/messages/${messageId}/archive`, method: 'POST' },
      trash: { path: `/gmail/messages/${messageId}`, method: 'DELETE' },
      restore: { path: `/gmail/messages/${messageId}/restore`, method: 'POST' },
    };

    const target = actionMap[action];
    return request(target.path, {
      method: target.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, userId: actor?.userId, userEmail: actor?.userEmail }),
    }, actor);
  },
  async send(formData: FormData) {
    if (actor?.userId) formData.set('userId', actor.userId);
    if (actor?.userEmail) formData.set('userEmail', actor.userEmail);
    return request('/gmail/send', {
      method: 'POST',
      body: formData,
    }, actor);
  },
  async createDraft(formData: FormData) {
    if (actor?.userId) formData.set('userId', actor.userId);
    if (actor?.userEmail) formData.set('userEmail', actor.userEmail);
    return request<{ draft: { id: string } }>('/gmail/draft', {
      method: 'POST',
      body: formData,
    }, actor);
  },
  async createOutbox(formData: FormData) {
    if (actor?.userId) formData.set('userId', actor.userId);
    if (actor?.userEmail) formData.set('userEmail', actor.userEmail);
    return request<{ outboxMessage: OutboxMessage }>('/gmail/outbox', {
      method: 'POST',
      body: formData,
    }, actor);
  },
  async outbox(accountEmail: string) {
    return request<{ outbox: OutboxMessage[] }>(`/gmail/outbox?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, undefined, actor);
  },
  async sendOutbox(accountEmail: string, id: string) {
    return request<{ outboxMessage: OutboxMessage }>(`/gmail/outbox/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, userId: actor?.userId, userEmail: actor?.userEmail }),
    }, actor);
  },
  async deleteOutbox(accountEmail: string, id: string) {
    return request<{ success: boolean }>(`/gmail/outbox/${id}?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, {
      method: 'DELETE',
    }, actor);
  },
  async logs(accountEmail: string) {
    return request<{ logs: EmailLog[] }>(`/gmail/logs?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, undefined, actor);
  },
  async emptyTrash(accountEmail: string) {
    return request<{ deletedCount: number }>('/gmail/trash/empty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, userId: actor?.userId, userEmail: actor?.userEmail }),
    }, actor);
  },
  async sendDraft(accountEmail: string, draftId: string) {
    return request<{ message: { id?: string } }>(`/gmail/drafts/${draftId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, userId: actor?.userId, userEmail: actor?.userEmail }),
    }, actor);
  },
  async deleteDraft(accountEmail: string, draftId: string) {
    return request<{ success: boolean }>(`/gmail/drafts/${draftId}?${params({ accountEmail, userId: actor?.userId || undefined, userEmail: actor?.userEmail || undefined })}`, {
      method: 'DELETE',
    }, actor);
  },
  attachmentUrl(accountEmail: string, messageId: string, attachment: Attachment, options?: { inline?: boolean }) {
    return `${API_BASE}/gmail/messages/${messageId}/attachments/${attachment.attachmentId}?${params({
      accountEmail,
      userId: actor?.userId || undefined,
      userEmail: actor?.userEmail || undefined,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      inline: options?.inline,
    })}`;
  },
  };
}
