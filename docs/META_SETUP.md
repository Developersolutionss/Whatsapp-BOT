# Configuracion de Meta / WhatsApp Cloud API

Guia paso a paso, basada en lo que se hizo realmente para este proyecto.

## 1. Cuenta y Business Manager

1. Cuenta personal de Facebook del admin.
2. Crear un **Business Portfolio** dedicado para el cliente en
   business.facebook.com (no reutilizar el de la agencia si el cliente va a
   ser dueno de su propia cuenta de WhatsApp a futuro).

## 2. Crear la app de Meta

1. developers.facebook.com/apps -> **Crear app**.
2. Tipo de uso: **Empresa**.
3. Caso de uso: **"Conectarte con los clientes a traves de WhatsApp"**.
4. Al configurar el caso de uso, elegir el **Business Portfolio** correcto
   en el selector (si no aparece el que queres, hay que crearlo primero en
   business.facebook.com y volver a esta pantalla).
5. Tipo de integracion: **"Integrar con la API"** (no "Conviertete en
   socio").

## 3. Numero de prueba (para probar antes de tener el numero real)

1. En el asistente, **Paso 1: Pruebalo** -> "Solicitar numero de prueba".
   Esto genera un numero temporal de Meta, un **Phone Number ID** y permite
   generar un **token de acceso temporal (dura 24h)**.
2. Agregar tu numero personal como **destinatario de prueba** (maximo 5
   numeros). Los numeros de prueba solo pueden interactuar con destinatarios
   agregados explicitamente ahi.
3. Enviar el mensaje de prueba desde esa pantalla para confirmar que la
   conexion funciona.

## 4. Conectar el webhook

En **Paso 2: Configuracion de produccion** -> **Configurar webhooks**:

- **URL de devolucion de llamada**: `https://bot.plasticos-superior.com/webhook`
- **Token de verificacion**: el valor de `VERIFY_TOKEN` en el `.env` del
  servidor.
- Dejar apagado el toggle de "certificado de cliente" (no se usa).
- "Verificar y guardar".

### Gotcha importante: suscribir la app a la WABA

Guardar la URL del webhook **no siempre alcanza**. Meta puede dejar la WABA
suscrita a su propia app interna de pruebas ("WA DevX Webhook Events 1P
App") en vez de a la app que creaste, y en ese caso tu servidor nunca recibe
nada aunque la verificacion GET haya funcionado.

Para confirmar y arreglarlo, desde el servidor (con el token y el WABA ID):

```bash
# Ver que apps estan suscritas a la WABA
curl -s "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <TOKEN>"

# Suscribir la app actual (la del token) a la WABA
curl -s -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <TOKEN>"
```

Despues de esto, el listado deberia mostrar tu app junto a la de Meta.

## 5. Token permanente (System User)

El token que se genera desde la pantalla de "Pruebalo" es temporal (24h) y
pensado solo para copiar y pegar en ejemplos rapidos — no es apto para
produccion. Para un token que no vence:

1. business.facebook.com -> **Configuracion del negocio** -> **Usuarios** ->
   **Usuarios del sistema**.
2. **Agregar** -> nombre (ej. `whatsbot-system-user`) -> rol **Admin**.
3. Click en el usuario creado -> **Agregar activos** -> pestana **Cuentas de
   WhatsApp** -> seleccionar la WABA -> **Control total**.
4. **Generar nuevo token** -> elegir la app -> marcar los permisos
   `whatsapp_business_messaging` y `whatsapp_business_management` ->
   **Generar token**.
5. Copiar el token y cargarlo en `WHATSAPP_TOKEN` del `.env` del servidor
   (ver [DEPLOYMENT.md](DEPLOYMENT.md)).

> Nota: en este proyecto se genero un token con el flujo rapido varias
> veces para destrabar demos, pero termino mostrando errores `131005`
> "Access denied" en el numero de prueba (ver
> [TROUBLESHOOTING.md](TROUBLESHOOTING.md)). El token de System User es el
> camino correcto y estable.

## 6. Pasar al numero real del negocio

En **Paso 2: Configuracion de produccion** -> "Registra tu numero de
telefono de WhatsApp":

1. Agregar el numero real del negocio.
2. **Importante**: ese numero no puede estar activo en la app normal de
   WhatsApp al mismo tiempo — hay que sacarlo de ahi primero (ver
   [CLIENT_CHECKLIST.md](CLIENT_CHECKLIST.md)).
3. Verificar por SMS o llamada.
4. Actualizar `PHONE_NUMBER_ID` en el `.env` del servidor con el ID del
   numero real.

## 7. Verificacion del negocio

Paso 3 del asistente. Pide datos legales de la empresa (nombre legal, NIT,
tipo de entidad, direccion). No es obligatorio para que el bot funcione en
modo prueba, pero si para:

- Subir el limite de mensajes salientes por dia.
- Publicar la app (salir de "modo desarrollo").
- Evitar restricciones de envio en el numero de produccion.

Ver el detalle de que datos juntar en [CLIENT_CHECKLIST.md](CLIENT_CHECKLIST.md).
