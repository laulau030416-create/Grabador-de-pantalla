/**
 * Modo creador de contenido: webcam en círculo, micrófono y limpieza.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { drawWebcamOverlay, combineStreams } from "@/core/stream";
import { WEBCAM_SIZES } from "@/config/constants";
import type { WebcamPosition } from "@/types";

/**
 * Crea un contexto de canvas falso que registra las llamadas.
 * @returns {object} Contexto simulado.
 */
function fakeCtx(): CanvasRenderingContext2D & {
  arcCalls: number[][];
  drawCalls: number[][];
  clipCalls: number;
} {
  const arcCalls: number[][] = [];
  const drawCalls: number[][] = [];
  const ctx = {
    arcCalls,
    drawCalls,
    clipCalls: 0,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    arc: (x: number, y: number, r: number): void => {
      arcCalls.push([x, y, r]);
    },
    clip: function (this: { clipCalls: number }): void {
      this.clipCalls += 1;
    },
    drawImage: (...args: unknown[]): void => {
      drawCalls.push(args.slice(1) as number[]);
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & {
    arcCalls: number[][];
    drawCalls: number[][];
    clipCalls: number;
  };
}

/**
 * Vídeo de webcam simulado.
 * @param {number} w - Ancho.
 * @param {number} h - Alto.
 * @returns {HTMLVideoElement} Elemento simulado.
 */
function fakeWebcam(w = 720, h = 720): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as HTMLVideoElement;
}

const DIMS = { width: 1920, height: 1080 };

describe("drawWebcamOverlay", () => {
  it("dibuja la cámara recortada en círculo", () => {
    const ctx = fakeCtx();
    drawWebcamOverlay(fakeWebcam(), ctx, DIMS, "bottom-right", "medium");

    // Debe recortar con un círculo antes de dibujar la imagen.
    expect(ctx.clipCalls).toBeGreaterThan(0);
    expect(ctx.arcCalls.length).toBeGreaterThan(0);
    expect(ctx.drawCalls.length).toBe(1);
  });

  it("respeta el tamaño elegido", () => {
    const small = fakeCtx();
    const large = fakeCtx();
    drawWebcamOverlay(fakeWebcam(), small, DIMS, "bottom-right", "small");
    drawWebcamOverlay(fakeWebcam(), large, DIMS, "bottom-right", "large");

    const smallRadius = small.arcCalls[0][2];
    const largeRadius = large.arcCalls[0][2];
    expect(largeRadius).toBeGreaterThan(smallRadius);

    // El diámetro se calcula sobre el lado menor del vídeo.
    const expected = (Math.min(DIMS.width, DIMS.height) * WEBCAM_SIZES[0].ratio) / 2;
    expect(smallRadius).toBeCloseTo(expected, 0);
  });

  it("coloca el círculo en la esquina indicada", () => {
    const positions: WebcamPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
    const centers = positions.map((position) => {
      const ctx = fakeCtx();
      drawWebcamOverlay(fakeWebcam(), ctx, DIMS, position, "medium");
      return { position, x: ctx.arcCalls[0][0], y: ctx.arcCalls[0][1] };
    });

    const mid = { x: DIMS.width / 2, y: DIMS.height / 2 };
    centers.forEach(({ position, x, y }) => {
      const expectRight = position.endsWith("right");
      const expectBottom = position.startsWith("bottom");
      expect(x > mid.x, `${position} en X`).toBe(expectRight);
      expect(y > mid.y, `${position} en Y`).toBe(expectBottom);
    });

    // Y siempre dentro del lienzo.
    centers.forEach(({ x, y }) => {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(DIMS.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(DIMS.height);
    });
  });

  it("recorta el centro de la cámara para no deformarla", () => {
    const ctx = fakeCtx();
    // Cámara panorámica: debe tomarse un cuadrado central.
    drawWebcamOverlay(fakeWebcam(1280, 720), ctx, DIMS, "bottom-right", "medium");

    const [sx, sy, sw, sh] = ctx.drawCalls[0];
    expect(sw).toBe(720);
    expect(sh).toBe(720);
    expect(sx).toBe((1280 - 720) / 2);
    expect(sy).toBe(0);
  });

  it("no dibuja nada si la cámara aún no tiene imagen", () => {
    const ctx = fakeCtx();
    drawWebcamOverlay(fakeWebcam(0, 0), ctx, DIMS, "bottom-right", "medium");
    expect(ctx.drawCalls.length).toBe(0);
  });
});

describe("combineStreams con micrófono", () => {
  let connections: number;

  beforeEach(() => {
    connections = 0;

    // jsdom no implementa MediaStream: se simula lo justo que usa el código.
    vi.stubGlobal(
      "MediaStream",
      class {
        private tracks: MediaStreamTrack[];
        constructor(tracks: MediaStreamTrack[] = []) {
          this.tracks = [...tracks];
        }
        addTrack(track: MediaStreamTrack): void {
          this.tracks.push(track);
        }
        getAudioTracks(): MediaStreamTrack[] {
          return this.tracks.filter((t) => t.kind === "audio");
        }
        getVideoTracks(): MediaStreamTrack[] {
          return this.tracks.filter((t) => t.kind === "video");
        }
        getTracks(): MediaStreamTrack[] {
          return [...this.tracks];
        }
      }
    );

    const destination = {
      stream: { getAudioTracks: (): { kind: string }[] => [{ kind: "audio" }] },
    };
    vi.stubGlobal(
      "AudioContext",
      class {
        public state = "running";
        createMediaStreamDestination = (): typeof destination => destination;
        createMediaStreamSource = (): { connect: () => void } => ({
          connect: (): void => {
            connections += 1;
          },
        });
        createGain = (): { gain: { value: number }; connect: () => void } => ({
          gain: { value: 1 },
          connect: (): void => {
            connections += 1;
          },
        });
        resume = vi.fn();
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Crea un stream simulado.
   * @param {number} audio - Número de pistas de audio.
   * @param {number} video - Número de pistas de vídeo.
   * @returns {MediaStream} Stream simulado.
   */
  function stream(audio: number, video = 0): MediaStream {
    const tracks = { audio, video };
    return {
      getAudioTracks: () => Array.from({ length: tracks.audio }, () => ({ kind: "audio" })),
      getVideoTracks: () => Array.from({ length: tracks.video }, () => ({ kind: "video" })),
      addTrack: vi.fn(),
    } as unknown as MediaStream;
  }

  it("mezcla el audio del sistema y el micrófono en una sola pista", () => {
    const result = combineStreams(stream(0, 1), stream(1), stream(1));

    expect(result.audioContext).not.toBeNull();
    // Sistema (1 conexión) + micrófono a través de la ganancia (2 conexiones).
    expect(connections).toBe(3);
  });

  it("funciona solo con micrófono, sin audio del sistema", () => {
    const result = combineStreams(stream(0, 1), stream(0), stream(1));
    expect(result.audioContext).not.toBeNull();
    expect(connections).toBe(2);
  });

  it("no crea contexto de audio si no hay ninguna fuente", () => {
    const result = combineStreams(stream(0, 1), stream(0), null);
    expect(result.audioContext).toBeNull();
    expect(connections).toBe(0);
  });
});
