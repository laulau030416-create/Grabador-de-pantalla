import { describe, it, expect, beforeEach } from "vitest";
import {
  isPro,
  setProFromEntitlement,
  getDailyLimitSeconds,
  getUsedSeconds,
  getRemainingSeconds,
  canRecord,
  consumeSeconds,
  resetUsage,
} from "@/core/usage";
import { FREE_DAILY_SECONDS } from "@/config/constants";

beforeEach(() => {
  localStorage.clear();
  setProFromEntitlement(false);
});

describe("plan gratuito", () => {
  it("empieza con el crédito diario completo", () => {
    expect(getDailyLimitSeconds()).toBe(FREE_DAILY_SECONDS);
    expect(getUsedSeconds()).toBe(0);
    expect(getRemainingSeconds()).toBe(FREE_DAILY_SECONDS);
    expect(canRecord()).toBe(true);
  });

  it("descuenta el tiempo consumido", () => {
    consumeSeconds(60);
    expect(getUsedSeconds()).toBe(60);
    expect(getRemainingSeconds()).toBe(FREE_DAILY_SECONDS - 60);
  });

  it("no permite crédito negativo y bloquea al agotarse", () => {
    consumeSeconds(FREE_DAILY_SECONDS + 100);
    expect(getRemainingSeconds()).toBe(0);
    expect(canRecord()).toBe(false);
  });

  it("resetUsage reinicia el crédito", () => {
    consumeSeconds(120);
    resetUsage();
    expect(getRemainingSeconds()).toBe(FREE_DAILY_SECONDS);
  });
});

describe("plan Pro", () => {
  it("activa y desactiva el estado Pro", () => {
    expect(isPro()).toBe(false);
    setProFromEntitlement(true);
    expect(isPro()).toBe(true);
    setProFromEntitlement(false);
    expect(isPro()).toBe(false);
  });

  it("otorga tiempo ilimitado y no consume crédito", () => {
    setProFromEntitlement(true);
    expect(getRemainingSeconds()).toBe(Infinity);
    consumeSeconds(1000);
    expect(getUsedSeconds()).toBe(0);
    expect(canRecord()).toBe(true);
  });

  it("ignora un marcador Pro heredado o manipulado en localStorage", () => {
    localStorage.setItem("screenrec_pro_v1", "true");
    expect(isPro()).toBe(false);
    expect(getRemainingSeconds()).toBe(FREE_DAILY_SECONDS);
  });
});
