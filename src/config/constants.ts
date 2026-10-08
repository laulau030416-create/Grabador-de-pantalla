import type {
  Orientation,
  Resolution,
  Framerate,
  Bitrate,
  VideoFormat,
  WebcamPosition,
  WebcamSize,
} from "@/types";

// Nombre de la aplicación
export const APP_NAME = "SCREENREC";
export const APP_VERSION = "2.0.0";
export const APP_DESCRIPTION = "Grabador de pantalla profesional con superpoderes";

// ============================================
// Plan gratuito y monetización
// ============================================

// Segundos gratuitos por día (3 minutos)
export const FREE_DAILY_SECONDS = 180;

// Claves de almacenamiento local
export const STORAGE_KEYS = {
  USAGE: "screenrec_usage_v1",
  SIDEBAR: "screenrec_sidebar_v1",
  MEMBER_SINCE: "screenrec_since_v1",
} as const;

// Los importes reales los fija Stripe por país/moneda y se muestran en Checkout.
export const PRO = {
  priceLabel: "Suscripción mensual o anual",
  features: [
    "Grabación sin límite de 3 minutos",
    "Modo creador: tu cámara en círculo sobre el vídeo",
    "Narración con micrófono mezclada con el audio del sistema",
    "Resolución 2K y 4K (el plan gratuito llega a 1080p)",
    "60 FPS ultra fluido y hasta 30 Mbps",
    "Soporte prioritario",
  ],
} as const;

// ============================================
// Opciones reservadas al plan Pro
// ============================================

/**
 * Valores que solo pueden usar los suscriptores Pro. El plan gratuito los ve
 * marcados con un candado y, al seleccionarlos, se ofrece la mejora.
 */
export const PRO_ONLY = {
  resolutions: ["1440", "2160"] as Resolution[],
  framerates: ["60"] as Framerate[],
  bitrates: ["16000000", "30000000"] as Bitrate[],
} as const;

// Valores máximos del plan gratuito (se usan como valores iniciales)
export const FREE_DEFAULTS = {
  resolution: "1080" as Resolution,
  framerate: "30" as Framerate,
  bitrate: "8000000" as Bitrate,
} as const;

// Duración máxima de una sola grabación en el plan gratuito (3 minutos)
export const FREE_MAX_RECORDING_SECONDS = 180;

// Opciones del selector de formato de salida
export const FORMAT_OPTIONS: { value: "mp4" | "webm"; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264) - Premiere / CapCut" },
  { value: "webm", label: "WebM (VP9) - Máxima compatibilidad web" },
];

// ============================================
// Iconos SVG (inline, sin dependencias)
// ============================================
export const ICONS: Record<string, string> = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  record:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
  library:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H4z"/><path d="M2 20h20"/><path d="m10 8 5 3-5 3V8z" fill="currentColor" stroke="none"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  support:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  orientation:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M18 9v6"/><path d="M21 11v2"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  monitor:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.8L19.7 11l-5.8 1.9L12 19l-1.9-6.1L4.3 11l5.8-2.2L12 3z"/></svg>',
  volume:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  chevronLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  panelClose:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="16 10 13 12.5 16 15"/></svg>',
  chevronDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5"/></svg>',
  smartphone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  desktop:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="12" rx="2"/><path d="M8 21h8M12 15v6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  database:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  logout:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  crown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></svg>',
};

// Beneficios que rota el banner superior
export const APP_BENEFITS: { icon: string; title: string; text: string }[] = [
  {
    icon: "record",
    title: "Graba en calidad profesional",
    text: "Hasta 4K y 60 FPS directamente desde tu navegador.",
  },
  {
    icon: "smartphone",
    title: "Horizontal y vertical",
    text: "Formato 16:9 para YouTube o 9:16 para Reels y TikTok.",
  },
  {
    icon: "zap",
    title: "Sin instalar nada",
    text: "Todo funciona online, sin programas ni extensiones.",
  },
  {
    icon: "shield",
    title: "100% privado",
    text: "Tus grabaciones se procesan en tu equipo, no se suben a ningún servidor.",
  },
  {
    icon: "sparkles",
    title: "Hazte Pro",
    text: "Desbloquea grabación ilimitada, 4K y 60 FPS.",
  },
];

// Elementos de navegación del panel lateral.
export const NAV_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: "dashboard", label: "Grabar", icon: "record" },
  { id: "library", label: "Biblioteca", icon: "library" },
  { id: "settings", label: "Ajustes", icon: "settings" },
  { id: "support", label: "Ayuda", icon: "support" },
];

