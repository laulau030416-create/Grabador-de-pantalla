import Stripe from "npm:stripe@23.0.0";
import { authenticatedUser, createAdminClient, requiredEnv } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request: Request): Promise<Response> => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);

  try {
    const admin = createAdminClient();
    const user = await authenticatedUser(request, admin);
    if (!user) return jsonResponse(request, { error: "Authentication required" }, 401);

    const { data: billingCustomer, error } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!billingCustomer?.stripe_customer_id) {
      return jsonResponse(request, { error: "No billing account exists for this user" }, 404);
    }

    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const portal = await stripe.billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      return_url: requiredEnv("SITE_URL"),
    });
    return jsonResponse(request, { url: portal.url });
  } catch (error) {
    console.error(
      "create-portal-session failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonResponse(
      request,
      { error: "Unable to open billing portal. Check server configuration." },
      500
    );
  }
});
