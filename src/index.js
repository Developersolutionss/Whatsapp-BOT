// override: true porque PM2 reusa el entorno del proceso anterior entre
// restarts; sin esto, un valor viejo que ya este en process.env (ej. de un
// PHONE_NUMBER_ID anterior) le gana silenciosamente al valor nuevo del
// archivo .env, que es la fuente de verdad real.
require("dotenv").config({ override: true });
const path = require("path");
const express = require("express");
const session = require("express-session");
const { buildDepartments } = require("./departments");
const {
  sendDepartmentMenu,
  sendDepartmentConfirmation,
  sendText,
} = require("./whatsapp");
const adminRouter = require("./admin");
const privacyRouter = require("./privacy");
const stats = require("./stats");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "wb_admin_sid",
    secret: process.env.SESSION_SECRET || "cambia-esto-en-produccion",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 4 },
  })
);
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "7d" }));
app.use("/admin", adminRouter);
app.use(privacyRouter); // /privacidad: Meta exige una URL publica de politica de privacidad

// --- Verificacion del webhook (Meta hace un GET una sola vez al configurarlo) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Recepcion de mensajes entrantes ---
app.post("/webhook", async (req, res) => {
  // Responder rapido a Meta; el procesamiento no debe bloquear la respuesta HTTP
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return; // eventos de status (delivered/read), ignorar

    const from = message.from;
    stats.recordIncoming(from);
    const departments = buildDepartments();

    if (message.type === "interactive" && message.interactive?.type === "list_reply") {
      const selectedId = message.interactive.list_reply.id;
      const department = departments.find((d) => d.id === selectedId);

      if (department && department.phone) {
        await sendDepartmentConfirmation(from, department);
      } else {
        await sendText(from, "No pude identificar esa opcion, escribi 'menu' para volver a intentar.");
      }
      return;
    }

    // Cualquier otro mensaje (texto, boton no reconocido, etc.) muestra el menu
    await sendDepartmentMenu(from, departments);
  } catch (err) {
    console.error("Error procesando mensaje entrante:", err.response?.data || err.message);
  }
});

app.get("/", (_req, res) => res.send("Plasticos Superior WhatsBot activo"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
