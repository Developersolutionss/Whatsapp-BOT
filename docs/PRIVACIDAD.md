# Pagina de politica de privacidad

Meta **exige una URL publica de politica de privacidad** para publicar la app
(Publicar -> modo En vivo). Sin ella no se puede pasar la app a produccion.

## Estado: VERSION DE PRUEBA (NO DEFINITIVA) - PENDIENTE DE DESPLEGAR Y REEMPLAZAR

> **Importante:** el texto actual es una version provisional y generica, creada
> solo para poder cumplir el requisito de Meta. **Debe cambiarse** por la
> politica oficial de Plasticos Superior, revisada y aprobada por el cliente (y
> su asesor legal), antes de considerarla definitiva.

- La pagina ya esta implementada en el codigo (`src/privacy.js`) y responde en
  `/privacidad` (alias `/privacy`). Es una version generica inicial para salir
  del paso.
- **Aun no esta desplegada en el VPS.** URL prevista:
  `https://bot.plasticos-superior.com/privacidad`.
- **Pendiente:** que el cliente (o su asesor legal) revise y apruebe el texto, y
  definir un correo de contacto oficial. Mas adelante conviene reemplazarla por
  la politica oficial de Plasticos Superior (por ejemplo, en su sitio web) y
  actualizar la URL en Meta.

## Configuracion

Variables opcionales en el `.env` (si no se definen, se usan los valores por
defecto del codigo):

| Variable | Uso | Por defecto |
| --- | --- | --- |
| `PRIVACY_COMPANY_NAME` | Nombre legal que aparece en la pagina | `Plasticos Superior SAS` |
| `PRIVACY_CONTACT_PHONE` | Telefono de contacto | `+57 311 7406214` |
| `PRIVACY_CONTACT_EMAIL` | Correo de contacto (si esta vacio no se muestra) | vacio |
| `PRIVACY_UPDATED_AT` | Fecha de ultima actualizacion | `13 de octubre de 2026` |

## Pasos para dejarla en produccion

1. Desplegar (ver [DEPLOYMENT.md](DEPLOYMENT.md)): `git pull` + `pm2 restart plasticos-superior-whatsbot --update-env`.
2. Verificar: `curl -I https://bot.plasticos-superior.com/privacidad` debe responder `200`.
3. En developers.facebook.com -> app -> **Configuracion de la app -> Basica**,
   pegar la URL en "URL de la politica de privacidad" (y completar icono y
   categoria si Meta los pide).
4. App -> **Publicar** -> boton **Publicar** (modo En vivo).

La pagina cita la Ley 1581 de 2012 (proteccion de datos personales, Colombia).
El texto debe validarse con el cliente antes de considerarse definitivo.
