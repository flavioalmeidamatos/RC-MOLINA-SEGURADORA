import type express from 'express';

import { usuariosPerfil, verifyAdminToken } from './local_db';

export interface CampaignActor {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

const getHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');

export const resolveCampaignActor = async (req: express.Request): Promise<CampaignActor | null> => {
  const userId = getHeaderValue(req.headers['x-user-id']).trim();
  const userEmail = getHeaderValue(req.headers['x-user-email']).trim().toLowerCase();

  if (!userId || !userEmail) {
    return null;
  }

  const perfil = await usuariosPerfil(userId);
  if (!perfil || String(perfil.email || '').trim().toLowerCase() !== userEmail) {
    return null;
  }

  return {
    userId: perfil.id,
    userEmail: perfil.email,
    isAdmin: verifyAdminToken(req.headers.authorization),
  };
};

export const requireCampaignActor = async (req: express.Request, res: express.Response) => {
  const actor = await resolveCampaignActor(req);
  if (!actor) {
    res.status(401).json({ error: 'Sessao invalida para campanhas.' });
    return null;
  }

  return actor;
};
