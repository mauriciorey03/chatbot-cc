# EditBot – Diseño de Flujo y Comportamiento del Sistema

## Arquitectura general

```
Usuario (WhatsApp)
       │
       ▼
Meta Cloud API (Webhook)
       │
       ▼
Express Server  ──►  StateMachine (flujo conversacional)
       │                     │
       ├──► Claude AI         ├── IDLE
       │    (texto/planes)    ├── GREETING
       │                     ├── AWAITING_ASSETS
       ├──► Motor de Video    ├── AWAITING_PROMPT
       │    (Runway/Kling)    ├── GENERATING_SCRIPT
       │                     ├── CONFIRMING_PLAN
       └──► Session Store     ├── PROCESSING
            (NodeCache 24h)   ├── DELIVERY
                              ├── ADJUSTMENT_MODE
                              └── APPLYING_ADJUSTMENT
```

---

## FASE 1 — Calentamiento y Briefing

### Estados: IDLE → GREETING → AWAITING_ASSETS → AWAITING_PROMPT

### 1.1 Saludo inicial

**Disparador:** Cualquier primer mensaje del usuario.

**Bot (usuario nuevo):**
> ¡Hola! 👋 Soy tu asistente de edición con IA.
> Puedo ayudarte a crear y editar videos e imágenes con solo describir lo que quieres.
> ¿Qué proyecto vamos a armar hoy? Cuéntame la idea o sube tus archivos para comenzar. 🎬

**Bot (usuario recurrente):**
> ¡Bienvenido de vuelta, [nombre]! 👋
> ¿Listo para crear algo nuevo o quieres retomar un proyecto anterior?

---

### 1.2 Captura multimodal de assets

El bot acepta en cualquier orden:
| Tipo        | Formatos soportados           | Acción del bot                      |
|-------------|-------------------------------|-------------------------------------|
| Texto       | Prompt libre                  | Analiza intención                   |
| Video       | MP4, MOV, AVI                 | Guarda como asset base              |
| Imagen      | JPG, PNG, WEBP, GIF           | Guarda como referencia de estilo    |
| Audio       | MP3, WAV, OGG, AAC            | Transcribe automáticamente (STT)    |

**Transcripción de audio:**
> 🎤 Detecté un audio en tu mensaje. Transcribiéndolo automáticamente...
> _Transcripción: "[texto transcrito]"_
> ¿Usamos este texto como base del guion?

---

### 1.3 Modo Copilot (Script Assistant)

**Disparador:** Prompts vagos como "video para vender X", "anuncio de Y" de menos de 100 caracteres.

**Bot (propone guion):**
> Antes de editar, te propongo este guion de 30 segundos:
>
> ---
> [0-5s] **Gancho:** "¿Cansado de X? Tenemos la solución..."
> [5-25s] **Desarrollo:** "Nuestro producto hace A, B y C..."
> [25-30s] **CTA:** "Visítanos en @marca o escríbenos hoy"
> ---
>
> ¿Te gusta este enfoque o ajustamos el tono?

**Botones:**
- `✅ Me gusta, continuemos`
- `🎭 Cambiar el tono`
- `⏩ Saltar, ir directo a editar`

---

## FASE 2 — El "Contrato" (Confirmación del Plan)

### Estado: CONFIRMING_PLAN

### 2.1 Generación y presentación del plan

**Bot:**
> **Plan de trabajo** ✅
>
> Esto es lo que voy a hacer:
>
> 🎬 Tomar el video base de 10 segundos
> 🎨 Aplicar estilo cinematográfico oscuro (LUT Matrix)
> 📝 Añadir subtítulos dinámicos en la parte inferior
> 🎵 Agregar música synthwave de fondo (volumen 30%)
> 📱 Exportar en formato 9:16 para TikTok/Reels
>
> ¿Procedemos con esto?

**Botones (máx. 3 en WhatsApp):**
- `🚀 Procesar` → Inicia procesamiento
- `✏️ Ajustar prompt` → Permite reescribir el prompt
- `❌ Cancelar` → Resetea sin gastar créditos

