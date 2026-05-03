import type express from 'express';
import {
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
  createAdminToken,
  initLocalDatabase,
  localDatabaseStatus,
  registrarAuditoria,
  saveAvatarDataUrl,
  usuariosCadastrar,
  usuariosEmailExiste,
  usuariosLogin,
  usuariosPerfil,
  usuariosResetarSenhaComCodigo,
  usuariosVerificarCodigoLogin,
  verifyAdminToken,
} from './local_db';

const EMAIL_RFC5322_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const isValidEmail = (email: string) => EMAIL_RFC5322_RE.test(email);

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const getBearerToken = (req: express.Request) => req.headers.authorization;

const requireAdmin =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    if (!verifyAdminToken(getBearerToken(req))) {
      res.status(401).json({ error: 'Acesso administrativo invalido.' });
      return;
    }

    return handler(req, res, next);
  };

export const registerLocalAuthRoutes = (app: express.Express) => {
  app.get(
    '/api/health/db',
    asyncRoute(async (_req, res) => {
      await initLocalDatabase();
      res.json({ ok: true, db: await localDatabaseStatus() });
    }),
  );

  app.post(
    '/api/audit',
    asyncRoute(async (req, res) => {
      await registrarAuditoria(String(req.body?.acao || 'AUDITORIA'), req.body?.detalhes || {});
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/auth/profile/:id',
    asyncRoute(async (req, res) => {
      const perfil = await usuariosPerfil(req.params.id);
      if (!perfil) {
        res.status(404).json({ error: 'Perfil nao encontrado.' });
        return;
      }
      res.json({ data: perfil });
    }),
  );

  app.post(
    '/api/auth/email-exists',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Informe um e-mail valido.' });
        return;
      }
      res.json({ data: await usuariosEmailExiste(email) });
    }),
  );

  app.post(
    '/api/auth/login',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const senha = String(req.body?.senha || '');

      if (!isValidEmail(email) || !senha) {
        res.status(400).json({ error: 'Informe e-mail e senha.' });
        return;
      }

      const perfil = await usuariosLogin(email, senha);
      if (!perfil) {
        res.status(401).json({ error: 'Credenciais invalidas.' });
        return;
      }

      res.json({ data: perfil });
    }),
  );

  app.post(
    '/api/auth/register',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const senha = String(req.body?.senha || '');
      const nomeCompleto = String(req.body?.nome_completo || '').trim();
      const organizacao = String(req.body?.organizacao || '').trim();

      if (!isValidEmail(email) || senha.length < 8 || nomeCompleto.split(/\s+/).length < 2) {
        res.status(400).json({ error: 'Dados de cadastro invalidos.' });
        return;
      }

      if (await usuariosEmailExiste(email)) {
        res.status(409).json({ error: 'Este e-mail ja esta cadastrado. Por favor, faca login.' });
        return;
      }

      const avatarUrl = await saveAvatarDataUrl(req.body?.avatar_data_url, req.body?.avatar_file_name);
      const perfil = await usuariosCadastrar({ email, senha, nomeCompleto, organizacao, avatarUrl });
      res.status(201).json({ data: perfil });
    }),
  );

  app.post(
    '/api/auth/verify-code',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const codigo = String(req.body?.codigo || '').replace(/\D/g, '').slice(0, 6);
      const perfil = await usuariosVerificarCodigoLogin(email, codigo);

      if (!perfil) {
        res.status(401).json({ error: 'Codigo invalido, expirado ou bloqueado.' });
        return;
      }

      res.json({ data: perfil });
    }),
  );

  app.post(
    '/api/auth/reset-password',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const codigo = String(req.body?.codigo || '').replace(/\D/g, '').slice(0, 6);
      const novaSenha = String(req.body?.nova_senha || '');

      if (!isValidEmail(email) || codigo.length !== 6 || novaSenha.length < 8) {
        res.status(400).json({ error: 'Dados invalidos.' });
        return;
      }

      res.json({ data: await usuariosResetarSenhaComCodigo(email, codigo, novaSenha) });
    }),
  );

  app.post(
    '/api/admin/login',
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const senha = String(req.body?.senha || '');
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rcmolina.com.br').trim().toLowerCase();

      if (email !== adminEmail) {
        res.status(401).json({ error: 'Credenciais invalidas.' });
        return;
      }

      const perfil = await usuariosLogin(email, senha);
      if (!perfil) {
        res.status(401).json({ error: 'Credenciais invalidas.' });
        return;
      }

      res.json({ token: createAdminToken(email), data: perfil });
    }),
  );

  app.get(
    '/api/admin/users',
    requireAdmin(
      asyncRoute(async (_req, res) => {
        res.json({ data: await adminListUsers() });
      }),
    ),
  );

  app.patch(
    '/api/admin/users/:id',
    requireAdmin(
      asyncRoute(async (req, res) => {
        const currentAvatarUrl = String(req.body?.avatar_url || '');
        const avatarUrl =
          (await saveAvatarDataUrl(req.body?.avatar_data_url, req.body?.avatar_file_name)) || currentAvatarUrl;

        await adminUpdateUser({
          id: req.params.id,
          nome: String(req.body?.nome || ''),
          email: String(req.body?.email || ''),
          organizacao: String(req.body?.organizacao || ''),
          avatarUrl,
        });
        res.json({ ok: true });
      }),
    ),
  );

  app.delete(
    '/api/admin/users/:id',
    requireAdmin(
      asyncRoute(async (req, res) => {
        await adminDeleteUser(req.params.id);
        res.json({ ok: true });
      }),
    ),
  );
};