// ============================================
// Preguntas frecuentes (sección de ayuda)
// ============================================
export const FAQ_CATEGORIES = [
  "Primeros pasos",
  "Vídeo y audio",
  "Plan y límites",
  "Biblioteca y datos",
  "Dispositivos",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_ITEMS: { category: FaqCategory; question: string; answer: string }[] = [
  {
    category: "Primeros pasos",
    question: "¿Cómo empiezo a grabar?",
    answer:
      "Elige la orientación y la calidad en el panel de la izquierda y pulsa <strong>Iniciar grabación</strong>. El navegador te preguntará qué quieres compartir: una pestaña, una ventana o toda la pantalla. Elige una opción y confirma. Cuando termines, pulsa <strong>Detener y procesar</strong> para obtener el vídeo.",
  },
  {
    category: "Vídeo y audio",
    question: "No se graba el sonido, ¿qué hago?",
    answer:
      "En la ventana que abre el navegador para elegir qué compartir, tienes que activar la casilla <strong>Compartir audio de la pestaña</strong> (o <em>Compartir audio del sistema</em>). Si no la marcas, el vídeo se graba sin sonido. Ten en cuenta que al compartir <em>toda la pantalla</em> algunos navegadores no permiten capturar audio: comparte una <strong>pestaña</strong> para tener el mejor resultado.",
  },
  {
    category: "Plan y límites",
    question: "¿Cuánto tiempo puedo grabar gratis?",
    answer:
      "El plan gratuito permite <strong>3 minutos por grabación</strong> y ese crédito se renueva <strong>cada día</strong>. Cuando se agota, la grabación se detiene automáticamente y se guarda lo grabado hasta ese momento. Si necesitas más tiempo, puedes desbloquear el plan Pro, que no tiene límite.",
  },
  {
    category: "Plan y límites",
    question: "¿Por qué algunas opciones tienen un candado?",
    answer:
      "Las resoluciones <strong>2K y 4K</strong>, los <strong>60 FPS</strong> y los bitrates altos están reservados al plan Pro. En el plan gratuito puedes grabar en 1080p a 30 FPS con calidad alta, que es más que suficiente para la mayoría de usos.",
  },
  {
    category: "Vídeo y audio",
    question: "¿Cómo grabo en vertical para Reels o TikTok?",
    answer:
      "Selecciona <strong>Vertical 9:16</strong> en la orientación. La app recorta la zona central de la pantalla en tiempo real. Mientras grabas aparece un control deslizante que te permite <strong>mover el enfoque</strong> a izquierda o derecha para encuadrar lo que te interese. En el móvil, el formato vertical se selecciona solo.",
  },
  {
    category: "Vídeo y audio",
    question: "¿Qué formato me conviene, MP4 o WebM?",
    answer:
      "Elige <strong>MP4 (H.264)</strong> si vas a editar el vídeo en programas como Premiere, CapCut o DaVinci, o subirlo a redes sociales: es el más compatible. Elige <strong>WebM (VP9)</strong> si el vídeo es para web. Si tu navegador no admite el formato elegido, la app cambia al otro automáticamente y te avisa.",
  },
  {
    category: "Biblioteca y datos",
    question: "¿Dónde se guardan mis grabaciones?",
    answer:
      "En tu propio equipo. <strong>Los vídeos no se suben a ningún servidor</strong>: se procesan y se guardan dentro de tu navegador. Al terminar puedes descargarlo o pulsar <strong>Guardar en biblioteca</strong>. Si usas una cuenta Pro, el correo y los datos de la suscripción se procesan de forma separada por Supabase y Stripe; el contenido de tus vídeos no se envía.",
  },
  {
    category: "Biblioteca y datos",
    question: "¿Las grabaciones de la biblioteca se pierden al cerrar la página?",
    answer:
      "No. Se guardan en el almacenamiento de tu navegador, así que las encontrarás al volver. Ten en cuenta estas tres cosas: <strong>solo están en ese navegador y dispositivo</strong> (no aparecen en el móvil si grabaste en el ordenador), se <strong>borran si limpias los datos de navegación</strong>, y en <strong>modo incógnito</strong> desaparecen al cerrar la ventana. Descarga lo importante para tenerlo a salvo.",
  },
  {
    category: "Biblioteca y datos",
    question: "¿Se puede recuperar un vídeo que eliminé?",
    answer:
      "No. Como las grabaciones nunca salen de tu equipo, al eliminar un vídeo de la biblioteca no hay copia en ningún sitio y no se puede recuperar. Por eso pedimos confirmación antes de borrar.",
  },
  {
    category: "Biblioteca y datos",
    question: "¿Cuánto puedo guardar en la biblioteca?",
    answer:
      "Depende del espacio que tu navegador reserve para la web, que suele ser bastante (varios GB). En <strong>Ajustes</strong> puedes ver cuánto ocupan tus grabaciones y cuánto espacio hay disponible. Si se llena, la app te avisará al guardar: elimina grabaciones antiguas o descárgalas para liberar sitio.",
  },
  {
    category: "Dispositivos",
    question: "¿Puedo grabar desde el móvil o la tablet?",
    answer:
      "No, y no es un fallo de la app ni de tu teléfono: <strong>ningún navegador móvil permite grabar la pantalla desde una página web</strong>. Es una limitación de Android y de iOS, así que le ocurre a cualquier grabador web. Para grabar necesitas un <strong>ordenador</strong>. Si lo que quieres es grabar la pantalla del móvil, usa su <strong>grabador integrado</strong>: desliza el dedo desde arriba y busca «Grabar pantalla». Desde el móvil sí puedes consultar tu biblioteca, tu perfil y esta ayuda.",
  },
  {
    category: "Dispositivos",
    question: "¿Qué navegadores funcionan?",
    answer:
      "En ordenador funciona con <strong>Chrome, Edge, Opera y Firefox</strong> actualizados. En Safari de macOS la compatibilidad es parcial. En <strong>Ajustes</strong> puedes comprobar exactamente qué admite tu dispositivo.",
  },
  {
    category: "Primeros pasos",
    question: "¿Qué es el modo creador?",
    answer:
      "Es un conjunto de funciones Pro pensadas para grabar tutoriales y contenido para redes: <strong>tu cámara en un círculo</strong> sobre la grabación (puedes elegir esquina y tamaño), <strong>narrar con tu micrófono</strong> mezclándolo con el audio del sistema, y una <strong>cuenta atrás</strong> de 3 segundos para colocar las ventanas antes de empezar. Todo se procesa en tu equipo y queda incrustado en el vídeo final.",
  },
  {
    category: "Dispositivos",
    question: "¿Podéis seguir el cursor con zoom o poner sonido de clics?",
    answer:
      "Por ahora no, y preferimos decirlo claro: los navegadores <strong>no permiten a una web saber dónde está el ratón ni qué teclas pulsas fuera de su propia página</strong>, por seguridad (si no, cualquier web podría espiar tu teclado). Programas como Screen Studio lo consiguen porque son aplicaciones instaladas con permisos del sistema. Si SCREENREC crece, una app de escritorio es el camino para ofrecerlo.",
  },
  {
    category: "Plan y límites",
    question: "¿Cómo activo el plan Pro?",
    answer:
      "Cuando la facturación esté habilitada, pulsa <strong>Desbloquear Pro</strong>, elige un plan mensual o anual e inicia sesión mediante un enlace seguro enviado a tu correo. Completa el pago en la página alojada de Stripe. Pro se activa al confirmarse la suscripción; el precio y la moneda se muestran antes de pagar.",
  },
  {
    category: "Plan y límites",
    question: "No me llega el enlace para iniciar sesión",
    answer:
      "Revisa la carpeta de <strong>spam o correo no deseado</strong> y comprueba que escribiste bien tu dirección. Si el enlace caducó, solicita uno nuevo. Si la función de facturación todavía no está habilitada, los botones de suscripción permanecerán desactivados.",
  },
  {
    category: "Plan y límites",
    question: "Activé Pro pero en otro dispositivo aparece el plan gratuito",
    answer:
      "Inicia sesión con el mismo correo: la suscripción se consulta en línea desde tu cuenta. Tus vídeos siguen guardados localmente en el dispositivo y no se sincronizan entre navegadores.",
  },
];

// Proveedores de correo permitidos (dominios conocidos)
export const ALLOWED_EMAIL_PROVIDERS: string[] = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "ymail.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
];

