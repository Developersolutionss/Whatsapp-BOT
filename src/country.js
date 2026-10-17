// Deteccion de pais por prefijo telefonico (formato E.164 sin "+", como llega de WhatsApp).
// Mapa basico: [prefijo, nombre, ISO-2]. Se busca el prefijo mas largo que coincida
// (ej. "1809" -> Rep. Dominicana antes que "1" -> EE. UU./Canada).
const PREFIXES = [
  ["1", "EE. UU. / Canada", "US"], ["1787", "Puerto Rico", "PR"], ["1809", "Rep. Dominicana", "DO"],
  ["1829", "Rep. Dominicana", "DO"], ["1849", "Rep. Dominicana", "DO"],
  ["34", "Espana", "ES"], ["44", "Reino Unido", "GB"], ["33", "Francia", "FR"], ["39", "Italia", "IT"],
  ["49", "Alemania", "DE"], ["351", "Portugal", "PT"], ["55", "Brasil", "BR"],
  ["52", "Mexico", "MX"], ["53", "Cuba", "CU"], ["54", "Argentina", "AR"], ["56", "Chile", "CL"],
  ["57", "Colombia", "CO"], ["58", "Venezuela", "VE"], ["51", "Peru", "PE"], ["591", "Bolivia", "BO"],
  ["593", "Ecuador", "EC"], ["595", "Paraguay", "PY"], ["598", "Uruguay", "UY"],
  ["502", "Guatemala", "GT"], ["503", "El Salvador", "SV"], ["504", "Honduras", "HN"],
  ["505", "Nicaragua", "NI"], ["506", "Costa Rica", "CR"], ["507", "Panama", "PA"],
  ["86", "China", "CN"], ["91", "India", "IN"], ["81", "Japon", "JP"],
].sort((a, b) => b[0].length - a[0].length);

function flagEmoji(iso) {
  return [...iso].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

// Devuelve { name, flag } o { name: "Desconocido", flag: "" } si no hay coincidencia.
function detectCountry(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const hit = PREFIXES.find(([prefix]) => digits.startsWith(prefix));
  if (!hit) return { name: "Desconocido", flag: "" };
  return { name: hit[1], flag: flagEmoji(hit[2]) };
}

module.exports = { detectCountry };
