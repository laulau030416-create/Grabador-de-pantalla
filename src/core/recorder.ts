/**
 * Módulo principal del grabador para SCREENREC
 * Implementa el patrón Singleton para garantizar una sola instancia.
 */

import {
  DEFAULT_CONFIG,
  CHUNK_DURATION_MS,
  ERROR_MESSAGES,
  AUDIO_BITRATE,
} from "@/config/constants";
import {
  resolveFormat,
  isMediaRecorderSupported,
  isCanvasCaptureStreamSupported,
} from "@/utils/detect";
import { generateFilename } from "@/utils/format";
import { cleanupRecordingResources, clearCanvas } from "@/utils/cleanup";
import {
  getDisplayStream,
  calculateCanvasDimensions,
  createCanvas,
  drawFrame,
  createCanvasStream,
  combineStreams,
  getWebcamStream,
  getMicStream,
  drawWebcamOverlay,
} from "./stream";
import type {
  RecordingConfig,
  RecordingResult,
  RecorderState,
  RecorderEvent,
  RecorderEventCallback,
  ResolvedFormat,
  CanvasDimensions,
} from "@/types";

/**
 * Clase principal del grabador (Singleton).
 */
export class ScreenRecorder {
  private static instance: ScreenRecorder | null = null;

  private recorder: MediaRecorder | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sourceVideo: HTMLVideoElement | null = null;
  private displayStream: MediaStream | null = null;
  private canvasStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private lastFormat: ResolvedFormat | null = null;
  /** Controla el bucle de dibujo, independiente del estado de grabación. */
  private renderActive = false;

  // Modo creador de contenido
  private webcamStream: MediaStream | null = null;
  private webcamVideo: HTMLVideoElement | null = null;
  private micStream: MediaStream | null = null;
  private creatorConfig: RecordingConfig | null = null;

  private data: Blob[] = [];
  private recordingResultPromise: Promise<RecordingResult> | null = null;
  private animationFrameId: number | null = null;
  private state: RecorderState = {
    isRecording: false,
    isPaused: false,
    currentTime: 0,
    error: null,
    panValue: 0.5,
  };

  private eventCallbacks: Set<RecorderEventCallback> = new Set();

  private constructor() {
    // Constructor privado para Singleton
  }

  /**
   * Obtiene la instancia del grabador (Singleton).
   * @returns {ScreenRecorder} Instancia del grabador.
   */
  public static getInstance(): ScreenRecorder {
    if (!ScreenRecorder.instance) {
      ScreenRecorder.instance = new ScreenRecorder();
    }
    return ScreenRecorder.instance;
  }