// Dominios de correo temporal/desechable bloqueados
export const DISPOSABLE_EMAIL_DOMAINS: string[] = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
];

// Opciones de orientación
export const ORIENTATIONS: Record<Orientation, { label: string; ratio: number }> = {
  horizontal: { label: "Horizontal 16:9 (YouTube)", ratio: 16 / 9 },
  vertical: { label: "Vertical 9:16 (Reels/TikTok)", ratio: 9 / 16 },
} as const;

// Opciones de resolución (píxeles verticales para horizontal, píxeles horizontales para vertical)
export const RESOLUTIONS: Record<Resolution, { label: string; pixels: number }> = {
  "1080": { label: "1080p (Full HD)", pixels: 1080 },
  "1440": { label: "1440p (2K)", pixels: 1440 },
  "2160": { label: "2160p (4K)", pixels: 2160 },
} as const;

// Opciones de FPS
export const FRAMERATES: Record<Framerate, { label: string; fps: number }> = {
  "30": { label: "30 FPS (Estándar)", fps: 30 },
  "60": { label: "60 FPS (Ultra fluido)", fps: 60 },
} as const;

// Opciones de bitrate (en bits por segundo)
export const BITRATES: Record<Bitrate, { label: string; bps: number }> = {
  "8000000": { label: "Alta (8 Mbps)", bps: 8_000_000 },
  "16000000": { label: "Extrema (16 Mbps)", bps: 16_000_000 },
  "30000000": { label: "Sin pérdidas (30 Mbps)", bps: 30_000_000 },
} as const;

