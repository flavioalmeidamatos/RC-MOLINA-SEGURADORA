import fs from 'fs/promises';
import path from 'path';

import qrcode from 'qrcode-terminal';
import whatsapp from 'whatsapp-web.js';

import type { WhatsAppBridgeStatus } from '../../src/types/whatsapp_campaign';

const { Client, LocalAuth, MessageMedia } = whatsapp as any;

type LocalBridgeMedia = {
  base64: string;
  type: string;
  name: string;
};

type LocalBridgeUser = NonNullable<WhatsAppBridgeStatus['user']>;

const DEFAULT_STATUS: WhatsAppBridgeStatus = {
  configured: true,
  available: false,
  status: 'disconnected',
  qr: null,
  qrAvailable: false,
  user: null,
  error: null,
};

let client: any = null;
let initPromise: Promise<void> | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let state: WhatsAppBridgeStatus = { ...DEFAULT_STATUS };

const resolveSessionDir = () => path.resolve(process.cwd(), process.env.WHATSAPP_SESSION_DIR || '.whatsapp_auth');
const resolveCacheDir = () => path.resolve(process.cwd(), process.env.WHATSAPP_CACHE_DIR || '.whatsapp_cache');

const setState = (next: Partial<WhatsAppBridgeStatus>) => {
  state = {
    ...state,
    configured: true,
    ...next,
  };
};

const scheduleRestart = () => {
  if (restartTimer) {
    return;
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    void initializeLocalWhatsAppConnector();
  }, 5000);
};

const handleDisconnect = async (error?: string | null) => {
  setState({
    available: false,
    status: 'disconnected',
    qr: null,
    qrAvailable: false,
    user: null,
    error: error || null,
  });

  try {
    if (client) {
      await client.destroy();
    }
  } catch (destroyError) {
    console.error('[WHATSAPP] Falha ao destruir cliente anterior:', destroyError);
  } finally {
    client = null;
    initPromise = null;
  }

  scheduleRestart();
};

const ensureStorageRoots = async () => {
  await fs.mkdir(resolveSessionDir(), { recursive: true });
  await fs.mkdir(resolveCacheDir(), { recursive: true });
};

export const initializeLocalWhatsAppConnector = async () => {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await ensureStorageRoots();

    setState({
      available: true,
      status: 'connecting',
      error: null,
    });

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: resolveSessionDir(),
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/bab41edffee88eac3e47e53077f350b66208c363/html/2.3000.1015901307-alpha.html',
      },
    });

    client.on('qr', (qrValue: string) => {
      qrcode.generate(qrValue, { small: true });
      setState({
        available: true,
        status: 'qr',
        qr: qrValue,
        qrAvailable: true,
        user: null,
        error: null,
      });
    });

    client.on('authenticated', () => {
      setState({
        available: true,
        status: 'logging_in',
        qr: null,
        qrAvailable: false,
        error: null,
      });
    });

    client.on('auth_failure', (message: string) => {
      console.error('[WHATSAPP] Falha de autenticacao:', message);
      void handleDisconnect(message);
    });

    client.on('ready', () => {
      const user: LocalBridgeUser = {
        pushname: client.info?.pushname || 'Usuario WhatsApp',
        phone: client.info?.wid?.user || '',
      };

      setState({
        available: true,
        status: 'connected',
        qr: null,
        qrAvailable: false,
        user,
        error: null,
      });
    });

    client.on('disconnected', (reason: string) => {
      console.warn('[WHATSAPP] Cliente desconectado:', reason);
      void handleDisconnect(reason);
    });

    try {
      await client.initialize();
    } catch (error) {
      console.error('[WHATSAPP] Erro ao inicializar cliente:', error);
      await handleDisconnect(error instanceof Error ? error.message : 'Falha ao inicializar cliente WhatsApp.');
    }
  })();

  return initPromise;
};

export const getLocalWhatsAppBridgeStatus = async (): Promise<WhatsAppBridgeStatus> => {
  await initializeLocalWhatsAppConnector();
  return { ...state };
};

export const logoutLocalWhatsAppBridge = async () => {
  await initializeLocalWhatsAppConnector();

  if (client) {
    await client.logout();
  }

  await handleDisconnect(null);
};

export const sendLocalWhatsAppBridgeMessage = async (
  number: string,
  message: string,
  mediaItems: LocalBridgeMedia[],
) => {
  await initializeLocalWhatsAppConnector();

  if (!client || state.status !== 'connected') {
    throw new Error('O servico do WhatsApp nao esta conectado no momento.');
  }

  let cleanedNumber = String(number || '').replace(/\D/g, '');
  if (cleanedNumber.length === 11 && !cleanedNumber.startsWith('55')) {
    cleanedNumber = `55${cleanedNumber}`;
  } else if (cleanedNumber.length === 10 && !cleanedNumber.startsWith('55')) {
    cleanedNumber = `55${cleanedNumber}`;
  }

  const chatId = `${cleanedNumber}@c.us`;
  const responses = [];

  if (Array.isArray(mediaItems) && mediaItems.length > 0) {
    for (let index = 0; index < mediaItems.length; index += 1) {
      if (index > 0) {
        // Wait 2.5 seconds between sending consecutive media files to prevent congestion
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const mediaItem = mediaItems[index];
      const base64Data = mediaItem.base64.includes(';base64,')
        ? mediaItem.base64.split(';base64,')[1]
        : mediaItem.base64;

      const media = new MessageMedia(
        mediaItem.type,
        base64Data,
        mediaItem.name || 'arquivo',
      );

      const options: any = {};
      if (mediaItem.type.startsWith('audio/')) {
        options.sendAudioAsVoice = true;
      }

      responses.push(await client.sendMessage(chatId, media, options));
    }

    if (message) {
      // Wait 1.5 seconds before sending the text message separately to ensure order and readability
      await new Promise((resolve) => setTimeout(resolve, 1500));
      responses.push(await client.sendMessage(chatId, message));
    }
  } else {
    responses.push(await client.sendMessage(chatId, message));
  }

  return {
    success: true,
    messageId: responses[0]?.id?._serialized,
    messageIds: responses.map((item: any) => item?.id?._serialized).filter(Boolean),
  };
};
