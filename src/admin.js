const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { execFile } = require("child_process");
const { EDITABLE_KEYS, readEditableValues, updateEnvValues, updateAdminPasswordHash } = require("./envStore");
const { buildDepartments } = require("./departments");
const stats = require("./stats");
const fs = require("fs");
const path = require("path");

// Logo incrustado como data URI: evita una peticion extra que a veces falla o llega tarde
// (proxy, cache, conexion lenta). Si no se puede leer, se usa el archivo estatico.
const ICON_OK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/></svg>`;
const ICON_ERR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>`;
const ICON_EYE = `<svg class="i-show" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="i-hide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.6 18.6 0 0 1 5.1-5.9M9.9 5.1A10.7 10.7 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>`;

// Campo de contrasena con boton ver/ocultar
function pwField(label, name, autocomplete, extra = "") {
  return `<div class="pw-field">
          <label for="${name}">${label}</label>
          <div class="pw-input">
            <input type="password" id="${name}" name="${name}" autocomplete="${autocomplete}" required ${extra}>
            <button type="button" class="pw-toggle" aria-label="Mostrar contrasena" aria-pressed="false">${ICON_EYE}</button>
          </div>
        </div>`;
}

const LOGO_FILE = "/logo.jpeg";
let LOGO_SRC = LOGO_FILE;
try {
  const buf = fs.readFileSync(path.join(__dirname, "..", "public", "logo.jpeg"));
  LOGO_SRC = `data:image/jpeg;base64,${buf.toString("base64")}`;
} catch (e) {
  console.error("No se pudo incrustar el logo:", e.message);
}

const router = express.Router();

const FIELD_LABELS = {
  DEPT_CONTABILIDAD: "Numero - Contabilidad",
  DEPT_PUNTO_DE_VENTA: "Numero - Punto de Venta",
  DEPT_ADMINISTRACION: "Numero - Administracion",
  DEPT_PROGRAMACION_PRODUCCION: "Numero - Programacion y Produccion",
  WELCOME_HEADER: "Titulo del menu de bienvenida",
  WELCOME_BODY: "Texto del mensaje de bienvenida",
  WELCOME_BUTTON_TEXT: "Texto del boton del menu",
  META_BILLING_URL: "Link directo a metodo de pago en Meta",
};

// Campos que alimentan el preview en vivo del lado del cliente
const PREVIEW_FIELDS = new Set(["WELCOME_HEADER", "WELCOME_BODY", "WELCOME_BUTTON_TEXT"]);

// Limites reales de WhatsApp para mensajes interactivos tipo "list"
const CHAR_LIMITS = {
  WELCOME_HEADER: 60,
  WELCOME_BODY: 1024,
  WELCOME_BUTTON_TEXT: 20,
};

