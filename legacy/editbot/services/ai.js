'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// ── Prompt del sistema para el Director de Edición ──────────────────────────

const SYSTEM_PROMPT = `Eres un asistente de edición de video e imagen con IA para WhatsApp.
Tu nombre es EditBot. Actúas como un director creativo experto que comprende tanto
el lenguaje técnico de edición como el lenguaje amateur de usuarios sin experiencia.

REGLAS CRÍTICAS:
1. Nunca afirmes que estás renderizando o procesando el video tú mismo.
   Tú DISEÑAS y CONFIRMAS el plan; un motor externo hace el procesamiento.
2. Si el usuario pide algo imposible para edición automatizada
   (p. ej.: un largometraje de 2 horas), indícalo con sutileza y ofrece alternativas.
3. Responde siempre en español, con un tono amigable, claro y profesional.
4. Sé conciso en WhatsApp: usa oraciones cortas y saltos de línea.
5. Jamás inventes capacidades que no existen.

CAPACIDADES REALES:
- Corte y trimming inteligente
- Estilos visuales y corrección de color
- Subtítulos automáticos dinámicos
- Reencuadre inteligente (16:9 ↔ 9:16)
- Música de fondo (librería de audio libre)
- Eliminación de silencios y muletillas
- Cambio de fondos con IA
- Formateo para múltiples plataformas`;

// ── Análisis de prompt del usuario ─────────────────────────────────────────

async function analyzPrompt(userMessage, assets, conversationHistory) {
  const assetContext =
    assets.length > 0
      ? `\nArchivos recibidos: ${assets.map((a) => `${a.type} (${a.mimeType})`).join(', ')}`
      : '\nNo se recibieron archivos adjuntos.';

  const messages = [
    ...conversationHistory,
    {
      role: 'user',
      content: userMessage + assetContext,
    },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  return response.content[0].text;
}

// ── Generación del plan de trabajo ─────────────────────────────────────────

async function generatePlan(userPrompt, assets) {
  const assetDesc =
    assets.length > 0
      ? assets.map((a) => `• ${a.type}: ${a.filename || a.mimeType}`).join('\n')
      : '• Sin archivos (generación desde cero)';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `El usuario quiere: "${userPrompt}"\n\nArchivos disponibles:\n${assetDesc}\n\nGenera un plan de trabajo conciso y claro (máximo 5 puntos).
Formato de cada punto: emoji + acción específica.
Ejemplo:
🎬 Tomar el video base de 10 segundos
🎨 Aplicar estilo cinematográfico oscuro (LUT Matrix)
📝 Añadir subtítulos dinámicos en la parte inferior
🎵 Agregar música synthwave de fondo (volumen 30%)
📱 Exportar en formato 9:16 para TikTok/Reels

Solo genera la lista, sin texto adicional.`,
      },
    ],
  });

  return response.content[0].text;
}

// ── Generación de guion (copilot) ──────────────────────────────────────────

async function generateScript(objective, duration = 30) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Crea un guion de ${duration} segundos para: "${objective}".

Estructura: Gancho (0-5s) | Desarrollo (5-25s) | CTA (25-30s).
Formato: tiempo en segundos entre corchetes + texto de voz en off.
Tono: conversacional, dinámico y persuasivo.
Máximo 80 palabras totales.`,
      },
    ],
  });

  return response.content[0].text;
}

// ── Interpretación de ajuste incremental ───────────────────────────────────

async function interpretAdjustment(adjustmentText, currentPlan, versions) {
  const versionContext =
    versions.length > 0
      ? `Versiones previas: ${versions.map((v) => `V${v.version}: ${v.description}`).join(' | ')}`
      : 'No hay versiones previas.';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Plan actual del proyecto:
${currentPlan}

${versionContext}

El usuario quiere este ajuste: "${adjustmentText}"

Describe en 2-3 líneas específicas qué cambio exacto se aplicará sobre el proyecto actual,
sin renderizar desde cero. Sé técnico pero comprensible.`,
      },
    ],
  });

  return response.content[0].text;
}

// ── Detección de intención de rollback ─────────────────────────────────────

async function detectRollbackIntent(message) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 50,
    system: 'Responde solo con JSON.',
    messages: [
      {
        role: 'user',
        content: `¿Este mensaje del usuario indica que quiere volver a una versión anterior?
Mensaje: "${message}"
Responde: {"isRollback": true/false, "versionHint": número o null}`,
      },
    ],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { isRollback: false, versionHint: null };
  }
}

// ── Detección de proyectos imposibles ─────────────────────────────────────

async function detectLimitations(prompt) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: 'Responde solo con JSON.',
    messages: [
      {
        role: 'user',
        content: `¿Esta solicitud de edición de video tiene alguna limitación crítica para procesamiento automatizado?
Solicitud: "${prompt}"
Limitaciones críticas: duración mayor a 10 minutos, resolución mayor a 4K, edición manual frame a frame, VFX de cine, largometraje.
Responde: {"hasLimitation": true/false, "reason": "descripción breve o null"}`,
      },
    ],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { hasLimitation: false, reason: null };
  }
}

module.exports = {
  analyzPrompt,
  generatePlan,
  generateScript,
  interpretAdjustment,
  detectRollbackIntent,
  detectLimitations,
};
