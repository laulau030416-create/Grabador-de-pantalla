/**
 * Módulo del Dashboard para SCREENREC (v4)
 * Controla la interfaz: sidebar, banner, grabador, plan, galería, FAQs y Pro.
 */

import {
  recorder,
  isPro,
  getRemainingSeconds,
  getDailyLimitSeconds,
  getRecordingLimitSeconds,
  consumeSeconds,
  canRecord,
  library,
  estimateStorage,
  requestPersistentStorage,
} from "@/core";
import { setProFromEntitlement } from "@/core/usage";
import {
  createBillingPortalUrl,
  createCheckoutUrl,
  isBillingConfigured,
  sendBillingMagicLink,
  signOutBillingUser,
  watchBillingStatus,
} from "@/core/billing";
import type { BillingInterval } from "@/core/billing";
import {
  DEFAULT_CONFIG,
  FREE_DEFAULTS,
  PRO_ONLY,
  ORIENTATIONS,
  RESOLUTIONS,
  FRAMERATES,
  BITRATES,
  FORMAT_OPTIONS,
  WEBCAM_POSITIONS,
  WEBCAM_SIZES,
  COUNTDOWN_SECONDS,
  ERROR_MESSAGES,
  APP_BENEFITS,
  NAV_ITEMS,
  FAQ_ITEMS,
  FAQ_CATEGORIES,
  PRO,
  STORAGE_KEYS,
  ICONS,
} from "@/config/constants";
import {
  getBrowserSupportInfo,
  isFormatSupported,
  isMobileDevice,
  canCaptureScreen,
} from "@/utils/detect";
import { formatTime, formatFileSize } from "@/utils/format";
import { Select, type SelectOption } from "./components/Select";
import { Toggle } from "./components/Toggle";
import type { RecordingConfig, RecordingResult, WebcamPosition, WebcamSize } from "@/types";
import type { LibraryItem } from "@/core";

/** Ajustes que pueden estar reservados al plan Pro. */
type GatedSetting = "resolution" | "framerate" | "bitrate";

/**
 * Formatea segundos como MM:SS.
 * @param {number} seconds - Segundos a formatear.
 * @returns {string} Cadena MM:SS o el símbolo de infinito.
 */
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "∞";
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Detecta si el viewport es de móvil.
 * @returns {boolean} true si es una pantalla pequeña.
 */
function isMobileViewport(): boolean {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 680px)").matches;
  }
  return window.innerWidth > 0 && window.innerWidth <= 680;
}

/**
 * Escapa texto para insertarlo de forma segura en HTML.
 * @param {string} value - Texto a escapar.
 * @returns {string} Texto escapado.
 */
function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

/**
 * Clase principal del Dashboard.
 */
export class Dashboard {
  // Escenario
  private videoStage!: HTMLElement;
  private placeholderText!: HTMLElement;
  private liveIndicator!: HTMLElement;
  private statusBadge!: HTMLElement;
  private previewVideo!: HTMLVideoElement;
  private resultVideo!: HTMLVideoElement;
  private downloadLink!: HTMLAnchorElement;
  private discardBtn!: HTMLButtonElement;
  private saveLibraryBtn!: HTMLButtonElement;
  private startBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private panControl!: HTMLElement;
  private panSlider!: HTMLInputElement;
  private actionFooter!: HTMLElement;
  private recTimer!: HTMLElement;
  private recCounter!: HTMLElement;
  private recElapsed!: HTMLElement;
  private recLimitEl!: HTMLElement;
  private qualityPill!: HTMLElement;
  private formatPill!: HTMLElement;
  private fullscreenBtn!: HTMLButtonElement;

  // Sidebar y plan
  private appEl!: HTMLElement;
  private planTimer!: HTMLElement;
  private planBarFill!: HTMLElement;
  private planBadge!: HTMLElement;
  private planNote!: HTMLElement;
  private upgradeBtn!: HTMLButtonElement;
  private userPlan!: HTMLElement;
  private libraryBadge: HTMLElement | null = null;

  // Modal
  private modalOverlay!: HTMLElement;
  private modalBox!: HTMLElement;

  // Componentes
  private orientationSelect!: Select;
  private formatSelect!: Select;
  private resolutionSelect!: Select;
  private framerateSelect!: Select;
  private qualitySelect!: Select;
  private audioToggle!: Toggle;

  // Modo creador
  private creatorToggle!: Toggle;
  private webcamToggle!: Toggle;
  private webcamPositionSelect!: Select;
  private webcamSizeSelect!: Select;
  private micToggle!: Toggle;
  private countdownToggle!: Toggle;

  // Estado
  private currentRecording: RecordingResult | null = null;
  private isStarting = false;
  private currentDuration = 0;
  private savedCurrentToLibrary = false;
  private isRecording = false;
  private tickInterval: number | null = null;
  private recordStartTime = 0;
  private recordLimitSeconds = Infinity;
  private remainingAtStart = Infinity;
  private elapsedSeconds = 0;
  private limitReached = false;
  private benefitIndex = 0;
  private benefitInterval: number | null = null;
  private currentView = "dashboard";
  private renamingId: string | null = null;
  private currentUserEmail: string | null = null;
  private checkoutInProgress = false;
  private billingReturnMessageShown = false;

  constructor() {
    this.initElements();
    this.initNav();
    this.initSidebar();
    this.initComponents();
    this.initBanner();
    this.initStaticIcons();
    this.initFaq();
    this.setupEventListeners();
    this.applyMobileDefaults();
    this.updateFormatInfo();
    this.updateQualityPill();
    this.updatePlanCard();
    this.subscribeLibrary();
    this.applyCaptureAvailability();
    this.ensureMemberSince();
    this.updateUserChip();
    watchBillingStatus(
      (status) => {
        this.currentUserEmail = status.email;
        setProFromEntitlement(status.isPro);
        this.refreshProGating();
        this.updatePlanCard();
        this.updateUserChip();
        this.handleBillingReturn(status.isPro);
        if (this.currentView === "profile") this.renderProfile();
        if (this.currentView === "settings") this.renderSettings();
      },
      (interval) => void this.startCheckout(interval)
    );
  }

  /**
   * Comprueba si el dispositivo puede grabar la pantalla y adapta la interfaz.
   *
   * En móviles y tablets **ningún navegador** permite capturar la pantalla desde
   * una web. En lugar de bloquear la aplicación entera, se explica el motivo,
   * se desactiva el botón de grabar y el resto (biblioteca, ayuda, perfil)
   * sigue siendo utilizable.
   */
  private applyCaptureAvailability(): void {
    const notice = document.getElementById("captureNotice");
    const stageCard = document.querySelector<HTMLElement>(".stage-card");
    const configPanel = document.getElementById("configPanel");

    if (canCaptureScreen()) {
      if (notice) notice.style.display = "none";
      return;
    }

    const mobile = isMobileDevice();
    this.startBtn.disabled = true;
    this.startBtn.title = mobile
      ? "La grabación de pantalla no está disponible en móviles"
      : "Tu navegador no permite grabar la pantalla";

    // La vista previa deja de ser pulsable si no se puede grabar.
    (this.placeholderText as HTMLButtonElement).disabled = true;

    // Si no se puede grabar, se retira toda la interfaz de captura: no tiene
    // sentido mostrar vista previa ni ajustes que no se pueden usar.
    this.appEl.classList.add("no-capture");
    if (stageCard) stageCard.style.display = "none";
    if (configPanel) configPanel.style.display = "none";
    this.appEl.classList.add("no-config");

    if (notice) {
      notice.innerHTML = mobile
        ? `
          <span class="notice-icon">${ICONS.smartphone}</span>
          <div class="notice-body">
            <div class="notice-title">La grabación no está disponible en el móvil</div>
            No es un fallo de tu teléfono: <strong>ningún navegador móvil permite grabar la
            pantalla desde una página web</strong>, es una limitación de Android y iOS.
            <ol>
              <li>Para grabar, abre SCREENREC en un <strong>ordenador</strong> con Chrome, Edge o Firefox.</li>
              <li>Si necesitas grabar el móvil, usa su <strong>grabador de pantalla integrado</strong>
              (desliza desde arriba y busca "Grabar pantalla").</li>
            </ol>
            Mientras tanto, aquí puedes consultar tu <strong>biblioteca</strong>, tu <strong>perfil</strong> y la <strong>ayuda</strong>.
          </div>`
        : `
          <span class="notice-icon">${ICONS.info}</span>
          <div class="notice-body">
            <div class="notice-title">Tu navegador no permite grabar la pantalla</div>
            ${ERROR_MESSAGES.UNSUPPORTED_BROWSER}
            Usa <strong>Google Chrome, Microsoft Edge o Firefox</strong> actualizados en un ordenador.
          </div>`;
      notice.style.display = "flex";
    }
  }

