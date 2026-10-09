/**
 * Coherencia del estado del plan.
 *
 * Los marcadores locales históricos no deben conceder Pro ni establecer la
 * identidad del usuario. Solo una respuesta de billing autenticada puede hacerlo.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_PRO_KEY = "screenrec_pro_v1";
const LEGACY_EMAIL_KEY = "screenrec_email_v1";

const HTML_PATH = resolve(__dirname, "../../index.html");

/** Extrae el contenido del body del index.html real. */
function loadBodyMarkup(): string {
  const html = readFileSync(HTML_PATH, "utf-8");
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!match) throw new Error("No se encontró el <body> en index.html");
  return match[1].replace(/<script[\s\S]*?<\/script>/gi, "");
}

beforeEach(() => {
  document.body.innerHTML = loadBodyMarkup();
  localStorage.clear();
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36",
    userAgentData: { mobile: false },
    mediaDevices: { getDisplayMedia: vi.fn() },
  });
  vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });
  (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  vi.resetModules();
});

describe("marcadores Pro heredados en localStorage", () => {
  beforeEach(() => {
    localStorage.setItem(LEGACY_PRO_KEY, "true");
  });

  it("no acepta el flag local como prueba de suscripción", async () => {
    const { Dashboard } = await import("./dashboard");
    new Dashboard();

    expect(document.getElementById("heroBanner")!.style.display).not.toBe("none");
    expect(document.getElementById("userPlan")!.textContent).toMatch(/gratuito/i);
    expect(document.getElementById("userName")!.textContent).toBe("Invitado");
  });

  it("mantiene visible la oferta y los candados sin entitlement del backend", async () => {
    const { Dashboard } = await import("./dashboard");
    new Dashboard();

    expect(document.getElementById("upgradeBtn")!.style.display).not.toBe("none");
    const resolution = document.getElementById("resolutionSelect") as HTMLSelectElement;
    const labels = Array.from(resolution.options).map((option) => option.textContent ?? "");
    expect(labels.some((label) => /Pro|🔒|lock/i.test(label))).toBe(true);
  });

  it("ya no expone activación OTP local y mantiene checkout deshabilitado hasta configurar Supabase", async () => {
    const { Dashboard } = await import("./dashboard");
    new Dashboard();
    (document.getElementById("upgradeBtn") as HTMLButtonElement).click();

    expect((document.getElementById("monthlyCheckoutBtn") as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((document.getElementById("annualCheckoutBtn") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("modalVerifyBtn")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Activar Pro|Verificar por correo/);
    expect(document.body.textContent).not.toMatch(/Stripe/i);
  });

  it("ignora el correo antiguo guardado en el navegador", async () => {
    localStorage.setItem(LEGACY_EMAIL_KEY, "persona@gmail.com");
    const { Dashboard } = await import("./dashboard");
    new Dashboard();

    expect(document.getElementById("userName")!.textContent).toBe("Invitado");
  });
});
