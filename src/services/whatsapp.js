'use strict';

const twilio = require('twilio');
const axios = require('axios');

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_NUMBER; // 'whatsapp:+14155238886'

const client = twilio(SID, TOKEN);

// Formatea el número destino con el prefijo whatsapp:
const wa = (to) => (to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);

// ── Envío de texto plano ────────────────────────────────────────────────────

async function sendText(to, body) {
  return client.messages.create({ from: FROM, to: wa(to), body });
}

// ── Botones interactivos via Twilio Content API ─────────────────────────────
// Genera un template de quick-reply on-the-fly y lo envía.
// Si la Content API falla (sandbox, permisos, etc.) cae al fallback de texto.

async function sendButtons(to, body, buttons) {
  // buttons: [{ id, title }]  max 3
  try {
    const content = await client.content.v1.contents.create({
      friendlyName: `btn_${Date.now()}`,
      language: 'es',
      variables: { '1': body },
      types: {
        'twilio/quick-reply': {
          body: '{{1}}',
          actions: buttons.map((b) => ({ title: b.title, id: b.id, type: 'QUICK_REPLY' })),
        },
      },
    });

    await client.messages.create({
      from: FROM,
      to: wa(to),
      contentSid: content.sid,
      contentVariables: JSON.stringify({ '1': body }),
    });

    return { contentSid: content.sid };
  } catch (err) {
    console.warn('[WhatsApp] Content API falló, usando texto numerado:', err.message);
    return sendButtonsFallback(to, body, buttons);
  }
}

// Fallback: envía los botones como opciones numeradas en texto plano.
// Devuelve el mapa { '1': id, '2': id, ... } para que el caller lo guarde en sesión.
async function sendButtonsFallback(to, body, buttons) {
  const lines = buttons.map((b, i) => `${i + 1}️⃣ ${b.title}`);
  const fullBody = `${body}\n\n${lines.join('\n')}`;
  await client.messages.create({ from: FROM, to: wa(to), body: fullBody });

  const map = {};
  buttons.forEach((b, i) => { map[String(i + 1)] = b.id; });
  return { buttonMap: map };
}

// Resuelve la respuesta del usuario: si es "1"/"2"/"3" y hay un mapa, devuelve el ID real.
function resolveButtonReply(text, pendingButtonMap) {
  if (!pendingButtonMap) return null;
  const trimmed = text.trim();
  // Número directo
  if (pendingButtonMap[trimmed]) return pendingButtonMap[trimmed];
  // Número con emoji (ej: "1️⃣"). Solo si el mensaje es únicamente el número,
  // para que preguntas como "¿cuántos pisos hay, 3?" no se tomen como opción.
  if (/^\d+️?⃣?$/.test(trimmed)) {
    const digit = trimmed.replace(/[^0-9]/g, '');
    if (pendingButtonMap[digit]) return pendingButtonMap[digit];
  }
  // Coincidencia por ID directo (Content API devuelve el ID como Body)
  const asId = Object.values(pendingButtonMap).find(
    (id) => id === trimmed.toUpperCase()
  );
  return asId || null;
}

// ── Lista de selección ──────────────────────────────────────────────────────

async function sendList(to, body, _buttonTitle, sections, footer) {
  // Twilio no soporta listas nativas en la misma forma que Meta.
  // Se envía como texto numerado con secciones.
  let text = `${body}\n`;
  let counter = 1;
  const map = {};

  for (const section of sections) {
    if (section.title) text += `\n*${section.title}*\n`;
    for (const row of section.rows) {
      text += `${counter}️⃣ ${row.title}`;
      if (row.description) text += ` — ${row.description}`;
      text += '\n';
      map[String(counter)] = row.id;
      counter++;
    }
  }
  if (footer) text += `\n${footer}`;

  await client.messages.create({ from: FROM, to: wa(to), body: text });
  return { buttonMap: map };
}

// ── CTA URL ─────────────────────────────────────────────────────────────────

async function sendCtaUrl(to, body, displayText, url) {
  const fullBody = `${body}\n\n🔗 ${displayText}: ${url}`;
  return client.messages.create({ from: FROM, to: wa(to), body: fullBody });
}

// ── Envío de media ──────────────────────────────────────────────────────────

async function sendMedia(to, _mediaType, mediaUrl, caption) {
  const params = { from: FROM, to: wa(to), mediaUrl: [mediaUrl] };
  if (caption) params.body = caption;
  return client.messages.create(params);
}

// ── Marcar como leído ───────────────────────────────────────────────────────
// Twilio no expone este concepto en su API — no-op.

async function markAsRead(_messageId) {
  return null;
}

// ── Descarga de media desde Twilio ──────────────────────────────────────────
// Twilio requiere autenticación básica para acceder a los archivos de media.

async function downloadMedia(mediaUrl) {
  const { data, headers } = await axios.get(mediaUrl, {
    auth: { username: SID, password: TOKEN },
    responseType: 'arraybuffer',
  });
  return { buffer: data, mimeType: headers['content-type'] };
}

// ── Validación de firma del webhook ─────────────────────────────────────────

function validateSignature(signature, url, params) {
  return twilio.validateRequest(TOKEN, signature, url, params);
}

module.exports = {
  sendText,
  sendButtons,
  sendButtonsFallback,
  resolveButtonReply,
  sendList,
  sendCtaUrl,
  sendMedia,
  markAsRead,
  downloadMedia,
  validateSignature,
};
