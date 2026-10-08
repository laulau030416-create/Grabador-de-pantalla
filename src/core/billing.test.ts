import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

type MockFunction = ReturnType<typeof vi.fn>;
interface BillingTestClient {
  auth: {
    signInWithOtp: MockFunction;
    getSession: MockFunction;
    signOut: MockFunction;
    onAuthStateChange: MockFunction;
  };
  functions: { invoke: MockFunction };
  from: MockFunction;
}
interface BillingClientHarness {
  client: BillingTestClient;
  query: Record<string, MockFunction>;
  unsubscribe: MockFunction;
  fireAuthEvent: (event: string, authSession: unknown) => void;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
  createClientMock.mockReset();
  vi.resetModules();
});

function makeClient(
  session: unknown = null,
  subscriptionData: unknown = null,
  subscriptionError: unknown = null
): BillingClientHarness {
  let authCallback: ((event: string, session: unknown) => void) | null = null;
  const unsubscribe = vi.fn();
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: subscriptionData, error: subscriptionError });

  const client = {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(
        (
          callback: (event: string, session: unknown) => void
        ): { data: { subscription: { unsubscribe: () => void } } } => {
          authCallback = callback;
          return { data: { subscription: { unsubscribe } } };
        }
      ),
    },
    functions: {
      invoke: vi
        .fn()
        .mockResolvedValue({ data: { url: "https://stripe.example/session" }, error: null }),
    },
    from: vi.fn(() => query),
  };

  return {
    client,
    query,
    unsubscribe,
    fireAuthEvent: (event: string, authSession: unknown) => authCallback?.(event, authSession),
  };
}

async function loadBilling(client?: unknown): Promise<typeof import("./billing")> {
  vi.stubEnv("VITE_SUPABASE_URL", client ? "https://project.supabase.co" : "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", client ? "public-test-key" : "");
  createClientMock.mockReturnValue(client ?? null);
  vi.resetModules();
  return await import("./billing");
}

const activeSession = {
  user: { id: "user-123", email: "person@example.com" },
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
};

describe("intervalos comerciales", () => {
  it("acepta únicamente mensual y anual", async () => {
    const billing = await loadBilling();
    expect(billing.isBillingInterval("monthly")).toBe(true);
    expect(billing.isBillingInterval("annual")).toBe(true);
  });

  it("rechaza intervalos arbitrarios que podrían manipular el checkout", async () => {
    const billing = await loadBilling();
    expect(billing.isBillingInterval("weekly")).toBe(false);
    expect(billing.isBillingInterval("lifetime")).toBe(false);
    expect(billing.isBillingInterval(null)).toBe(false);
    expect(billing.isBillingInterval({})).toBe(false);
  });
});

