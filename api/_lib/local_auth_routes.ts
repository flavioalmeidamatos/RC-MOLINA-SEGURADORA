import type express from 'express';
import { isMasterAdmin } from './master_admin_helper';
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
  usuariosPodeListarTodos,
  usuariosPerfil,
  usuariosResetarSenhaComCodigo,
  usuariosVerificarCodigoLogin,
  verifyAdminToken,
} from './local_db';

const EMAIL_RFC5322_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const isValidEmail = (email: string) => EMAIL_RFC5322_RE.test(email);

const senhaAtendeCriterios = (senha: string) =>
  senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha) && /[^A-Za-z0-9\s]/.test(senha);

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
    (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

const getBearerToken = (req: express.Request) => req.headers.authorization;
const getRequestUserHeader = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');

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

      if (perfil.aprovado === false) {
        res.status(403).json({ error: 'Seu cadastro está aguardando aprovação do administrador.' });
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

      if (!isValidEmail(email) || !senhaAtendeCriterios(senha) || nomeCompleto.split(/\s+/).length < 2) {
        res.status(400).json({ error: 'Dados de cadastro invalidos.' });
        return;
      }

      if (await usuariosEmailExiste(email)) {
        res.status(409).json({ error: 'Este e-mail ja esta cadastrado. Por favor, faca login.' });
        return;
      }

      const avatarUrl = await saveAvatarDataUrl(req.body?.avatar_data_url, req.body?.avatar_file_name);
      const logoUrl = await saveAvatarDataUrl(req.body?.logo_data_url, req.body?.logo_file_name);
      const perfil = await usuariosCadastrar({ email, senha, nomeCompleto, organizacao, avatarUrl, logoUrl });

      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const destEmail = 'matos.almeida.flavio@gmail.com';
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              <div style="background-color: #1a1a1a; padding: 20px; text-align: center; border-bottom: 4px solid #ccff00;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">NOVO CADASTRO SOLICITADO</h1>
              </div>
              <div style="padding: 30px;">
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Olá Administrador,
                </p>
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Um <strong>novo usuário</strong> acaba de se registrar no sistema e está solicitando a <strong>criação e a liberação da conta</strong>, bem como de suas permissões de acordo com o pacote contratado para o uso do sistema.
                </p>
                <div style="background-color: #f9f9f9; border-left: 4px solid #ccff00; padding: 15px; margin-bottom: 20px;">
                  <h3 style="margin-top: 0; color: #1a1a1a;">Dados do Usuário:</h3>
                  <p style="margin: 5px 0;"><strong>Nome Completo:</strong> ${nomeCompleto}</p>
                  <p style="margin: 5px 0;"><strong>E-mail:</strong> ${email}</p>
                  <p style="margin: 5px 0;"><strong>Organização:</strong> ${organizacao}</p>
                </div>
                <p style="font-size: 16px; line-height: 1.5;">
                  Acesse o painel administrativo na aba <strong>Home</strong> para avaliar a solicitação e conceder o acesso e as permissões adequadas.
                </p>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://rcmolinaseguros.resolveplanilhas.com.br" style="background-color: #ccff00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">ACESSAR PAINEL ADMINISTRATIVO</a>
                </div>
              </div>
              <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #777;">
                Este é um e-mail automático gerado pelo sistema CKDEV Soluções em TI.
              </div>
            </div>
          </div>
        `;

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${resendApiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'CKDEV Solucoes em TI <onboarding@resend.dev>',
            to: destEmail,
            subject: '🚨 ATENÇÃO: Novo usuário solicitando acesso e permissões na plataforma',
            html: htmlBody,
          }),
        }).then(async r => {
          const body = await r.text();
          console.log('[RESEND API] Status:', r.status, 'Response:', body);
        }).catch(err => console.error('Erro ao enviar e-mail de notificacao:', err));
      }

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

      if (perfil.aprovado === false) {
        res.status(403).json({ error: 'Seu cadastro está aguardando aprovação do administrador.' });
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
      if (!isMasterAdmin({ email })) {
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
    asyncRoute(async (req, res) => {
      const isAdmin = verifyAdminToken(getBearerToken(req));
      const canViewAsRosilene =
        !isAdmin &&
        (await usuariosPodeListarTodos({
          id: getRequestUserHeader(req.headers['x-user-id']),
          email: getRequestUserHeader(req.headers['x-user-email']),
        }));

      if (!isAdmin && !canViewAsRosilene) {
        res.status(401).json({ error: 'Acesso administrativo invalido.' });
        return;
      }

      res.json({ data: await adminListUsers() });
    }),
  );

  app.patch(
    '/api/admin/users/:id',
    requireAdmin(
      asyncRoute(async (req, res) => {
        const currentAvatarUrl = String(req.body?.avatar_url || '');
        const currentLogoUrl = String(req.body?.logo_url || '');
        const senha = String(req.body?.senha || '');

        if (senha && !senhaAtendeCriterios(senha)) {
          res.status(400).json({ error: 'A nova senha deve ter no minimo 8 caracteres, com letra, numero e caractere especial.' });
          return;
        }

        const avatarUrl =
          (await saveAvatarDataUrl(req.body?.avatar_data_url, req.body?.avatar_file_name)) || currentAvatarUrl;

        const logoUrl =
          (await saveAvatarDataUrl(req.body?.logo_data_url, req.body?.logo_file_name)) || currentLogoUrl;

        await adminUpdateUser({
          id: req.params.id,
          nome: String(req.body?.nome || ''),
          email: String(req.body?.email || ''),
          organizacao: String(req.body?.organizacao || ''),
          avatarUrl,
          logoUrl,
          senha,
          permissoes: req.body?.permissoes ? String(req.body.permissoes) : null,
          aprovado: req.body?.aprovado !== undefined ? Boolean(req.body.aprovado) : undefined,
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

  // ── Endpoints de contexto para Master Admins ───────────────────────────────

  app.get(
    '/api/admin/companies',
    asyncRoute(async (req, res) => {
      const userEmail = getRequestUserHeader(req.headers['x-user-email']);
      if (!isMasterAdmin({ email: userEmail })) {
        res.status(403).json({ error: 'Acesso restrito a administradores master.' });
        return;
      }

      const { listAllCompanies } = await import('./local_db');
      const companies = await listAllCompanies();
      res.json({ data: companies });
    }),
  );

  app.get(
    '/api/admin/companies/:id/members',
    asyncRoute(async (req, res) => {
      const userEmail = getRequestUserHeader(req.headers['x-user-email']);
      if (!isMasterAdmin({ email: userEmail })) {
        res.status(403).json({ error: 'Acesso restrito a administradores master.' });
        return;
      }

      const { listCompanyMembers } = await import('./local_db');
      const members = await listCompanyMembers(req.params.id);
      res.json({ data: members });
    }),
  );
};
