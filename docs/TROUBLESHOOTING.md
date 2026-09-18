# Troubleshooting

Errores reales encontrados durante el desarrollo y como se resolvieron.

## El bot no responde nada

Orden de diagnostico:

1. **¿El proceso esta corriendo?**
   ```bash
   pm2 describe plasticos-superior-whatsbot
   ```
   Deberia decir `status: online`.

2. **¿El mensaje llega al servidor?** Revisar si hay un `POST /webhook` en
   el access log de Nginx:
   ```bash
   tail -n 30 /var/log/nginx/plasticos-superior-whatsbot_access.log
   ```
   - Si **no aparece ningun POST**: el problema esta en la configuracion de
     Meta, no en el servidor. Ver "Webhook configurado pero no llega nada"
     abajo.
   - Si **si aparece** con `200`, el servidor si recibio el mensaje. Seguir
     al paso 3.

3. **¿Fallo al responder?** Revisar el log de errores:
   ```bash
   pm2 logs plasticos-superior-whatsbot --err --lines 50 --nostream
   ```
   Buscar el codigo de error de Meta (ver tabla abajo).

## Webhook configurado pero no llega nada al servidor (sin errores, sin logs)

**Causa real encontrada en este proyecto**: guardar la URL del webhook en la
pantalla de Meta no siempre suscribe tu app a la WABA. La WABA puede quedar
suscrita a la app interna de pruebas de Meta ("WA DevX Webhook Events 1P
App"), que es la que alimenta el panel "Revisa los webhooks de prueba" del
dashboard — por eso ese panel muestra actividad aunque tu servidor no reciba
nada.

Diagnostico:

```bash
curl -s "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <TOKEN>"
```

Si tu app no aparece en la lista, suscribila:

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <TOKEN>"
```

## Codigos de error de la API de WhatsApp

| Codigo | Mensaje | Causa | Solucion |
| --- | --- | --- | --- |
| `131009` | Parameter value is not valid / Row title is too long | Un titulo de fila de la lista interactiva supera los 24 caracteres | Acortar el `title` en `src/departments.js` (la descripcion permite hasta 72) |
| `190` | Session has expired | El access token temporal (24h) vencio | Generar un token nuevo (idealmente uno permanente de System User, ver [META_SETUP.md](META_SETUP.md)) |
| `131005` | Access denied / There was a problem with the access token or permissions | Restriccion de la cuenta/numero de prueba (no siempre es el token) | Ver seccion siguiente |

## Error 131005 "Access denied" con un token valido

Sintoma: `debug_token` muestra el token como valido y con los permisos
correctos, pero cualquier intento de enviar un mensaje (incluso texto
plano, incluso desde la propia consola de Meta en el navegador) devuelve
`131005`.

Esto paso en este proyecto con el **numero de prueba** despues de varias
rondas de pruebas. El token no era el problema (se probo con varios tokens
nuevos, mismo resultado, incluso fallando directo desde la UI de Meta). La
causa mas probable es una restriccion propia de los numeros de prueba de
cuentas **sin verificar el negocio** (`business_verification_status:
not_verified`), que limitan la cantidad de mensajes de prueba antes de
exigir la verificacion.

**No se encontro una forma de destrabar esto sin migrar a un numero real o
completar la verificacion del negocio.** Si te encontras con este error:

1. Confirmar que no es el token (probar `debug_token` y reintentar con uno
   nuevo).
2. Confirmar que el numero de destino esta agregado como destinatario de
   prueba.
3. Si ambas cosas estan bien, es probable que sea la restriccion de cuenta
   sin verificar — pasar al numero real de produccion o completar la
   verificacion del negocio (ver [META_SETUP.md](META_SETUP.md) y
   [CLIENT_CHECKLIST.md](CLIENT_CHECKLIST.md)).

## El token vence cada 24 horas

Si estas usando el token generado desde la pantalla rapida de "Pruebalo",
es esperable — dura 24h por diseno. La solucion definitiva es generar un
**token permanente de System User** (ver [META_SETUP.md](META_SETUP.md),
seccion 5), no seguir regenerando el temporal.
