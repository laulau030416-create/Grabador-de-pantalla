import Stripe from "npm:stripe@23.0.0";
import { authenticatedUser, createAdminClient, requiredEnv } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request: Request): Promise<Response> => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);

  try {
    const payload = await request.json().catch(() => null);
    const interval = payload?.interval;
    if (interval !== "monthly" && interval !== "annual") {
      return jsonResponse(request, { error: "Invalid billing interval" }, 400);
    }

    const priceId = requiredEnv(
      interval === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_ANNUAL"
    );
    const siteUrl = new URL(requiredEnv("SITE_URL"));
    const admin = createAdminClient();
    const user = await authenticatedUser(request, admin);
    if (!user) return jsonResponse(request, { error: "Authentication required" }, 401);

    const { data: entitlement, error: entitlementError } = await admin
      .from("billing_subscriptions")
      .select("is_pro")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (entitlement?.is_pro) {
      return jsonResponse(request, { error: "An active subscription already exists" }, 409);
    }

    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const automaticTaxEnabled = Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true";
    const { data: billingCustomer, error: customerLookupError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (customerLookupError) throw customerLookupError;

    let stripeCustomerId = billingCustomer?.stripe_customer_id as string | undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        ...(user.email ? { email: user.email } : {}),
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
      const { error: customerSaveError } = await admin.from("billing_customers").upsert(
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (customerSaveError) throw customerSaveError;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, billing_interval: interval },
      subscription_data: {
        metadata: { supabase_user_id: user.id, billing_interval: interval },
      },
      ...(automaticTaxEnabled
        ? {
            automatic_tax: { enabled: true as const },
            billing_address_collection: "required" as const,
            customer_update: { address: "auto" as const },
          }
        : {}),
      success_url: new URL("?billing=success", siteUrl).toString(),
      cancel_url: new URL("?billing=cancel", siteUrl).toString(),
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return jsonResponse(request, { url: session.url });
  } catch (error) {
    console.error(
      "create-checkout-session failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonResponse(
      request,
      { error: "Unable to start checkout. Check server billing configuration." },
      500
    );
  }
});
