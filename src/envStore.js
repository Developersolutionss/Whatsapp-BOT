const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");

// Campos de negocio editables desde el panel. Deliberadamente NO incluye
// WHATSAPP_TOKEN, PHONE_NUMBER_ID ni VERIFY_TOKEN (son credenciales tecnicas
// de Meta: si el cliente las toca y las rompe, el bot deja de recibir o
// mandar mensajes), ni PORT (rompe el proxy de Nginx), ni
// ADMIN_USERNAME/ADMIN_PASSWORD_HASH/SESSION_SECRET (credenciales del propio
// panel; la contrasena se cambia con su propio formulario, ver
// updateAdminPasswordHash). Esos campos solo se tocan a mano en el .env del
// servidor.
const EDITABLE_KEYS = [
  "DEPT_CONTABILIDAD",
  "DEPT_PUNTO_DE_VENTA",
  "DEPT_ADMINISTRACION",
  "DEPT_PROGRAMACION_PRODUCCION",
  "WELCOME_HEADER",
  "WELCOME_BODY",
  "WELCOME_BUTTON_TEXT",
  "META_BILLING_URL",
];

const SECRET_KEYS = new Set();

function parseEnvFile() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const lines = raw.split("\n");
  const values = {};
  lines.forEach((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  });
  return { lines, values };
}

function readEditableValues() {
  const { values } = parseEnvFile();
  const result = {};
  EDITABLE_KEYS.forEach((key) => {
    result[key] = values[key] || "";
  });
  return result;
}

function mask(value) {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

// updates: objeto { KEY: nuevoValor }. Un valor vacio para una clave secreta
// significa "no cambiar" (asi el formulario puede mostrar el campo vacio sin
// borrar el token actual si el admin no lo toca).
function updateEnvValues(updates) {
  const { lines, values } = parseEnvFile();
  const next = { ...values };

  Object.keys(updates).forEach((key) => {
    if (!EDITABLE_KEYS.includes(key)) return;
    const incoming = updates[key];
    if (SECRET_KEYS.has(key) && incoming === "") return; // no tocar si lo dejaron en blanco
    next[key] = incoming;
  });

  const seen = new Set();
  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=.*$/);
    if (!match) return line;
    const key = match[1];
    if (!(key in next)) return line;
    seen.add(key);
    return `${key}=${next[key]}`;
  });

  Object.keys(next).forEach((key) => {
    if (!seen.has(key) && EDITABLE_KEYS.includes(key)) {
      newLines.push(`${key}=${next[key]}`);
    }
  });

  fs.writeFileSync(ENV_PATH, newLines.join("\n"));
}

// Cambia unicamente ADMIN_PASSWORD_HASH. Separado de updateEnvValues a
// proposito: este campo nunca debe quedar expuesto en el formulario generico
// del panel, solo accesible desde el flujo dedicado de "cambiar contrasena".
function updateAdminPasswordHash(hash) {
  const { lines, values } = parseEnvFile();
  let found = false;
  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=.*$/);
    if (match && match[1] === "ADMIN_PASSWORD_HASH") {
      found = true;
      return `ADMIN_PASSWORD_HASH=${hash}`;
    }
    return line;
  });
  if (!found) newLines.push(`ADMIN_PASSWORD_HASH=${hash}`);
  fs.writeFileSync(ENV_PATH, newLines.join("\n"));
  process.env.ADMIN_PASSWORD_HASH = hash; // aplica sin reiniciar el proceso
}

module.exports = { EDITABLE_KEYS, SECRET_KEYS, readEditableValues, updateEnvValues, updateAdminPasswordHash, mask };