// Formatos de video soportados (en orden de preferencia)
export const VIDEO_FORMATS: { mimeType: string; ext: string; label: string }[] = [
  { mimeType: "video/mp4;codecs=avc1.42E01E", ext: "mp4", label: "MP4 (H.264, AVC)" },
  { mimeType: "video/mp4;codecs=h264", ext: "mp4", label: "MP4 (H.264)" },
  { mimeType: "video/mp4", ext: "mp4", label: "MP4" },
  { mimeType: "video/webm;codecs=vp9", ext: "webm", label: "WebM (VP9)" },
  { mimeType: "video/webm;codecs=vp8", ext: "webm", label: "WebM (VP8)" },
  { mimeType: "video/webm", ext: "webm", label: "WebM" },
];

// Configuración por defecto
export const DEFAULT_CONFIG = {
  orientation: "horizontal" as Orientation,
  resolution: "1080" as Resolution,
  framerate: "60" as Framerate,
  bitrate: "16000000" as Bitrate,
  includeAudio: true,
  format: "mp4" as VideoFormat,
  webcam: false,
  webcamPosition: "bottom-right" as WebcamPosition,
  webcamSize: "medium" as WebcamSize,
  includeMic: false,
  countdown: true,
};

// ============================================
// Modo creador de contenido
// ============================================

// Segundos de la cuenta atrás previa a la grabación
export const COUNTDOWN_SECONDS = 3;

// Posiciones disponibles para el círculo de la webcam
export const WEBCAM_POSITIONS: { value: WebcamPosition; label: string }[] = [
  { value: "bottom-right", label: "Abajo a la derecha" },
  { value: "bottom-left", label: "Abajo a la izquierda" },
  { value: "top-right", label: "Arriba a la derecha" },
  { value: "top-left", label: "Arriba a la izquierda" },
];

// Tamaños del círculo, como fracción del lado menor del vídeo
export const WEBCAM_SIZES: { value: WebcamSize; label: string; ratio: number }[] = [
  { value: "small", label: "Pequeña", ratio: 0.16 },
  { value: "medium", label: "Mediana", ratio: 0.22 },
  { value: "large", label: "Grande", ratio: 0.3 },
];

// Margen del círculo respecto al borde, como fracción del lado menor
export const WEBCAM_MARGIN_RATIO = 0.035;

// Duración de los chunks de grabación (ms)
export const CHUNK_DURATION_MS = 1000;

// ============================================
// Calidad de audio
// ============================================

// Bitrate de audio (192 kbps: calidad de música en estéreo).
// Sin especificarlo, los navegadores usan valores bajos pensados para voz.
export const AUDIO_BITRATE = 192_000;

// Frecuencia de muestreo estándar de audio digital (48 kHz).
// Coincidir con la fuente evita remuestreos que degradan el sonido.
export const AUDIO_SAMPLE_RATE = 48_000;

// Tiempo máximo de grabación (ms) - 1 hora por defecto
export const MAX_RECORDING_DURATION_MS = 60 * 60 * 1000;

// Mensajes de error
export const ERROR_MESSAGES = {
  UNSUPPORTED_BROWSER: "Tu navegador no soporta la grabación de pantalla.",
  PERMISSION_DENIED: "Permiso denegado. Por favor, permite el acceso a la pantalla.",
  NO_VIDEO_TRACKS: "No se detectaron pistas de video.",
  RECORDING_FAILED: "Error al iniciar la grabación.",
  PROCESSING_FAILED: "Error al procesar el video.",
  UNSUPPORTED_FORMAT: "Formato de video no soportado.",
} as const;
