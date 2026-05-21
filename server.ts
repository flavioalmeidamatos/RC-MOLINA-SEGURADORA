import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { registerLocalAuthRoutes } from './api/_lib/local_auth_routes';
import { gmailRouter } from './api/_lib/gmail_routes.js';
import { ImportLeadHttpError, importLeadFromSistemaQuer } from './api/_lib/import_lead';
import importLeadAssetHandler from './api/import-lead-asset';
import sendLoginCodeHandler from './api/send-login-code';
import { aniversariantesMesHandler, createClienteHandler, listClientesHandler, nextClienteCodigoHandler, searchClientesHandler, updateClienteHandler, deleteClienteHandler, clientStatsHandler } from './api/clientes';
import { registerWhatsAppBridgeRoutes } from './api/whatsapp_bridge';
import { initializeLocalWhatsAppConnector } from './api/_lib/whatsapp_connector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Evita que erros de bibliotecas de terceiros derrubem o servidor local
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Erro nao capturado:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Rejeicao nao tratada em:', promise, 'motivo:', reason);
});

dotenv.config({ path: path.join(__dirname, '.env.local') });
const SIMULATOR_ORIGIN = 'https://app.simuladoronline.com';
const SIMULATOR_PROXY_PREFIX = '/simulador-proxy';
const SIMULATOR_PROXY_PREFIX_ESCAPED = SIMULATOR_PROXY_PREFIX.replace(/\//g, '\\/');
const SIMULATOR_APP_PATHS =
  'static|js|files|login|login_check|inicio|logout|simulador|operadoras|cliente|clientes|agenda|admin|io|mig|recuperar-senha|favicon\\.ico';
const LOCAL_APP_PATHS_TO_KEEP =
  'api|uploads|simulador-proxy|sulamerica-proxy|amil-proxy|medsenior-proxy|@vite|src|node_modules';
const SULAMERICA_ORIGIN = 'https://os11.sulamerica.com.br';
const SULAMERICA_PROXY_PREFIX = '/sulamerica-proxy';
const SULAMERICA_PROXY_PREFIX_ESCAPED = SULAMERICA_PROXY_PREFIX.replace(/\//g, '\\/');
const SULAMERICA_LOGIN_PATH = '/SaudeCotador/LoginVendedor.aspx';
const SULAMERICA_APP_PATHS =
  'SaudeCotador|WebPatterns|EPA_Taskbox|PerformanceProbe|RichWidgets|favicon\\.ico|_osjs\\.js|_OSGlobalJS\\.pt-BR\\.js|Theme\\.SaudeCotador\\.css';
const AMIL_ORIGIN = 'https://portalcorretor.amil.com.br';
const AMIL_PROXY_PREFIX = '/amil-proxy';
const AMIL_PROXY_PREFIX_ESCAPED = AMIL_PROXY_PREFIX.replace(/\//g, '\\/');
const AMIL_LOGIN_PATH = '/portal/web/servicos/usuario/corretor/login';
const AMIL_APP_PATHS =
  'portal|web|servicos|usuario|corretor|o|combo|html|image|documents|favicon\\.ico|api|css|js|fonts|static|assets|lib|vendor|pages|app|shared';
const AMIL_LOGIN = '77915445715';
const AMIL_PASSWORD = 'sqn0y3zqmo';
const AMIL_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MEDSENIOR_ORIGIN = 'https://vendadigital.medsenior.com.br';
const MEDSENIOR_PROXY_PREFIX = '/medsenior-proxy';
const MEDSENIOR_LOGIN = '77915445715';
const MEDSENIOR_PASSWORD = 'Benj@min88';
const SIMULATOR_BLOCKED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'content-security-policy',
  'content-security-policy-report-only',
  'connection',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'transfer-encoding',
  'x-frame-options',
]);

const getRequestBody = (req: express.Request) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const rewriteSimulatorLocation = (location: string) => {
  if (location.startsWith(SIMULATOR_ORIGIN)) {
    return `${SIMULATOR_PROXY_PREFIX}${location.slice(SIMULATOR_ORIGIN.length)}`;
  }

  if (location.startsWith('//app.simuladoronline.com')) {
    return `${SIMULATOR_PROXY_PREFIX}${location.slice('//app.simuladoronline.com'.length)}`;
  }

  if (location.startsWith('/')) {
    return `${SIMULATOR_PROXY_PREFIX}${location}`;
  }

  return location;
};

const rewriteSimulatorCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${SIMULATOR_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const normalizeSimulatorUpstreamPath = (value: string | undefined) => {
  let normalized = value || '/login/4602';

  while (true) {
    const next = normalized
      .replace(new RegExp(`^//${SIMULATOR_PROXY_PREFIX.slice(1)}(?=/|\\?|$)`), '')
      .replace(new RegExp(`^${SIMULATOR_PROXY_PREFIX}(?=/|\\?|$)`), '');

    if (next === normalized) {
      break;
    }

    normalized = next || '/';
  }

  return normalized;
};

const rewriteSimulatorRequestUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.pathname.startsWith(SIMULATOR_PROXY_PREFIX)) {
      return `${SIMULATOR_ORIGIN}${normalizeSimulatorUpstreamPath(parsedUrl.pathname)}${parsedUrl.search}`;
    }
  } catch {
    if (value.startsWith(SIMULATOR_PROXY_PREFIX)) {
      return `${SIMULATOR_ORIGIN}${normalizeSimulatorUpstreamPath(value)}`;
    }
  }

  return undefined;
};

