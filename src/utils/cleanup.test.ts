import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  revokeObjectUrl,
  stopMediaStreamTracks,
  cleanupRecordingResources,
  clearCanvas,
} from "@/utils/cleanup";

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom no implementa URL.revokeObjectURL, así que lo definimos como mock espiable.
beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function createFakeStream(trackCount: number): { stream: MediaStream; stops: number[] } {
  const stops: number[] = [];
  const tracks = Array.from({ length: trackCount }, (_, i) => ({
    stop: (): void => {
      stops.push(i);
    },
  }));
  const stream = {
    getTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, stops };
}

describe("revokeObjectUrl", () => {
  it("revoca la URL cuando se proporciona una", () => {
    revokeObjectUrl("blob:fake-url");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("no hace nada cuando la URL es null", () => {
    revokeObjectUrl(null);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe("stopMediaStreamTracks", () => {
  it("detiene todas las pistas del stream", () => {
    const { stream, stops } = createFakeStream(3);
    stopMediaStreamTracks(stream);
    expect(stops).toEqual([0, 1, 2]);
  });

  it("no lanza error con un stream null", () => {
    expect(() => stopMediaStreamTracks(null)).not.toThrow();
  });
});

describe("cleanupRecordingResources", () => {
  it("revoca la URL y detiene ambos streams", () => {
    const a = createFakeStream(1);
    const b = createFakeStream(2);
    cleanupRecordingResources("blob:x", a.stream, b.stream);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    expect(a.stops).toEqual([0]);
    expect(b.stops).toEqual([0, 1]);
  });
});

describe("clearCanvas", () => {
  it("reduce el tamaño del canvas a 1x1", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    clearCanvas(canvas);
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });

  it("no lanza error con un canvas null", () => {
    expect(() => clearCanvas(null)).not.toThrow();
  });
});
