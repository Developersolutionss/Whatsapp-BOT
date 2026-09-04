const axios = require("axios");

const GRAPH_VERSION = "v21.0";

function client() {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  return axios.create({
    baseURL: `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

async function sendText(to, body) {
  return client().post("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

// WhatsApp permite maximo 3 "reply buttons" por mensaje. Con 4 departamentos
// usamos un "list message", que soporta hasta 10 filas en una sola seccion.
async function sendDepartmentMenu(to, departments) {
  const header = process.env.WELCOME_HEADER || "Menu";
  const body =
    process.env.WELCOME_BODY ||
    "Elegi el area con la que queres comunicarte:";
  const buttonText = process.env.WELCOME_BUTTON_TEXT || "Ver opciones";

  return client().post("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      action: {
        button: buttonText,
        sections: [
          {
            title: "Departamentos",
            rows: departments.map((d) => ({
              id: d.id,
              title: d.title,
              description: d.description,
            })),
          },
        ],
      },
    },
  });
}

async function sendDepartmentConfirmation(to, department) {
  const link = `https://wa.me/${department.phone}`;
  const body = `Te comunico con *${department.title}*.\nEscribile directamente aca: ${link}`;
  return sendText(to, body);
}

module.exports = { sendText, sendDepartmentMenu, sendDepartmentConfirmation };