// --- Proteccion basica contra fuerza bruta en el login (en memoria) ---
const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function layout(title, bodyHtml, wide, centered) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Panel Plasticos Superior</title>
<style>
  :root { --accent: #4b7a52; --accent-dark: #3c6342; --ink: #e4e6e8; --muted: #8b93a1; --panel: #1c2024; --panel-line: #2b3036; --field: #15181b; }
  body { font-family: system-ui, sans-serif; background: #121417; color: var(--ink); margin: 0; padding: 2rem 1rem; }
  body.centered { min-height: 100vh; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .card { max-width: 640px; margin: 0 auto; background: var(--panel); border: 1px solid var(--panel-line); border-radius: 10px; padding: 2rem; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
  .card.wide { max-width: 1080px; }
  .card.login-card { max-width: 380px; }
  h1 { font-size: 1.3rem; margin-top: 0; font-weight: 600; }
  h1.login-title { text-align: center; margin-bottom: .2rem; }
  .login-sub { text-align: center; color: var(--muted); font-size: .85rem; margin: 0 0 1.6rem; }
  .login-logo-plate { background: #f1f1ef; border-radius: 10px; padding: 14px 18px; margin: 0 auto 1.4rem; max-width: 280px; }
  .login-logo-plate img { width: 100%; height: auto; display: block; }
  label { display: block; margin: 1rem 0 .3rem; font-size: .85rem; color: var(--muted); }
  input[type=text], input[type=password] { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border-radius: 6px; border: 1px solid var(--panel-line); background: var(--field); color: var(--ink); font-size: 1rem; transition: border-color .15s; }
  input:focus { outline: none; border-color: var(--accent); }
  input::placeholder { color: #51565c; }
  button { margin-top: 1.5rem; width: 100%; padding: .75rem; border: none; border-radius: 6px; background: var(--accent); color: #f3f6f3; font-weight: 600; font-size: .95rem; cursor: pointer; transition: background .15s; }
  button:hover { background: var(--accent-dark); }
  .hint { font-size: .8rem; color: var(--muted); margin-top: .2rem; }
  .charcount { font-size: .75rem; color: var(--muted); margin-top: .2rem; text-align: right; }
  .charcount.over { color: #c9766f; font-weight: 600; }
  .flash-ok { background: #203625; color: #bcd4bf; padding: .7rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: .9rem; }
  .flash-err { background: #3a2323; color: #e0bcbc; padding: .7rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: .9rem; }
  a.payment-link { display: inline-block; margin-top: .3rem; color: #8fb0d8; }
  .logout-form { margin: 0 0 0 auto; flex-shrink: 0; }
  button.logout { display: inline-flex; align-items: center; gap: .4rem; width: auto; margin: 0; min-height: 40px; padding: .5rem .9rem; background: transparent; color: var(--muted); border: 1px solid var(--panel-line); font-weight: 500; font-size: .85rem; }
  button.logout:hover { background: #3a2323; color: #e0bcbc; border-color: #5a3434; }
  @media (max-width: 480px) {
    body { padding: 1rem .75rem; }
    .card { padding: 1.2rem; }
    .panel-header { gap: .6rem; }
    .panel-header h1 { font-size: 1.05rem; }
    .panel-logo { height: 30px; }
    button.logout { min-width: 44px; min-height: 44px; justify-content: center; padding: .5rem .7rem; }
    button.logout .logout-text { display: none; }
  }
  /* --- Cambiar contrasena --- */
  .pw-card { max-width: 480px; padding: 1rem 1.4rem 1.4rem; }
  .pw-form { display: flex; flex-direction: column; gap: .2rem; }
  .pw-field label { margin: .8rem 0 .35rem; }
  .pw-input { position: relative; }
  .pw-input input[type=password], .pw-input input[type=text] { padding-right: 3rem; min-height: 46px; }
  .pw-input input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(75,122,82,.25); }
  button.pw-toggle { position: absolute; top: 0; right: 0; width: 46px; height: 100%; margin: 0; padding: 0; background: transparent; color: var(--muted); display: flex; align-items: center; justify-content: center; border-radius: 0 6px 6px 0; }
  button.pw-toggle:hover { background: transparent; color: var(--ink); }
  .pw-toggle .i-hide { display: none; }
  .pw-toggle.on .i-hide { display: block; }
  .pw-toggle.on .i-show { display: none; }
  .pw-msg { display: flex; align-items: flex-start; gap: .55rem; padding: .7rem .9rem; border-radius: 8px; font-size: .88rem; line-height: 1.35; margin: .4rem 0; border: 1px solid; }
  .pw-msg[hidden] { display: none; }
  .pw-msg svg { flex-shrink: 0; margin-top: 1px; }
  .pw-msg.ok { background: #1d3223; color: #b9d9bf; border-color: #2f5a39; }
  .pw-msg.err { background: #3a2323; color: #e8bcbc; border-color: #5a3434; }
  button.pw-submit { margin-top: 1rem; min-height: 48px; }
  button.pw-submit:focus-visible, button.pw-toggle:focus-visible { outline: 2px solid #8fb0d8; outline-offset: 2px; }
  @media (max-width: 480px) { .pw-card { max-width: none; padding: .8rem 1rem 1.1rem; } .pw-input input { font-size: 16px; } }

  /* --- Seccion Avanzado (acordeon) --- */
  details.advanced { margin-top: 1.5rem; border: 1px solid var(--panel-line); border-radius: 10px; background: rgba(255,255,255,.015); transition: border-color .15s; }
  details.advanced:hover, details.advanced[open] { border-color: #3a4048; }
  details.advanced summary { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 48px; padding: .75rem 1rem; cursor: pointer; list-style: none; color: var(--muted); font-size: .9rem; font-weight: 500; border-radius: 10px; user-select: none; }
  details.advanced summary::-webkit-details-marker { display: none; }
  details.advanced summary:hover { color: var(--ink); }
  details.advanced summary:focus-visible { outline: 2px solid #8fb0d8; outline-offset: 2px; }
  details.advanced .chev { transition: transform .25s ease; }
  details.advanced[open] .chev { transform: rotate(180deg); }
  details.advanced[open] summary { color: var(--ink); }
  .advanced-body { padding: 0 1rem 1.1rem; max-width: 100%; animation: advOpen .25s ease; }
  .advanced-body label { margin-top: .2rem; }
  .advanced-body input { min-width: 0; text-overflow: ellipsis; }
  .advanced-body input:focus { box-shadow: 0 0 0 3px rgba(75,122,82,.25); }
  @keyframes advOpen { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .advanced-body { animation: none; } details.advanced .chev { transition: none; } }
  @media (min-width: 880px) { .advanced-body input { max-width: 640px; } }

  /* Boton principal: hover/focus/active mas claros, ancho completo en movil */
  form > button[type=submit] { min-height: 48px; box-shadow: 0 1px 0 rgba(255,255,255,.06) inset; }
  form > button[type=submit]:hover { box-shadow: 0 4px 12px rgba(0,0,0,.3); }
  form > button[type=submit]:active { transform: translateY(1px); }
  form > button[type=submit]:focus-visible { outline: 2px solid #8fb0d8; outline-offset: 2px; }

  fieldset { border: 1px solid var(--panel-line); border-radius: 8px; margin-top: 1.5rem; }
  legend { padding: 0 .5rem; color: var(--muted); font-size: .9rem; }

  .layout-grid { display: grid; grid-template-columns: 1fr; gap: 2rem; margin-top: 1rem; }
  @media (min-width: 880px) { .layout-grid { grid-template-columns: 1fr 360px; } }

  /* --- mockup de WhatsApp --- */
  .phone { position: sticky; top: 1.5rem; background: #0b141a; border-radius: 20px; padding: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
  .phone-header { background: #1f2c33; color: #e9edef; padding: .7rem .9rem; border-radius: 12px 12px 0 0; font-size: .9rem; display: flex; align-items: center; gap: .5rem; }
  .phone-header .avatar { width: 28px; height: 28px; border-radius: 50%; background: #25d366; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #052e16; font-size: .8rem; }
  .phone-body { background: #0b141a; background-image: radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px); background-size: 14px 14px; padding: 1rem .7rem; min-height: 380px; border-radius: 0 0 12px 12px; display: flex; flex-direction: column; gap: .5rem; }
  .bubble { background: #202c33; color: #e9edef; border-radius: 10px; padding: .6rem .7rem; max-width: 92%; font-size: .85rem; line-height: 1.35; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
  .bubble b { color: #fff; }
  .bubble .header-text { font-weight: 700; display: block; margin-bottom: .25rem; }
  .bubble .list-btn { margin-top: .5rem; text-align: center; color: #53bdeb; border-top: 1px solid #2a3942; padding-top: .5rem; font-weight: 600; cursor: pointer; font-size: .85rem; }
  .sheet { background: #202c33; border-radius: 10px; padding: .4rem 0; max-width: 92%; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
  .sheet-title { color: #8696a0; font-size: .7rem; text-transform: uppercase; padding: .4rem .8rem; }
  .sheet-row { padding: .5rem .8rem; border-top: 1px solid #2a3942; cursor: pointer; }
  .sheet-row:first-of-type { border-top: none; }
  .sheet-row .t { color: #e9edef; font-size: .85rem; font-weight: 600; }
  .sheet-row .d { color: #8696a0; font-size: .78rem; margin-top: .1rem; }
  .sheet-row .warn { color: #f87171; font-size: .72rem; margin-top: .2rem; }
  .preview-reset { font-size: .78rem; color: #53bdeb; cursor: pointer; text-align: center; margin-top: .3rem; }
  .preview-label { font-size: .8rem; color: #64748b; margin-bottom: .5rem; }

  .panel-header { display: flex; align-items: center; gap: .9rem; margin-bottom: 1rem; }
  .panel-logo { height: 36px; width: auto; flex-shrink: 0; object-fit: contain; border-radius: 6px; background: #f1f1ef; padding: 3px 6px; }
  .panel-header h1 { margin: 0; }

  .stats-row { display: flex; flex-wrap: wrap; gap: 1.2rem; margin-bottom: 1rem; }
  .stat { display: flex; flex-direction: column; }
  .stat-n { font-size: 1.6rem; font-weight: 700; color: var(--ink); }
  .stat-l { font-size: .78rem; color: var(--muted); }
  .contacts-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  .contacts-table th, .contacts-table td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--panel-line); color: var(--ink); }
  .contacts-table th { color: var(--muted); font-weight: 600; font-size: .75rem; text-transform: uppercase; }
</style>
</head>
<body${centered ? ' class="centered"' : ""}>
  <div class="card${wide ? " wide" : ""}${centered ? " login-card" : ""}">${bodyHtml}</div>
</body>
</html>`;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect("/admin/login");
}

router.get("/login", (req, res) => {
  const error = req.query.error ? `<div class="flash-err">Usuario o contrasena incorrectos.</div>` : "";
  res.send(
    layout(
      "Ingresar",
      `
    <div class="login-logo-plate"><img src="${LOGO_SRC}" alt="Plasticos Superior" width="280" height="96" decoding="async"></div>
    <h1 class="login-title">Panel de administracion</h1>
    <p class="login-sub">Bot de WhatsApp</p>
    ${error}
    <form method="post" action="/admin/login">
      <label>Usuario</label>
      <input type="text" name="username" autocomplete="username" required autofocus>
      <label>Contrasena</label>
      <input type="password" name="password" autocomplete="current-password" required>
      <button type="submit">Ingresar</button>
    </form>
  `,
      false,
      true
    )
  );
});

router.post("/login", (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).send(layout("Bloqueado", `<h1>Demasiados intentos</h1><p>Esperá unos minutos y volvé a intentar.</p>`));
  }

  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || "";

  const userOk = typeof username === "string" && username === expectedUser;
  const passOk = expectedHash && typeof password === "string" && bcrypt.compareSync(password, expectedHash);

  if (!userOk || !passOk) {
    registerFailedAttempt(ip);
    return res.redirect("/admin/login?error=1");
  }

  clearAttempts(ip);
  req.session.authenticated = true;
  req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  res.redirect("/admin");
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.get("/", requireAuth, (req, res) => {
  const values = readEditableValues();
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  const csrf = req.session.csrfToken;
  const ok = req.query.ok ? `<div class="flash-ok">Cambios guardados. El bot se reinicio con la nueva configuracion.</div>` : "";
  const PW_ERRORS = {
    wrong: "La contrasena actual no es correcta.",
    mismatch: "Las contrasenas nuevas no coinciden.",
    short: "La contrasena nueva debe tener al menos 8 caracteres.",
    err: "No se pudo cambiar la contrasena. Revisa los datos e intenta de nuevo.",
  };
  const pwOk = req.query.pw === "ok" ? `<div class="pw-msg ok" role="status">${ICON_OK}<span>Contrasena actualizada con exito.</span></div>` : "";
  const pwErr = PW_ERRORS[req.query.pw] ? `<div class="pw-msg err" role="alert">${ICON_ERR}<span>${PW_ERRORS[req.query.pw]}</span></div>` : "";

  const billingUrl = values.META_BILLING_URL || "https://business.facebook.com/billing_hub/payment_methods/";

  // Titulo/descripcion de cada departamento son fijos en src/departments.js
  // (no editables desde el panel); el preview los combina con el numero
  // que el admin tenga tipeado en el formulario en ese momento.
  const departmentsForPreview = buildDepartments().map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    phoneField: `DEPT_${d.id.replace(/^dept_/, "").toUpperCase()}`,
  }));

  const fieldsHtml = EDITABLE_KEYS.filter((k) => k !== "META_BILLING_URL")
    .map((key) => {
      const previewAttr = PREVIEW_FIELDS.has(key) ? ` data-preview="${key}"` : "";
      const counter = CHAR_LIMITS[key] ? `<div class="charcount" data-counter="${key}"></div>` : "";
      return `
      <label>${FIELD_LABELS[key]}</label>
      <input type="text" name="${key}" value="${escapeHtml(values[key])}"${previewAttr}>
      ${counter}
    `;
    })
    .join("");

  const summary = stats.getSummary(30);
  const contactsRows = summary.contacts
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.phone)}</td>
        <td>${formatDate(c.firstSeen)}</td>
        <td>${formatDate(c.lastSeen)}</td>
        <td>${c.messageCount}</td>
      </tr>`
    )
    .join("");

  res.send(
    layout(
      "Panel",
      `
    <div class="panel-header">
      <img src="${LOGO_SRC}" alt="Plasticos Superior" class="panel-logo" width="105" height="36" decoding="async">
      <h1>Configuracion del bot</h1>
      <form class="logout-form" method="post" action="/admin/logout">
        <button type="submit" class="logout" aria-label="Cerrar sesion" title="Cerrar sesion">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span class="logout-text">Salir</span>
        </button>
      </form>
    </div>
    ${ok}

    <fieldset>
      <legend>Actividad</legend>
      <div class="stats-row">
        <div class="stat"><span class="stat-n">${summary.totalIncoming}</span><span class="stat-l">Mensajes recibidos</span></div>
        <div class="stat"><span class="stat-n">${summary.totalOutgoing}</span><span class="stat-l">Mensajes enviados</span></div>
        <div class="stat"><span class="stat-n">${summary.totalContacts}</span><span class="stat-l">Personas distintas</span></div>
        <div class="stat"><span class="stat-n">${summary.newContactsLast7d}</span><span class="stat-l">Nuevas (7 dias)</span></div>
      </div>
      ${
        summary.contacts.length
          ? `<table class="contacts-table">
        <thead><tr><th>Numero</th><th>Primer mensaje</th><th>Ultimo mensaje</th><th>Mensajes</th></tr></thead>
        <tbody>${contactsRows}</tbody>
      </table>`
          : `<p class="hint">Todavia no llego ningun mensaje.</p>`
      }
    </fieldset>

    <fieldset>
      <legend>Metodo de pago en Meta</legend>
      <p class="hint">Ahi es donde Plasticos Superior carga la tarjeta con la que Meta cobra los mensajes salientes.</p>
      <a class="payment-link" href="${escapeHtml(billingUrl)}" target="_blank" rel="noopener">Ir a configurar el metodo de pago en Meta &rarr;</a>
    </fieldset>

    <fieldset class="pw-card">
      <legend>Cambiar contrasena</legend>
      ${pwOk}
      ${pwErr}
      <form id="pwForm" class="pw-form" method="post" action="/admin/change-password" novalidate>
        <input type="hidden" name="_csrf" value="${csrf}">
        ${pwField("Contrasena actual", "current_password", "current-password")}
        ${pwField("Contrasena nueva", "new_password", "new-password", 'minlength="8"')}
        <p class="hint">Minimo 8 caracteres.</p>
        ${pwField("Repetir contrasena nueva", "new_password_confirm", "new-password", 'minlength="8"')}
        <div id="pwClient" class="pw-msg err" role="alert" hidden></div>
        <button type="submit" class="pw-submit">Cambiar contrasena</button>
      </form>
      <script>
        (function () {
          var form = document.getElementById("pwForm");
          var box = document.getElementById("pwClient");
          // Ver / ocultar contrasena
          form.querySelectorAll(".pw-toggle").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var input = btn.parentNode.querySelector("input");
              var show = input.type === "password";
              input.type = show ? "text" : "password";
              btn.setAttribute("aria-pressed", show);
              btn.setAttribute("aria-label", show ? "Ocultar contrasena" : "Mostrar contrasena");
              btn.classList.toggle("on", show);
            });
          });
          // Validacion rapida antes de enviar (el servidor valida de nuevo)
          form.addEventListener("submit", function (e) {
            var n = form.new_password.value, c = form.new_password_confirm.value, msg = "";
            if (!form.current_password.value) msg = "Escribe tu contrasena actual.";
            else if (n.length < 8) msg = "La contrasena nueva debe tener al menos 8 caracteres.";
            else if (n !== c) msg = "Las contrasenas nuevas no coinciden.";
            if (msg) {
              e.preventDefault();
              box.hidden = false;
              box.innerHTML = ${JSON.stringify(ICON_ERR)} + "<span></span>";
              box.lastChild.textContent = msg;
            }
          });
          form.addEventListener("input", function () { box.hidden = true; });
        })();
      </script>
    </fieldset>

    <div class="layout-grid">
      <form method="post" action="/admin">
        <input type="hidden" name="_csrf" value="${csrf}">
        ${fieldsHtml}

        <!-- Acordeon nativo: cerrado por defecto; el input sigue dentro del form y se envia igual -->
        <details class="advanced">
          <summary>
            <span>Avanzado</span>
            <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </summary>
          <div class="advanced-body">
            <label for="META_BILLING_URL">${FIELD_LABELS.META_BILLING_URL}</label>
            <input type="text" id="META_BILLING_URL" name="META_BILLING_URL" inputmode="url" autocapitalize="off" spellcheck="false" value="${escapeHtml(values.META_BILLING_URL)}" placeholder="https://business.facebook.com/billing_hub/payment_methods/">
            <p class="hint">Si Meta cambia la pantalla, pega aca la URL exacta de "Metodos de pago" de la cuenta de WhatsApp.</p>
          </div>
        </details>

        <button type="submit">Guardar y reiniciar el bot</button>
      </form>

      <div>
        <div class="preview-label">Así se ve en WhatsApp (en vivo, no se manda nada real)</div>
        <div class="phone">
          <div class="phone-header">
            <div class="avatar">PS</div>
            <div>Plasticos Superior</div>
          </div>
          <div class="phone-body" id="previewBody"></div>
        </div>
      </div>
    </div>

    <script>
      var DEPARTMENTS = ${JSON.stringify(departmentsForPreview).replace(/</g, "\\u003c")};
      var CHAR_LIMITS = ${JSON.stringify(CHAR_LIMITS)};

      function fieldValue(name) {
        var el = document.querySelector('[name="' + name + '"]');
        return el ? el.value : "";
      }

      function escapeHtml(str) {
        return String(str || "")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      // WhatsApp solo soporta *negrita* como markdown simple en sus mensajes de texto
      function renderWaText(str) {
        return escapeHtml(str).replace(/\\*([^*]+)\\*/g, "<b>$1</b>").replace(/\\n/g, "<br>");
      }

      var selectedDept = null;
      var sheetOpen = false;

      function render() {
        var header = fieldValue("WELCOME_HEADER");
        var body = fieldValue("WELCOME_BODY");
        var buttonText = fieldValue("WELCOME_BUTTON_TEXT") || "Ver opciones";

        var html = '<div class="bubble">';
        if (header) html += '<span class="header-text">' + escapeHtml(header) + '</span>';
        html += renderWaText(body || "(sin texto de bienvenida)");
        html += '<div class="list-btn" onclick="toggleSheet()">\\uD83D\\uDCCB ' + escapeHtml(buttonText) + '</div>';
        html += '</div>';

        if (sheetOpen) {
          html += '<div class="sheet"><div class="sheet-title">Departamentos</div>';
          DEPARTMENTS.forEach(function (d) {
            var warn = "";
            if (d.title.length > 24) warn += "Titulo de " + d.title.length + " caracteres, el maximo de WhatsApp es 24. ";
            if (d.description.length > 72) warn += "Descripcion de " + d.description.length + " caracteres, el maximo es 72.";
            html += '<div class="sheet-row" onclick="selectDept(\\'' + d.id + '\\')">'
              + '<div class="t">' + escapeHtml(d.title) + '</div>'
              + '<div class="d">' + escapeHtml(d.description) + '</div>'
              + (warn ? '<div class="warn">⚠ ' + warn + '</div>' : '')
              + '</div>';
          });
          html += '</div>';
        }

        if (selectedDept) {
          var phone = fieldValue(selectedDept.phoneField) || "57XXXXXXXXXX";
          var confirmText = "Te comunico con *" + selectedDept.title + "*.\\nEscribile directamente aca: https://wa.me/" + phone;
          html += '<div class="bubble">' + renderWaText(confirmText) + '</div>';
          html += '<div class="preview-reset" onclick="resetPreview()">&larr; Volver al menu</div>';
        }

        document.getElementById("previewBody").innerHTML = html;
      }

      function toggleSheet() {
        sheetOpen = !sheetOpen;
        selectedDept = null;
        render();
      }

      function selectDept(id) {
        selectedDept = DEPARTMENTS.filter(function (d) { return d.id === id; })[0];
        sheetOpen = false;
        render();
      }

      function resetPreview() {
        selectedDept = null;
        sheetOpen = false;
        render();
      }

      function updateCounters() {
        Object.keys(CHAR_LIMITS).forEach(function (key) {
          var el = document.querySelector('[data-counter="' + key + '"]');
          if (!el) return;
          var len = fieldValue(key).length;
          var limit = CHAR_LIMITS[key];
          el.textContent = len + " / " + limit + " caracteres";
          el.className = "charcount" + (len > limit ? " over" : "");
        });
      }

      document.querySelectorAll("[data-preview]").forEach(function (el) {
        el.addEventListener("input", function () { render(); updateCounters(); });
      });
      DEPARTMENTS.forEach(function (d) {
        var el = document.querySelector('[name="' + d.phoneField + '"]');
        if (el) el.addEventListener("input", render);
      });

      render();
      updateCounters();
    </script>
  `,
      true
    )
  );
});

router.post("/", requireAuth, (req, res) => {
  if (!req.body._csrf || req.body._csrf !== req.session.csrfToken) {
    return res.status(403).send(layout("Error", `<h1>Formulario invalido</h1><p>Volve a intentar desde el panel.</p>`));
  }

  const updates = {};
  EDITABLE_KEYS.forEach((key) => {
    if (typeof req.body[key] === "string") updates[key] = req.body[key].trim();
  });

  updateEnvValues(updates);

  execFile("pm2", ["restart", "plasticos-superior-whatsbot", "--update-env"], (err) => {
    if (err) console.error("No se pudo reiniciar pm2 tras guardar el panel:", err.message);
  });

  res.redirect("/admin?ok=1");
});

router.post("/change-password", requireAuth, (req, res) => {
  if (!req.body._csrf || req.body._csrf !== req.session.csrfToken) {
    return res.status(403).send(layout("Error", `<h1>Formulario invalido</h1><p>Volve a intentar desde el panel.</p>`));
  }

  const { current_password, new_password, new_password_confirm } = req.body;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || "";
  const currentOk = typeof current_password === "string" && bcrypt.compareSync(current_password, expectedHash);
  if (!currentOk) return res.redirect("/admin?pw=wrong");
  if (typeof new_password !== "string" || new_password.length < 8) return res.redirect("/admin?pw=short");
  if (new_password !== new_password_confirm) return res.redirect("/admin?pw=mismatch");

  updateAdminPasswordHash(bcrypt.hashSync(new_password, 10));
  res.redirect("/admin?pw=ok");
});

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
