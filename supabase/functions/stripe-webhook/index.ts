import Stripe from "npm:stripe@23.0.0";
import { createAdminClient, requiredEnv } from "../_shared/supabase.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient();
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    const { data: billingCustomer, error: lookupError } = await admin
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    userId = billingCustomer?.user_id;
  }

  // Eventos sin vínculo a una cuenta SCREENREC no conceden acceso.
  if (!userId) {
    console.warn("Ignoring Stripe subscription without a SCREENREC user mapping");
    return;
  }

  const metadataInterval = subscription.metadata.billing_interval;
  const interval =
    metadataInterval === "monthly" || metadataInterval === "annual" ? metadataInterval : null;
  // Stripe Basil moved current_period_end from Subscription to each item.
  // For multiple items, use the earliest end to avoid extending access beyond
  // the shortest paid entitlement period.
  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  const periodEndSeconds = itemPeriodEnds.length > 0 ? Math.min(...itemPeriodEnds) : null;
  const periodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null;
  const isPro =
    (subscription.status === "active" || subscription.status === "trialing") &&
    periodEnd !== null &&
    Date.parse(periodEnd) > Date.now();

  const { data: currentEntitlement, error: currentEntitlementError } = await admin
    .from("billing_subscriptions")
    .select("stripe_subscription_id, is_pro")
    .eq("user_id", userId)
    .maybeSingle();
  if (currentEntitlementError) throw currentEntitlementError;
  if (
    currentEntitlement?.stripe_subscription_id !== subscription.id &&
    currentEntitlement?.is_pro === true &&
    !isPro
  ) {
    console.warn("Ignoring a non-entitled event from a different subscription while Pro is active");
    return;
  }

  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      status: subscription.status,
      billing_interval: interval,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      is_pro: isPro,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
  } catch (error) {
    console.error(
      "Stripe webhook configuration is incomplete",
      error instanceof Error ? error.message : "unknown error"
    );
    return new Response("Webhook configuration error", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return new Response("Invalid webhook signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscriptionEvent = event.data.object as Stripe.Subscription;
        // Fetch the latest server state so delayed/out-of-order event deliveries
        // cannot restore an entitlement that has already been canceled.
        const latestSubscription = await stripe.subscriptions.retrieve(subscriptionEvent.id);
        await syncSubscription(latestSubscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(
      "Stripe webhook processing failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return new Response("Webhook processing failed", { status: 500 });
  }

  return Response.json({ received: true });
});