  /**
   * Suscribe un callback a los eventos del grabador.
   * @param {RecorderEventCallback} callback - Función callback.
   * @returns {() => void} Función para desuscribirse.
   */
  public subscribe(callback: RecorderEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Emite un evento a todos los suscriptores.
   * @param {RecorderEvent} event - Evento a emitir.
   * @param {unknown} data - Datos adicionales.
   */
  private emitEvent(event: RecorderEvent, data?: unknown): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error("Error en callback de evento:", error);
      }
    });
  }

  /**
   * Obtiene el estado actual del grabador.
   * @returns {RecorderState} Estado actual.
   */
  public getState(): RecorderState {
    return { ...this.state };
  }

  /**
   * Inicia una nueva grabación.
   * @param {RecordingConfig} config - Configuración de la grabación.
   * @param {HTMLVideoElement} previewElement - Elemento para la vista previa.
   * @returns {Promise<RecordingResult>} Resultado de la grabación.
   * @throws {Error} Si no se puede iniciar la grabación.
   */
  public async startRecording(
    config: Partial<RecordingConfig> = {},
    previewElement?: HTMLVideoElement
  ): Promise<RecordingResult> {
    // Validar que no haya una grabación en curso
    if (this.state.isRecording) {
      throw new Error("Ya hay una grabación en curso.");
    }

    // Limpiar recursos previos
    this.cleanup();

    // Mergear configuración con valores por defecto
    const fullConfig: RecordingConfig = { ...DEFAULT_CONFIG, ...config };

    // Validar soporte del navegador
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_BROWSER);
    }
    if (!isMediaRecorderSupported() || !isCanvasCaptureStreamSupported()) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_BROWSER);
    }

    try {
      // Obtener stream de pantalla
      this.displayStream = await getDisplayStream(fullConfig);

      // Crear elemento de video fuente ANTES del canvas, para conocer las
      // dimensiones reales de la captura y así no recortar en horizontal.
      this.sourceVideo = document.createElement("video");
      this.sourceVideo.srcObject = this.displayStream;
      this.sourceVideo.muted = true;
      this.sourceVideo.autoplay = true;
      this.sourceVideo.playsInline = true;
      // No se espera a play(): en algunos navegadores su promesa tarda en
      // resolverse y bloquearía el arranque. waitForVideoDimensions ya espera
      // a que el vídeo esté listo, con un tiempo máximo de seguridad.
      void this.sourceVideo.play().catch(() => undefined);
      await this.waitForVideoDimensions(this.sourceVideo);

      // Calcular dimensiones del canvas usando el tamaño real capturado.
      const canvasDims = calculateCanvasDimensions(
        fullConfig,
        this.sourceVideo.videoWidth,
        this.sourceVideo.videoHeight
      );

      // Crear canvas y contexto
      const { canvas, ctx } = createCanvas(canvasDims);
      this.canvas = canvas;
      this.ctx = ctx;

      // Modo creador: webcam y micrófono. Se piden antes de dibujar para que
      // el círculo aparezca desde el primer fotograma.
      this.creatorConfig = fullConfig;
      if (fullConfig.webcam) {
        await this.setupWebcam();
      }
      if (fullConfig.includeMic) {
        this.micStream = await getMicStream();
      }

      // Pintar ya el primer fotograma: si el canvas está vacío, su stream no
      // produce imagen y la vista previa se quedaría en negro.
      this.paintFrame(canvasDims);

      // Crear stream del canvas
      const fps = fullConfig.framerate === "30" ? 30 : 60;
      this.canvasStream = createCanvasStream(this.canvas, fps);

      // Arrancar el bucle de dibujo ANTES de la vista previa y del MediaRecorder,
      // para que el stream del canvas tenga imagen desde el principio.
      this.startRenderLoop();

      // La vista previa muestra el CANVAS, no la captura original: así se ve
      // exactamente lo que se va a grabar, incluido el recorte vertical y los
      // cambios del control de enfoque en tiempo real.
      if (previewElement) {
        previewElement.srcObject = this.canvasStream;
        previewElement.style.display = "block";
        // El canvas ya viene recortado, así que se muestra completo.
        previewElement.style.objectFit = "contain";
        // No se espera a play(): su promesa no se resuelve hasta que llega un
        // fotograma, lo que bloquearía el arranque de la grabación.
        void previewElement.play().catch(() => undefined);
      }

      // Combinar streams: vídeo del canvas + audio del sistema y/o micrófono.
      const hasSystemAudio =
        fullConfig.includeAudio && this.displayStream.getAudioTracks().length > 0;
      const hasMic = !!this.micStream && this.micStream.getAudioTracks().length > 0;

      if (hasSystemAudio || hasMic) {
        const combined = combineStreams(
          this.canvasStream,
          hasSystemAudio ? this.displayStream : new MediaStream(),
          hasMic ? this.micStream : null
        );
        this.combinedStream = combined.stream;
        this.audioContext = combined.audioContext;
      } else {
        this.combinedStream = this.canvasStream;
      }

      // Resolver el formato pedido por el usuario (con fallback si no hay soporte)
      const resolved = resolveFormat(fullConfig.format);
      const { mimeType, ext } = resolved;
      this.lastFormat = resolved;

      // Configurar MediaRecorder
      const bitrate =
        fullConfig.bitrate === "8000000"
          ? 8_000_000
          : fullConfig.bitrate === "16000000"
            ? 16_000_000
            : 30_000_000;
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: bitrate,
        // Sin fijar el bitrate de audio, el navegador aplica un valor bajo
        // pensado para voz y el sonido se graba con peor calidad que el original.
        audioBitsPerSecond: AUDIO_BITRATE,
      };

      this.recorder = new MediaRecorder(this.combinedStream, options);
      this.data = [];

      // La misma promesa es esperada por startRecording y stopRecording.
      const resultPromise = new Promise<RecordingResult>((resolve, reject) => {
        this.recorder!.onstop = (): void => {
          try {
            this.stopRenderLoop();
            const blob = new Blob(this.data, { type: mimeType });
            const filename = generateFilename(ext as "mp4" | "webm");
            const url = URL.createObjectURL(blob);
            const result: RecordingResult = {
              blob,
              filename,
              ext: ext as "mp4" | "webm",
              url,
            };

            this.emitEvent("stop", result);
            resolve(result);
          } catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));
            this.emitEvent("error", failure);
            reject(failure);
          } finally {
            this.cleanup();
          }
        };

        this.recorder!.onerror = (event: Event): void => {
          const error =
            (event as Event & { error?: Error }).error ?? new Error("Error desconocido");
          this.state.error = error;
          this.emitEvent("error", error);
          reject(error);
          this.cleanup();
        };
      });
      this.recordingResultPromise = resultPromise;

      this.recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) {
          this.data.push(event.data);
        }
      };

      // Iniciar grabación
      this.recorder.start(CHUNK_DURATION_MS);
      this.state.isRecording = true;
      this.state.isPaused = false;
      this.state.error = null;

      this.emitEvent("start");

      // Manejar finalización de la captura (ej: usuario cierra la pestaña)
      this.displayStream.getVideoTracks()[0].onended = (): void => {
        if (this.recorder && this.recorder.state !== "inactive") {
          void this.stopRecording();
        }
      };

      return resultPromise;
    } catch (error) {
      this.cleanup();
      this.emitEvent("error", error);
      throw error;
    }
  }

  /**
   * Detiene la grabación actual.
   * @returns {Promise<RecordingResult | null>} Resultado de la grabación o null si no había ninguna.
   */
  public async stopRecording(): Promise<RecordingResult | null> {
    if (!this.state.isRecording || !this.recorder) {
      return null;
    }

    const resultPromise = this.recordingResultPromise;
    this.stopRenderLoop();
    if (this.recorder.state !== "inactive") this.recorder.stop();
    return resultPromise;
  }

  /**
   * Pausa la grabación.
   */
  public pauseRecording(): void {
    if (!this.state.isRecording || this.state.isPaused || this.recorder?.state !== "recording") {
      return;
    }
    this.recorder.pause();
    this.state.isPaused = true;
    this.emitEvent("pause");
  }

  /**
   * Reanuda la grabación.
   */
  public resumeRecording(): void {
    if (!this.state.isRecording || !this.state.isPaused || this.recorder?.state !== "paused") {
      return;
    }
    this.recorder.resume();
    this.state.isPaused = false;
    this.emitEvent("resume");
  }

  /**
   * Espera a que el elemento de video tenga dimensiones válidas.
   * @param {HTMLVideoElement} video - Elemento de video fuente.
   * @returns {Promise<void>} Se resuelve cuando el video reporta dimensiones.
   */
  private waitForVideoDimensions(video: HTMLVideoElement): Promise<void> {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onReady = (): void => {
        video.removeEventListener("loadedmetadata", onReady);
        resolve();
      };
      video.addEventListener("loadedmetadata", onReady);
      // Salvaguarda: no bloquear indefinidamente.
      setTimeout(resolve, 1500);
    });
  }

  /**
   * Inicia el bucle de renderizado del canvas.
   */
  private startRenderLoop(): void {
    // El bucle se controla con su propio flag, no con `isRecording`, para poder
    // alimentar la vista previa antes de que empiece la grabación.
    this.renderActive = true;

    const renderFrame = (): void => {
      if (!this.renderActive || !this.sourceVideo || !this.ctx || !this.canvas) {
        return;
      }

      this.paintFrame({ width: this.canvas.width, height: this.canvas.height });
      this.animationFrameId = requestAnimationFrame(renderFrame);
    };

    // Iniciar el bucle
    renderFrame();
  }

  /**
   * Pinta un fotograma completo: la captura y, si procede, la webcam encima.
   * @param {CanvasDimensions} canvasDims - Dimensiones del canvas.
   */
  private paintFrame(canvasDims: CanvasDimensions): void {
    if (!this.sourceVideo || !this.ctx) return;

    drawFrame(this.sourceVideo, this.ctx, canvasDims, this.state.panValue);

    // La webcam se dibuja después para que quede por encima de la captura.
    if (this.webcamVideo && this.creatorConfig?.webcam) {
      drawWebcamOverlay(
        this.webcamVideo,
        this.ctx,
        canvasDims,
        this.creatorConfig.webcamPosition,
        this.creatorConfig.webcamSize
      );
    }
  }

  /**
   * Prepara la webcam del modo creador.
   *
   * Si la cámara falla, la grabación continúa sin ella: es preferible grabar
   * sin el círculo que perder la captura entera.
   */
  private async setupWebcam(): Promise<void> {
    try {
      this.webcamStream = await getWebcamStream();

      const video = document.createElement("video");
      video.srcObject = this.webcamStream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      void video.play().catch(() => undefined);
      await this.waitForVideoDimensions(video);

      this.webcamVideo = video;
    } catch (error) {
      console.warn("No se pudo activar la webcam, se graba sin ella:", error);
      this.webcamStream = null;
      this.webcamVideo = null;
    }
  }

  /**
   * Indica si la webcam está activa en la grabación en curso.
   * @returns {boolean} true si se está superponiendo la cámara.
   */
  public isWebcamActive(): boolean {
    return !!this.webcamVideo;
  }

  /**
   * Detiene el bucle de renderizado.
   */
  private stopRenderLoop(): void {
    this.renderActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Devuelve el formato realmente usado en la última grabación.
   * @returns {ResolvedFormat | null} Formato resuelto o null si no se ha grabado.
   */
  public getLastFormat(): ResolvedFormat | null {
    return this.lastFormat;
  }

  /**
   * Actualiza el valor de pan (para modo vertical).
   * @param {number} value - Valor de pan (0 a 1).
   */
  public updatePanValue(value: number): void {
    // Clamp entre 0 y 1
    this.state.panValue = Math.max(0, Math.min(1, value));
  }

  /**
   * Limpia todos los recursos del grabador.
   */
  private cleanup(): void {
    // Detener el bucle de renderizado
    this.stopRenderLoop();

    // Limpiar recursos de grabación
    cleanupRecordingResources(null, this.displayStream, this.canvasStream);

    // Cerrar el AudioContext usado para inyectar el audio
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }

    // Limpiar canvas
    clearCanvas(this.canvas);

    // Limpiar source video
    if (this.sourceVideo) {
      this.sourceVideo.srcObject = null;
      this.sourceVideo = null;
    }

    // Liberar webcam y micrófono: si no se detienen sus pistas, la cámara
    // sigue encendida (con su luz avisando) después de grabar.
    this.webcamStream?.getTracks().forEach((track) => track.stop());
    this.webcamStream = null;
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }

    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.creatorConfig = null;

    // Limpiar recorder
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      this.recorder = null;
    }

    // Resetear estado
    this.data = [];
    this.recordingResultPromise = null;
    this.state = {
      isRecording: false,
      isPaused: false,
      currentTime: 0,
      error: null,
      panValue: 0.5,
    };
  }

  /**
   * Libera la instancia del grabador (para pruebas).
   */
  public static releaseInstance(): void {
    if (ScreenRecorder.instance) {
      ScreenRecorder.instance.cleanup();
      ScreenRecorder.instance = null;
    }
  }
}

// Exportar instancia por defecto
export const recorder = ScreenRecorder.getInstance();
