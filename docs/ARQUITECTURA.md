# Arquitectura

## Componentes

```
Cliente WhatsApp
      |
      v
Meta Cloud API (WhatsApp Business Platform)
      |  webhook (HTTPS POST)
      v
Nginx (bot.plasticos-superior.com) --> proxy_pass --> Node/Express (puerto interno)
      |
      v
PM2 (proceso persistente, restart automatico)
```

El bot es un servicio stateless: no guarda historial de conversacion ni base
de datos. Cada mensaje entrante se procesa de forma independiente.

## Codigo

### `src/index.js`

Servidor Express con dos rutas:

- `GET /webhook`: usada una sola vez por Meta para verificar el webhook.
  Responde el `hub.challenge` si `hub.verify_token` coincide con
  `VERIFY_TOKEN` del `.env`.
- `POST /webhook`: recibe los eventos de mensajes. Responde `200` de
  inmediato (Meta lo exige) y despues procesa el mensaje de forma asincrona:
  - Si es una respuesta de la lista (`interactive.list_reply`), busca el
    departamento por `id` y manda la confirmacion con el link `wa.me`.
  - Para cualquier otro mensaje entrante, manda el menu de departamentos.

### `src/whatsapp.js`

Wrapper fino sobre la Graph API de Meta (`graph.facebook.com/v21.0`):

- `sendText(to, body)`: mensaje de texto simple.
- `sendDepartmentMenu(to, departments)`: manda un mensaje `interactive` tipo
  `list` (no `button`, porque WhatsApp limita los reply buttons a 3 y hay 4
  departamentos).
- `sendDepartmentConfirmation(to, department)`: texto con el link
  `https://wa.me/<numero>` del departamento.

### `src/departments.js`

Catalogo estatico de los 4 departamentos. Cada uno tiene:

- `id`: usado como identificador de la fila en la lista interactiva (debe
  ser unico).
- `title`: **maximo 24 caracteres** (limite duro de WhatsApp para list rows,
  error `131009` si se pasa).
- `description`: hasta 72 caracteres, texto secundario debajo del titulo.
- `phone`: numero de destino (viene de las variables `DEPT_*` del `.env`).

## Por que "list message" y no "reply buttons"

WhatsApp permite maximo 3 "Interactive Reply Buttons" por mensaje. Como el
negocio tiene 4 departamentos, se uso un "list message" (menu desplegable),
que soporta hasta 10 filas en una sola seccion.

## Por que el link `wa.me` a otro numero (y no todo en un solo numero)

Se evaluaron dos disenos:

- **Opcion A (la implementada)**: el bot vive en un numero principal y cada
  departamento tiene su propio numero de WhatsApp. Simple, sin
  infraestructura adicional. Es lo que pidio el cliente originalmente.
- **Opcion B (no implementada)**: todo en un solo numero, con una bandeja
  compartida (tipo Chatwoot) donde cada area responde desde el mismo numero
  via API. Requiere una base de datos, panel de administracion y logica de
  asignacion de conversaciones — mucho mas trabajo de desarrollo.

Se decidio seguir con la Opcion A por ser la que el cliente pidio y no
requerir infraestructura extra.
