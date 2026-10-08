# SCREENREC 🎥

> **Grabador de pantalla profesional con superpoderes**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.7-purple.svg)](https://vitejs.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-8.57.1-4B32C3.svg)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-3.9.9-F7B93E.svg)](https://prettier.io/)

---

## 📌 Descripción

**SCREENREC** es una aplicación web de nivel premium diseñada para creadores de contenido, diseñadores web y desarrolladores. Permite grabar la pantalla en **alta calidad** (hasta 4K) con configuraciones avanzadas de **orientación, resolución, FPS y bitrate**, todo directamente desde el navegador sin necesidad de instalar software adicional.

### ✨ Características Principales

- **🎯 Orientación Dual**: Horizontal (16:9) para YouTube o Vertical (9:16) para Reels/TikTok.
- **📏 Resolución Escalonada**: 1080p (Full HD), 1440p (2K), 2160p (4K).
- **⚡ Tasa de Fotogramas**: 30 FPS (estándar) o 60 FPS (ultra fluido).
- **🎚️ Bitrate Ajustable**: 8 Mbps (Alta), 16 Mbps (Extrema), 30 Mbps (Sin Pérdidas).
- **🎬 Formatos de Salida**: MP4 (H.264) o WebM (VP9/VP8) con **fallback inteligente**.
- **🔊 Audio del Sistema**: Opción para incluir o excluir el audio de la pestaña.
- **🖥️ Vista Previa en Vivo**: Visualización en tiempo real de lo que se está grabando.
- **🎞️ Reproductor Integrado**: Revisa el video antes de descargarlo.
- **💾 Gestión de Archivos**: Descargar o descartar el video con nombre automático.
- **🔒 Bloqueo de Controles**: Evita cambios accidentales durante la grabación.
- **📱 Diseño Responsive**: Adaptable a móviles y escritorio.
- **💳 Suscripciones Pro**: Integración opcional Stripe + Supabase Auth; requiere configuración propia antes de habilitar cobros.

---

## 🚀 Instalación y Uso

### Requisitos

- **Navegador moderno**: Google Chrome, Microsoft Edge o Firefox (recomendado Chrome para mejor soporte de MP4).
- **Permisos**: La aplicación requiere permiso para acceder a la pantalla y al audio del sistema.
- **Desarrollo**: Node.js 20.19 o superior. Para validar las Edge Functions, Deno 2.9.6.

### Instalación Local

1. **Clonar el repositorio**:

   ```bash
   git clone https://github.com/laulau030416-create/Grabador-de-pantalla.git
   cd Grabador-de-pantalla
   ```

2. **Instalar dependencias**:

   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**:

   ```bash
   npm run dev
   ```

   > Vite servirá la aplicación en `http://localhost:5173`.

4. **Build para producción**:

   ```bash
   npm run build
   ```

   > Los archivos generados estarán en la carpeta `dist/`.

5. **Desplegar**:
   - **GitHub Pages**: `npm run build` y sube la carpeta `dist/` a tu repositorio.
   - **Vercel/Netlify**: Conecta tu repositorio y despliega automáticamente.

### Suscripciones Pro

El checkout permanece deshabilitado hasta configurar Supabase y Stripe. Sigue la [guía de facturación](docs/billing-setup.md); no añadas claves secretas a Vite ni al repositorio. Empieza en modo de prueba y no publiques cobros reales antes de completar las pruebas y la configuración fiscal/legal.

---

## 📂 Estructura del Proyecto

```
.
├── index.html
├── public/                  # Logo e iconos
├── src/
│   ├── config/              # Planes, límites y opciones
│   ├── core/                # Grabación, biblioteca, uso y billing
│   ├── ui/                  # Dashboard y componentes
│   ├── utils/                # Detección y formateo
│   └── styles/               # CSS de la aplicación
├── supabase/
│   ├── functions/            # Checkout, portal y webhook Stripe
│   └── migrations/           # Tablas y RLS de billing
├── docs/billing-setup.md     # Configuración de Stripe + Supabase
├── .github/workflows/ci.yml
├── package.json
└── README.md
```

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Uso                              |
| ---------- | ------- | -------------------------------- |
| TypeScript | 5.9.3   | Lenguaje principal               |
| Vite       | 7.3.7   | Bundler y servidor de desarrollo |
| ESLint     | 8.57.1  | Linting                          |
| Prettier   | 3.9.9   | Formateo de código               |
| Vitest     | 4.1.11  | Testing                          |

### APIs del Navegador

- [`navigator.mediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia): Captura de pantalla.
- [`Canvas API`](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API): Procesamiento de video (recorte, escalado).
- [`MediaRecorder API`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder): Grabación de video.
- [`AudioContext API`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext): Manejo de audio.

---

## 🎨 Diseño y UX

### Paleta de Colores

| Color            | Hex                     | Uso                       |
| ---------------- | ----------------------- | ------------------------- |
| Fondo oscuro     | `#0f172a`               | Fondo principal           |
| Tarjeta          | `rgba(30, 41, 59, 0.7)` | Paneles con Glassmorphism |
| Acento           | `#6366f1`               | Botones principales       |
| Peligro          | `#ef4444`               | Botones de error/stop     |
| Texto principal  | `#f1f5f9`               | Texto principal           |
| Texto secundario | `#94a3b8`               | Texto muted               |

### Tipografía

- **Fuente**: [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts).
- **Estilo**: Moderno, limpio y legible.

### Diseño Responsive

- **Escritorio**: Layout horizontal (2 paneles).
- **Móvil**: Layout vertical (1 columna).

---

## 🧪 Testing

### Ejecutar pruebas

```bash
npm test
```

### Validaciones

```bash
npm run typecheck
npm run lint
npm run format:check
npm test -- --run
npm run test:coverage
npm run build
npm run check:functions  # requiere Deno 2.9.6
npm audit --audit-level=moderate
```

Los tests Vitest viven junto a los módulos en `src/`. La integración Stripe/Supabase requiere además pruebas de sandbox con credenciales propias; no se ejecutan contra cuentas externas en CI.

---

## 📜 Licencia

Este proyecto está bajo la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Sigue estos pasos:

1. **Forkea el repositorio**.
2. **Crea una rama** (`git checkout -b feature/nueva-funcionalidad`).
3. **Haz commit** de tus cambios (`git commit -m "Añade nueva funcionalidad"`).
4. **Push** a la rama (`git push origin feature/nueva-funcionalidad`).
5. **Abre un Pull Request**.

### Reglas de Contribución

- **Código limpio**: Sigue las reglas de ESLint y Prettier.
- **TypeScript**: Usa tipado estricto.
- **Tests**: Añade pruebas para nuevas funcionalidades.
- **Documentación**: Actualiza el README si es necesario.

---

## 📞 Soporte

Si encuentras un error o tienes una sugerencia, abre un **Issue** en el repositorio:

[🐛 Reportar Issue](https://github.com/laulau030416-create/Grabador-de-pantalla/issues)

---

## 🎯 Hoja de Ruta (Roadmap)

- [x] Grabación básica de pantalla.
- [x] Configuración de orientación (horizontal/vertical).
- [x] Ajuste de resolución, FPS y bitrate.
- [x] Inclusión de audio del sistema.
- [x] Vista previa en vivo.
- [x] Reproductor integrado.
- [ ] **Shortcuts de teclado** (Ctrl+Shift+R para grabar).
- [ ] **Modo "Sin interfaz"** (ocultar controles durante grabación).
- [ ] **Exportación a Google Drive/Dropbox**.
- [ ] **Subtítulos automáticos** (usando Web Speech API).
- [ ] **Filtros de video** (brillo, contraste, etc.).
- [ ] **Grabación de cámara web + pantalla** (picture-in-picture).

---

## 🏆 Agradecimientos

- A la comunidad de **MDN Web Docs** por la documentación de las APIs.
- A **Vite** por su velocidad y simplicidad.
- A **TypeScript** por hacer el código más robusto.

---

> **Hecho con ❤️ y TypeScript**
> © 2024 [eslendere3official-stack](https://github.com/eslendere3official-stack)
