import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveFormat, isFormatSupported } from "@/utils/detect";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Simula el soporte de MediaRecorder para ciertos tipos MIME.
 * @param {string[]} supported - Fragmentos de mimeType soportados.
 */
function stubSupport(supported: string[]): void {
  vi.stubGlobal("MediaRecorder", {
    isTypeSupported: (type: string) => supported.some((s) => type.includes(s)),
  });
}

describe("isFormatSupported", () => {
  it("devuelve false sin lanzar si MediaRecorder no existe", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(isFormatSupported("mp4")).toBe(false);
    expect(isFormatSupported("webm")).toBe(false);
  });

  it("detecta soporte de mp4", () => {
    stubSupport(["mp4"]);
    expect(isFormatSupported("mp4")).toBe(true);
    expect(isFormatSupported("webm")).toBe(false);
  });

  it("detecta soporte de webm", () => {
    stubSupport(["webm"]);
    expect(isFormatSupported("webm")).toBe(true);
    expect(isFormatSupported("mp4")).toBe(false);
  });
});

describe("resolveFormat", () => {
  it("usa un fallback seguro cuando MediaRecorder no existe", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(resolveFormat("mp4")).toMatchObject({ ext: "webm", fellBack: true });
  });

  it("devuelve el formato pedido si está soportado", () => {
    stubSupport(["mp4", "webm"]);
    const result = resolveFormat("mp4");
    expect(result.ext).toBe("mp4");
    expect(result.fellBack).toBe(false);
  });

  it("hace fallback a webm si mp4 no está soportado", () => {
    stubSupport(["webm"]);
    const result = resolveFormat("mp4");
    expect(result.ext).toBe("webm");
    expect(result.fellBack).toBe(true);
  });

  it("hace fallback a mp4 si webm no está soportado", () => {
    stubSupport(["mp4"]);
    const result = resolveFormat("webm");
    expect(result.ext).toBe("mp4");
    expect(result.fellBack).toBe(true);
  });

  it("devuelve siempre un mimeType utilizable", () => {
    stubSupport(["webm"]);
    expect(resolveFormat("mp4").mimeType).toBeTruthy();
  });
});
