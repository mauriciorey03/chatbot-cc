'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { KB, toPromptText, todayISO } = require('../data/knowledgeBase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

// ── Prompt del sistema (estable → cacheable) ───────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente virtual de WhatsApp de ${KB.name} (${KB.location.city}).
Tu trabajo es responder preguntas de los visitantes usando ÚNICAMENTE la información de la base de conocimiento de abajo.

Cómo responder:
- Responde en español, con un tono cálido, cercano y profesional. Puedes usar algún emoji, sin exagerar.
- No empieces cada respuesta con un saludo: el sistema ya saluda al usuario al iniciar la conversación.
- Sé breve: es WhatsApp. Usa frases cortas, saltos de línea y viñetas (•) cuando listes cosas. Para resaltar usa *negrita* de WhatsApp (un solo asterisco), nunca Markdown con ** ni encabezados #.
- Si la pregunta se puede responder con la base de conocimiento, responde con datos exactos (locales, pisos, horarios, enlaces).
- Si la información NO está en la base de conocimiento (por ejemplo, una tienda, restaurante, promoción, precio o teléfono que no aparece), dilo con honestidad, no la inventes, y sugiere el directorio de tiendas, el mapa de restaurantes o el WhatsApp de Atención al Cliente según corresponda.
- Para eventos con fechas, compara con la fecha actual que se te indica en el mensaje: si ya terminó, dilo claramente.
- Si te preguntan algo que no tiene relación con el centro comercial, indícalo amablemente y ofrece ayuda con temas de ${KB.shortName}.
- Al final puedes recordar que escribiendo *menú* se ven las opciones, pero no en todas las respuestas.

<base_de_conocimiento>
${toPromptText()}
</base_de_conocimiento>`;

// Máximo de mensajes previos que se envían como contexto
const MAX_HISTORY = 10;

function weekday() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'America/Bogota' });
}

// ── Respuesta a preguntas libres ──────────────────────────────────────────
// history: [{ role: 'user' | 'assistant', content: string }]

async function answerQuestion(question, history = []) {
  const messages = [
    ...history.slice(-MAX_HISTORY),
    {
      role: 'user',
      // La fecha va en el turno del usuario (no en el system) para no romper el caché
      content: `[Fecha actual: ${weekday()} ${todayISO()}]\n${question}`,
    },
  ];

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  if (response.stop_reason === 'refusal') {
    console.warn('[AI] Respuesta rechazada:', response.stop_details);
    return null;
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return text || null;
}

module.exports = { answerQuestion };
