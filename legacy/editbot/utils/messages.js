'use strict';

// Plantillas de mensajes del bot organizadas por fase
const MESSAGES = {
  // ── FASE 1: Bienvenida y briefing ──────────────────────────────────────
  greeting: {
    new: `¡Hola! 👋 Soy tu asistente de edición con IA.

Puedo ayudarte a crear y editar videos e imágenes con solo describir lo que quieres.

¿Qué proyecto vamos a armar hoy? Cuéntame la idea o sube tus archivos para comenzar. 🎬`,

    returning: (name) =>
      `¡Bienvenido de vuelta${name ? `, ${name}` : ''}! 👋\n\n¿Listo para crear algo nuevo o quieres retomar un proyecto anterior?`,

    buttons: [
      { id: 'GREET_EDIT_VIDEO', title: '🎬 Editar mi video' },
      { id: 'GREET_CREATE',     title: '✨ Crear video nuevo' },
      { id: 'GREET_EDIT_IMAGE', title: '🖼️ Editar imagen' },
    ],

    // Mensaje de seguimiento cuando el usuario elige una acción del saludo
    actionContext: {
      GREET_EDIT_VIDEO: '¡Perfecto! Sube el video que quieres editar y cuéntame qué cambios necesitas. 🎬',
      GREET_CREATE:     '¡Genial! Cuéntame tu idea o sube imágenes de referencia para comenzar. ✨',
      GREET_EDIT_IMAGE: '¡Vamos! Sube la imagen que quieres editar y dime qué transformación necesitas. 🖼️',
    },
  },

  briefing: {
    askForAssets: `Perfecto, entendida la idea. 📋

Ahora súbeme los archivos que necesito:
• 🎥 Video base (si tienes uno)
• 🖼️ Imágenes de referencia o estilo
• 🎤 Audio con voz en off (si aplica)

Si no tienes archivos, puedo trabajar solo con tu descripción. ¿Continuamos así?`,

    askForPrompt: `¡Genial! Ya tengo tus archivos.

Ahora dime con detalle: ¿qué quieres que haga con ellos? Puedes describir el estilo, el tono, los efectos o cualquier ajuste que tengas en mente.`,

    processingInput: `Analizando tu idea... 🤔`,
  },

  // ── FASE 2: Contrato / Confirmación ────────────────────────────────────
  contract: {
    confirmHeader: `*Plan de trabajo* ✅\n\nEsto es lo que voy a hacer:\n\n`,

    confirmFooter: `\n¿Procedemos con esto?`,

    buttons: {
      send: '🚀 Procesar',
      edit: '✏️ Ajustar prompt',
      cancel: '❌ Cancelar',
    },

    editPrompt: `Claro, dime qué quieres cambiar del plan. Puedes ajustar el estilo, los efectos, la música, o cualquier otro detalle.`,

    cancelled: `Entendido, cancelamos por aquí. ¡No se gastó nada!

Si quieres empezar de nuevo cuando estés listo, solo escríbeme. 😊`,
  },

  // ── FASE 3: Procesamiento y entrega ────────────────────────────────────
  processing: {
    start: `¡Perfecto! Enviando tu proyecto a producción... 🚀`,

    intermediate: [
      `Procesando tu video... ⚙️`,
      `Aplicando los efectos de IA... 🎨`,
      `Ya casi está... estoy dándole los últimos retoques ✨`,
      `Finalizando y optimizando el archivo... ⏳`,
    ],

    subtitlesInProgress: `Ya casi está... estoy aplicando los subtítulos dinámicos ⏳`,

    colorGradingInProgress: `Ajustando los colores y la paleta de tu video... 🎨`,

    done: `¡Aquí tienes tu resultado! 🎉`,

    doneWithLink: (url) =>
      `¡Tu video está listo! 🍿\n\nEs un archivo grande, así que puedes verlo y descargarlo aquí:\n\n🔗 *Ver Video* → ${url}\n\nEl link estará disponible por 24 horas.`,

    nextSteps: `¿Qué hacemos ahora?`,

    buttons: {
      adjust: '🛠️ Ajustar este video',
      createNew: '➕ Crear otro nuevo',
      finish: '✅ Finalizar y descargar',
    },
  },

  // ── MODO AJUSTE ─────────────────────────────────────────────────────────
  adjustment: {
    welcome: `Modo ajuste activado 🛠️

Tengo el contexto de tu proyecto. Dime qué quieres cambiar:
• Describe el ajuste con palabras: _"súbele el volumen a la música"_
• Señala un rango de tiempo: _"el corte entre el segundo 5 y 10"_
• O sube una captura de pantalla marcando lo que quieres cambiar`,

    confirmAdjustment: (adjustment) =>
      `Entendido. Voy a aplicar este cambio sobre el video actual:\n\n_"${adjustment}"_\n\n¿Procedemos?`,

    applyingChange: `Aplicando el ajuste... 🔧`,

    versionSaved: (version) =>
      `Versión anterior guardada como *V${version}* por si quieres volver a ella.`,

    rollback: (version) =>
      `Volviendo a la versión *V${version}*... ⏪`,
  },

  // ── HISTORIAL DE VERSIONES ──────────────────────────────────────────────
  history: {
    list: (versions) => {
      const items = versions
        .map((v, i) => `• V${i + 1}: ${v.description} _(${v.date})_`)
        .join('\n');
      return `*Historial de versiones* 📂\n\n${items}\n\n¿A cuál quieres volver?`;
    },

    noHistory: `Aún no hay versiones anteriores de este proyecto.`,
  },

  // ── SCRIPT / COPILOT ────────────────────────────────────────────────────
  scriptAssistant: {
    proposal: (script) =>
      `Antes de editar, te propongo este guion de 30 segundos basado en tu idea:\n\n---\n${script}\n---\n\n¿Te gusta este enfoque o ajustamos el tono?`,

    buttons: {
      approve: '✅ Me gusta, continuemos',
      changeTone: '🎭 Cambiar el tono',
      skip: '⏩ Saltar, ir directo a editar',
    },
  },

  // ── TRANSCRIPCIÓN DE AUDIO ──────────────────────────────────────────────
  audio: {
    detected: `Detecté un audio en tu mensaje. Transcribiéndolo automáticamente... 🎤`,
    transcribed: (text) =>
      `Transcripción lista:\n\n_"${text}"_\n\n¿Usamos este texto como base del guion?`,
  },

  // ── LÍMITES Y RESTRICCIONES ─────────────────────────────────────────────
  limits: {
    videoTooLong: `Ese proyecto suena increíble, pero la edición automatizada funciona mejor con videos de hasta *10 minutos*.

Para proyectos más largos te recomiendo dividirlo en segmentos y procesarlos por partes. ¿Te parece si empezamos con la primera sección?`,

    unsupportedFormat: (format) =>
      `El formato *${format}* no está soportado aún. Por ahora trabajo con MP4, MOV, JPG, PNG y MP3/WAV. ¿Puedes convertir el archivo?`,

    fileTooLarge: `El archivo es muy grande (máximo 64 MB por WhatsApp).

Te recomiendo subirlo comprimido o usar un link de Google Drive / Dropbox.`,

    featureUnavailable: (feature) =>
      `Esa función (_${feature}_) está en nuestra hoja de ruta pero aún no está disponible.

Por ahora puedo ayudarte con: cortes, estilos visuales, subtítulos, música y reencuadre. ¿Alguna de estas te sirve?`,
  },

  // ── SELECTOR DE MOTOR DE VIDEO ──────────────────────────────────────────
  engineSelector: {
    prompt: (current) =>
      `Motor de IA activo: *${current === 'kling' ? '⚡ Kling AI' : '🎬 Higgsfield'}*\n¿Cambiar para el próximo video?`,

    buttons: {
      kling: '⚡ Kling AI',
      higgsfield: '🎬 Higgsfield',
    },

    changed: (engine) =>
      `Motor cambiado a *${engine === 'kling' ? '⚡ Kling AI' : '🎬 Higgsfield'}*. ✅\nSe usará en el próximo procesamiento.`,
  },

  // ── ERRORES ──────────────────────────────────────────────────────────────
  errors: {
    generic: `Ups, algo salió mal de nuestro lado. 😅 No te preocupes, no se perdió tu proyecto. Intenta de nuevo en un momento.`,
    timeout: `El procesamiento está tardando más de lo esperado. Te avisaré en cuanto esté listo. 📬`,
    sessionExpired: `Tu sesión expiró tras 24 horas de inactividad. ¿Quieres empezar un nuevo proyecto?`,
  },
};

module.exports = MESSAGES;
