# Deployment

## Infraestructura actual

El bot corre en un **VPS Linux compartido** (Ubuntu) junto con otros
proyectos de la agencia, bajo PM2 + Nginx.

| Item | Valor |
| --- | --- |
| Servidor | `76.13.126.35` |
| Directorio del proyecto | `/var/www/plasticos-superior-whatsbot` |
| Proceso PM2 | `plasticos-superior-whatsbot` |
| Puerto interno | `3003` |
| Dominio | `bot.plasticos-superior.com` |
| Nginx site | `/etc/nginx/sites-available/plasticos-superior-whatsbot` |
| SSL | Let's Encrypt (Certbot), autorenovacion configurada |
| Repo | https://github.com/Developersolutionss/Whatsapp-BOT |

> El servidor es compartido con otros proyectos (aquakids, arenas_sport,
> vinos_adelina, steban-api, inventario-despachos, devsolutions-app). Cualquier
> comando de PM2/Nginx debe apuntar explicitamente a este proyecto — nunca
> usar comandos globales o wildcards que puedan afectar a los demas.

## Primer deploy (ya hecho)

1. `git clone` del repo a `/var/www/plasticos-superior-whatsbot`.
2. `npm install --omit=dev`.
3. Se subio el `.env` manualmente (no esta en git, ver `.env.example`).
4. `pm2 start src/index.js --name plasticos-superior-whatsbot` + `pm2 save`.
5. Nginx: server block en el puerto 80, `proxy_pass http://127.0.0.1:3003`,
   symlink a `sites-enabled`, `nginx -t`, `systemctl reload nginx`.
6. `certbot --nginx -d bot.plasticos-superior.com` (dominio explicito, nunca
   `certbot --nginx` a secas en un servidor compartido).

## Actualizar el bot (deploys posteriores)

Para este proyecto, al ser un servicio simple sin build ni migraciones de
base de datos, alcanza con un `git pull` + restart:

```bash
ssh 76.13.126.35
cd /var/www/plasticos-superior-whatsbot
git pull origin main
npm install --omit=dev   # solo si cambiaron dependencias
pm2 restart plasticos-superior-whatsbot --update-env
```

`--update-env` es necesario si cambiaste variables en el `.env`.

## Actualizar variables de entorno

```bash
ssh 76.13.126.35
cd /var/www/plasticos-superior-whatsbot
nano .env   # o sed para un cambio puntual
pm2 restart plasticos-superior-whatsbot --update-env
```

## Verificar que todo esta bien

```bash
# El servicio responde
curl -s https://bot.plasticos-superior.com/

# El proceso esta online
pm2 describe plasticos-superior-whatsbot

# No hay errores recientes
pm2 logs plasticos-superior-whatsbot --err --lines 50 --nostream

# El token de WhatsApp sigue siendo valido
cd /var/www/plasticos-superior-whatsbot
TOKEN=$(grep '^WHATSAPP_TOKEN=' .env | cut -d= -f2)
PHONE_ID=$(grep '^PHONE_NUMBER_ID=' .env | cut -d= -f2)
curl -s "https://graph.facebook.com/v21.0/${PHONE_ID}?fields=display_phone_number" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Notas del entorno compartido

- No usar `pm2 restart all`, `nginx -s reload` sin antes correr `nginx -t`, ni
  `certbot --nginx` sin `-d <dominio>` explicito — todos afectan a los demas
  proyectos del servidor.
- Antes de tocar algo, revisar que ya existe con `pm2 jlist` y
  `ls /etc/nginx/sites-enabled/`.
