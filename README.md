# Plasticos Superior - WhatsBot

Webhook en Node.js/Express que atiende mensajes de WhatsApp (Meta Cloud API),
muestra un menu con los 4 departamentos del negocio y responde con el link
directo (`wa.me/...`) del area elegida.

## Estado actual

- Infraestructura desplegada y funcionando (VPS + Nginx + HTTPS + PM2).
- App de Meta creada, webhook conectado y probado con el numero de prueba.
- Pendiente: numero real del negocio, token permanente y verificacion del
  negocio ante Meta. Ver [docs/CLIENT_CHECKLIST.md](docs/CLIENT_CHECKLIST.md)
  para la lista completa de lo que falta que entregue el cliente.

## Documentacion

| Archivo | Contenido |
| --- | --- |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Como funciona el bot, flujo de mensajes, estructura del codigo |
| [docs/META_SETUP.md](docs/META_SETUP.md) | Guia paso a paso para configurar la app de Meta y WhatsApp Cloud API desde cero |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Como esta desplegado en el VPS y como actualizar el bot en produccion |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Errores conocidos y como resolverlos |
| [docs/CLIENT_CHECKLIST.md](docs/CLIENT_CHECKLIST.md) | Datos que debe entregar Plasticos Superior para pasar a produccion |

## Instalacion local (desarrollo)

```bash
npm install
cp .env.example .env
# completar .env con token, phone number id, verify token y los 4 numeros
npm run dev
```

## Estructura del proyecto

```
src/
  index.js         Servidor Express: verificacion del webhook + recepcion de mensajes
  whatsapp.js       Llamadas a la Cloud API (mandar menu, mandar confirmacion)
  departments.js    Catalogo de los 4 departamentos (id, titulo, descripcion, telefono)
.env.example        Variables de entorno necesarias, con comentarios
docs/               Documentacion detallada (ver tabla arriba)
```

## Flujo del bot

1. El cliente le escribe cualquier mensaje al numero de WhatsApp del bot.
2. El bot responde con una **lista interactiva** (menu) de los 4 departamentos:
   Contabilidad, Punto de Venta, Administracion, Programacion y Produccion.
   Se usa "list message" en vez de "reply buttons" porque WhatsApp limita los
   botones a 3 opciones y hay 4 departamentos.
3. El cliente toca una opcion -> llega al webhook como `interactive.list_reply.id`.
4. El bot responde con un mensaje de confirmacion + link `wa.me/<numero>` del
   departamento elegido, para que el cliente siga la conversacion directo con
   esa area.

Mas detalle tecnico en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Personalizacion

- Textos de bienvenida: variables `WELCOME_*` en `.env`.
- Nombres/descripciones de cada departamento: [src/departments.js](src/departments.js)
  (ojo: WhatsApp limita el titulo de cada fila de la lista a 24 caracteres).
- Numeros de destino: variables `DEPT_*` en `.env`.
