import type express from 'express';

import { requireCampaignActor } from './_lib/campanhas_auth';
import { getWhatsAppBridgeStatus, logoutWhatsAppBridge, sendCampaignToWhatsAppBridge } from './_lib/whatsapp_bridge';

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const registerWhatsAppBridgeRoutes = (app: express.Express) => {
  app.get(
    '/api/whatsapp-bridge/status',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.json({ data: await getWhatsAppBridgeStatus() });
    }),
  );

  app.post(
    '/api/whatsapp-bridge/logout',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      await logoutWhatsAppBridge();
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/whatsapp-bridge/send',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      const result = await sendCampaignToWhatsAppBridge(req.body || {});
      res.json({ data: result });
    }),
  );
};
