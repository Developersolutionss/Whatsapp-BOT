const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { execFile } = require("child_process");
const { EDITABLE_KEYS, SECRET_KEYS, readEditableValues, updateEnvValues, mask } = require("./envStore");

const router = express.Router();

const FIELD_LABELS = {
  WHATSAPP_TOKEN: "Token de acceso de WhatsApp (Meta)",
  PHONE_NUMBER_ID: "Phone Number ID",
  VERIFY_TOKEN: "Verify Token del webhook",
  DEPT_CONTABILIDAD: "Numero - Contabilidad",
  DEPT_PUNTO_DE_VENTA: "Numero - Punto de Venta",
  DEPT_ADMINISTRACION: "Numero - Administracion",
  DEPT_PROGRAMACION_PRODUCCION: "Numero - Programacion y Produccion",
  WELCOME_HEADER: "Titulo del menu de bienvenida",
  WELCOME_BODY: "Texto del mensaje de bienvenida",
  WELCOME_BUTTON_TEXT: "Texto del boton del menu",
  META_BILLING_URL: "Link directo a metodo de pago en Meta",
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

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Panel Plasticos Superior</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem 1rem; }
  .card { max-width: 640px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  h1 { font-size: 1.4rem; margin-top: 0; }
  label { display: block; margin: 1rem 0 .3rem; font-size: .9rem; color: #94a3b8; }
  input[type=text], input[type=password] { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
  input::placeholder { color: #475569; }
  button { margin-top: 1.5rem; width: 100%; padding: .8rem; border: none; border-radius: 8px; background: #22c55e; color: #052e16; font-weight: 600; font-size: 1rem; cursor: pointer; }
  button:hover { background: #16a34a; }
  .hint { font-size: .8rem; color: #64748b; margin-top: .2rem; }
  .flash-ok { background: #14532d; color: #bbf7d0; padding: .7rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .flash-err { background: #450a0a; color: #fecaca; padding: .7rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
  a.payment-link { display: inline-block; margin-top: .3rem; color: #93c5fd; }
  .logout { float: right; font-size: .85rem; color: #94a3b8; text-decoration: none; }
  fieldset { border: 1px solid #334155; border-radius: 8px; margin-top: 1.5rem; }
  legend { padding: 0 .5rem; color: #94a3b8; font-size: .9rem; }
</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
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
    <h1>Panel Plasticos Superior</h1>
    ${error}
    <form method="post" action="/admin/login">
      <label>Usuario</label>
      <input type="text" name="username" autocomplete="username" required>
      <label>Contrasena</label>
      <input type="password" name="password" autocomplete="current-password" required>
      <button type="submit">Ingresar</button>
    </form>
  `
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

  const billingUrl = values.META_BILLING_URL || "https://business.facebook.com/billing_hub/payment_methods/";

  const fieldsHtml = EDITABLE_KEYS.filter((k) => k !== "META_BILLING_URL")
    .map((key) => {
      const isSecret = SECRET_KEYS.has(key);
      const current = values[key];
      const placeholder = isSecret ? (current ? `Actual: ${mask(current)} (dejar en blanco para no cambiar)` : "No configurado") : "";
      const inputValue = isSecret ? "" : current;
      return `
      <label>${FIELD_LABELS[key]}</label>
      <input type="text" name="${key}" value="${escapeHtml(inputValue)}" placeholder="${escapeHtml(placeholder)}">
    `;
    })
    .join("");

  res.send(
    layout(
      "Panel",
      `
    <a class="logout" href="#" onclick="document.getElementById('logoutForm').submit();return false;">Salir</a>
    <form id="logoutForm" method="post" action="/admin/logout" style="display:none"></form>
    <h1>Configuracion del bot</h1>
    ${ok}

    <fieldset>
      <legend>Metodo de pago en Meta</legend>
      <p class="hint">Ahi es donde Plasticos Superior carga la tarjeta con la que Meta cobra los mensajes salientes.</p>
      <a class="payment-link" href="${escapeHtml(billingUrl)}" target="_blank" rel="noopener">Ir a configurar el metodo de pago en Meta &rarr;</a>
    </fieldset>

    <form method="post" action="/admin">
      <input type="hidden" name="_csrf" value="${csrf}">
      ${fieldsHtml}

      <fieldset>
        <legend>Avanzado</legend>
        <label>${FIELD_LABELS.META_BILLING_URL}</label>
        <input type="text" name="META_BILLING_URL" value="${escapeHtml(values.META_BILLING_URL)}" placeholder="https://business.facebook.com/billing_hub/payment_methods/">
        <p class="hint">Si Meta cambia la pantalla, pegá acá la URL exacta de "Métodos de pago" de la cuenta de WhatsApp.</p>
      </fieldset>

      <button type="submit">Guardar y reiniciar el bot</button>
    </form>
  `
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
