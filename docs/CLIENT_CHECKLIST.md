# Checklist: informacion que debe entregar Plasticos Superior

Datos que el cliente debe reunir y enviar para dejar el bot funcionando al
100% en produccion con Meta (numero real, sin restricciones de cuenta de
prueba).

## 1. Numero de WhatsApp Business principal

- [ ] Numero de telefono que va a usar el bot (con codigo de pais)
- [ ] Confirmar que ese numero no tenga WhatsApp activo actualmente en un
      celular (un numero no puede usarse a la vez en la app normal y en la
      API — si esta activo hay que eliminarlo de ahi primero)
- [ ] Disponibilidad para recibir el codigo de verificacion por SMS o
      llamada en ese numero

## 2. Numeros de destino por departamento

- [ ] Contabilidad — numero con codigo de pais
- [ ] Punto de Venta — numero con codigo de pais
- [ ] Administracion — numero con codigo de pais
- [ ] Programacion y Produccion — numero con codigo de pais

## 3. Perfil publico de WhatsApp Business

- [ ] Nombre del negocio a mostrar (verified name)
- [ ] Categoria del negocio (ej. Fabricacion / Productos industriales)
- [ ] Descripcion corta del negocio
- [ ] Direccion fisica
- [ ] Sitio web (si tienen)
- [ ] Correo de contacto
- [ ] Logo o foto de perfil (imagen cuadrada, buena resolucion)

## 4. Verificacion del negocio ante Meta

- [ ] Nombre legal completo de la empresa
- [ ] NIT o documento de identificacion tributaria
- [ ] Tipo de entidad legal (ej. Empresa privada)
- [ ] Direccion legal registrada
- [ ] Documento que pruebe la existencia legal del negocio (camara de
      comercio, RUT o similar)
- [ ] Dominio de correo corporativo o sitio web propio (ayuda a acelerar la
      verificacion)

## 5. Metodo de pago

- [ ] Tarjeta de credito o debito para asociar a la cuenta de WhatsApp
      Business (Meta cobra mensajes salientes tipo marketing/utilidad fuera
      de la ventana de servicio)
- [ ] NIT para la facturacion, si necesitan factura a nombre de la empresa

## 6. Administracion de la cuenta de Meta

- [ ] Persona designada como administrador del Business Manager (nombre +
      cuenta de Facebook o email)
- [ ] Confirmar si esa persona es del cliente o de la agencia
      (DeveloperSolutions)

## 7. Contenido del bot (textos)

- [ ] Confirmar o ajustar el mensaje de bienvenida actual:
      "Hola, bienvenido a Plasticos Superior. Por favor elegi el area con
      la que queres comunicarte:"
- [ ] Confirmar los nombres de los 4 departamentos tal como deben verse en
      el menu

---

Una vez reunidos estos datos, se cargan en el `.env` del servidor (ver
[DEPLOYMENT.md](DEPLOYMENT.md)) y se sigue la seccion 6 de
[META_SETUP.md](META_SETUP.md) para registrar el numero real.
