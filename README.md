# Plasticos Superior - WhatsBot

Webhook en Node.js/Express que atiende mensajes de WhatsApp (Meta Cloud API),
muestra un menu con los 4 departamentos y responde con el link directo
(`wa.me/...`) del area elegida.

## 1. Requisitos previos (los hace el cliente / vos con acceso a su cuenta)

- Numero de WhatsApp Business verificado en Meta Business Suite.
- App de Meta creada en developers.facebook.com con el producto **WhatsApp** agregado.
- Token de acceso (idealmente un **token permanente de System User**, no el temporal de 24h).
- El **Phone Number ID** (Meta > WhatsApp > API Setup).
- Los 4 numeros de destino en formato E.164 sin el "+" (ej: `573001234567`).

## 2. Instalacion local

```bash
npm install
cp .env.example .env
# completar .env con token, phone number id, verify token y los 4 numeros
npm run dev
```

## 3. Despliegue en VPS propio

1. **Servidor**: cualquier VPS con Node 18+ (Ubuntu 22.04 recomendado).
2. Clonar el repo y correr `npm install --production`.
3. Ejecutar el proceso con un gestor persistente, por ejemplo PM2:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name plasticos-whatsbot
   pm2 save
   pm2 startup
   ```
4. **Nginx como reverse proxy** (necesario porque Meta exige HTTPS publico):
   ```nginx
   server {
       server_name bot.tudominio.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
5. **Certificado SSL** con Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d bot.tudominio.com
   ```
6. Confirmar que `https://bot.tudominio.com/` responde "Plasticos Superior WhatsBot activo".

## 4. Configurar el webhook en Meta

En Meta App Dashboard > WhatsApp > Configuration:

- **Callback URL**: `https://bot.tudominio.com/webhook`
- **Verify Token**: el mismo valor que pusiste en `VERIFY_TOKEN` del `.env`
- Suscribirse al campo `messages`

Meta hara un GET a `/webhook` para validar el `VERIFY_TOKEN` antes de guardar la configuracion.

## 5. Flujo del bot

1. Cliente escribe cualquier mensaje al numero principal.
2. El bot responde con una lista interactiva (menu) de 4 departamentos
   (Contabilidad, Punto de Venta, Administracion, Programacion y Produccion).
   Se usa "list message" en vez de "reply buttons" porque WhatsApp limita
   los botones a 3 y hay 4 departamentos.
3. El cliente toca una opcion -> llega como `interactive.list_reply.id`.
4. El bot responde con un mensaje de confirmacion + link `wa.me/<numero>` del
   departamento correspondiente, para que el cliente siga la conversacion
   directo con esa area.

## 6. Personalizacion

- Textos de bienvenida y nombres de boton: variables `WELCOME_*` en `.env`.
- Nombres/descripciones de cada departamento: [src/departments.js](src/departments.js).
- Numeros de destino: variables `DEPT_*` en `.env`.
