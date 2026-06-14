import { Request } from 'express';
import { getPool } from '../clientes';
import { isMasterAdmin } from './master_admin_helper';

export interface TenantContext {
  companyId: string;
  userId: string | null;
  isMaster: boolean;
  currentUserId: string | null;
}

export const getTenantContext = async (req: Request): Promise<TenantContext> => {
  const headerUserId = String(req.headers['x-user-id'] || '').trim();
  const headerUserEmail = String(req.headers['x-user-email'] || '').trim().toLowerCase();

  const pool = getPool();
  
  if (!headerUserId) {
    const defaultCompanyRes = await pool.query('select id from "RCMOLINASEGUROS"."EMPRESAS" order by created_at asc limit 1');
    return {
      companyId: defaultCompanyRes.rows[0]?.id || '',
      userId: null,
      isMaster: false,
      currentUserId: null
    };
  }

  const userRes = await pool.query(
    'select id, email, company_id, is_master_admin from "RCMOLINASEGUROS"."USUARIOS" where id = $1 limit 1',
    [headerUserId]
  );
  
  const user = userRes.rows[0];

  if (!user || user.email.toLowerCase() !== headerUserEmail) {
    const defaultCompanyRes = await pool.query('select id from "RCMOLINASEGUROS"."EMPRESAS" order by created_at asc limit 1');
    return {
      companyId: defaultCompanyRes.rows[0]?.id || '',
      userId: null,
      isMaster: false,
      currentUserId: null
    };
  }

  const isMaster = isMasterAdmin(user);

  if (isMaster) {
    const qCompanyId = req.query.company_id as string;
    const qUserId = req.query.user_id as string;

    return {
      companyId: qCompanyId || user.company_id,
      userId: qUserId && qUserId !== 'all' ? qUserId : null,
      isMaster: true,
      currentUserId: user.id
    };
  }

  return {
    companyId: user.company_id,
    userId: null,
    isMaster: false,
    currentUserId: user.id
  };
};
