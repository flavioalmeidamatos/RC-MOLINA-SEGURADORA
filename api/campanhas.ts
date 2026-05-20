import type express from 'express';

import { requireCampaignActor } from './_lib/campanhas_auth';
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  listCampaignHistory,
  listCampaigns,
  removeCampaignAttachment,
  updateCampaign,
  uploadCampaignAttachment,
} from './_lib/campanhas_db';

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const registerCampanhasRoutes = (app: express.Express) => {
  app.get(
    '/api/campanhas',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.json({ data: await listCampaigns(actor) });
    }),
  );

  app.get(
    '/api/campanhas/:id',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      const campaign = await getCampaignById(actor, req.params.id);
      if (!campaign) {
        res.status(404).json({ error: 'Campanha nao encontrada.' });
        return;
      }

      res.json({ data: campaign });
    }),
  );

  app.get(
    '/api/campanhas/:id/history',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.json({ data: await listCampaignHistory(actor, req.params.id) });
    }),
  );

  app.post(
    '/api/campanhas',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.status(201).json({ data: await createCampaign(actor, req.body || {}) });
    }),
  );

  app.post(
    '/api/campanhas/:id/attachments',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.status(201).json({
        data: await uploadCampaignAttachment(actor, req.params.id, req.body || {}),
      });
    }),
  );

  app.delete(
    '/api/campanhas/:id/attachments/:attachmentId',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      res.json({
        data: await removeCampaignAttachment(actor, req.params.id, req.params.attachmentId),
      });
    }),
  );

  app.put(
    '/api/campanhas/:id',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      const campaign = await updateCampaign(actor, req.params.id, req.body || {});
      if (!campaign) {
        res.status(404).json({ error: 'Campanha nao encontrada.' });
        return;
      }

      res.json({ data: campaign });
    }),
  );

  app.delete(
    '/api/campanhas/:id',
    asyncRoute(async (req, res) => {
      const actor = await requireCampaignActor(req, res);
      if (!actor) return;

      const deleted = await deleteCampaign(actor, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Campanha nao encontrada.' });
        return;
      }

      res.json({ ok: true });
    }),
  );
};
