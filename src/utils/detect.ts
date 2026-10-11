/**
 * Funciones de detección de capacidades del navegador para SCREENREC
 */

import { VIDEO_FORMATS } from "@/config/constants";
import type { ResolvedFormat } from "@/types";

/**
 * Detecta si el navegador soporta la API getDisplayMedia.
 * @returns {boolean} True si está soportado.
 */
export function isDisplayMediaSupported(): boolean {
  return !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Detecta si el navegador soporta MediaRecorder.
 * @returns {boolean} True si está soportado.
 */
export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

function supportsMimeType(mimeType: string): boolean {
  return (
    isMediaRecorderSupported() &&
    typeof MediaRecorder.isTypeSupported === "function" &&
    MediaRecorder.isTypeSupported(mimeType)
  );
}

/**
 * Detecta si el navegador soporta la API Canvas captureStream.
 * @returns {boolean} True si está soportado.
 */
export function isCanvasCaptureStreamSupported(): boolean {
  return !!HTMLCanvasElement.prototype.captureStream;
}

/**
 * Detecta si el navegador soporta AudioContext.
 * @returns {boolean} True si está soportado.
 */
export function isAudioContextSupported(): boolean {
  return !!window.AudioContext;
}

/**
 * Detecta el mejor formato de video soportado por el navegador.
 * @returns {{ mimeType: string; ext: string; label: string }} Mejor formato soportado.
 */
export function detectBestFormat(): { mimeType: string; ext: string; label: string } {
  for (const format of VIDEO_FORMATS) {
    if (supportsMimeType(format.mimeType)) {
      return format;
    }
  }
  // Fallback a WebM si no se encuentra nada
  return VIDEO_FORMATS.find((f) => f.ext === "webm")!;
}

/**
 * Indica si un formato concreto (por extensión) está soportado.
 * @param {("mp4"|"webm")} ext - Extensión deseada.
 * @returns {boolean} True si hay algún mimeType soportado para esa extensión.
 */
export function isFormatSupported(ext: "mp4" | "webm"): boolean {
  return VIDEO_FORMATS.some((format) => format.ext === ext && supportsMimeType(format.mimeType));
}

/**
 * Resuelve el formato de salida a partir del preferido, con fallback inteligente.
 *
 * Si el formato pedido no está soportado por el navegador, se devuelve el mejor
 * formato disponible marcando `fellBack: true` para poder avisar en la interfaz.
 *
 * @param {("mp4"|"webm")} preferred - Formato solicitado por el usuario.
 * @returns {ResolvedFormat} Formato definitivo a usar.
 */
export function resolveFormat(preferred: "mp4" | "webm"): ResolvedFormat {
  if (!isMediaRecorderSupported()) {
    const fallback = VIDEO_FORMATS.find((format) => format.ext === "webm")!;
    return { ...fallback, ext: "webm", fellBack: preferred !== "webm" };
  }

  const match = VIDEO_FORMATS.find(
    (format) => format.ext === preferred && supportsMimeType(format.mimeType)
  );

  if (match) {
    return { ...match, ext: match.ext as "mp4" | "webm", fellBack: false };
  }

  const best = detectBestFormat();
  return {
    ...best,
    ext: best.ext as "mp4" | "webm",
    fellBack: best.ext !== preferred,
  };
}

/**
 * Indica si se está usando un móvil o tablet.
 *
 * Es relevante porque **ningún navegador móvil permite capturar la pantalla**
 * desde una web: en Android la API existe pero rechaza siempre la petición, y
 * en iOS no está disponible. Detectarlo permite explicarlo con claridad en vez
 * de mostrar un error genérico.
 *
 * @returns {boolean} true si el dispositivo es móvil o tablet.
 */
export function isMobileDevice(): boolean {
  try {
    const nav = navigator as Navigator & {
      userAgentData?: { mobile?: boolean };
      maxTouchPoints?: number;
    };

    if (typeof nav.userAgentData?.mobile === "boolean") {
      return nav.userAgentData.mobile;
    }

    const ua = nav.userAgent ?? "";
    if (/Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return true;

    // iPad moderno se identifica como Mac: se distingue por el táctil.
    const isIpad = /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
    return isIpad || /iPad|Tablet|Silk/i.test(ua);
  } catch {
    return false;
  }
}

/**
 * Indica si el dispositivo puede grabar la pantalla realmente.
 * @returns {boolean} true si la captura de pantalla es posible.
 */
export function canCaptureScreen(): boolean {
  return isBrowserSupported() && !isMobileDevice();
}

/**
 * Verifica si el navegador soporta todas las APIs necesarias para SCREENREC.
 * @returns {boolean} True si todo está soportado.
 */
export function isBrowserSupported(): boolean {
  return (
    isDisplayMediaSupported() && isMediaRecorderSupported() && isCanvasCaptureStreamSupported()
  );
}

/**
 * Obtiene información detallada sobre el soporte del navegador.
 * @returns {Record<string, boolean>} Objeto con el estado de cada API.
 */
export function getBrowserSupportInfo(): Record<string, boolean> {
  return {
    displayMedia: isDisplayMediaSupported(),
    mediaRecorder: isMediaRecorderSupported(),
    canvasCaptureStream: isCanvasCaptureStreamSupported(),
    audioContext: isAudioContextSupported(),
  };
}
