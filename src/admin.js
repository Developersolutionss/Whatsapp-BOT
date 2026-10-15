const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { execFile } = require("child_process");
const { EDITABLE_KEYS, readEditableValues, updateEnvValues, updateAdminPasswordHash } = require("./envStore");
const { buildDepartments } = require("./departments");
const stats = require("./stats");

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
  .logout { float: right; font-size: .85rem; color: var(--muted); text-decoration: none; }
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
  .panel-logo { height: 36px; width: auto; border-radius: 6px; background: #f1f1ef; padding: 3px 6px; }
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
    <div class="login-logo-plate"><img src="/logo.jpeg" alt="Plasticos Superior San Judas SAS"></div>
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
  const pwOk = req.query.pw === "ok" ? `<div class="flash-ok">Contrasena actualizada.</div>` : "";
  const pwErr = req.query.pw === "err" ? `<div class="flash-err">La contrasena actual no es correcta, o la nueva no coincide.</div>` : "";

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
    <a class="logout" href="#" onclick="document.getElementById('logoutForm').submit();return false;">Salir</a>
    <form id="logoutForm" method="post" action="/admin/logout" style="display:none"></form>
    <div class="panel-header">
      <img src="/logo.jpeg" alt="Plasticos Superior San Judas SAS" class="panel-logo">
      <h1>Configuracion del bot</h1>
    </div>
    ${ok}
    ${pwOk}
    ${pwErr}

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

    <fieldset>
      <legend>Cambiar contrasena</legend>
      <form method="post" action="/admin/change-password">
        <input type="hidden" name="_csrf" value="${csrf}">
        <label>Contrasena actual</label>
        <input type="password" name="current_password" autocomplete="current-password" required>
        <label>Contrasena nueva</label>
        <input type="password" name="new_password" autocomplete="new-password" required minlength="8">
        <label>Repetir contrasena nueva</label>
        <input type="password" name="new_password_confirm" autocomplete="new-password" required minlength="8">
        <button type="submit">Cambiar contrasena</button>
      </form>
    </fieldset>

    <div class="layout-grid">
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
  const newOk =
    typeof new_password === "string" &&
    new_password.length >= 8 &&
    new_password === new_password_confirm;

  if (!currentOk || !newOk) {
    return res.redirect("/admin?pw=err");
  }

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
