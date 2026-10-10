const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");

// Campos de negocio editables desde el panel. Deliberadamente NO incluye
// PORT (rompe el proxy de Nginx) ni ADMIN_USERNAME/ADMIN_PASSWORD_HASH/
// SESSION_SECRET (credenciales del propio panel, se cambian aparte).
const EDITABLE_KEYS = [
  "WHATSAPP_TOKEN",
  "PHONE_NUMBER_ID",
  "VERIFY_TOKEN",
  "DEPT_CONTABILIDAD",
  "DEPT_PUNTO_DE_VENTA",
  "DEPT_ADMINISTRACION",
  "DEPT_PROGRAMACION_PRODUCCION",
  "WELCOME_HEADER",
  "WELCOME_BODY",
  "WELCOME_BUTTON_TEXT",
  "META_BILLING_URL",
];

const SECRET_KEYS = new Set(["WHATSAPP_TOKEN", "VERIFY_TOKEN"]);

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

module.exports = { EDITABLE_KEYS, SECRET_KEYS, readEditableValues, updateEnvValues, mask };