  /**
   * Obtiene las referencias a los elementos del DOM.
   */
  private initElements(): void {
    this.appEl = document.getElementById("app")!;
    this.videoStage = document.getElementById("videoStage")!;
    this.placeholderText = document.getElementById("placeholderText")!;
    this.liveIndicator = document.getElementById("liveIndicator")!;
    this.statusBadge = document.getElementById("statusBadge")!;
    this.previewVideo = document.getElementById("previewVideo") as HTMLVideoElement;
    this.resultVideo = document.getElementById("resultVideo") as HTMLVideoElement;
    this.downloadLink = document.getElementById("downloadLink") as HTMLAnchorElement;
    this.discardBtn = document.getElementById("discardBtn") as HTMLButtonElement;
    this.saveLibraryBtn = document.getElementById("saveLibraryBtn") as HTMLButtonElement;
    this.startBtn = document.getElementById("startBtn") as HTMLButtonElement;
    this.stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
    this.panControl = document.getElementById("panControl")!;
    this.panSlider = document.getElementById("panSlider") as HTMLInputElement;
    this.actionFooter = document.getElementById("actionFooter")!;
    this.recTimer = document.getElementById("recTimer")!;
    this.recCounter = document.getElementById("recCounter")!;
    this.recElapsed = document.getElementById("recElapsed")!;
    this.recLimitEl = document.getElementById("recLimit")!;
    this.qualityPill = document.getElementById("qualityPill")!;
    this.formatPill = document.getElementById("formatPill")!;
    this.fullscreenBtn = document.getElementById("fullscreenBtn") as HTMLButtonElement;

    this.planTimer = document.getElementById("planTimer")!;
    this.planBarFill = document.getElementById("planBarFill")!;
    this.planBadge = document.getElementById("planBadge")!;
    this.planNote = document.getElementById("planNote")!;
    this.upgradeBtn = document.getElementById("upgradeBtn") as HTMLButtonElement;
    this.userPlan = document.getElementById("userPlan")!;

    this.modalOverlay = document.getElementById("modalOverlay")!;
    this.modalBox = document.getElementById("modalBox")!;
  }

  /**
   * Inserta los iconos SVG estáticos de la interfaz.
   */
  private initStaticIcons(): void {
    document.getElementById("collapseBtn")!.innerHTML = ICONS.panelClose;
    document.getElementById("userAvatar")!.innerHTML = ICONS.user;
    document.getElementById("placeholderIcon")!.innerHTML = ICONS.record;
    this.fullscreenBtn.innerHTML = ICONS.expand;
    this.saveLibraryBtn.innerHTML = `${ICONS.save} Guardar en biblioteca`;
    this.downloadLink.innerHTML = `${ICONS.download} Descargar video`;
  }