---

### 2.2 Ajuste del prompt (EDITING_PROMPT)

**Bot:**
> Claro, dime qué quieres cambiar del plan. Puedes ajustar el estilo, los efectos, la música, o cualquier otro detalle.

El usuario reescribe, el bot regenera el plan completo y vuelve al estado `CONFIRMING_PLAN`.

---

### 2.3 Cancelación

**Bot:**
> Entendido, cancelamos por aquí. ¡No se gastó nada!
> Si quieres empezar de nuevo cuando estés listo, solo escríbeme. 😊

Resetea la sesión sin conservar el proyecto.

---

## FASE 3 — Procesamiento y Entrega

### Estados: PROCESSING → DELIVERY

### 3.1 Inicio del procesamiento

**Bot:**
> ¡Perfecto! Enviando tu proyecto a producción... 🚀

---

### 3.2 Mensajes intermedios automáticos (cada 30 segundos)

Para evitar silencios en WhatsApp, el sistema envía mensajes de progreso automáticamente:

| Tiempo | Mensaje                                         |
|--------|-------------------------------------------------|
| 0s     | "Procesando tu video... ⚙️"                    |
| 30s    | "Aplicando los efectos de IA... 🎨"             |
| 60s    | "Ya casi está... estoy dándole los últimos retoques ✨" |
| 90s    | "Finalizando y optimizando el archivo... ⏳"    |
| 2min+  | "El procesamiento está tardando más. Te avisaré en cuanto esté listo. 📬" |

Mensajes específicos según la tarea detectada:
- Subtítulos: `"Ya casi está... estoy aplicando los subtítulos dinámicos ⏳"`
- Color grading: `"Ajustando los colores y la paleta de tu video... 🎨"`

---

### 3.3 Entrega del resultado

**Archivo pequeño (< 64 MB):**
> ¡Aquí tienes tu resultado! 🎉
> [video enviado directamente en el chat]
> ¿Qué hacemos ahora?

**Archivo grande (> 64 MB o alta resolución):**
> ¡Tu video está listo! 🍿
> Es un archivo grande, así que puedes verlo y descargarlo aquí:
> 🔗 **Ver Video** → [link]
> El link estará disponible por 24 horas.

**Botones post-entrega:**
- `🛠️ Ajustar este video`
- `➕ Crear otro nuevo`
- `✅ Finalizar y descargar`

---

## MODO AJUSTE — Prompting Incremental

### Estados: ADJUSTMENT_MODE → CONFIRMING_ADJUSTMENT → APPLYING_ADJUSTMENT

### Activación

Solo disponible después de una entrega. El bot mantiene **toda la memoria del proyecto** (assets, plan, versión actual).

**Bot:**
> Modo ajuste activado 🛠️
>
> Tengo el contexto de tu proyecto. Dime qué quieres cambiar:
> • Describe el ajuste: _"súbele el volumen a la música"_
> • Señala un rango de tiempo: _"el corte entre el segundo 5 y 10"_
> • O sube una captura marcando lo que quieres cambiar

---

### Interpretación y confirmación del ajuste

**Usuario:** "Súbele el volumen a la música"

**Bot:**
> Entendido. Voy a aplicar este cambio sobre el video actual:
>
> _"Incrementar el volumen del track de música synthwave de 30% a 70%, sin re-renderizar el video completo."_
>
> ¿Procedemos?

**Botones:**
- `✅ Aplicar cambio`
- `✏️ Redescribir`
- `↩️ Volver`

**Clave técnica:** El sistema aplica solo una capa de edición sobre el asset de audio, **no renderiza desde cero**.

---

## HISTORIAL DE VERSIONES (Control de Versiones)

Cada vez que se aplica un ajuste, la versión anterior se guarda automáticamente:

**Bot:**
> Versión anterior guardada como **V2** por si quieres volver a ella.

### Rollback

