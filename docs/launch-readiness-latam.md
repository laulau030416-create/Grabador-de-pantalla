# Preparación de SCREENREC para lanzamiento en LATAM

**Estado revisado:** 9 de octubre de 2026
**Base revisada:** rama `hardening/commercial-readiness`, commit `95e5491`; PR en borrador [#1](https://github.com/laulau030416-create/Grabador-de-pantalla/pull/1).
**Conclusión:** MVP técnico prometedor, todavía **no listo para lanzamiento público de pago**. Se puede preparar una beta gratuita mientras se confirma el proveedor.

## Lo que ya está en buen estado

- TypeScript, lint y formato pasan en la validación local.
- **150 pruebas unitarias pasan** en 14 archivos; no sustituyen pruebas en navegadores reales.
- Build de producción pasa.
- Coverage ejecuta correctamente: **60,48 % statements y 63,06 % líneas**. Esto deja riesgo sin cubrir, especialmente en persistencia (`storage.ts`), Dashboard y ciclo completo del grabador.
- Deno valida las Edge Functions actuales; `npm audit --audit-level=moderate` reportó **0 vulnerabilidades**.
- La PR #1 está en borrador y los checks reportados por GitHub fueron exitosos. No está fusionada.
- Las grabaciones permanecen en el dispositivo y la aplicación explica que no se sincronizan entre dispositivos.

## Bloqueos para cobrar en producción

### P0 — Proveedor de pago y entorno de facturación

- La implementación actual es específica de Stripe/Supabase y **no está conectada a cuentas, precios ni un webhook productivo**.
- Stripe no es una opción confirmada para el negocio colombiano. La pasarela para LATAM sigue pendiente.
- Cuando se seleccione el proveedor: validar onboarding colombiano, países compradores, métodos realmente recurrentes, moneda de liquidación, comisiones, reembolsos, cancelaciones, webhooks y sandbox.
- Mantener al servidor como autoridad del entitlement Pro; nunca activar Pro solo por volver de una página de pago o por un valor de `localStorage`.
- No usar credenciales live hasta pasar pruebas de altas, renovaciones, rechazos, cancelaciones, reembolsos, eventos duplicados y suscripción vencida.

### P0 — Verificación de grabación en navegadores reales

Actualmente hay pruebas unitarias/DOM, pero **no hay una suite E2E que pruebe `getDisplayMedia` y `MediaRecorder` en un navegador real**. Antes de una beta amplia, probar al menos en Chrome y Edge de escritorio, y después Firefox:

- permisos concedidos y denegados;
- selección de pestaña, ventana y pantalla;
- audio de pestaña/sistema, micrófono y cámara;
- detener desde la propia app y desde el selector del navegador;
- cuenta atrás, cancelar/iniciar dos veces, pausa/reanudación y errores;
- cada formato que se anuncie, descarga final y reproducción del archivo;
- guardar, recargar, renombrar y borrar desde IndexedDB;
- cuota/almacenamiento insuficiente y recuperación amigable.

Los navegadores móviles no permiten esta captura de pantalla web: el mensaje y el marketing deben decirlo claramente. En móvil se puede consultar la app, pero no grabar la pantalla con esta aplicación web.

### P1 — Límites, almacenamiento y promesas de producto

- El uso gratuito se guarda localmente y puede alterarse por un usuario avanzado. Es una regla de producto, **no una cuota antifraude ni DRM**; no venderla como control inviolable.
- Los vídeos viven en IndexedDB del navegador/dispositivo. Limpiar datos, usar incógnito, quedarse sin espacio o perder el dispositivo puede hacerlos irrecuperables. El producto no ofrece backup ni sincronización.
- Pro anuncia grabación ilimitada, 2K/4K, 60 FPS y soporte prioritario. Verificar los límites reales por navegador/equipo, definir qué significa “soporte prioritario” y quitar o condicionar cualquier promesa que no se pueda cumplir.
- Definir una política de almacenamiento: estimación de espacio, aviso antes del límite, errores de persistencia y guía para descargar archivos importantes.

### P1 — Confianza y operación comercial

Antes del cobro público se necesitan datos reales de la propietaria y revisión apropiada; no están definidos en este repositorio:

- razón social o identidad del vendedor, país de operación y canal de contacto;
- dominio propio, correo de soporte y responsable de atender incidentes/reembolsos;
- precios, moneda, periodicidad, renovación automática, prueba gratis, cancelación y reembolsos;
- términos de servicio y aviso de privacidad: datos de cuenta, proveedor de autenticación/pago, finalidad, retención, contacto y tratamiento de grabaciones locales;
- revisión con asesoría colombiana de facturación, impuestos y obligaciones de protección de datos.

No publicar una plantilla legal como si fuera asesoría o inventar datos de la empresa. La integración de un Merchant of Record, si se elige, no elimina automáticamente obligaciones fiscales o legales locales del negocio.

### P1 — Presentación pública

- Revisar nombre comercial, disponibilidad del dominio y posibles conflictos de marca antes de invertir en pauta.
- Publicar una página de aterrizaje en español neutro que explique: funciona en computador, no graba desde navegador móvil, el vídeo no se sube, formatos compatibles, requisitos y límites gratuitos.
- Añadir contacto visible, guía para problemas comunes, versión/changelog y proceso para reportar fallos.
- Configurar dominio HTTPS y probar build/despliegue en el origen final. Actualmente el despliegue de GitHub Pages está automatizado para `main` y `develop`; mantener `develop` como preview y usar `main` solo para producción, según la configuración de Pages del repositorio.
- No añadir analytics que registren contenido de pantalla. Si se agrega analítica, informar al usuario y medir solo eventos mínimos/no sensibles.

## Secuencia recomendada

1. **Ahora, sin pasarela:** preparar página de lanzamiento y soporte, corregir copy provisional, automatizar smoke/E2E básico y ejecutar pruebas manuales de captura; validar la experiencia con 5–10 usuarios de escritorio hispanohablantes.
2. **Después de confirmar proveedor:** reemplazar el adaptador específico de Stripe por uno del proveedor seleccionado, preservar autenticación/RLS si corresponde y validar sus renovaciones y webhooks en sandbox.
3. **Beta gratuita:** invitar usuarios, medir fallos de captura y formatos, observar almacenamiento y recoger consentimiento/feedback; no presentar límites locales como protección antifraude.
4. **Lanzamiento pago:** únicamente después de aprobación del proveedor, política/condiciones revisadas, soporte operativo, precios publicados y pruebas de cobro/reembolso/cancelación satisfactorias.

## Pendiente de decidir con la propietaria

- Proveedor final de pagos y mercados de lanzamiento prioritarios.
- Dominio/nombre de marca, correo de soporte y datos comerciales que se publicarán.
- Precios y monedas para planes mensual/anual.
- Si la beta inicial será gratuita y cerrada o pública.
