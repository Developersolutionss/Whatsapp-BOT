const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { execFile } = require("child_process");
const { EDITABLE_KEYS, SECRET_KEYS, readEditableValues, updateEnvValues, mask } = require("./envStore");
const { buildDepartments } = require("./departments");

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

function layout(title, bodyHtml, wide) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Panel Plasticos Superior</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem 1rem; }
  .card { max-width: 640px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  .card.wide { max-width: 1080px; }
  h1 { font-size: 1.4rem; margin-top: 0; }
  label { display: block; margin: 1rem 0 .3rem; font-size: .9rem; color: #94a3b8; }
  input[type=text], input[type=password] { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
  input::placeholder { color: #475569; }
  button { margin-top: 1.5rem; width: 100%; padding: .8rem; border: none; border-radius: 8px; background: #22c55e; color: #052e16; font-weight: 600; font-size: 1rem; cursor: pointer; }
  button:hover { background: #16a34a; }
  .hint { font-size: .8rem; color: #64748b; margin-top: .2rem; }
  .charcount { font-size: .75rem; color: #64748b; margin-top: .2rem; text-align: right; }
  .charcount.over { color: #f87171; font-weight: 600; }
  .flash-ok { background: #14532d; color: #bbf7d0; padding: .7rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .flash-err { background: #450a0a; color: #fecaca; padding: .7rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
  a.payment-link { display: inline-block; margin-top: .3rem; color: #93c5fd; }
  .logout { float: right; font-size: .85rem; color: #94a3b8; text-decoration: none; }
  fieldset { border: 1px solid #334155; border-radius: 8px; margin-top: 1.5rem; }
  legend { padding: 0 .5rem; color: #94a3b8; font-size: .9rem; }

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
</style>
</head>
<body>
  <div class="card${wide ? " wide" : ""}">${bodyHtml}</div>
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
      const isSecret = SECRET_KEYS.has(key);
      const current = values[key];
      const placeholder = isSecret ? (current ? `Actual: ${mask(current)} (dejar en blanco para no cambiar)` : "No configurado") : "";
      const inputValue = isSecret ? "" : current;
      const previewAttr = PREVIEW_FIELDS.has(key) ? ` data-preview="${key}"` : "";
      const counter = CHAR_LIMITS[key] ? `<div class="charcount" data-counter="${key}"></div>` : "";
      return `
      <label>${FIELD_LABELS[key]}</label>
      <input type="text" name="${key}" value="${escapeHtml(inputValue)}" placeholder="${escapeHtml(placeholder)}"${previewAttr}>
      ${counter}
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