**Disparadores:** El usuario escribe frases como:
- "Vuelve a la versión anterior"
- "No me gustó el último cambio"
- "Quiero la versión 1"

**Bot (rollback directo):**
> Volviendo a la **V1**... ⏪
> [Entrega el video de V1 con opciones]

**Bot (selección de versión con lista):**
> 📂 **Historial de versiones**
>
> • V1: Video original sin cambios (hace 5 min)
> • V2: Cambio de color a estilo Matrix (hace 3 min)
>
> ¿A cuál quieres volver?

---

## MÓDULOS DEL SISTEMA

### Módulo 1 – Input y Comprensión
| Capacidad           | Descripción técnica                                    |
|---------------------|--------------------------------------------------------|
| Prompting libre     | Claude analiza texto sin estructura fija               |
| Multimodal          | WhatsApp acepta image/video/audio en el mismo mensaje  |
| STT (audio → texto) | Transcripción automática al recibir audio              |
| Copilot de guion    | Claude genera guion estructurado si el prompt es vago  |
| Detección de límites | Claude detecta solicitudes imposibles antes de procesar |

### Módulo 2 – Edición por Lenguaje Natural
| Comando natural                        | Acción técnica                           |
|----------------------------------------|------------------------------------------|
| "Quita los silencios"                  | Smart trimming / silence removal         |
| "Dale un toque cinematográfico oscuro" | LUT color grading (Matrix/Teal-Orange)  |
| "Adapta para TikTok"                   | Smart Reframing 16:9 → 9:16              |
| "Corta donde salgo sonriendo"          | Detección facial + trimming inteligente  |
| "Añade subtítulos dinámicos"           | ASR + subtitle rendering                 |
| "Cambia el fondo por una playa"        | Background replacement con IA generativa |

### Módulo 3 – Generación e Integración de Assets
| Capacidad                | Motor externo sugerido          |
|--------------------------|---------------------------------|
| Estilos visuales / LUTs  | Runway ML, Kling AI             |
| Cambio de fondos         | Runway Gen-3, Pika Labs         |
| Música de fondo          | Suno AI, Mubert API             |
| Reencuadre inteligente   | Adobe Premiere Pro API, Runway  |
| Subtítulos automáticos   | Whisper (OpenAI) + Remotion     |

---

## RESTRICCIONES CRÍTICAS

| Situación                        | Comportamiento del bot                                     |
|----------------------------------|------------------------------------------------------------|
| Video > 10 minutos               | Sugiere dividir en segmentos                               |
| Largometraje / producción de cine | Redirige con alternativas                                 |
| Formato no soportado             | Informa y pide formato alternativo                         |
| Archivo > 64 MB                  | Envía CTA URL en vez del archivo                           |
| Función no disponible            | Informa y ofrece funciones similares disponibles           |
| Procesamiento > 2 min            | Avisa y promete notificar cuando esté listo                |
| El bot NUNCA afirma que renderiza | Rol del bot: diseño y confirmación del plan únicamente    |

---

## ESTRUCTURA DE ARCHIVOS DEL PROYECTO

```
src/
├── index.js                    # Servidor Express
├── routes/
│   └── webhook.js              # Enrutador principal de mensajes
├── services/
│   ├── whatsapp.js             # Cliente de la WhatsApp Cloud API
│   ├── ai.js                   # Integración con Claude (Anthropic)
│   ├── session.js              # Gestión de sesiones en memoria (24h)
│   └── media.js                # Manejo de archivos + integración con motor de video
├── handlers/
│   ├── phase1_briefing.js      # Fase 1: saludo, assets, prompt, guion
│   ├── phase2_contract.js      # Fase 2: confirmación, edición, cancelación
│   ├── phase3_processing.js    # Fase 3: procesamiento, entrega, post-entrega
│   └── adjustment.js           # Modo ajuste + historial de versiones
├── flows/
│   └── stateMachine.js         # Máquina de estados + transiciones válidas
└── utils/
    └── messages.js             # Todas las plantillas de texto del bot
```
