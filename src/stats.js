const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MAX_EVENTS = 500; // historial de movimientos que se conserva
const STATS_PATH = path.join(DATA_DIR, "stats.json");

function loadStats() {
  try {
    const raw = fs.readFileSync(STATS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { totalIncoming: 0, totalOutgoing: 0, contacts: {}, events: [], ...parsed };
  } catch {
    return { totalIncoming: 0, totalOutgoing: 0, contacts: {}, events: [] };
  }
}

function saveStats(stats) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

// Se llama una vez por cada mensaje entrante del cliente (antes de responder).
// area: nombre del departamento elegido, o null si solo escribio / abrio el menu.
function recordIncoming(phone, area = null) {
  if (!phone) return;
  const stats = loadStats();
  stats.totalIncoming += 1;
  const now = new Date().toISOString();
  if (!stats.contacts[phone]) {
    stats.contacts[phone] = { firstSeen: now, lastSeen: now, messageCount: 1 };
  } else {
    stats.contacts[phone].lastSeen = now;
    stats.contacts[phone].messageCount += 1;
  }
  stats.events.push({ at: now, phone, area });
  if (stats.events.length > MAX_EVENTS) stats.events = stats.events.slice(-MAX_EVENTS);
  saveStats(stats);
}

// Se llama una vez por cada mensaje que el bot manda exitosamente via la API.
function recordOutgoing() {
  const stats = loadStats();
  stats.totalOutgoing += 1;
  saveStats(stats);
}

function getSummary(limit = 50, eventsLimit = 100) {
  const stats = loadStats();
  const contacts = Object.entries(stats.contacts)
    .map(([phone, c]) => ({ phone, ...c }))
    .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    totalIncoming: stats.totalIncoming,
    totalOutgoing: stats.totalOutgoing,
    totalContacts: contacts.length,
    newContactsLast24h: contacts.filter((c) => new Date(c.firstSeen).getTime() >= dayAgo).length,
    newContactsLast7d: contacts.filter((c) => new Date(c.firstSeen).getTime() >= weekAgo).length,
    contacts: contacts.slice(0, limit),
    events: [...stats.events].reverse().slice(0, eventsLimit),
  };
}

module.exports = { recordIncoming, recordOutgoing, getSummary };
