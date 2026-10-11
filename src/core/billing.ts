import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type BillingInterval = "monthly" | "annual";

export interface BillingStatus {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  isPro: boolean;
}

const PENDING_INTERVAL_KEY = "screenrec.pending-billing-interval";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const billingClient: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          persistSession: true,
        },
      })
    : null;

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function isBillingConfigured(): boolean {
  return billingClient !== null;
}

export function hasActiveEntitlement(
  record: { is_pro?: unknown; status?: unknown; current_period_end?: unknown },
  now = Date.now()
): boolean {
  if (record.is_pro !== true || (record.status !== "active" && record.status !== "trialing")) {
    return false;
  }
  return (
    typeof record.current_period_end === "string" && Date.parse(record.current_period_end) > now
  );
}

export async function sendBillingMagicLink(
  email: string,
  interval: BillingInterval
): Promise<void> {
  if (!billingClient) throw new Error("Supabase Auth is not configured");

  localStorage.setItem(PENDING_INTERVAL_KEY, interval);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await billingClient.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) {
    localStorage.removeItem(PENDING_INTERVAL_KEY);
    throw error;
  }
}

export async function createCheckoutUrl(interval: BillingInterval): Promise<string | null> {
  if (!billingClient) throw new Error("Supabase is not configured");

  const { data: sessionData, error: sessionError } = await billingClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data, error } = await billingClient.functions.invoke<{ url?: string }>(
    "create-checkout-session",
    { body: { interval } }
  );
  if (error) throw error;
  if (!data?.url) throw new Error("Checkout did not return a redirect URL");
  return data.url;
}

export async function createBillingPortalUrl(): Promise<string> {
  if (!billingClient) throw new Error("Supabase is not configured");

  const { data: sessionData, error: sessionError } = await billingClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error("Sign in before managing a subscription");

  const { data, error } = await billingClient.functions.invoke<{ url?: string }>(
    "create-portal-session",
    { body: {} }
  );
  if (error) throw error;
  if (!data?.url) throw new Error("Billing portal did not return a redirect URL");
  return data.url;
}

export async function signOutBillingUser(): Promise<void> {
  if (!billingClient) return;
  localStorage.removeItem(PENDING_INTERVAL_KEY);
  const { error } = await billingClient.auth.signOut();
  if (error) throw error;
}

async function publishStatus(
  session: Session | null,
  onStatus: (status: BillingStatus) => void
): Promise<void> {
  if (!billingClient) {
    onStatus({ configured: false, signedIn: false, email: null, isPro: false });
    return;
  }

  if (!session) {
    onStatus({ configured: true, signedIn: false, email: null, isPro: false });
    return;
  }

  let isPro = false;
  const { data, error } = await billingClient
    .from("billing_subscriptions")
    .select("is_pro, current_period_end, status")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!error && data) isPro = hasActiveEntitlement(data);

  onStatus({
    configured: true,
    signedIn: true,
    email: session.user.email ?? null,
    isPro,
  });
}

export function watchBillingStatus(
  onStatus: (status: BillingStatus) => void,
  onResumeCheckout: (interval: BillingInterval) => void
): () => void {
  if (!billingClient) {
    onStatus({ configured: false, signedIn: false, email: null, isPro: false });
    return () => undefined;
  }

  let stopped = false;
  let checkoutPollTimer: number | null = null;
  const refresh = async (session: Session | null): Promise<void> => {
    try {
      await publishStatus(session, (status) => {
        if (stopped) return;
        onStatus(status);
        if (status.isPro && checkoutPollTimer !== null) {
          window.clearInterval(checkoutPollTimer);
          checkoutPollTimer = null;
        }
      });
    } catch (error) {
      console.error(
        "Could not refresh billing status",
        error instanceof Error ? error.message : "unknown error"
      );
      if (!stopped) {
        onStatus({
          configured: true,
          signedIn: Boolean(session),
          email: session?.user.email ?? null,
          isPro: false,
        });
      }
    }
  };

  const { data } = billingClient.auth.onAuthStateChange((event, session) => {
    // Supabase advierte no hacer llamadas de red dentro del callback de Auth;
    // la tarea diferida evita bloquear el lock interno de la sesión.
    window.setTimeout(() => {
      void refresh(session);
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        const pending = localStorage.getItem(PENDING_INTERVAL_KEY);
        if (isBillingInterval(pending)) {
          localStorage.removeItem(PENDING_INTERVAL_KEY);
          onResumeCheckout(pending);
        }
      }
    }, 0);
  });

  void billingClient.auth
    .getSession()
    .then(({ data: sessionData, error }) => {
      if (error) throw error;
      if (!stopped) void refresh(sessionData.session);
    })
    .catch((error: unknown) => {
      console.error(
        "Could not restore Supabase session",
        error instanceof Error ? error.message : "unknown error"
      );
      if (!stopped) onStatus({ configured: true, signedIn: false, email: null, isPro: false });
    });

  if (new URLSearchParams(window.location.search).get("billing") === "success") {
    let attemptsRemaining = 15;
    checkoutPollTimer = window.setInterval(() => {
      attemptsRemaining -= 1;
      if (attemptsRemaining <= 0) {
        if (checkoutPollTimer !== null) window.clearInterval(checkoutPollTimer);
        checkoutPollTimer = null;
        return;
      }
      void billingClient.auth
        .getSession()
        .then(({ data: sessionData, error }) => {
          if (error) throw error;
          if (sessionData.session) void refresh(sessionData.session);
        })
        .catch(() => undefined);
    }, 2000);
  }

  return () => {
    stopped = true;
    if (checkoutPollTimer !== null) window.clearInterval(checkoutPollTimer);
    data.subscription.unsubscribe();
  };
}