  /**
   * Construye la navegación lateral.
   */
  private initNav(): void {
    const nav = document.getElementById("nav")!;

    NAV_ITEMS.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = `nav-item ${item.id === "dashboard" ? "active" : ""}`;
      btn.dataset.view = item.id;
      btn.title = item.label;
      btn.innerHTML = `
        <span class="nav-icon">${ICONS[item.icon] ?? ""}</span>
        <span class="nav-label">${item.label}</span>
      `;

      if (item.id === "library") {
        const badge = document.createElement("span");
        badge.className = "nav-badge";
        badge.textContent = "0";
        btn.appendChild(badge);
        this.libraryBadge = badge;
      }

      btn.addEventListener("click", () => this.switchView(item.id));
      nav.appendChild(btn);
    });
  }

  /**
   * Cambia la vista activa del área principal.
   * @param {string} viewId - Vista destino.
   */
  private switchView(viewId: string): void {
    this.currentView = viewId;

    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", (el as HTMLElement).dataset.view === viewId);
    });

    document.querySelectorAll(".view").forEach((el) => {
      (el as HTMLElement).style.display = "none";
    });
    const view = document.getElementById(`view-${viewId}`);
    if (view) view.style.display = "flex";

    // El panel de configuración solo tiene sentido en la vista de grabación,
    // y únicamente si el dispositivo puede grabar.
    const configPanel = document.getElementById("configPanel")!;
    const showConfig = viewId === "dashboard" && canCaptureScreen();
    configPanel.style.display = showConfig ? "flex" : "none";
    // Sin panel de configuración, su columna se elimina del layout.
    this.appEl.classList.toggle("no-config", !showConfig);

    // El chip de usuario se resalta cuando la vista activa es el perfil.
    document.getElementById("userChip")!.classList.toggle("active", viewId === "profile");

    if (viewId === "library") this.renderGallery();
    if (viewId === "settings") this.renderSettings();
    if (viewId === "profile") this.renderProfile();
  }

  /**
   * Configura el botón de contraer/desplegar el sidebar.
   */
  private initSidebar(): void {
    const collapseBtn = document.getElementById("collapseBtn") as HTMLButtonElement;

    let collapsed = false;
    try {
      collapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR) === "collapsed";
    } catch {
      collapsed = false;
    }
    this.applyCollapsed(collapsed, collapseBtn);

    collapseBtn.addEventListener("click", () => {
      const next = !this.appEl.classList.contains("collapsed");
      this.applyCollapsed(next, collapseBtn);
      try {
        localStorage.setItem(STORAGE_KEYS.SIDEBAR, next ? "collapsed" : "expanded");
      } catch {
        // Silencioso.
      }
    });

    // El logo vuelve a la vista de grabación.
    document.getElementById("brandLink")!.addEventListener("click", (e) => {
      e.preventDefault();
      this.switchView("dashboard");
    });

    // El chip de usuario abre el perfil.
    document.getElementById("userChip")!.addEventListener("click", () => {
      this.switchView("profile");
    });
  }

  /**
   * Aplica el estado contraído del sidebar.
   * @param {boolean} collapsed - true para contraer.
   * @param {HTMLButtonElement} btn - Botón de contraer.
   */
  private applyCollapsed(collapsed: boolean, btn: HTMLButtonElement): void {
    this.appEl.classList.toggle("collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "Mostrar menú" : "Ocultar menú";
    btn.setAttribute("aria-label", btn.title);
  }

  // ============================================
  // Opciones y bloqueo del plan Pro
  // ============================================

  /**
   * Indica si un valor concreto está reservado al plan Pro.
   * @param {GatedSetting} setting - Ajuste al que pertenece el valor.
   * @param {string} value - Valor a comprobar.
   * @returns {boolean} true si requiere Pro.
   */
  private isProOnly(setting: GatedSetting, value: string): boolean {
    const lists: Record<GatedSetting, readonly string[]> = {
      resolution: PRO_ONLY.resolutions,
      framerate: PRO_ONLY.framerates,
      bitrate: PRO_ONLY.bitrates,
    };
    return lists[setting].includes(value);
  }

  /**
   * Construye las opciones de un ajuste marcando las que son Pro.
   * @param {GatedSetting} setting - Ajuste a construir.
   * @returns {SelectOption[]} Opciones para el select.
   */
  private buildGatedOptions(setting: GatedSetting): SelectOption[] {
    const source: Record<GatedSetting, Record<string, { label: string }>> = {
      resolution: RESOLUTIONS,
      framerate: FRAMERATES,
      bitrate: BITRATES,
    };
    const pro = isPro();

    return Object.entries(source[setting]).map(([value, { label }]) => ({
      value,
      label: !pro && this.isProOnly(setting, value) ? `${label} 🔒 Pro` : label,
    }));
  }

  /**
   * Gestiona el cambio de un ajuste que puede requerir Pro.
   * Si el usuario gratuito elige una opción Pro, se revierte y se ofrece la mejora.
   * @param {GatedSetting} setting - Ajuste modificado.
   * @param {Select} select - Componente afectado.
   * @param {() => void} [onValid] - Acción si el valor es válido.
   */
  private handleGatedChange(setting: GatedSetting, select: Select, onValid?: () => void): void {
    const value = select.getValue();

    if (!isPro() && this.isProOnly(setting, value)) {
      select.setValue(FREE_DEFAULTS[setting]);
      this.updateQualityPill();
      this.openProModal(false, setting);
      return;
    }

    onValid?.();
  }

  /**
   * Reconstruye las opciones cuando cambia el entitlement Pro del servidor.
   */
  private refreshProGating(): void {
    const resolution = this.resolutionSelect.getValue();
    const framerate = this.framerateSelect.getValue();
    const bitrate = this.qualitySelect.getValue();

    this.resolutionSelect.setOptions(this.buildGatedOptions("resolution"));
    this.framerateSelect.setOptions(this.buildGatedOptions("framerate"));
    this.qualitySelect.setOptions(this.buildGatedOptions("bitrate"));

    this.resolutionSelect.setValue(resolution);
    this.framerateSelect.setValue(framerate);
    this.qualitySelect.setValue(bitrate);
  }

  /**
   * Crea los controles de configuración con iconos SVG.
   */
  private initComponents(): void {
    const withIcon = (icon: string, text: string): string =>
      `<span class="label-icon">${ICONS[icon] ?? ""}</span>${text}`;

    // El plan gratuito arranca con valores permitidos; Pro con los máximos.
    const pro = isPro();
    const initial = {
      resolution: pro ? DEFAULT_CONFIG.resolution : FREE_DEFAULTS.resolution,
      framerate: pro ? DEFAULT_CONFIG.framerate : FREE_DEFAULTS.framerate,
      bitrate: pro ? DEFAULT_CONFIG.bitrate : FREE_DEFAULTS.bitrate,
    };

    this.orientationSelect = new Select({
      id: "orientationSelect",
      label: withIcon("orientation", "Orientación del video"),
      labelAsHtml: true,
      options: Object.entries(ORIENTATIONS).map(([value, { label }]) => ({ value, label })),
      value: DEFAULT_CONFIG.orientation,
      onChange: (value): void => this.handleOrientationChange(value as "horizontal" | "vertical"),
    });

    this.formatSelect = new Select({
      id: "formatSelect",
      label: withIcon("file", "Formato de archivo"),
      labelAsHtml: true,
      options: FORMAT_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      value: DEFAULT_CONFIG.format,
      onChange: (): void => {
        this.updateFormatInfo();
        this.updateFormatPill();
      },
    });

    this.resolutionSelect = new Select({
      id: "resolutionSelect",
      label: withIcon("monitor", "Resolución base"),
      labelAsHtml: true,
      options: this.buildGatedOptions("resolution"),
      value: initial.resolution,
      onChange: (): void =>
        this.handleGatedChange("resolution", this.resolutionSelect, () => this.updateQualityPill()),
    });

    this.framerateSelect = new Select({
      id: "framerateSelect",
      label: withIcon("zap", "Fotogramas por segundo"),
      labelAsHtml: true,
      options: this.buildGatedOptions("framerate"),
      value: initial.framerate,
      onChange: (): void =>
        this.handleGatedChange("framerate", this.framerateSelect, () => this.updateQualityPill()),
    });

    this.qualitySelect = new Select({
      id: "qualitySelect",
      label: withIcon("sparkles", "Calidad de video (bitrate)"),
      labelAsHtml: true,
      options: this.buildGatedOptions("bitrate"),
      value: initial.bitrate,
      onChange: (): void => this.handleGatedChange("bitrate", this.qualitySelect),
    });

    this.audioToggle = new Toggle({
      id: "recordAudio",
      label: `<span class="label-icon">${ICONS.volume}</span>Incluir audio del sistema`,
      labelAsHtml: true,
      checked: DEFAULT_CONFIG.includeAudio,
    });

    this.initCreatorControls();

    this.replacePlaceholder("orientation", this.orientationSelect.getElement());
    this.replacePlaceholder("format", this.formatSelect.getElement());
    this.replacePlaceholder("resolution", this.resolutionSelect.getElement());
    this.replacePlaceholder("framerate", this.framerateSelect.getElement());
    this.replacePlaceholder("quality", this.qualitySelect.getElement());
    this.replacePlaceholder("audioToggleWrapper", this.audioToggle.getElement());

    this.updateFormatPill();
  }

  /**
   * Crea los controles del modo creador de contenido.
   *
   * Es una función Pro: en el plan gratuito el interruptor abre la oferta de
   * mejora en lugar de activarse.
   */
  private initCreatorControls(): void {
    this.creatorToggle = new Toggle({
      id: "creatorMode",
      label: "Activar modo creador",
      checked: false,
      onChange: (checked): void => this.handleCreatorToggle(checked),
    });

    this.webcamToggle = new Toggle({
      id: "webcamOverlay",
      label: `<span class="label-icon">${ICONS.record}</span>Mi cámara en círculo`,
      labelAsHtml: true,
      checked: DEFAULT_CONFIG.webcam,
      onChange: (): void => this.updateCreatorOptions(),
    });

    this.webcamPositionSelect = new Select({
      id: "webcamPositionSelect",
      label: "Posición de la cámara",
      options: WEBCAM_POSITIONS.map((option) => ({ value: option.value, label: option.label })),
      value: DEFAULT_CONFIG.webcamPosition,
    });

    this.webcamSizeSelect = new Select({
      id: "webcamSizeSelect",
      label: "Tamaño de la cámara",
      options: WEBCAM_SIZES.map((option) => ({ value: option.value, label: option.label })),
      value: DEFAULT_CONFIG.webcamSize,
    });

    this.micToggle = new Toggle({
      id: "includeMic",
      label: `<span class="label-icon">${ICONS.volume}</span>Narrar con mi micrófono`,
      labelAsHtml: true,
      checked: DEFAULT_CONFIG.includeMic,
    });

    this.countdownToggle = new Toggle({
      id: "countdownEnabled",
      label: `<span class="label-icon">${ICONS.clock}</span>Cuenta atrás de ${COUNTDOWN_SECONDS} s`,
      labelAsHtml: true,
      checked: DEFAULT_CONFIG.countdown,
    });

    this.replacePlaceholder("creatorToggleWrapper", this.creatorToggle.getElement());
    this.replacePlaceholder("webcamToggleWrapper", this.webcamToggle.getElement());
    this.replacePlaceholder("webcamPosition", this.webcamPositionSelect.getElement());
    this.replacePlaceholder("webcamSize", this.webcamSizeSelect.getElement());
    this.replacePlaceholder("micToggleWrapper", this.micToggle.getElement());
    this.replacePlaceholder("countdownToggleWrapper", this.countdownToggle.getElement());

    const icon = document.getElementById("creatorIcon");
    if (icon) icon.innerHTML = ICONS.sparkles;

    const badge = document.getElementById("creatorProBadge");
    if (badge) badge.style.display = isPro() ? "none" : "inline-flex";

    this.updateCreatorOptions();
  }

  /**
   * Gestiona la activación del modo creador (reservado a Pro).
   * @param {boolean} checked - Estado del interruptor.
   */
  private handleCreatorToggle(checked: boolean): void {
    if (checked && !isPro()) {
      // Sin Pro no se activa: se revierte y se ofrece la mejora.
      this.creatorToggle.setChecked(false);
      this.updateCreatorOptions();
      this.openProModal(false, undefined, "creator");
      return;
    }
    this.updateCreatorOptions();
  }

  /**
   * Muestra u oculta las opciones del modo creador según su estado.
   */
  private updateCreatorOptions(): void {
    const options = document.getElementById("creatorOptions");
    const active = this.creatorToggle.getChecked();
    if (options) options.style.display = active ? "block" : "none";

    // Las opciones de la cámara solo tienen sentido si la cámara está activa.
    const webcamOn = this.webcamToggle.getChecked();
    this.webcamPositionSelect.setDisabled(!webcamOn);
    this.webcamSizeSelect.setDisabled(!webcamOn);
  }

  /**
   * Sustituye un contenedor por el elemento del componente.
   * @param {string} id - Id del contenedor.
   * @param {HTMLElement} element - Elemento a insertar.
   */
  private replacePlaceholder(id: string, element: HTMLElement): void {
    const container = document.getElementById(id);
    if (container) container.replaceWith(element);
  }

  /**
   * En móvil, grabar en vertical (9:16) por defecto.
   */
  private applyMobileDefaults(): void {
    if (isMobileViewport()) {
      this.orientationSelect.setValue("vertical");
      this.handleOrientationChange("vertical");
    }
  }

  /**
   * Crea el slider de beneficios del banner.
   *
   * Si el usuario ya es Pro, el banner no se muestra: ofrecerle "Hazte Pro"
   * cuando ya lo es resulta contradictorio y roba espacio a la vista previa.
   */
  private initBanner(): void {
    const banner = document.getElementById("heroBanner");
    if (isPro()) {
      if (banner) banner.style.display = "none";
      return;
    }

    const container = document.getElementById("heroBenefits")!;
    const dotsContainer = document.getElementById("heroDots")!;

    APP_BENEFITS.forEach((benefit, index) => {
      const slide = document.createElement("div");
      slide.className = `hero-slide ${index === 0 ? "active" : ""}`;
      // Iconos planos (SVG) para mantener un estilo coherente con el menú.
      slide.innerHTML = `
        <div class="hero-slide-title">
          <span class="hero-slide-icon">${ICONS[benefit.icon] ?? ""}</span>
          ${benefit.title}
        </div>
        <div class="hero-slide-text">${benefit.text}</div>
      `;
      container.appendChild(slide);

      const dot = document.createElement("button");
      dot.className = `hero-dot-nav ${index === 0 ? "active" : ""}`;
      dot.setAttribute("aria-label", `Beneficio ${index + 1}`);
      dot.addEventListener("click", () => {
        this.showBenefit(index);
        this.startBenefitRotation();
      });
      dotsContainer.appendChild(dot);
    });

    this.startBenefitRotation();
  }

  /**
   * Muestra un beneficio concreto.
   * @param {number} index - Índice objetivo.
   */
  private showBenefit(index: number): void {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot-nav");
    if (slides.length === 0) return;

    this.benefitIndex = (index + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("active", i === this.benefitIndex));
    dots.forEach((d, i) => d.classList.toggle("active", i === this.benefitIndex));
  }

  /**
   * Inicia o reinicia la rotación automática del banner.
   */
  private startBenefitRotation(): void {
    if (this.benefitInterval) window.clearInterval(this.benefitInterval);
    this.benefitInterval = window.setInterval(() => {
      this.showBenefit(this.benefitIndex + 1);
    }, 5000);
  }

  /**
   * Construye el acordeón de preguntas frecuentes.
   */
  private initFaq(): void {
    const list = document.getElementById("faqList");
    if (!list) return;

    list.innerHTML = "";

    // Se agrupa por categorías: cada bloque es una tarjeta con sus preguntas
    // separadas por líneas, en lugar de cajas suel­tas de alturas dispares.
    FAQ_CATEGORIES.forEach((category) => {
      const items = FAQ_ITEMS.filter((faq) => faq.category === category);
      if (items.length === 0) return;

      const group = document.createElement("section");
      group.className = "faq-group";

      const header = document.createElement("header");
      header.className = "faq-group-head";
      header.innerHTML = `
        <h3 class="faq-group-title">${category}</h3>
        <span class="faq-group-count">${items.length}</span>
      `;
      group.appendChild(header);

      const body = document.createElement("div");
      body.className = "faq-group-body";

      items.forEach((faq) => {
        const item = document.createElement("div");
        item.className = "faq-item";

        const question = document.createElement("button");
        question.className = "faq-question";
        question.type = "button";
        question.setAttribute("aria-expanded", "false");
        question.innerHTML = `
          <span class="faq-question-text">${faq.question}</span>
          <span class="faq-chevron">${ICONS.chevronDown}</span>
        `;

        const answer = document.createElement("div");
        answer.className = "faq-answer";
        answer.innerHTML = `<div class="faq-answer-inner">${faq.answer}</div>`;

        question.addEventListener("click", () => {
          const open = item.classList.toggle("open");
          question.setAttribute("aria-expanded", open ? "true" : "false");
        });

        item.appendChild(question);
        item.appendChild(answer);
        body.appendChild(item);
      });

      group.appendChild(body);
      list.appendChild(group);
    });
  }

  /**
   * Registra los listeners de la interfaz.
   */
  private setupEventListeners(): void {
    this.startBtn.addEventListener("click", () => void this.handleStartRecording());

    // La vista previa es interactiva: se puede empezar a grabar pulsándola.
    this.placeholderText.addEventListener("click", () => void this.handleStartRecording());

    // El interruptor de audio también afecta a la barra de estado.
    this.audioToggle.getElement().addEventListener("change", () => this.updateClipBar());
    this.stopBtn.addEventListener("click", () => void this.handleStopRecording());
    this.discardBtn.addEventListener("click", () => this.handleDiscard());
    this.saveLibraryBtn.addEventListener("click", () => void this.handleSaveToLibrary());
    this.upgradeBtn.addEventListener("click", () => this.openProModal());
    this.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());

    document.getElementById("galleryClearBtn")!.addEventListener("click", () => {
      this.confirmClearLibrary();
    });

    this.panSlider.addEventListener("input", () => {
      recorder.updatePanValue(parseFloat(this.panSlider.value) / 100);
    });

    this.modalOverlay.addEventListener("click", (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modalOverlay.style.display === "flex") {
        this.closeModal();
      }
    });

    recorder.subscribe((event, data) => {
      switch (event) {
        case "start":
          this.isStarting = false;
          this.isRecording = true;
          this.recordStartTime = Date.now();
          this.recCounter.style.display = "inline-flex";
          this.startTick();
          this.stopBtn.disabled = false;
          this.liveIndicator.style.display = "flex";
          this.statusBadge.classList.add("active");
          this.statusBadge.innerHTML = '<span class="pulse-dot"></span> Grabando';
          document.querySelector(".rec-dot")?.classList.add("live");
          break;
        case "stop":
          this.handleRecordingStop(data as RecordingResult);
          break;
        case "error":
          this.handleRecordingError(data as Error);
          break;
      }
    });
  }

  /**
   * Mantiene el badge de la biblioteca sincronizado.
   */
  private subscribeLibrary(): void {
    const update = (items: LibraryItem[]): void => {
      if (this.libraryBadge) {
        this.libraryBadge.textContent = String(items.length);
        this.libraryBadge.classList.toggle("visible", items.length > 0);
      }
      if (this.currentView === "library") this.renderGallery();
    };
    library.subscribe(update);
    update(library.getAll());
  }

  /**
   * Actualiza el aviso del formato de salida (incluye fallback).
   */
  private updateFormatInfo(): void {
    const formatInfo = document.getElementById("formatInfo");
    if (!formatInfo || !this.formatSelect) return;

    const preferred = this.formatSelect.getValue() as "mp4" | "webm";

    // Repetir el formato ya elegido no aporta nada: el aviso solo aparece
    // cuando hay información nueva, es decir, si el navegador no lo admite y
    // se va a grabar en otro formato.
    if (isFormatSupported(preferred)) {
      formatInfo.style.display = "none";
      return;
    }

    const fallback = preferred === "mp4" ? "WebM (VP9)" : "MP4 (H.264)";
    formatInfo.innerHTML = `Tu navegador no admite <strong>${preferred.toUpperCase()}</strong>. Se grabará en <strong>${fallback}</strong>.`;
    formatInfo.style.borderColor = "rgba(245,158,11,0.35)";
    formatInfo.style.color = "#fcd34d";
    formatInfo.style.display = "block";
  }

  /**
   * Actualiza los indicadores de la barra de estado del clip.
   */
  private updateClipBar(): void {
    if (!this.resolutionSelect) return;

    const res = this.resolutionSelect.getValue();
    const resLabel = res === "2160" ? "4K" : res === "1440" ? "2K" : "1080p";
    this.qualityPill.textContent = `${resLabel} · ${this.framerateSelect.getValue()} FPS`;
    this.formatPill.textContent = this.formatSelect.getValue().toUpperCase();

    const orientationPill = document.getElementById("orientationPill");
    if (orientationPill) {
      orientationPill.textContent =
        this.orientationSelect.getValue() === "vertical" ? "9:16 Vertical" : "16:9 Horizontal";
    }

    const audioPill = document.getElementById("audioPill");
    if (audioPill) {
      const withAudio = this.audioToggle.getChecked();
      audioPill.textContent = withAudio ? "Con audio" : "Sin audio";
      audioPill.classList.toggle("off", !withAudio);
    }
  }

  /**
   * Actualiza la etiqueta de calidad del pie del escenario.
   */
  private updateQualityPill(): void {
    this.updateClipBar();
  }

  /**
   * Actualiza la etiqueta de formato de la barra de estado.
   */
  private updateFormatPill(): void {
    this.updateClipBar();
  }

  /**
   * Actualiza la tarjeta del plan y el chip de usuario.
   * @param {number} [liveRemaining] - Segundos restantes en vivo durante la grabación.
   */
  private updatePlanCard(liveRemaining?: number): void {
    if (isPro()) {
      this.planBadge.textContent = "Plan Pro";
      this.planBadge.classList.add("pro");
      this.planTimer.textContent = "∞";
      this.planBarFill.style.width = "100%";
      this.planNote.textContent = "Grabación ilimitada. ¡Gracias por tu apoyo!";
      this.upgradeBtn.style.display = "none";
      this.userPlan.textContent = "Plan Pro";
      return;
    }

    const limit = getDailyLimitSeconds();
    const remaining = liveRemaining ?? getRemainingSeconds();

    this.planBadge.textContent = "Plan gratuito";
    this.planBadge.classList.remove("pro");
    this.planTimer.textContent = formatClock(remaining);
    this.planBarFill.style.width = `${Math.max(0, Math.min(100, (remaining / limit) * 100))}%`;
    this.planNote.textContent =
      remaining > 0
        ? "3 minutos gratis por grabación. El crédito se renueva mañana."
        : "Crédito agotado. Vuelve mañana o desbloquea Pro para grabar sin límites.";
    this.upgradeBtn.style.display = "flex";
    this.userPlan.textContent = "Plan gratuito";
  }

  /**
   * Muestra el correo de la sesión Supabase (si existe) en el chip de usuario.
   */
  private updateUserChip(): void {
    const email = this.currentUserEmail;
    const nameEl = document.getElementById("userName");
    if (!nameEl) return;

    // El correo de identidad solo viene de la sesión autenticada, nunca del almacenamiento local.
    if (email) {
      nameEl.textContent = email.split("@")[0];
    } else {
      nameEl.textContent = isPro() ? "Cuenta Pro" : "Invitado";
    }
  }

  /**
   * Aplica el cambio de orientación.
   * @param {("horizontal"|"vertical")} orientation - Orientación elegida.
   */
  private handleOrientationChange(orientation: "horizontal" | "vertical"): void {
    const isVertical = orientation === "vertical";
    this.videoStage.classList.toggle("vertical", isVertical);
    this.panControl.style.display = isVertical && this.isRecording ? "block" : "none";
    this.updateClipBar();
  }

  /**
   * Inicia la grabación aplicando el límite del plan.
   */
  private async handleStartRecording(): Promise<void> {
    if (this.isRecording || this.isStarting) return;

    if (!canRecord()) {
      this.openProModal(true);
      return;
    }

    if (this.currentRecording) {
      try {
        URL.revokeObjectURL(this.currentRecording.url);
      } catch {
        // El navegador puede haber revocado ya la URL.
      }
      this.currentRecording = null;
      this.savedCurrentToLibrary = false;
    }

    try {
      this.isStarting = true;
      this.remainingAtStart = getRemainingSeconds();
      this.recordLimitSeconds = getRecordingLimitSeconds();
      this.limitReached = false;
      this.elapsedSeconds = 0;
      this.lockControls(true);
      this.updateUIForRecording();

      const creatorOn = this.creatorToggle.getChecked() && isPro();

      const config: RecordingConfig = {
        orientation: this.orientationSelect.getValue() as "horizontal" | "vertical",
        resolution: this.resolutionSelect.getValue() as "1080" | "1440" | "2160",
        framerate: this.framerateSelect.getValue() as "30" | "60",
        bitrate: this.qualitySelect.getValue() as "8000000" | "16000000" | "30000000",
        includeAudio: this.audioToggle.getChecked(),
        format: this.formatSelect.getValue() as "mp4" | "webm",
        // Modo creador (solo si está activo)
        webcam: creatorOn && this.webcamToggle.getChecked(),
        webcamPosition: this.webcamPositionSelect.getValue() as WebcamPosition,
        webcamSize: this.webcamSizeSelect.getValue() as WebcamSize,
        includeMic: creatorOn && this.micToggle.getChecked(),
        countdown: creatorOn && this.countdownToggle.getChecked(),
      };

      // La cuenta atrás da tiempo a colocar las ventanas antes de grabar.
      if (config.countdown) {
        await this.runCountdown();
      }

      this.recLimitEl.textContent = formatClock(this.recordLimitSeconds);

      this.currentRecording = await recorder.startRecording(config, this.previewVideo);
    } catch (error) {
      console.error("Error al iniciar grabación:", error);
      const shouldHandleError = this.isStarting || this.isRecording;
      this.isStarting = false;
      this.stopTick();
      if (shouldHandleError) this.handleRecordingError(error as Error);
    }
  }

  /**
   * Muestra una cuenta atrás antes de empezar a grabar.
   * @returns {Promise<void>} Se resuelve cuando termina la cuenta.
   */
  private runCountdown(): Promise<void> {
    const overlay = document.getElementById("countdownOverlay");
    const number = document.getElementById("countdownNumber");
    if (!overlay || !number) return Promise.resolve();

    return new Promise((resolve) => {
      let remaining = COUNTDOWN_SECONDS;
      number.textContent = String(remaining);
      overlay.style.display = "flex";

      const tick = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(tick);
          overlay.style.display = "none";
          resolve();
          return;
        }
        number.textContent = String(remaining);
        // Reinicia la animación en cada número.
        number.classList.remove("tick");
        void number.offsetWidth;
        number.classList.add("tick");
      }, 1000);
    });
  }

  /**
   * Detiene la grabación en curso.
   */
  private async handleStopRecording(): Promise<void> {
    if (!this.isRecording) return;
    try {
      await recorder.stopRecording();
    } catch (error) {
      console.error("Error al detener grabación:", error);
      this.handleRecordingError(error as Error);
    }
  }

  /**
   * Temporizador de grabación: actualiza contadores y aplica el límite.
   */
  private startTick(): void {
    this.stopTick();
    this.tickInterval = window.setInterval(() => {
      this.elapsedSeconds = (Date.now() - this.recordStartTime) / 1000;
      this.recTimer.textContent = formatTime(this.elapsedSeconds);
      this.recElapsed.textContent = formatClock(this.elapsedSeconds);

      if (!isPro()) {
        const remaining = Math.max(0, this.remainingAtStart - this.elapsedSeconds);
        this.updatePlanCard(remaining);

        if (this.elapsedSeconds >= this.recordLimitSeconds) {
          this.limitReached = true;
          this.stopTick();
          void this.handleStopRecording();
        }
      }
    }, 250);
  }

  /**
   * Detiene el temporizador.
   */
  private stopTick(): void {
    if (this.tickInterval) {
      window.clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Procesa el fin de la grabación.
   * @param {RecordingResult} result - Resultado devuelto por el grabador.
   */
  private handleRecordingStop(result: RecordingResult): void {
    this.isRecording = false;
    this.isStarting = false;
    this.stopTick();
    this.currentRecording = result;
    this.currentDuration = this.elapsedSeconds;
    this.savedCurrentToLibrary = false;

    consumeSeconds(this.elapsedSeconds);
    this.updatePlanCard();
    this.showResult(result);
    this.lockControls(false);

    if (this.limitReached) {
      this.openProModal(true);
    }
  }

  /**
   * Gestiona errores de grabación.
   * @param {Error} error - Error capturado.
   */
  private handleRecordingError(error: Error): void {
    this.isRecording = false;
    this.isStarting = false;
    this.stopTick();
    this.lockControls(false);
    this.resetUI();

    const message = error?.message || ERROR_MESSAGES.RECORDING_FAILED;
    // El usuario cancelando el diálogo de compartir no es un fallo real.
    if (!/permis|denied|cancel/i.test(message)) {
      this.showAlertModal("No se pudo grabar", message);
    }
  }

  /**
   * Muestra el resultado de la grabación.
   * @param {RecordingResult} result - Resultado.
   */
  private showResult(result: RecordingResult): void {
    this.previewVideo.style.display = "none";
    this.liveIndicator.style.display = "none";
    this.recCounter.style.display = "none";
    this.resultVideo.src = result.url;
    this.resultVideo.style.display = "block";
    this.panControl.style.display = "none";

    this.downloadLink.href = result.url;
    this.downloadLink.download = result.filename;
    this.actionFooter.style.display = "grid";
    this.stopBtn.style.display = "none";
    this.startBtn.style.display = "flex";
    this.statusBadge.classList.remove("active");
    this.statusBadge.textContent = "Captura finalizada";

    this.saveLibraryBtn.disabled = false;
    this.saveLibraryBtn.innerHTML = `${ICONS.save} Guardar en biblioteca`;

    const used = recorder.getLastFormat();
    if (used) {
      this.formatPill.textContent = used.ext.toUpperCase();
      if (used.fellBack) this.updateFormatInfo();
    }
  }

  /**
   * Guarda la grabación actual en la biblioteca del navegador.
   */
  private async handleSaveToLibrary(): Promise<void> {
    if (!this.currentRecording || this.savedCurrentToLibrary) return;

    this.saveLibraryBtn.disabled = true;
    this.saveLibraryBtn.textContent = "Guardando...";

    try {
      // Pedir almacenamiento duradero para que el navegador no borre los
      // vídeos automáticamente si necesita liberar espacio.
      void requestPersistentStorage();

      await library.add({
        filename: this.currentRecording.filename,
        blob: this.currentRecording.blob,
        durationSeconds: this.currentDuration,
      });

      this.savedCurrentToLibrary = true;
      this.saveLibraryBtn.innerHTML = `${ICONS.check} Guardado`;
    } catch (error) {
      console.error("No se pudo guardar en la biblioteca:", error);
      this.saveLibraryBtn.disabled = false;
      this.saveLibraryBtn.innerHTML = `${ICONS.save} Guardar en biblioteca`;
      this.showAlertModal(
        "No se pudo guardar",
        "Parece que no hay espacio suficiente en el navegador. Descarga el vídeo o elimina grabaciones antiguas de la biblioteca e inténtalo de nuevo."
      );
    }
  }

  /**
   * Descarta la grabación actual.
   */
  private handleDiscard(): void {
    // La biblioteca crea su propia Object URL; esta URL pertenece al reproductor
    // principal y debe liberarse tanto si se guardó como si no.
    if (this.currentRecording) {
      try {
        URL.revokeObjectURL(this.currentRecording.url);
      } catch {
        // Silencioso.
      }
    }
    this.currentRecording = null;
    this.savedCurrentToLibrary = false;
    this.resetUI();
  }

  /**
   * Bloquea o desbloquea los controles durante la grabación.
   * @param {boolean} locked - true para bloquear.
   */
  private lockControls(locked: boolean): void {
    this.orientationSelect.setDisabled(locked);
    this.formatSelect.setDisabled(locked);
    this.resolutionSelect.setDisabled(locked);
    this.framerateSelect.setDisabled(locked);
    this.qualitySelect.setDisabled(locked);
    this.audioToggle.setDisabled(locked);

    // Los ajustes del modo creador tampoco deben cambiarse a mitad de captura.
    this.creatorToggle.setDisabled(locked);
    this.webcamToggle.setDisabled(locked);
    this.micToggle.setDisabled(locked);
    this.countdownToggle.setDisabled(locked);
    const webcamOn = this.webcamToggle.getChecked();
    this.webcamPositionSelect.setDisabled(locked || !webcamOn);
    this.webcamSizeSelect.setDisabled(locked || !webcamOn);
  }

  /**
   * Prepara la interfaz para el estado "grabando".
   */
  private updateUIForRecording(): void {
    this.placeholderText.style.display = "none";
    this.resultVideo.style.display = "none";
    this.previewVideo.style.display = "block";
    this.liveIndicator.style.display = "none";
    this.startBtn.style.display = "none";
    this.stopBtn.style.display = "flex";
    this.stopBtn.disabled = true;
    this.actionFooter.style.display = "none";
    this.recTimer.textContent = "00:00:00";
    this.recElapsed.textContent = "00:00";
    this.statusBadge.classList.remove("active");
    this.statusBadge.textContent = "Preparando captura...";
    document.querySelector(".rec-dot")?.classList.remove("live");

    const limitLabel = document.getElementById("clipLimitLabel");
    if (limitLabel) {
      limitLabel.textContent = Number.isFinite(this.recordLimitSeconds)
        ? `Máximo ${formatClock(this.recordLimitSeconds)}`
        : "Sin límite";
    }

    const isVertical = this.orientationSelect.getValue() === "vertical";
    this.panControl.style.display = isVertical ? "block" : "none";
    this.videoStage.classList.toggle("vertical", isVertical);
  }

  /**
   * Restaura la interfaz al estado inicial.
   */
  private resetUI(): void {
    // El marcador es un botón con maquetación flex: "block" lo descuadraría.
    this.placeholderText.style.display = "flex";
    document.querySelector(".rec-dot")?.classList.remove("live");
    const limitLabel = document.getElementById("clipLimitLabel");
    if (limitLabel) limitLabel.textContent = "Duración";
    this.previewVideo.style.display = "none";
    this.resultVideo.style.display = "none";
    this.liveIndicator.style.display = "none";
    this.recCounter.style.display = "none";
    this.stopBtn.style.display = "none";
    this.stopBtn.disabled = false;
    this.actionFooter.style.display = "none";
    this.startBtn.style.display = "flex";
    this.panControl.style.display = "none";
    this.recTimer.textContent = "00:00:00";
    this.statusBadge.classList.remove("active");
    this.statusBadge.textContent = "En espera";

    const isVertical = this.orientationSelect.getValue() === "vertical";
    this.videoStage.classList.toggle("vertical", isVertical);

    this.previewVideo.srcObject = null;
    this.resultVideo.removeAttribute("src");
  }

  /**
   * Alterna pantalla completa del escenario.
   */
  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this.videoStage.requestFullscreen?.();
    }
  }

  // ============================================
  // Galería (biblioteca a pantalla completa)
  // ============================================

  /**
   * Dibuja la galería con miniaturas y acciones.
   */
  private renderGallery(): void {
    const grid = document.getElementById("galleryGrid");
    const subtitle = document.getElementById("gallerySubtitle");
    const clearBtn = document.getElementById("galleryClearBtn") as HTMLButtonElement | null;
    if (!grid) return;

    const items = library.getAll();

    if (subtitle) {
      subtitle.textContent =
        items.length === 0
          ? "Todavía no has guardado ninguna grabación."
          : `${items.length} ${items.length === 1 ? "grabación" : "grabaciones"} · ${formatFileSize(library.totalSize())}`;
    }
    if (clearBtn) clearBtn.style.display = items.length > 0 ? "flex" : "none";

    const warning = document.getElementById("galleryWarning");
    if (warning) {
      warning.innerHTML = library.isPersistent
        ? "Tus grabaciones se guardan <strong>en este navegador</strong> y siguen aquí aunque cierres la página. No se suben a ningún servidor, así que <strong>no estarán en otros dispositivos</strong>: descarga lo importante para tenerlo a salvo."
        : "Este navegador no permite guardar grabaciones de forma permanente, así que <strong>se perderán al recargar la página</strong>. Descarga lo que quieras conservar.";
      warning.style.display = "block";
    }

    grid.innerHTML = "";

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${ICONS.film}</div>
          Aún no hay grabaciones aquí.<br />
          Graba algo y pulsa "Guardar en biblioteca" para verlo en esta pantalla.
        </div>`;
      return;
    }

    items.forEach((item) => grid.appendChild(this.buildGalleryItem(item)));
  }

  /**
   * Construye una tarjeta de la galería.
   * @param {LibraryItem} item - Grabación a representar.
   * @returns {HTMLElement} Elemento de la tarjeta.
   */
  private buildGalleryItem(item: LibraryItem): HTMLElement {
    const card = document.createElement("div");
    card.className = "gallery-item";
    card.dataset.id = item.id;

    const time = item.createdAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const isRenaming = this.renamingId === item.id;

    card.innerHTML = `
      <div class="gallery-thumb" title="Reproducir">
        <video src="${item.url}#t=0.1" preload="metadata" muted playsinline></video>
        <div class="gallery-play">${ICONS.play}</div>
        <span class="gallery-duration">${formatClock(item.durationSeconds)}</span>
      </div>
      <div class="gallery-body">
        ${
          isRenaming
            ? `<input class="gallery-name-input" type="text" value="${escapeHtml(item.filename)}" />`
            : `<div class="gallery-name">${escapeHtml(item.filename)}</div>`
        }
        <div class="gallery-meta">${formatFileSize(item.size)} · ${time}</div>
        <div class="gallery-actions">
          <a class="icon-btn" href="${item.url}" download="${escapeHtml(item.filename)}" title="Descargar" aria-label="Descargar">${ICONS.download}</a>
          <button class="icon-btn" data-action="rename" title="Cambiar nombre" aria-label="Cambiar nombre">${ICONS.edit}</button>
          <button class="icon-btn danger" data-action="delete" title="Eliminar" aria-label="Eliminar">${ICONS.trash}</button>
        </div>
      </div>
    `;

    card.querySelector(".gallery-thumb")!.addEventListener("click", () => {
      this.openPlayerModal(item);
    });

    card.querySelector('[data-action="rename"]')!.addEventListener("click", () => {
      this.renamingId = item.id;
      this.renderGallery();
      const input = document.querySelector<HTMLInputElement>(
        `.gallery-item[data-id="${item.id}"] .gallery-name-input`
      );
      input?.focus();
      input?.select();
    });

    card.querySelector('[data-action="delete"]')!.addEventListener("click", () => {
      this.confirmDeleteItem(item);
    });

    const input = card.querySelector<HTMLInputElement>(".gallery-name-input");
    if (input) {
      const commit = (): void => {
        if (this.renamingId !== item.id) return;
        this.renamingId = null;
        void library.rename(item.id, input.value);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          this.renamingId = null;
          this.renderGallery();
        }
      });
      input.addEventListener("blur", commit);
    }

    return card;
  }

  /**
   * Abre un reproductor grande para una grabación.
   * @param {LibraryItem} item - Grabación a reproducir.
   */
  private openPlayerModal(item: LibraryItem): void {
    this.modalBox.classList.add("modal-wide");
    this.modalBox.innerHTML = `
      <h2>${ICONS.play} ${escapeHtml(item.filename)}</h2>
      <p class="modal-sub">${formatFileSize(item.size)} · ${formatClock(item.durationSeconds)}</p>
      <video class="modal-player" src="${item.url}" controls autoplay playsinline></video>
      <button class="modal-close" id="modalCloseBtn">Cerrar</button>
    `;
    this.modalOverlay.style.display = "flex";
    document.getElementById("modalCloseBtn")!.addEventListener("click", () => this.closeModal());
  }

  /**
   * Pide confirmación antes de eliminar una grabación.
   * @param {LibraryItem} item - Grabación a eliminar.
   */
  private confirmDeleteItem(item: LibraryItem): void {
    this.modalBox.classList.remove("modal-wide");
    this.modalBox.innerHTML = `
      <h2>${ICONS.trash} Eliminar grabación</h2>
      <p class="modal-sub">
        Se eliminará <strong>${escapeHtml(item.filename)}</strong>.
        Esta acción no se puede deshacer y el vídeo no se podrá recuperar.
      </p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelDeleteBtn">Cancelar</button>
        <button class="btn btn-primary" id="confirmDeleteBtn">Eliminar</button>
      </div>
    `;
    this.modalOverlay.style.display = "flex";

    document.getElementById("cancelDeleteBtn")!.addEventListener("click", () => this.closeModal());
    document.getElementById("confirmDeleteBtn")!.addEventListener("click", () => {
      // Si el vídeo borrado es el que está en el reproductor principal, limpiarlo.
      if (this.currentRecording?.url === item.url) {
        this.currentRecording = null;
        this.savedCurrentToLibrary = false;
        this.resetUI();
      }
      void library.remove(item.id);
      this.closeModal();
    });
  }

  /**
   * Pide confirmación antes de vaciar la biblioteca.
   */
  private confirmClearLibrary(): void {
    if (library.count() === 0) return;

    this.modalBox.classList.remove("modal-wide");
    this.modalBox.innerHTML = `
      <h2>${ICONS.trash} Vaciar biblioteca</h2>
      <p class="modal-sub">
        Se eliminarán las <strong>${library.count()}</strong> grabaciones guardadas.
        Esta acción no se puede deshacer.
      </p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelClearBtn">Cancelar</button>
        <button class="btn btn-primary" id="confirmClearBtn">Vaciar</button>
      </div>
    `;
    this.modalOverlay.style.display = "flex";

    document.getElementById("cancelClearBtn")!.addEventListener("click", () => this.closeModal());
    document.getElementById("confirmClearBtn")!.addEventListener("click", () => {
      void library.clear();
      this.closeModal();
    });
  }

  // ============================================
  // Perfil
  // ============================================

  /**
   * Lee un valor de localStorage de forma segura.
   * @param {string} key - Clave a leer.
   * @returns {string | null} Valor o null.
   */
  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Guarda un valor en localStorage de forma segura.
   * @param {string} key - Clave.
   * @param {string} value - Valor.
   */
  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silencioso.
    }
  }

  /**
   * Registra la fecha del primer uso (para mostrarla en el perfil).
   */
  private ensureMemberSince(): void {
    if (!this.readStorage(STORAGE_KEYS.MEMBER_SINCE)) {
      this.writeStorage(STORAGE_KEYS.MEMBER_SINCE, new Date().toISOString());
    }
  }

  /**
   * Formatea una fecha ISO como texto legible.
   * @param {string | null} iso - Fecha en ISO.
   * @returns {string} Fecha formateada o un guion.
   */
  private formatDate(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  }

  /**
   * Renderiza la vista de perfil de usuario.
   */
  private renderProfile(): void {
    const pro = isPro();
    const email = this.currentUserEmail;
    const items = library.getAll();
    const totalSeconds = items.reduce((sum, item) => sum + item.durationSeconds, 0);

    // Cabecera
    const hero = document.getElementById("profileHero")!;
    const initial = email ? email.trim().charAt(0).toUpperCase() : "";
    hero.innerHTML = `
      <div class="profile-avatar">${initial || ICONS.user}</div>
      <div class="profile-info">
        <div class="profile-name">${email ? escapeHtml(email) : "Invitado"}</div>
        <div class="profile-sub">
          ${
            email
              ? "Cuenta autenticada con Supabase."
              : "Puedes usar el plan gratuito sin crear una cuenta."
          }
        </div>
        <span class="profile-tag ${pro ? "pro" : ""}">
          ${pro ? ICONS.crown : ICONS.user} ${pro ? "Plan Pro" : "Plan gratuito"}
        </span>
      </div>
      <div class="profile-actions" id="profileActions"></div>
    `;

    const actions = document.getElementById("profileActions")!;
    if (this.currentUserEmail) {
      const logout = document.createElement("button");
      logout.className = "btn btn-secondary";
      logout.innerHTML = `${ICONS.logout} Cerrar sesión`;
      logout.addEventListener("click", () => this.confirmLogoutPro());
      actions.appendChild(logout);
    } else if (!pro) {
      const upgrade = document.createElement("button");
      upgrade.className = "btn btn-pro";
      upgrade.innerHTML = `${ICONS.sparkles} Desbloquear Pro`;
      upgrade.addEventListener("click", () => this.openProModal());
      actions.appendChild(upgrade);
    }

    // Estadísticas
    const stats: { icon: string; value: string; label: string }[] = [
      { icon: "film", value: String(items.length), label: "Grabaciones guardadas" },
      { icon: "clock", value: formatClock(totalSeconds), label: "Tiempo grabado" },
      { icon: "database", value: formatFileSize(library.totalSize()), label: "Espacio ocupado" },
      {
        icon: "zap",
        value: pro ? "∞" : formatClock(getRemainingSeconds()),
        label: pro ? "Tiempo disponible" : "Crédito restante hoy",
      },
    ];

    const statGrid = document.getElementById("profileStats")!;
    statGrid.innerHTML = stats
      .map(
        (stat) => `
        <div class="stat-card">
          <span class="stat-icon">${ICONS[stat.icon] ?? ""}</span>
          <div>
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
          </div>
        </div>`
      )
      .join("");

    // Detalle del plan
    const planCard = document.getElementById("profilePlanCard")!;
    planCard.innerHTML = `
      <h3 class="card-title">Mi plan</h3>
      <div class="data-list">
        <div class="data-row"><span class="data-label">Plan actual</span><span class="data-value">${pro ? "SCREENREC Pro" : "Gratuito"}</span></div>
        <div class="data-row"><span class="data-label">Duración por grabación</span><span class="data-value">${pro ? "Sin límite" : "3 minutos"}</span></div>
        <div class="data-row"><span class="data-label">Resolución máxima</span><span class="data-value">${pro ? "4K (2160p)" : "1080p"}</span></div>
        <div class="data-row"><span class="data-label">Fotogramas por segundo</span><span class="data-value">${pro ? "60 FPS" : "30 FPS"}</span></div>
        <div class="data-row"><span class="data-label">Calidad máxima</span><span class="data-value">${pro ? "30 Mbps" : "8 Mbps"}</span></div>
        ${pro ? '<div class="data-row"><span class="data-label">Estado</span><span class="data-value">Verificado por el servidor</span></div>' : ""}
      </div>
    `;

    // Datos y privacidad
    const dataCard = document.getElementById("profileDataCard")!;
    dataCard.innerHTML = `
      <h3 class="card-title">Mis datos</h3>
      <div class="data-list">
        <div class="data-row"><span class="data-label">Cuenta</span><span class="data-value">${email ? escapeHtml(email) : "No iniciada"}</span></div>
        <div class="data-row"><span class="data-label">Usas SCREENREC desde</span><span class="data-value">${this.formatDate(this.readStorage(STORAGE_KEYS.MEMBER_SINCE))}</span></div>
        <div class="data-row"><span class="data-label">Dónde se guarda todo</span><span class="data-value">Solo en este navegador</span></div>
        <div class="data-row"><span class="data-label">Grabaciones en servidores</span><span class="data-value">Ninguna</span></div>
      </div>
      <p class="plan-note" style="margin-top:12px">
        Tus grabaciones permanecen en este dispositivo y no se sincronizan con servidores.
        La cuenta y la suscripción se verifican en línea; puedes volver a iniciar sesión
        desde otro navegador para recuperar el acceso Pro.
      </p>
    `;
  }

  /**
   * Pide confirmación antes de cerrar la sesión de la cuenta.
   */
  private confirmLogoutPro(): void {
    this.modalBox.classList.remove("modal-wide");
    this.modalBox.innerHTML = `
      <h2>${ICONS.logout} Cerrar sesión</h2>
      <p class="modal-sub">
        Volverás al plan gratuito en este navegador. Tu suscripción no se cancela al cerrar
        sesión y tus grabaciones guardadas <strong>no se borran</strong>.
      </p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelLogoutBtn">Cancelar</button>
        <button class="btn btn-primary" id="confirmLogoutBtn">Cerrar sesión</button>
      </div>
    `;
    this.modalOverlay.style.display = "flex";

    document.getElementById("cancelLogoutBtn")!.addEventListener("click", () => this.closeModal());
    document.getElementById("confirmLogoutBtn")!.addEventListener("click", () => {
      void (async (): Promise<void> => {
        try {
          await signOutBillingUser();
          this.currentUserEmail = null;
          setProFromEntitlement(false);
          this.refreshProGating();
          this.updatePlanCard();
          this.updateUserChip();
          this.renderProfile();
          this.closeModal();
        } catch {
          this.showAlertModal(
            "No se pudo cerrar sesión",
            "Revisa tu conexión e inténtalo de nuevo."
          );
        }
      })();
    });
  }

  // ============================================
  // Ajustes
  // ============================================

  /**
   * Renderiza la vista de ajustes.
   */
  private renderSettings(): void {
    const summary = document.getElementById("planSummary")!;
    const pro = isPro();

    // Iconos de las tarjetas.
    const icons: Record<string, string> = {
      settingsPlanIcon: pro ? ICONS.crown : ICONS.user,
      settingsStorageIcon: ICONS.database,
      settingsDeviceIcon: ICONS.monitor,
    };
    Object.entries(icons).forEach(([id, icon]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = icon;
    });

    const planRows: { label: string; value: string; strong?: boolean }[] = [
      { label: "Plan actual", value: pro ? "SCREENREC Pro" : "Gratuito", strong: true },
      {
        label: pro ? "Tiempo de grabación" : "Crédito restante hoy",
        value: pro ? "Ilimitado" : formatClock(getRemainingSeconds()),
        strong: true,
      },
      { label: "Duración por grabación", value: pro ? "Sin límite" : "3 minutos" },
      { label: "Resolución máxima", value: pro ? "4K (2160p)" : "1080p" },
      { label: "Fotogramas por segundo", value: pro ? "60 FPS" : "30 FPS" },
      { label: "Modo creador", value: pro ? "Incluido" : "Solo Pro" },
    ];

    summary.innerHTML = planRows
      .map(
        (row) => `
        <div class="data-row">
          <span class="data-label">${row.label}</span>
          <span class="data-value${row.strong ? " strong" : ""}">${row.value}</span>
        </div>`
      )
      .join("");

    const container = document.getElementById("toolsInfo")!;
    const support = getBrowserSupportInfo();
    const rows: { label: string; ok: boolean }[] = [
      { label: "Captura de pantalla", ok: canCaptureScreen() },
      { label: "Grabación de vídeo", ok: support.mediaRecorder },
      { label: "Procesado de vídeo", ok: support.canvasCaptureStream },
      { label: "Audio del sistema", ok: support.audioContext },
      { label: "Exportar en MP4 (H.264)", ok: isFormatSupported("mp4") },
      { label: "Exportar en WebM (VP9)", ok: isFormatSupported("webm") },
    ];

    container.innerHTML = rows
      .map(
        (row) => `
        <div class="data-row">
          <span class="data-label">${row.label}</span>
          <span class="data-value ${row.ok ? "ok" : "no"}">${row.ok ? "Disponible" : "No disponible"}</span>
        </div>`
      )
      .join("");

    // Uso de almacenamiento de la biblioteca.
    void this.renderStorageInfo();

    const actions = document.getElementById("settingsActions")!;
    actions.innerHTML = "";

    if (pro) {
      const manage = document.createElement("button");
      manage.className = "btn btn-secondary";
      manage.textContent = "Administrar suscripción";
      manage.addEventListener("click", () => void this.openBillingPortal());
      actions.appendChild(manage);
    } else {
      const upgrade = document.createElement("button");
      upgrade.className = "btn btn-pro";
      upgrade.textContent = "Desbloquear Pro";
      upgrade.addEventListener("click", () => this.openProModal());
      actions.appendChild(upgrade);
    }
  }

  /**
   * Añade a los ajustes una fila con el espacio ocupado por las grabaciones.
   */
  private async renderStorageInfo(): Promise<void> {
    const container = document.getElementById("storageInfo");
    if (!container) return;

    const count = library.count();
    const estimate = await estimateStorage();

    const rows: { label: string; value: string; ok?: boolean }[] = [
      { label: "Grabaciones guardadas", value: String(count) },
      { label: "Espacio que ocupan", value: formatFileSize(library.totalSize()) },
      {
        label: "Guardado permanente",
        value: library.isPersistent ? "Activado" : "No disponible",
        ok: library.isPersistent,
      },
    ];

    if (estimate && estimate.quotaBytes > 0) {
      rows.push({
        label: "Espacio disponible",
        value: formatFileSize(Math.max(0, estimate.quotaBytes - estimate.usedBytes)),
      });
    }

    container.innerHTML = rows
      .map(
        (row) => `
        <div class="data-row">
          <span class="data-label">${row.label}</span>
          <span class="data-value ${row.ok === undefined ? "" : row.ok ? "ok" : "no"}">${row.value}</span>
        </div>`
      )
      .join("");
  }

  // ============================================
  // Pro y suscripciones
  // ============================================

  /**
   * Abre la oferta Pro con períodos recurrentes.
   * @param {boolean} [limitHit] - true si se abre por agotar el tiempo.
   * @param {GatedSetting} [blockedSetting] - Ajuste Pro que se intentó usar.
   */
  private openProModal(
    limitHit = false,
    blockedSetting?: GatedSetting,
    blockedFeature?: "creator"
  ): void {
    this.modalBox.classList.remove("modal-wide");
    const features = PRO.features.map((feature) => `<li>${feature}</li>`).join("");
    const configured = isBillingConfigured();

    const settingNames: Record<GatedSetting, string> = {
      resolution: "esa resolución",
      framerate: "60 FPS",
      bitrate: "ese bitrate",
    };

    let subtitle = "Desbloquea todo el potencial de SCREENREC.";
    if (limitHit) {
      subtitle =
        "Has alcanzado el límite de 3 minutos del plan gratuito. Desbloquea Pro para grabar sin límites.";
    } else if (blockedSetting) {
      subtitle = `Para grabar con ${settingNames[blockedSetting]} necesitas el plan Pro.`;
    } else if (blockedFeature === "creator") {
      subtitle =
        "El modo creador (cámara en círculo, narración con micrófono y cuenta atrás) es una función Pro.";
    }

    this.modalBox.innerHTML = `
      <h2>${ICONS.sparkles} SCREENREC Pro</h2>
      <p class="modal-sub">${subtitle}</p>
      <div class="modal-price">${PRO.priceLabel}</div>
      <p class="modal-sub">El importe y la moneda se mostrarán antes de confirmar el pago.</p>
      <ul class="modal-features">${features}</ul>
      ${configured ? "" : '<p class="modal-error">El checkout todavía no está configurado.</p>'}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="monthlyCheckoutBtn" ${configured ? "" : "disabled"}>Plan mensual</button>
        <button class="btn btn-pro" id="annualCheckoutBtn" ${configured ? "" : "disabled"}>Plan anual</button>
      </div>
      <button class="modal-close" id="modalCloseBtn">Ahora no</button>
    `;

    this.modalOverlay.style.display = "flex";
    document.getElementById("modalCloseBtn")!.addEventListener("click", () => this.closeModal());
    document.getElementById("monthlyCheckoutBtn")!.addEventListener("click", () => {
      void this.startCheckout("monthly");
    });
    document.getElementById("annualCheckoutBtn")!.addEventListener("click", () => {
      void this.startCheckout("annual");
    });
  }

  /**
   * Abre una Checkout Session autenticada o solicita magic link antes de crearla.
   * @param {BillingInterval} interval - Periodicidad elegida.
   */
  private async startCheckout(interval: BillingInterval): Promise<void> {
    if (!isBillingConfigured()) {
      this.showAlertModal(
        "Checkout no configurado",
        "La autenticación y facturación aún no están conectadas."
      );
      return;
    }
    if (this.checkoutInProgress) return;
    this.checkoutInProgress = true;
    const checkoutButtons = [
      document.getElementById("monthlyCheckoutBtn"),
      document.getElementById("annualCheckoutBtn"),
    ].filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement);
    checkoutButtons.forEach((button) => (button.disabled = true));

    try {
      const url = await createCheckoutUrl(interval);
      if (!url) {
        this.openBillingSignInModal(interval);
        return;
      }
      window.location.assign(url);
    } catch (error) {
      console.error(
        "No se pudo iniciar el checkout",
        error instanceof Error ? error.message : "unknown error"
      );
      this.showAlertModal(
        "Checkout no disponible",
        "No se pudo iniciar el pago. Revisa que el servicio esté configurado y vuelve a intentarlo."
      );
    } finally {
      this.checkoutInProgress = false;
      checkoutButtons.forEach((button) => (button.disabled = !isBillingConfigured()));
    }
  }

  private handleBillingReturn(isProEntitled: boolean): void {
    const result = new URLSearchParams(window.location.search).get("billing");
    if (result === "cancel") {
      if (!this.billingReturnMessageShown) {
        this.billingReturnMessageShown = true;
        this.showAlertModal("Checkout cancelado", "No se completó ningún cobro.");
      }
      this.clearBillingReturnQuery();
      return;
    }
    if (result !== "success") return;

    if (isProEntitled) {
      this.billingReturnMessageShown = true;
      this.showAlertModal("¡SCREENREC Pro está activo!", "Se confirmó tu suscripción.");
      this.clearBillingReturnQuery();
    } else if (!this.billingReturnMessageShown) {
      this.billingReturnMessageShown = true;
      this.showAlertModal(
        "Confirmando pago",
        "Recibimos la operación y estamos verificando la suscripción; la página se actualizará automáticamente. Si no cambia en unos segundos, vuelve a cargarla."
      );
    }
  }

  private clearBillingReturnQuery(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("billing");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  /**
   * Pide correo para Supabase Auth; el magic link nunca concede Pro por sí solo.
   * @param {BillingInterval} interval - Período de suscripción que se reanudará al iniciar sesión.
   */
  private openBillingSignInModal(interval: BillingInterval): void {
    this.modalBox.innerHTML = `
      <h2>${ICONS.mail} Inicia sesión para suscribirte</h2>
      <p class="modal-sub">Te enviaremos un enlace seguro de acceso. El estado Pro solo se activa cuando el servidor confirma la suscripción.</p>
      <input type="email" class="modal-input" id="billingEmail" placeholder="tu@email.com" autocomplete="email" required />
      <div class="modal-error" id="billingEmailError"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="billingCancelBtn">Cancelar</button>
        <button class="btn btn-primary" id="billingSendLinkBtn">Enviar enlace</button>
      </div>
    `;
    const input = document.getElementById("billingEmail") as HTMLInputElement;
    const error = document.getElementById("billingEmailError")!;
    const sendButton = document.getElementById("billingSendLinkBtn") as HTMLButtonElement;
    input.focus();

    const send = async (): Promise<void> => {
      if (!input.reportValidity()) return;
      sendButton.disabled = true;
      sendButton.textContent = "Enviando…";
      error.textContent = "";
      try {
        const email = input.value.trim().toLowerCase();
        await sendBillingMagicLink(email, interval);
        this.modalBox.innerHTML = `
          <h2>${ICONS.mail} Revisa tu correo</h2>
          <p class="modal-success">Enviamos un enlace de acceso a <strong>${escapeHtml(email)}</strong>.</p>
          <p class="modal-sub">Al abrirlo, volverás a SCREENREC y se continuará con el plan elegido.</p>
          <div class="modal-actions"><button class="btn btn-primary" id="billingDoneBtn">Entendido</button></div>
        `;
        document
          .getElementById("billingDoneBtn")!
          .addEventListener("click", () => this.closeModal());
      } catch {
        sendButton.disabled = false;
        sendButton.textContent = "Enviar enlace";
        error.textContent =
          "No se pudo enviar el enlace. Revisa la configuración de Supabase Auth e inténtalo de nuevo.";
      }
    };

    document.getElementById("billingCancelBtn")!.addEventListener("click", () => this.closeModal());
    sendButton.addEventListener("click", () => void send());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void send();
    });
  }

  /** Abre el portal de facturación configurado para una suscripción activa. */
  private async openBillingPortal(): Promise<void> {
    try {
      const url = await createBillingPortalUrl();
      window.location.assign(url);
    } catch {
      this.showAlertModal(
        "No se pudo abrir la facturación",
        "Inicia sesión de nuevo o revisa la configuración del portal de facturación."
      );
    }
  }

  /**
   * Muestra un aviso simple en un modal.
   * @param {string} title - Título del aviso.
   * @param {string} message - Mensaje a mostrar.
   */
  private showAlertModal(title: string, message: string): void {
    this.modalBox.classList.remove("modal-wide");
    this.modalBox.innerHTML = `
      <h2>${title}</h2>
      <p class="modal-sub">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" id="alertCloseBtn">Entendido</button>
      </div>
    `;
    this.modalOverlay.style.display = "flex";
    document.getElementById("alertCloseBtn")!.addEventListener("click", () => this.closeModal());
  }

  /**
   * Cierra el modal activo.
   */
  private closeModal(): void {
    this.modalOverlay.style.display = "none";
    this.modalBox.innerHTML = "";
    this.modalBox.classList.remove("modal-wide");
  }
}

/**
 * Arranca la interfaz cargando antes las grabaciones guardadas.
 */
async function bootstrap(): Promise<void> {
  // La carga es tolerante a fallos: si no hay almacenamiento, la app arranca igual.
  await library.init();
  new Dashboard();
}

/**
 * Inicializa el dashboard cuando el DOM esté listo.
 */
export function initDashboard(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void bootstrap());
  } else {
    void bootstrap();
  }
}