const simulatorRegionRefreshScript = `
<script>
(function () {
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function triggerFieldEvents(field) {
    if (!field) return;

    ['input', 'change'].forEach(function (eventName) {
      field.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    if (window.jQuery) {
      window.jQuery(field).trigger('input');
      window.jQuery(field).trigger('change');
    }
  }

  function findFieldByLabel(possibleLabels) {
    var normalizedLabels = possibleLabels.map(normalizeText);
    var labels = Array.from(document.querySelectorAll('label'));

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var labelText = normalizeText(label.textContent || label.innerText || '');
      if (!normalizedLabels.some(function (candidate) { return labelText.indexOf(candidate) !== -1; })) {
        continue;
      }

      var htmlFor = label.getAttribute('for');
      if (htmlFor) {
        var byFor = document.getElementById(htmlFor);
        if (byFor && byFor.tagName === 'SELECT') {
          return byFor;
        }
      }

      var container = label.parentElement;
      while (container) {
        var nestedSelect = container.querySelector('select');
        if (nestedSelect) {
          return nestedSelect;
        }
        container = container.parentElement;
      }
    }

    var allSelects = Array.from(document.querySelectorAll('select'));
    for (var j = 0; j < allSelects.length; j++) {
      var select = allSelects[j];
      var haystack = normalizeText(
        [
          select.id,
          select.name,
          select.getAttribute('aria-label'),
          select.getAttribute('placeholder'),
          select.closest('div, td, th, section, article, form')?.textContent
        ].join(' ')
      );

      if (normalizedLabels.some(function (candidate) { return haystack.indexOf(candidate) !== -1; })) {
        return select;
      }
    }

    return null;
  }

  function markSelectAsRefreshing(select) {
    if (!select) return;

    var firstOption = select.options && select.options.length ? select.options[0].textContent : '';
    select.innerHTML = '';

    var option = document.createElement('option');
    option.value = '';
    option.textContent = firstOption || '- Aguarde atualizacao -';
    select.appendChild(option);
    select.selectedIndex = 0;
    select.disabled = true;
  }

  function releaseSelect(select) {
    if (!select) return;
    window.setTimeout(function () {
      select.disabled = false;
    }, 2400);
  }

  function getDependentFields() {
    return [
      findFieldByLabel(['Operadora']),
      findFieldByLabel(['Administradora']),
      findFieldByLabel(['Entidade']),
      findFieldByLabel(['Profissao', 'Profissão'])
    ].filter(Boolean);
  }

  function refreshDependentCombos(regionSelect) {
    if (!regionSelect) {
      return;
    }

    var dependents = getDependentFields();
    dependents.forEach(markSelectAsRefreshing);
    dependents.forEach(releaseSelect);

    [0, 250, 800, 1600].forEach(function (delay) {
      window.setTimeout(function () {
        if (!document.contains(regionSelect) || !regionSelect.value) {
          return;
        }

        regionSelect.dataset.rcRegionSynthetic = '1';
        triggerFieldEvents(regionSelect);
        window.setTimeout(function () {
          delete regionSelect.dataset.rcRegionSynthetic;
        }, 0);
      }, delay);
    });
  }

  function bindRegionRefresh() {
    var regionSelect = findFieldByLabel(['Regiao', 'Região']);
    if (!regionSelect || regionSelect.dataset.rcRegionRefreshBound === '1') {
      return;
    }

    regionSelect.dataset.rcRegionRefreshBound = '1';
    regionSelect.addEventListener('change', function () {
      if (regionSelect.dataset.rcRegionSynthetic === '1') {
        return;
      }
      refreshDependentCombos(regionSelect);
    });

    if (regionSelect.value) {
      window.setTimeout(function () {
        refreshDependentCombos(regionSelect);
      }, 500);
    }
  }

  bindRegionRefresh();
  var observer = new MutationObserver(function () {
    bindRegionRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;

const rewriteSimulatorAppPaths = (content: string) =>
  content
    .replace(
      new RegExp(`(["'=:(,]\\s*)/(?!/|simulador-proxy/)(${SIMULATOR_APP_PATHS})(?=/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!simulador-proxy\\\\/)(${SIMULATOR_APP_PATHS})(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX_ESCAPED}\\/$2`
    )
    // Some simulator screens request dynamic combo endpoints that are not covered by the static allowlist.
    .replace(
      new RegExp(`(["'])/(?!/|${LOCAL_APP_PATHS_TO_KEEP}/)([A-Za-z0-9_-]+)(?=/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!${LOCAL_APP_PATHS_TO_KEEP}\\\\/)([A-Za-z0-9_-]+)(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${SIMULATOR_PROXY_PREFIX_ESCAPED}\\/$2`
    );

const rewriteSulamericaLocation = (location: string) => {
  if (location.startsWith(SULAMERICA_ORIGIN)) {
    return `${SULAMERICA_PROXY_PREFIX}${location.slice(SULAMERICA_ORIGIN.length)}`;
  }

  if (location.startsWith('//os11.sulamerica.com.br')) {
    return `${SULAMERICA_PROXY_PREFIX}${location.slice('//os11.sulamerica.com.br'.length)}`;
  }

  if (location.startsWith('/')) {
    return `${SULAMERICA_PROXY_PREFIX}${location}`;
  }

  return location;
};

const rewriteSulamericaCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${SULAMERICA_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const getCookieNames = (cookieHeader: string | undefined) =>
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim().split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name));

const rewriteSulamericaAppPaths = (content: string) =>
  content
    .replace(
      new RegExp(`(["'=:(,]\\s*)/(?!/|sulamerica-proxy/)(${SULAMERICA_APP_PATHS})(?=/|\\?|["'])`, 'gi'),
      `$1${SULAMERICA_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!sulamerica-proxy\\\\/)(${SULAMERICA_APP_PATHS})(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${SULAMERICA_PROXY_PREFIX_ESCAPED}\\/$2`
    )
    .replace(/\b(top|parent)\.location\b/g, 'location')
    .replace(/window\.top\./g, 'window.')
    .replace(/window\.parent\./g, 'window.');

const rewriteAmilLocation = (location: string) => {
  if (location.startsWith(AMIL_ORIGIN)) {
    return `${AMIL_PROXY_PREFIX}${location.slice(AMIL_ORIGIN.length)}`;
  }

  if (location.startsWith('//portalcorretor.amil.com.br')) {
    return `${AMIL_PROXY_PREFIX}${location.slice('//portalcorretor.amil.com.br'.length)}`;
  }

  if (location.startsWith('/')) {
    return `${AMIL_PROXY_PREFIX}${location}`;
  }

  return location;
};

const rewriteAmilCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${AMIL_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const rewriteAmilAppPaths = (content: string) =>
  content
    .replace(
      new RegExp(`(["'=:(,]\\s*)/(?!/|amil-proxy/)(${AMIL_APP_PATHS})(?=/|\\?|["'])`, 'gi'),
      `$1${AMIL_PROXY_PREFIX}/$2`
    )
    .replace(
      new RegExp(`(["'])\\\\/(?!amil-proxy\\\\/)(${AMIL_APP_PATHS})(?=\\\\/|\\?|["'])`, 'gi'),
      `$1${AMIL_PROXY_PREFIX_ESCAPED}\\/$2`
    )
    .replace(/\b(top|parent)\.location\b/g, 'location')
    .replace(/window\.top\./g, 'window.')
    .replace(/window\.parent\./g, 'window.');

const rewriteMedseniorLocation = (location: string) => {
  if (location.startsWith(MEDSENIOR_ORIGIN)) {
    return `${MEDSENIOR_PROXY_PREFIX}${location.slice(MEDSENIOR_ORIGIN.length)}`;
  }
  if (location.startsWith('/')) {
    return `${MEDSENIOR_PROXY_PREFIX}${location}`;
  }
  return location;
};

const rewriteMedseniorCookie = (cookie: string) =>
  cookie
    .replace(/;\s*domain=[^;]*/gi, '')
    .replace(/;\s*path=[^;]*/gi, `; Path=${MEDSENIOR_PROXY_PREFIX}`)
    .replace(/;\s*secure/gi, '');

const sulamericaAutofillScript = `
<script>
(function () {
  function fillSulamericaLogin() {
    var cpf = document.getElementById('VanillaTheme_wtLayLoginVendedor_block_wtMainContent_WebPatterns_wtLatLogin_block_wtUsername_wtInpCodCPFVendedor');
    var email = document.getElementById('VanillaTheme_wtLayLoginVendedor_block_wtMainContent_WebPatterns_wtLatLogin_block_wtUsername_ValidationTools_wtWbbValEmail_block_wtInputToValidate_wtInpEmlVendedor');
    var senha = document.getElementById('VanillaTheme_wtLayLoginVendedor_block_wtMainContent_WebPatterns_wtLatLogin_block_wtPassword_wtInpPassword');
    var aceite = document.getElementById('VanillaTheme_wtLayLoginVendedor_block_wtMainContent_WebPatterns_wtLatLogin_block_wtPassword_wt9_wt4');

    [
      [cpf, '77915445715'],
      [email, 'rcmolina.invest.segurosaude@gmail.com'],
      [senha, 'Benj@min88']
    ].forEach(function (item) {
      if (!item[0]) return;
      item[0].value = item[1];
      item[0].setAttribute('autocomplete', 'off');
      item[0].setAttribute('data-lpignore', 'true');
      item[0].dispatchEvent(new Event('input', { bubbles: true }));
      item[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    if (aceite && !aceite.checked) {
      aceite.checked = true;
      aceite.dispatchEvent(new Event('click', { bubbles: true }));
      aceite.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function acceptSulamericaPrivacy() {
    var selectors = [
      '.sula-cookies-save',
      'input[value="ACEITO"]',
      '#btn-aceitar-privacidade',
      '#onetrust-accept-btn-handler',
      '.cookie-banner-button',
      'button.btn-accept-privacy',
      '#aceitar-cookies',
      '.lgpd-btn-aceitar',
      '.aceitar-cookies',
      '#btn-aceitar-cookies'
    ];
    
    selectors.forEach(function (s) {
      var el = document.querySelector(s);
      if (el && typeof el.click === 'function') {
        el.click();
      }
    });

    // Procura por botões ou inputs que contenham "Aceitar", "Concordo" ou "Aceito"
    var buttons = document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var txt = (btn.innerText || btn.textContent || btn.value || '').toLowerCase();
      var isCookieBtn = btn.className.indexOf('cookie') !== -1 || 
                        btn.id.indexOf('cookie') !== -1 || 
                        btn.className.indexOf('lgpd') !== -1 ||
                        btn.className.indexOf('sula') !== -1;
      
      if ((isCookieBtn || txt.indexOf('aceito') !== -1) && 
          (txt.indexOf('aceitar') !== -1 || txt.indexOf('concordo') !== -1 || txt.indexOf('entendi') !== -1 || txt.indexOf('aceito') !== -1)) {
        btn.click();
      }
    }
  }

  fillSulamericaLogin();
  acceptSulamericaPrivacy();
  
  [250, 750, 1500, 3000, 5000].forEach(function (delay) {
    window.setTimeout(function() {
      fillSulamericaLogin();
      acceptSulamericaPrivacy();
    }, delay);
  });
})();
</script>`;

const rewriteSulamericaText = (content: string, contentType: string, upstreamPath: string) => {
  let rewritten = content
    .replaceAll(SULAMERICA_ORIGIN, SULAMERICA_PROXY_PREFIX)
    .replaceAll('http://os11.sulamerica.com.br', SULAMERICA_PROXY_PREFIX)
    .replaceAll('//os11.sulamerica.com.br', SULAMERICA_PROXY_PREFIX);

  if (contentType.includes('text/html')) {
    const basePath = upstreamPath.includes('/') ? upstreamPath.slice(0, upstreamPath.lastIndexOf('/') + 1) : '/';
    rewritten = rewritten
      .replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, '')
      .replace(/<head([^>]*)>/i, `<head$1><base href="${SULAMERICA_PROXY_PREFIX}${basePath}" />`)
      .replace(/\b(href|src|action)=["']\/(?!\/|sulamerica-proxy\/)/gi, `$1="${SULAMERICA_PROXY_PREFIX}/`);

    rewritten = rewritten.includes('</body>')
      ? rewritten.replace('</body>', `${sulamericaAutofillScript}</body>`)
      : `${rewritten}${sulamericaAutofillScript}`;
  }

  if (contentType.includes('text/css') || contentType.includes('javascript')) {
    rewritten = rewritten
      .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${SULAMERICA_PROXY_PREFIX}/`)
      .replace(
        new RegExp(`(["'])/(?!sulamerica-proxy/)(${SULAMERICA_APP_PATHS})(?=/|\\?)`, 'gi'),
        `$1${SULAMERICA_PROXY_PREFIX}/$2`
      );
  }

  return rewriteSulamericaAppPaths(rewritten);
};

const amilAutofillScript = `
<script>
(function () {
  var loginValue = ${JSON.stringify(AMIL_LOGIN)};
  var senhaValue = ${JSON.stringify(AMIL_PASSWORD)};
  var enterPressed = false;

  function findLoginInput() {
    var candidates = document.querySelectorAll('#login, input[name="login"], input[name*="login" i], input[id*="login" i], input[name*="cpf" i], input[id*="cpf" i], input[type="email"], input[type="text"]');
    for (var index = 0; index < candidates.length; index += 1) {
      var input = candidates[index];
      if (input.type !== 'hidden' && !input.disabled && !input.readOnly) return input;
    }
    return null;
  }

  function findPasswordInput() {
    return document.querySelector('input[type="password"], input[name*="senha" i], input[id*="senha" i], input[name*="password" i], input[id*="password" i]');
  }

  function triggerFieldEvents(input) {
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-lpignore', 'true');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(input) {
    if (!input || enterPressed) return;
    enterPressed = true;
    var perfil = document.getElementById('perfilUsuario');
    if (perfil && !perfil.value) {
      perfil.value = 'CORRETOR';
      triggerFieldEvents(perfil);
    }

    input.focus();
    ['keydown', 'keypress', 'keyup'].forEach(function (eventName) {
      input.dispatchEvent(new KeyboardEvent(eventName, {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      }));
    });

    var button = document.getElementById('efetuarLogin') || document.querySelector('button[type="submit"], input[type="submit"], button.acaoPrincipal, button, a[role="button"]');
    if (button) button.click();

    window.setTimeout(function () {
      var form = document.getElementById('formLoginCorretor');
      if (form && location.href.indexOf('/login') !== -1) form.submit();
    }, 1200);
  }

  function fillAmilLogin() {
    var login = findLoginInput();
    var senha = findPasswordInput();

    if (login) {
      login.value = loginValue;
      triggerFieldEvents(login);
    }

    if (senha) {
      senha.value = senhaValue;
      triggerFieldEvents(senha);
      window.setTimeout(function () { pressEnter(senha); }, 1800);
    }
  }

  fillAmilLogin();
  [250, 750, 1500, 3000, 5000].forEach(function (delay) {
    window.setTimeout(fillAmilLogin, delay);
  });
})();
</script>`;

const rewriteAmilText = (content: string, contentType: string, upstreamPath: string) => {
  let rewritten = content
    .replaceAll(AMIL_ORIGIN, AMIL_PROXY_PREFIX)
    .replaceAll('http://portalcorretor.amil.com.br', AMIL_PROXY_PREFIX)
    .replaceAll('//portalcorretor.amil.com.br', AMIL_PROXY_PREFIX);

  if (contentType.includes('text/html')) {
    const basePath = upstreamPath.includes('/') ? upstreamPath.slice(0, upstreamPath.lastIndexOf('/') + 1) : '/';
    rewritten = rewritten
      .replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, '')
      .replace(/<head([^>]*)>/i, `<head$1><base href="${AMIL_PROXY_PREFIX}${basePath}" />`)
      .replace(/\b(href|src|action)=["']\/(?!\/|amil-proxy\/)/gi, `$1="${AMIL_PROXY_PREFIX}/`);

    rewritten = rewritten.includes('</body>')
      ? rewritten.replace('</body>', `${amilAutofillScript}</body>`)
      : `${rewritten}${amilAutofillScript}`;
  }

  if (contentType.includes('text/css') || contentType.includes('javascript')) {
    rewritten = rewritten
      .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${AMIL_PROXY_PREFIX}/`)
      .replace(
        new RegExp(`(["'])/(?!amil-proxy/)(${AMIL_APP_PATHS})(?=/|\\?)`, 'gi'),
        `$1${AMIL_PROXY_PREFIX}/$2`
      );
  }

  return rewriteAmilAppPaths(rewritten);
};

const rewriteSimulatorText = (content: string, contentType: string) => {
  const proxyOrigin = SIMULATOR_PROXY_PREFIX;
  let rewritten = content
    .replaceAll(SIMULATOR_ORIGIN, proxyOrigin)
    .replaceAll('http://app.simuladoronline.com', proxyOrigin)
    .replaceAll('//app.simuladoronline.com', proxyOrigin);

  if (contentType.includes('text/html')) {
    rewritten = rewritten
      .replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, `<base href="${SIMULATOR_PROXY_PREFIX}/" />`)
      .replace(/\b(href|src|action)=["']\/(?!\/|simulador-proxy\/)/gi, `$1="${SIMULATOR_PROXY_PREFIX}/`)
      .replace(/window\.BASE_URL\s*=\s*['"][^'"]*['"]/g, `window.BASE_URL = '${SIMULATOR_PROXY_PREFIX}/'`)
      .replace(/window\.ASSETS_URL\s*=\s*['"][^'"]*['"]/g, `window.ASSETS_URL = '${SIMULATOR_PROXY_PREFIX}/static/'`)
      .replace(
        /<input([^>]*id=["']login_usuario["'][^>]*?)\s*\/?>/i,
        '<input$1 value="Rosilene Rodrigues" autocomplete="off" data-lpignore="true">'
      )
      .replace(
        /<input([^>]*id=["']login_senha["'][^>]*?)\s*\/?>/i,
        '<input$1 value="123" autocomplete="off" data-lpignore="true">'
      );

    rewritten = rewritten.includes('</body>')
      ? rewritten.replace('</body>', `${simulatorRegionRefreshScript}</body>`)
      : `${rewritten}${simulatorRegionRefreshScript}`;
  }

  if (contentType.includes('text/css') || contentType.includes('javascript')) {
    rewritten = rewritten
      .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${SIMULATOR_PROXY_PREFIX}/`)
      .replace(
        /return url\.match\(\/https\?\|www\/\)\?url:\(window\.BASE_URL\|\|""\)\+url/g,
        'return url.match(/https?|www/)?url:(url.charAt(0)==="/"?url:(window.BASE_URL||"")+url)'
      )
      .replace(
        new RegExp(`(["'])/(?!simulador-proxy/)(${SIMULATOR_APP_PATHS})/`, 'gi'),
        `$1${SIMULATOR_PROXY_PREFIX}/$2/`
      );
  }

  return rewriteSimulatorAppPaths(rewritten);
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(uploadDir));
  void initializeLocalWhatsAppConnector();

  registerLocalAuthRoutes(app);
  app.use('/api', gmailRouter);

  app.post('/api/send-login-code', sendLoginCodeHandler);
  registerWhatsAppBridgeRoutes(app);

  app.post('/api/clientes', createClienteHandler);
  app.get('/api/clientes', listClientesHandler);
  app.get('/api/clientes/next-code', nextClienteCodigoHandler);
  app.get('/api/clientes/aniversariantes-mes', aniversariantesMesHandler);
  app.get('/api/clientes/search', searchClientesHandler);
  app.get('/api/clientes/stats', clientStatsHandler);
  app.put('/api/clientes/:id', updateClienteHandler);
  app.delete('/api/clientes/:id', deleteClienteHandler);

  app.get('/api/import-lead-asset', (req, res) => {
    importLeadAssetHandler(req, res);
  });

  app.post('/api/import-lead', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
      const data = await importLeadFromSistemaQuer({
        login: String(req.body?.login || ''),
        senha: String(req.body?.senha || ''),
        leadUrl: String(req.body?.leadUrl || ''),
      });

      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof ImportLeadHttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      console.error('ERRO:', error);
      return res.status(500).json({ error: 'Erro interno ao importar lead.' });
    }
  });

  app.all(`${SIMULATOR_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = normalizeSimulatorUpstreamPath(req.originalUrl.slice(SIMULATOR_PROXY_PREFIX.length));
    const upstreamUrl = new URL(upstreamPath, SIMULATOR_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;

      const lowerName = name.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
        continue;
      }

      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    const upstreamReferer =
      rewriteSimulatorRequestUrl(
        Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer
      ) || `${SIMULATOR_ORIGIN}/login/4602`;

    requestHeaders.set('host', 'app.simuladoronline.com');
    requestHeaders.set('origin', SIMULATOR_ORIGIN);
    requestHeaders.set('referer', upstreamReferer);

    try {
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) {
          return;
        }

        if (lowerName === 'location') {
          res.setHeader('Location', rewriteSimulatorLocation(value));
          return;
        }

        if (lowerName === 'set-cookie') {
          return;
        }

        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteSimulatorCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

      if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
        res.send(rewriteSimulatorText(responseBuffer.toString('utf8'), contentType));
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY DO SIMULADOR:', error);
      res.status(502).send('Erro ao carregar o proxy do simulador.');
    }
  });

  app.all(`${SULAMERICA_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = req.originalUrl.slice(SULAMERICA_PROXY_PREFIX.length) || SULAMERICA_LOGIN_PATH;

    if (upstreamPath === '/__reset__') {
      const cookieNames = getCookieNames(Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie);

      for (const cookieName of cookieNames) {
        res.append(
          'Set-Cookie',
          `${cookieName}=; Path=${SULAMERICA_PROXY_PREFIX}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly`
        );
        res.append(
          'Set-Cookie',
          `${cookieName}=; Path=${SULAMERICA_PROXY_PREFIX}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`
        );
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).send('SulAmerica proxy resetado.');
      return;
    }

    const upstreamUrl = new URL(upstreamPath, SULAMERICA_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;

      const lowerName = name.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
        continue;
      }

      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    requestHeaders.set('host', 'os11.sulamerica.com.br');
    requestHeaders.set('origin', SULAMERICA_ORIGIN);
    requestHeaders.set('referer', `${SULAMERICA_ORIGIN}${SULAMERICA_LOGIN_PATH}`);

    try {
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) {
          return;
        }

        if (lowerName === 'location') {
          res.setHeader('Location', rewriteSulamericaLocation(value));
          return;
        }

        if (lowerName === 'set-cookie') {
          return;
        }

        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteSulamericaCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

      if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
        res.send(rewriteSulamericaText(responseBuffer.toString('utf8'), contentType, upstreamPath));
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY SULAMERICA:', error);
      res.status(502).send('Erro ao carregar o proxy SulAmerica.');
    }
  });

  app.all(`${AMIL_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = req.originalUrl.slice(AMIL_PROXY_PREFIX.length) || AMIL_LOGIN_PATH;
    const upstreamUrl = new URL(upstreamPath, AMIL_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;

      const lowerName = name.toLowerCase();
      if (
        ['host', 'connection', 'content-length', 'accept-encoding', 'origin', 'referer', 'user-agent'].includes(lowerName) ||
        lowerName.startsWith('sec-')
      ) {
        continue;
      }

      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    requestHeaders.set('host', 'portalcorretor.amil.com.br');
    requestHeaders.set('origin', AMIL_ORIGIN);
    requestHeaders.set('referer', `${AMIL_ORIGIN}${AMIL_LOGIN_PATH}`);
    requestHeaders.set('user-agent', AMIL_BROWSER_USER_AGENT);
    requestHeaders.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
    requestHeaders.set('accept-language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    requestHeaders.set('upgrade-insecure-requests', '1');

    try {
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();

        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) {
          return;
        }

        if (lowerName === 'location') {
          res.setHeader('Location', rewriteAmilLocation(value));
          return;
        }

        if (lowerName === 'set-cookie') {
          return;
        }

        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteAmilCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

      if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('javascript')) {
        res.send(rewriteAmilText(responseBuffer.toString('utf8'), contentType, upstreamPath));
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY AMIL:', error);
      res.status(502).send('Erro ao carregar o proxy Amil.');
    }
  });

  app.all(`${MEDSENIOR_PROXY_PREFIX}*`, async (req, res) => {
    const upstreamPath = req.originalUrl.slice(MEDSENIOR_PROXY_PREFIX.length) || '/';
    const upstreamUrl = new URL(upstreamPath, MEDSENIOR_ORIGIN);
    const requestHeaders = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lowerName = name.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lowerName)) {
        continue;
      }
      requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
    }

    requestHeaders.set('host', 'vendadigital.medsenior.com.br');
    requestHeaders.set('origin', MEDSENIOR_ORIGIN);
    requestHeaders.set('referer', `${MEDSENIOR_ORIGIN}/`);

    try {
      const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await getRequestBody(req);
      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: requestHeaders,
        body: bodyBuffer as unknown as BodyInit,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);

      upstreamResponse.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();
        if (SIMULATOR_BLOCKED_RESPONSE_HEADERS.has(lowerName)) return;
        if (lowerName === 'location') {
          res.setHeader('Location', rewriteMedseniorLocation(value));
          return;
        }
        if (lowerName === 'set-cookie') return;
        res.setHeader(name, value);
      });

      const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        res.append('Set-Cookie', rewriteMedseniorCookie(cookie));
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

const medseniorAutofillScript = `
<script>
(function () {
  var loginValue = ${JSON.stringify(MEDSENIOR_LOGIN)};
  var senhaValue = ${JSON.stringify(MEDSENIOR_PASSWORD)};
  var userStorageKey = 'rc-medsenior-usuario';
  var passwordStorageKey = 'rc-medsenior-senha';

  try {
    window.localStorage.setItem(userStorageKey, loginValue);
    window.localStorage.setItem(passwordStorageKey, senhaValue);
  } catch (_storageError) {}

  function triggerEvents(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function getPersistedValue(storageKey, fallbackValue) {
    try {
      return window.localStorage.getItem(storageKey) || fallbackValue;
    } catch (_storageError) {
      return fallbackValue;
    }
  }

  function fillMedseniorLogin() {
    var persistedUser = getPersistedValue(userStorageKey, loginValue);
    var persistedPassword = getPersistedValue(passwordStorageKey, senhaValue);
    var userField =
      document.querySelector('#usuario') ||
      document.querySelector('input[name="usuario"]') ||
      document.querySelector('input[autocomplete="username"]') ||
      document.querySelector('input[type="text"]');
    var passwordField =
      document.querySelector('#password') ||
      document.querySelector('input[name="password"]') ||
      document.querySelector('input[name="senha"]') ||
      document.querySelector('input[autocomplete="current-password"]') ||
      document.querySelector('input[type="password"]');

    if (userField && userField.value !== persistedUser) {
      userField.value = persistedUser;
      userField.setAttribute('autocomplete', 'username');
      userField.setAttribute('data-lpignore', 'true');
      triggerEvents(userField);
    }
    if (passwordField && passwordField.value !== persistedPassword) {
      passwordField.value = persistedPassword;
      passwordField.setAttribute('autocomplete', 'current-password');
      passwordField.setAttribute('data-lpignore', 'true');
      triggerEvents(passwordField);
    }
  }

  function observeMutations() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      fillMedseniorLogin();
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  // Executa imediatamente e em intervalos para lidar com carregamento assíncrono do React/MUI
  fillMedseniorLogin();
  var intervals = [100, 300, 600, 1000, 2000, 5000];
  intervals.forEach(function (delay) {
    window.setTimeout(fillMedseniorLogin, delay);
  });
  observeMutations();
})();
</script>`;

      if (contentType.includes('text/html')) {
        let content = responseBuffer.toString('utf8');
        // Adiciona base href para garantir que recursos relativos funcionem via proxy
        content = content.replace(/<head([^>]*)>/i, `<head$1><base href="${MEDSENIOR_PROXY_PREFIX}/" />`);
        
        // Injeta o script de preenchimento automático
        if (content.includes('</body>')) {
          content = content.replace('</body>', `${medseniorAutofillScript}</body>`);
        } else {
          content += medseniorAutofillScript;
        }
        
        res.send(content);
        return;
      }

      res.send(responseBuffer);
    } catch (error) {
      console.error('ERRO NO PROXY MEDSENIOR:', error);
      res.status(502).send('Erro ao carregar o proxy Medsenior.');
    }
  });

  app.use((req, res, next) => {
    const referer = req.headers.referer || '';
    if (
      !req.originalUrl.startsWith('/api') &&
      !req.originalUrl.startsWith(SIMULATOR_PROXY_PREFIX) &&
      !req.originalUrl.startsWith(SULAMERICA_PROXY_PREFIX) &&
      !req.originalUrl.startsWith(AMIL_PROXY_PREFIX) &&
      !req.originalUrl.startsWith(MEDSENIOR_PROXY_PREFIX)
    ) {
      if (referer.includes(SIMULATOR_PROXY_PREFIX)) {
        return res.redirect(307, `${SIMULATOR_PROXY_PREFIX}${req.originalUrl}`);
      }
      if (referer.includes(SULAMERICA_PROXY_PREFIX)) {
        return res.redirect(307, `${SULAMERICA_PROXY_PREFIX}${req.originalUrl}`);
      }
      if (referer.includes(AMIL_PROXY_PREFIX)) {
        return res.redirect(307, `${AMIL_PROXY_PREFIX}${req.originalUrl}`);
      }
      if (referer.includes(MEDSENIOR_PROXY_PREFIX)) {
        return res.redirect(307, `${MEDSENIOR_PROXY_PREFIX}${req.originalUrl}`);
      }
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Rodando em http://localhost:${PORT}`));
}

startServer();