describe("entitlement Pro", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");

  it("acepta solo estados activos con período futuro verificable", async () => {
    const billing = await loadBilling();
    expect(
      billing.hasActiveEntitlement(
        { is_pro: true, status: "active", current_period_end: "2026-02-01T00:00:00.000Z" },
        now
      )
    ).toBe(true);
    expect(
      billing.hasActiveEntitlement(
        { is_pro: true, status: "trialing", current_period_end: "2026-02-01T00:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("falla cerrado para impago, expiración, período nulo y flags no booleanos", async () => {
    const billing = await loadBilling();
    expect(
      billing.hasActiveEntitlement(
        { is_pro: true, status: "past_due", current_period_end: "2026-02-01T00:00:00.000Z" },
        now
      )
    ).toBe(false);
    expect(
      billing.hasActiveEntitlement(
        { is_pro: true, status: "active", current_period_end: "2025-12-31T00:00:00.000Z" },
        now
      )
    ).toBe(false);
    expect(
      billing.hasActiveEntitlement(
        { is_pro: true, status: "active", current_period_end: null },
        now
      )
    ).toBe(false);
    expect(
      billing.hasActiveEntitlement(
        { is_pro: "true", status: "active", current_period_end: "2026-02-01T00:00:00.000Z" },
        now
      )
    ).toBe(false);
  });
});

describe("billing sin credenciales públicas", () => {
  it("mantiene checkout desactivado hasta configurar Supabase", async () => {
    const billing = await loadBilling();
    expect(billing.isBillingConfigured()).toBe(false);
  });

  it("rechaza magic link, checkout y portal sin cliente Supabase", async () => {
    const billing = await loadBilling();
    await expect(billing.sendBillingMagicLink("person@example.com", "monthly")).rejects.toThrow(
      /not configured/i
    );
    await expect(billing.createCheckoutUrl("annual")).rejects.toThrow(/not configured/i);
    await expect(billing.createBillingPortalUrl()).rejects.toThrow(/not configured/i);
  });

  it("deja cerrar sesión y publica un estado gratuito seguro", async () => {
    const billing = await loadBilling();
    await expect(billing.signOutBillingUser()).resolves.toBeUndefined();
    let status: unknown;
    const unsubscribe = billing.watchBillingStatus(
      (value) => (status = value),
      () => undefined
    );
    expect(status).toEqual({ configured: false, signedIn: false, email: null, isPro: false });
    unsubscribe();
  });
});

describe("billing con un cliente Supabase simulado", () => {
  it("envía un magic link y guarda el período para reanudar checkout", async () => {
    const { client } = makeClient();
    const billing = await loadBilling(client);

    await billing.sendBillingMagicLink("  PERSON@example.com ", "annual");

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        shouldCreateUser: true,
      },
    });
    expect(localStorage.getItem("screenrec.pending-billing-interval")).toBe("annual");
  });

  it("elimina el período pendiente si Supabase no puede enviar el link", async () => {
    const { client } = makeClient();
    client.auth.signInWithOtp.mockResolvedValue({ error: new Error("rate limited") });
    const billing = await loadBilling(client);

    await expect(billing.sendBillingMagicLink("person@example.com", "monthly")).rejects.toThrow(
      "rate limited"
    );
    expect(localStorage.getItem("screenrec.pending-billing-interval")).toBeNull();
  });

  it("crea checkout y portal solo después de recuperar una sesión", async () => {
    const { client } = makeClient(activeSession);
    const billing = await loadBilling(client);

    await expect(billing.createCheckoutUrl("monthly")).resolves.toBe(
      "https://stripe.example/session"
    );
    await expect(billing.createBillingPortalUrl()).resolves.toBe("https://stripe.example/session");
    expect(client.functions.invoke).toHaveBeenNthCalledWith(1, "create-checkout-session", {
      body: { interval: "monthly" },
    });
    expect(client.functions.invoke).toHaveBeenNthCalledWith(2, "create-portal-session", {
      body: {},
    });
  });

  it("no crea checkout si no hay sesión y limpia la suscripción Auth al salir", async () => {
    const { client } = makeClient();
    const billing = await loadBilling(client);

    await expect(billing.createCheckoutUrl("annual")).resolves.toBeNull();
    await billing.signOutBillingUser();
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });

  it("publica el entitlement vigente y desuscribe los eventos Auth al limpiar", async () => {
    const { client, unsubscribe } = makeClient(activeSession, {
      is_pro: true,
      status: "active",
      current_period_end: "2099-01-01T00:00:00.000Z",
    });
    const billing = await loadBilling(client);
    const statuses: unknown[] = [];
    const stop = billing.watchBillingStatus(
      (status) => statuses.push(status),
      () => undefined
    );

    await new Promise((resolve) => window.setTimeout(resolve, 10));
    expect(statuses).toContainEqual({
      configured: true,
      signedIn: true,
      email: "person@example.com",
      isPro: true,
    });
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reanuda el período elegido al recibir un evento de sesión", async () => {
    const { client, fireAuthEvent } = makeClient(activeSession);
    const billing = await loadBilling(client);
    await billing.sendBillingMagicLink("person@example.com", "annual");
    const resumed: string[] = [];
    const stop = billing.watchBillingStatus(
      () => undefined,
      (interval) => resumed.push(interval)
    );

    fireAuthEvent("SIGNED_IN", activeSession);
    await new Promise((resolve) => window.setTimeout(resolve, 10));

    expect(resumed).toEqual(["annual"]);
    expect(localStorage.getItem("screenrec.pending-billing-interval")).toBeNull();
    stop();
  });
});
