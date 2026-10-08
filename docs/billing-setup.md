# Integración comercial: Stripe + Supabase

Este repositorio incluye una base para suscripciones mensuales/anuales. **No crea productos, no despliega funciones, no conecta cuentas y no activa cobros.** Hay que completar la configuración de Supabase y Stripe antes de habilitar el checkout.

## Arquitectura

- **Supabase Auth** autentica al usuario antes de abrir el checkout.
- Una Edge Function `create-checkout-session` valida el JWT en servidor y solo acepta los intervalos `monthly` o `annual`.
- Los IDs de precio se guardan como secretos de servidor (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`); no se aceptan importes enviados por el navegador.
- Stripe Checkout aloja el formulario de pago.
- El webhook `stripe-webhook` verifica `Stripe-Signature` sobre el body original y actualiza el entitlement en `billing_subscriptions`.
- RLS permite al usuario autenticado **leer únicamente su propio entitlement**; la escritura está reservada al backend.
- `create-portal-session` permite que el usuario gestione o cancele su suscripción desde Stripe Customer Portal.
- No se suben las grabaciones a Supabase ni a Stripe; los vídeos permanecen en el dispositivo.

## Configuración requerida (pendiente del propietario)

### 1. Supabase

1. Crear/elegir un proyecto Supabase y habilitar autenticación por email (magic link/OTP) con los redirects del sitio.
2. Aplicar la migración `supabase/migrations/20261008010000_billing.sql`.
3. Configurar `SITE_URL` y `APP_ALLOWED_ORIGINS` para que incluyan solo los orígenes exactos de producción y desarrollo.
4. Desplegar las Edge Functions de este repositorio.
5. Configurar los secretos de servidor listados abajo. Nunca incluirlos en Vite, `VITE_*`, el repositorio ni la app del navegador.

### 2. Stripe (modo de prueba primero)

1. Crear dos precios recurrentes en Stripe: mensual y anual; definir moneda, importes, impuestos y texto fiscal de acuerdo con el país del negocio.
2. Configurar el Customer Portal y permitir gestionar/cancelar la suscripción.
3. Crear un webhook hacia `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`.
4. Suscribir al menos los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused` y `customer.subscription.resumed`.
5. Probar checkout, renovación, fallo de pago, cancelación y reactivación con tarjetas de prueba antes de cambiar a claves live.

## Variables de entorno

### Cliente Vite (públicas)

Copiar `.env.example` a `.env.local` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` o publishable key

La clave publicable/anon no sustituye RLS y no debe tener privilegios de servicio.

### Edge Functions (secretas)

Para desarrollo local, copiar `supabase/functions/.env.example` a `supabase/functions/.env`. En producción, configurar los secretos en Supabase Dashboard/CLI. Se requieren:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` **o** `SUPABASE_SECRET_KEYS` (solo servidor)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_AUTOMATIC_TAX` (opcional; `true` solo después de habilitar Stripe Tax y definir productos/direcciones fiscales)
- `SITE_URL`
- `APP_ALLOWED_ORIGINS`

No compartir secretos por chat ni guardarlos en GitHub Actions o en `.env.example`.

## Criterios antes de activar producción

- Definir país legal del negocio, mercado/moneda, importes mensual/anual, política de reembolso, cancelación, prueba gratuita e impuestos.
- Stripe Tax queda deshabilitado por defecto; para activarlo hay que configurar Stripe Tax y usar `STRIPE_AUTOMATIC_TAX=true` en los secretos del servidor.
- Configurar dominios permitidos en Supabase Auth y CORS.
- Ejecutar pruebas de webhook con reintentos y eventos duplicados; verificar el comportamiento de reembolso/disputa y `past_due`.
- Revisar términos, privacidad, soporte, cookies/analítica y obligaciones fiscales con asesoría apropiada.
- Confirmar que `billing_subscriptions.is_pro` solo puede ser escrito por las funciones servidoras.
- Probar con claves Stripe `sk_test_` y webhook `whsec_` de prueba; habilitar `sk_live_` únicamente tras aprobación explícita del propietario.

## Fuentes oficiales consultadas

- Stripe — [Build a subscriptions integration with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions)
- Stripe — [Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- Stripe — [Receive Stripe events](https://docs.stripe.com/webhooks)
- Supabase — [Handling Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- Supabase — [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- Supabase — [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)

### Limitación de controles en el navegador

El entitlement y la gestión de suscripción se validan desde el servidor. Sin embargo, SCREENREC procesa la grabación enteramente en el cliente; ningún flag local puede impedir que un usuario avanzado modifique el JavaScript o sus límites gratuitos. La integración elimina la activación local casual y asegura las operaciones de facturación, pero no constituye DRM ni un control de uso remoto.

Referencia específica: Stripe movió `current_period_start`/`current_period_end` desde el objeto Subscription al objeto Subscription Item en API Basil; el webhook lee el período desde `items.data[].current_period_end` y consulta el estado más reciente para tolerar eventos fuera de orden. Fuente: [Stripe changelog — subscription item-level billing periods](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end).
