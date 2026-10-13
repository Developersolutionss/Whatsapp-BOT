# Guia de configuracion del bot — Plasticos Superior

Tutorial completo y autocontenido para dejar el bot funcionando, ya sea con
el numero de WhatsApp que el cliente lleva usando hace tiempo (el de la app
normal / WhatsApp Business), o con un numero nuevo dedicado a la API. Cierra
con el manual de uso del panel de administracion (`/admin`).

> Los demas documentos de `docs/` (`META_SETUP.md`, `DEPLOYMENT.md`,
> `CLIENT_CHECKLIST.md`, `TROUBLESHOOTING.md`, `ARQUITECTURA.md`) siguen
> siendo validos como referencia tecnica mas detallada. Esta guia los resume
> y los ordena en un solo flujo de decision para no tener que saltar entre
> archivos.

## Indice

1. [Decision inicial: numero existente o numero nuevo](#1-decision-inicial-numero-existente-o-numero-nuevo)
2. [Opcion A — Numero nuevo dedicado a la API](#2-opcion-a--numero-nuevo-dedicado-a-la-api)
3. [Opcion B — Migrar el numero principal que ya usa el cliente](#3-opcion-b--migrar-el-numero-principal-que-ya-usa-el-cliente)
4. [Token permanente (System User) — igual en ambos casos](#4-token-permanente-system-user--igual-en-ambos-casos)
5. [Cargar los datos en el servidor](#5-cargar-los-datos-en-el-servidor)
6. [Manual del panel de administracion (`/admin`)](#6-manual-del-panel-de-administracion-admin)
7. [Errores comunes](#7-errores-comunes)

---

## 1. Decision inicial: numero existente o numero nuevo

El bot usa **WhatsApp Cloud API**, que es distinta a la app normal de
WhatsApp Business que el cliente instala en un celular. Un mismo numero de
telefono **no puede estar activo en las dos a la vez**. Antes de empezar hay
que decidir con el cliente cual de los dos caminos conviene:

| | Numero nuevo (Opcion A) | Numero que ya usa (Opcion B) |
|---|---|---|
| Tiempo para arrancar | Minutos | Depende de que el cliente libere el numero |
| Riesgo | Ninguno, no se toca nada existente | Se pierde el acceso a la app de WhatsApp Business en ese numero |
| Historial de chats | No aplica (numero nuevo) | **Se pierde**. Cloud API no migra conversaciones ni contactos |
| Reputacion/antiguedad del numero | Se pierde, numero sin historial | Se conserva: el numero sigue siendo el mismo que ya conocen los clientes |
| Recomendado para | Probar el bot sin comprometer nada | Produccion final, cuando el cliente ya aprobo el flujo |

**Recomendacion:** probar siempre primero con la Opcion A (numero de prueba
de Meta, gratis e inmediato) y solo migrar el numero real del cliente
(Opcion B) cuando el bot ya este probado de punta a punta.

---

## 2. Opcion A — Numero nuevo dedicado a la API

Sirve tanto para un numero de prueba temporal de Meta como para un numero
nuevo (SIM nueva o virtual) que el cliente compre especificamente para el
bot.

### 2.1 Crear la app de Meta

1. Entrar a [developers.facebook.com/apps](https://developers.facebook.com/apps).
2. **Crear app** → Tipo de uso: **Empresa**.
3. Caso de uso: **"Conectarte con los clientes a traves de WhatsApp"**.
4. Elegir el **Business Portfolio** del cliente en el selector (si no existe
   todavia, crearlo primero en business.facebook.com).
5. Tipo de integracion: **"Integrar con la API"** (no "Conviertete en
   socio").

Si la cuenta de desarrollador pide verificar correo, telefono personal o
identidad antes de dejar crear la app, es un paso aparte de Meta y no tiene
que ver con el negocio del cliente — se hace una sola vez con el perfil
personal del admin. No hace falta pagina de Facebook ni verificacion del
negocio para este paso.

### 2.2 Numero de prueba (para arrancar hoy mismo)

1. Dentro del caso de uso, **Configuracion de la API** → ahi aparece un
   numero de prueba que Meta asigna automaticamente, con su **Phone Number
   ID** y el **WhatsApp Business Account ID (WABA ID)**.
2. En la seccion **Para** (destinatarios), agregar el numero personal de
   quien va a probar (maximo 5 numeros). Meta manda un codigo de
   verificacion por WhatsApp a ese numero.
3. El numero de prueba **solo puede responder** a los numeros agregados ahi.
   Si alguien mas escribe, el bot va a fallar con el error `131030`
   (ver [seccion 7](#7-errores-comunes)).
4. Copiar un **token temporal** (dura 24 h) desde la misma pantalla, solo
   para la prueba inicial. No usar este token en produccion.

### 2.3 Numero nuevo real (si el cliente compra una linea aparte)

1. En **Configuracion de la API** → **Administrar numeros de telefono** →
   **Agregar numero de telefono**.
2. Completar el nombre visible del negocio, categoria, descripcion.
3. Verificar por SMS o llamada.
4. Ese numero pasa a tener su propio **Phone Number ID**, distinto al de
   prueba. Usar ese ID de ahi en adelante.

Con cualquiera de los dos (prueba o numero nuevo), seguir con la
[seccion 4](#4-token-permanente-system-user--igual-en-ambos-casos).

---

## 3. Opcion B — Migrar el numero principal que ya usa el cliente

Esto aplica cuando el cliente lleva tiempo usando ese numero en la app
**WhatsApp Business** (la app de celular, no la API) y quiere que el bot
responda ahi mismo, conservando el numero.

### 3.1 Antes de tocar nada: lo que hay que advertirle al cliente

- **El historial de chats de ese numero no se puede migrar a la API.** Los
  mensajes guardados en el celular siguen ahi, pero el bot no tiene acceso a
  conversaciones pasadas ni puede exportarlas.
- **La app de WhatsApp Business en ese celular deja de recibir mensajes de
  WhatsApp** una vez el numero queda registrado en Cloud API. El negocio
  pasa a depender 100% del bot/servidor para ese numero.
- Si el cliente quiere seguir teniendo acceso humano a las conversaciones
  (no solo el bot automatico), eso requiere un agente/CRM conectado a la
  misma API (ej. un inbox tipo Chatwoot, Respond.io, Zoko, o soporte
  directo del equipo de WhatsApp Business Platform), **no viene incluido
  en este bot**. Avisarle al cliente antes de migrar, no despues.
- Recomendado: hacer un **respaldo del celular** (WhatsApp tiene su propia
  funcion de backup de chats) antes de seguir, por las dudas.

Si el cliente confirma que quiere seguir de todas formas, continuar.

### 3.2 Liberar el numero de la app de WhatsApp Business

Un numero no puede estar activo en la app normal y en la API al mismo
tiempo. Hay que sacarlo de la app **antes** de registrarlo en Meta:

1. En el celular del cliente, abrir **WhatsApp Business** → **Configuracion**
   → **Cuenta**.
2. Opcion recomendada por Meta: **Cambiar numero** a otro numero temporal, o
   **Eliminar la cuenta** si el cliente no necesita mas ese numero en la
   app. Eliminar la cuenta borra el numero de los servidores de WhatsApp
   (no solo del celular), que es justo lo que se necesita para poder
   registrarlo en la API.
3. Confirmar con el cliente que efectivamente dejo de recibir WhatsApp en
   ese celular antes de seguir (probar mandandole un mensaje de prueba
   desde otro numero).

> Si no se libera el numero primero, el siguiente paso (verificacion en
> Meta) va a fallar o va a pedir confirmar que se quiere desconectar el
> numero de donde este activo — en ese caso Meta puede ofrecer hacerlo de
> forma automatica, pero es mas seguro haberlo hecho a mano antes para
> controlar el momento exacto del corte.

### 3.3 Crear la app de Meta y registrar el numero

1. Seguir los pasos [2.1](#21-crear-la-app-de-meta) para crear la app de
   Meta (si no existe ya una para este cliente).
2. En **Configuracion de la API** → **Administrar numeros de telefono** →
   **Agregar numero de telefono**.
3. Escribir el numero real del cliente, con codigo de pais.
4. Completar perfil publico: nombre verificado del negocio, categoria,
   descripcion, direccion, sitio web, correo (ver checklist completo en
   [CLIENT_CHECKLIST.md](CLIENT_CHECKLIST.md)).
5. Verificar por SMS o llamada — el codigo llega al mismo numero que se
   esta registrando.
6. Una vez verificado, copiar el **Phone Number ID** nuevo. Reemplaza al
   que se haya usado antes para pruebas.

### 3.4 Migrar la cuenta a Cloud API (si el numero ya tenia WhatsApp Business API con otro proveedor)

Si el numero del cliente ya estaba en Cloud API o en un BSP (Business
Solution Provider) de terceros — no en la app normal, sino en otra
plataforma de WhatsApp API —, el camino es distinto: se hace desde
**Configuracion de la API → Administrar numeros de telefono → Migrar
numero de telefono existente**, pidiendole al cliente el codigo de
migracion de 6 digitos que genera desde su cuenta actual. Esto sí conserva
el historial de calidad/verificacion del numero. Si no es este caso
(el numero viene de la app normal de celular), ignorar este paso.

---

## 4. Token permanente (System User) — igual en ambos casos

**No usar el token temporal de 24 h en produccion.** Hay que crear uno que
no vence:

1. Ir a [business.facebook.com](https://business.facebook.com) →
   **Configuracion del negocio** → **Usuarios** → **Usuarios del sistema**.
2. **Agregar** → nombre (ej. `whatsbot-system-user`) → rol **Admin**.
3. Click en el usuario creado → **Agregar activos** → pestana **Cuentas de
   WhatsApp** → seleccionar la WABA del cliente → **Control total**.
4. **Generar nuevo token** → elegir la app creada en el paso 2 → marcar los
   permisos `whatsapp_business_messaging` y `whatsapp_business_management`
   → **Generar token**.
5. Copiar el token (solo se muestra una vez) y guardarlo en un lugar seguro
   antes de cargarlo en el servidor.

Con esto el token deja de expirar cada 24 h y no hay que repetir este
proceso cada vez que se pierde la conexion.

---

## 5. Cargar los datos en el servidor

Una vez con **Phone Number ID**, **WABA ID** y **token permanente**, hay dos
formas de cargarlos:

### Opcion rapida: desde el panel `/admin`

Ver [seccion 6](#6-manual-del-panel-de-administracion-admin). Permite
cambiar el token, el Phone Number ID, el Verify Token y los numeros de
departamento sin entrar por SSH, y reinicia el bot solo.

### Opcion manual: por SSH

```bash
ssh root@76.13.126.35
cd /var/www/plasticos-superior-whatsbot
nano .env
```

Completar:

```
WHATSAPP_TOKEN=<token permanente del system user>
PHONE_NUMBER_ID=<phone number id del numero que corresponda>
VERIFY_TOKEN=<cualquier string secreto inventado>
```

Guardar y reiniciar:

```bash
pm2 restart plasticos-superior-whatsbot --update-env
```

### Configurar el webhook en Meta (los dos casos lo necesitan)

En **Configuracion de la API** → **Webhook**:

- **URL de devolucion de llamada:** `https://bot.plasticos-superior.com/webhook`
- **Token de verificacion:** el mismo valor que se puso en `VERIFY_TOKEN`.
- **Verificar y guardar**.
- Bajar hasta **Campos del webhook**, elegir el producto
  **Whatsapp Business Account** (no "User") y activar **Suscribirse** en la
  fila **messages**. Este paso es el que mas se olvida: guardar la URL no
  alcanza, si no se activa `messages` el servidor nunca recibe los mensajes
  aunque la verificacion haya sido exitosa.

Mas detalle de este flujo, incluido un chequeo por API de que la app este
bien suscrita a la WABA, en [META_SETUP.md](META_SETUP.md).

---

## 6. Manual del panel de administracion (`/admin`)

Desde la version con panel (commit `183b58a` en adelante) se puede
administrar casi toda la configuracion del bot desde el navegador, sin
entrar al servidor.

### 6.1 Acceso

- URL: `https://bot.plasticos-superior.com/admin`
- Pide **usuario** y **contrasena**. Las credenciales se generan una sola
  vez en el servidor (ver [6.6](#66-generar-o-cambiar-la-contrasena-del-panel)).
- Tiene proteccion basica contra fuerza bruta: despues de **8 intentos
  fallidos** desde la misma IP en 15 minutos, bloquea el login
  temporalmente (HTTP 429).
- La sesion dura **4 horas**, despues hay que volver a entrar.

### 6.2 Que se puede editar

| Campo en el panel | Variable en `.env` | Que hace |
|---|---|---|
| Token de acceso de WhatsApp (Meta) | `WHATSAPP_TOKEN` | Credencial para mandar mensajes. Campo oculto: si se deja en blanco, no se modifica. |
| Phone Number ID | `PHONE_NUMBER_ID` | Numero desde el que responde el bot |
| Verify Token del webhook | `VERIFY_TOKEN` | Debe coincidir con el que esta cargado en Meta |
| Numero — Contabilidad / Punto de Venta / Administracion / Programacion y Produccion | `DEPT_*` | A donde apunta el link `wa.me/` de cada opcion del menu |
| Titulo del menu de bienvenida | `WELCOME_HEADER` | Encabezado del primer mensaje (maximo 60 caracteres) |
| Texto del mensaje de bienvenida | `WELCOME_BODY` | Cuerpo del primer mensaje (maximo 1024 caracteres) |
| Texto del boton del menu | `WELCOME_BUTTON_TEXT` | Texto del boton que abre la lista (maximo 20 caracteres) |
| Link a metodo de pago en Meta | `META_BILLING_URL` | Atajo que se muestra arriba del formulario, dentro de **Avanzado** |

Los **nombres y descripciones de los 4 departamentos** (no los numeros, el
texto) no son editables desde el panel — estan fijos en
[`src/departments.js`](../src/departments.js) y requieren un cambio de
codigo + deploy.

### 6.3 Preview en vivo

A la derecha del formulario hay un mockup de WhatsApp que se actualiza a
medida que se escribe, sin mandar ningun mensaje real:

- Muestra el mensaje de bienvenida con el header, cuerpo y boton tal como
  va a verse.
- Al hacer click en el boton se simula la lista de departamentos, y avisa
  con un cartel de advertencia (⚠) si algun titulo supera los 24
  caracteres o alguna descripcion supera los 72 — son los limites reales
  de WhatsApp para listas interactivas, y si se pasan, el mensaje real
  falla al enviarse.
- Al hacer click en un departamento muestra el mensaje de confirmacion con
  el link `wa.me/<numero>` que se va a mandar, usando el numero que este
  cargado en ese momento en el campo correspondiente.
- Debajo de cada campo con limite de caracteres (header, body, boton) hay
  un contador que se pone en rojo si se pasa del maximo permitido.

### 6.4 Guardar cambios

Al apretar **"Guardar y reiniciar el bot"**:

1. Los campos que se dejaron vacios en los campos sensibles (token, verify
   token) **no se tocan** — solo se actualizan los que tengan texto nuevo.
2. Se escribe el `.env` del servidor con los valores nuevos.
3. El panel ejecuta automaticamente `pm2 restart plasticos-superior-whatsbot
   --update-env`, asi que el bot queda corriendo con la config nueva sin
   necesidad de entrar por SSH.
4. Redirige de vuelta al panel con el mensaje "Cambios guardados. El bot se
   reinicio con la nueva configuracion."

El formulario esta protegido con un token CSRF por sesion; si se recibe
"Formulario invalido" hay que volver a `/admin` y reintentar (suele pasar
si la sesion ya habia expirado).

### 6.5 Salir

Boton **Salir** arriba a la derecha del panel. Cierra la sesion del lado del
servidor (no solo borra la cookie).

### 6.6 Generar o cambiar la contrasena del panel

La contrasena nunca se guarda en texto plano, solo su hash. Para generarla
o cambiarla:

```bash
ssh root@76.13.126.35
cd /var/www/plasticos-superior-whatsbot
npm run hash-password -- "la-contrasena-que-elijas"
```

Esto imprime un hash tipo `$2a$10$...`. Copiarlo entero y cargarlo en el
`.env`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$.......................................
SESSION_SECRET=<un string aleatorio largo, una sola vez>
```

`SESSION_SECRET` firma las cookies de sesion — no hace falta regenerarlo
cada vez, solo la primera vez que se configura el panel (o si se sospecha
que la sesion de alguien quedo comprometida). Despues de editar el `.env` a
mano:

```bash
pm2 restart plasticos-superior-whatsbot --update-env
```

> El panel en si **no** tiene una opcion para cambiar la contrasena desde el
> navegador — es intencional, para no exponer esa funcion a quien ya este
> logueado. Siempre se cambia por SSH.

---

## 7. Errores comunes

| Error / sintoma | Causa | Solucion |
|---|---|---|
| `Session has expired` / `code 190` al mandar mensajes | El token temporal de 24h vencio | Generar un token **permanente** de System User (seccion 4) |
| `(#131005) Access denied` | Token invalido, revocado, o sin los permisos `whatsapp_business_messaging`/`whatsapp_business_management` | Revisar permisos del token con `debug_token` (ver [META_SETUP.md](META_SETUP.md)) o generar uno nuevo |
| `(#131030) Recipient phone number not in allowed list` | Se esta usando el numero de prueba y el destinatario no esta en la lista de hasta 5 numeros autorizados | Agregar el numero en Configuracion de la API → "Para", o pasar a un numero real/verificado |
| El webhook verifica bien (GET 200) pero nunca llegan mensajes | Falta suscribir el campo **messages** del producto **Whatsapp Business Account** (quedo en "User" u otro producto, o sin activar) | Seccion 5, ultimo paso. Confirmar tambien con `GET /<WABA_ID>/subscribed_apps` que la app este en la lista |
| El link `wa.me/...` del departamento sale con `57XXXXXXXXXX` | El numero de ese departamento nunca se cargo | Cargarlo desde el panel `/admin` o en el `.env` (`DEPT_*`) |
| "Formulario invalido" al guardar en el panel | Token CSRF de una sesion vieja/expirada | Recargar `/admin` y volver a intentar |
| 429 "Demasiados intentos" en el login del panel | Mas de 8 intentos fallidos en 15 minutos desde esa IP | Esperar 15 minutos, o confirmar que el usuario/contrasena sean los correctos |
| El panel no pide login y da error raro, o la sesion se cierra sola todo el tiempo | Falta `SESSION_SECRET` en el `.env` (usa un valor por defecto inseguro) | Cargar un `SESSION_SECRET` propio (seccion 6.6) |

Para mas casos y el detalle de como reproducirlos/depurarlos, ver
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).
