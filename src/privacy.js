const express = require("express");

const router = express.Router();

// VERSION DE PRUEBA, NO DEFINITIVA: texto generico para poder publicar la app en Meta.
// DEBE reemplazarse por la politica oficial de Plasticos Superior (revisada por el cliente/legal).
// Meta exige una URL publica de politica de privacidad para publicar la app.
// Los datos de contacto se pueden ajustar desde el .env sin tocar el codigo.
function renderPrivacyPage() {
  const company = process.env.PRIVACY_COMPANY_NAME || "Plasticos Superior SAS";
  const phone = process.env.PRIVACY_CONTACT_PHONE || "+57 311 7406214";
  const email = process.env.PRIVACY_CONTACT_EMAIL || "";
  const updated = process.env.PRIVACY_UPDATED_AT || "13 de octubre de 2026";

  const contactEmail = email
    ? `<li>Correo electrónico: <a href="mailto:${email}">${email}</a></li>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de privacidad - ${company}</title>
<style>
  :root { --bg:#f5f7fa; --card:#fff; --text:#1f2933; --muted:#5f6b7a; --accent:#128c7e; --line:#e4e8ee; --head:#128c7e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#10151b; --card:#171e26; --text:#e6ebf1; --muted:#9aa7b5; --accent:#4cc9b0; --line:#262f3a; --head:#0b5f55; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  header { background:var(--head); color:#fff; padding:28px 16px; }
  header div, main { max-width:760px; margin:0 auto; }
  header h1 { margin:0; font-size:1.5rem; }
  header p { margin:4px 0 0; color:#fff; opacity:.9; font-size:.95rem; }
  main { padding:24px 16px 48px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px 22px; margin-bottom:16px; }
  h2 { margin:0 0 8px; font-size:1.1rem; color:var(--accent); }
  p, li { color:var(--text); }
  ul { padding-left:20px; margin:8px 0 0; }
  a { color:var(--accent); }
  footer { text-align:center; color:var(--muted); font-size:.85rem; padding-bottom:32px; }
</style>
</head>
<body>
<header><div>
  <h1>Política de privacidad</h1>
  <p>${company} · Última actualización: ${updated}</p>
</div></header>
<main>
  <section>
    <h2>1. Quiénes somos</h2>
    <p>${company} (en adelante, "la empresa") atiende a sus clientes por WhatsApp a través de un asistente automático que muestra un menú de áreas (Contabilidad, Punto de Venta, Administración, Programación y Producción) y dirige la conversación al área elegida.</p>
  </section>
  <section>
    <h2>2. Datos que recibimos</h2>
    <ul>
      <li>Tu número de teléfono de WhatsApp y el nombre de perfil que tengas configurado.</li>
      <li>El contenido de los mensajes que nos envías y la opción del menú que seleccionas.</li>
    </ul>
  </section>
  <section>
    <h2>3. Para qué los usamos</h2>
    <p>Usamos estos datos únicamente para responder tus mensajes, mostrarte el menú de áreas y ponerte en contacto con el área de la empresa que elijas. No los usamos para publicidad de terceros ni los vendemos.</p>
  </section>
  <section>
    <h2>4. Con quién se comparten</h2>
    <p>Los mensajes viajan por la plataforma WhatsApp Business (Meta Platforms), que procesa los datos según sus propias políticas. Podemos compartir tu conversación con el área interna de la empresa que atiende tu solicitud. No compartimos tus datos con otros terceros salvo obligación legal.</p>
  </section>
  <section>
    <h2>5. Conservación y seguridad</h2>
    <p>El asistente automático no guarda historial de conversaciones ni bases de datos propias. Los datos permanecen en WhatsApp y en los canales de atención de la empresa solo el tiempo necesario para atenderte. Aplicamos medidas razonables para proteger la información.</p>
  </section>
  <section>
    <h2>6. Tus derechos</h2>
    <p>Conforme a la Ley 1581 de 2012 de Colombia, puedes conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales, así como revocar tu autorización. Para ejercer estos derechos o pedir la eliminación de tus datos, contáctanos:</p>
    <ul>
      <li>WhatsApp: ${phone}</li>
      ${contactEmail}
    </ul>
  </section>
  <section>
    <h2>7. Cambios a esta política</h2>
    <p>Podemos actualizar esta política. La versión vigente siempre estará disponible en esta página.</p>
  </section>
</main>
<footer>© ${new Date().getFullYear()} ${company}</footer>
</body>
</html>`;
}

router.get(["/privacidad", "/privacy"], (_req, res) => {
  res.type("html").send(renderPrivacyPage());
});

module.exports = router;
