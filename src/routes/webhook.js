'use strict';

const express = require('express');
const router = express.Router();

const wa = require('../services/whatsapp');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');

const info = require('../handlers/info');

// ── Validación de firma Twilio ─────────────────────────────────────────────

function twilioSignatureMiddleware(req, res, next) {
  // En desarrollo (sin TWILIO_AUTH_TOKEN configurado) se omite la validación
  if (!process.env.TWILIO_AUTH_TOKEN) return next();

  const signature = req.headers['x-twilio-signature'];
  const url = `${process.env.BASE_URL}/webhook`;

  if (!wa.validateSignature(signature, url, req.body)) {
    console.warn('[Webhook] Firma Twilio inválida');
    return res.status(403).send('Forbidden');
  }
  next();
}

// ── Ruta GET (health / verificación manual) ────────────────────────────────
// Twilio no usa hub challenge. Esta ruta solo sirve como health check.

router.get('/', (_req, res) => res.status(200).send('Primavera Urbana bot activo'));

// ── Ruta POST — recepción de mensajes de Twilio ────────────────────────────

router.post('/', twilioSignatureMiddleware, async (req, res) => {
  // Twilio requiere respuesta con TwiML (aunque esté vacía)
  res.set('Content-Type', 'text/xml');
  res.send('<Response/>');

  try {
    await processIncoming(req.body);
  } catch (err) {
    console.error('[Webhook] Error procesando mensaje:', err);
  }
});

// ── Parser del payload de Twilio WhatsApp ──────────────────────────────────
// req.body viene como application/x-www-form-urlencoded:
// From=whatsapp:+573001234567, Body=texto, NumMedia=0, ProfileName=Ana

async function processIncoming(body) {
  // Extrae userId sin el prefijo 'whatsapp:'
  const userId = (body.From || '').replace(/^whatsapp:/, '');
  if (!userId) return;

  const session = sessionSvc.get(userId);
  if (body.ProfileName && !session.userName) {
    session.userName = body.ProfileName;
    sessionSvc.save(session);
  }

  const text = (body.Body || '').trim();
  const numMedia = parseInt(body.NumMedia || '0', 10);
  const buttonPayload = (body.ButtonPayload || '').trim();

  console.log(`[Router] userId=${userId} state=${session.state} numMedia=${numMedia} payload="${buttonPayload}" body="${text.slice(0, 60)}"`);

  if (buttonPayload) {
    await handleOption(userId, buttonPayload);
    return;
  }

  // Imágenes, audios, etc. sin texto → solo atendemos texto
  if (numMedia > 0 && !text) {
    await wa.sendText(userId, MSG.mediaNotSupported);
    return;
  }

  if (text) {
    await routeText(userId, text);
  }
}

// ── Router de texto ────────────────────────────────────────────────────────

async function routeText(userId, text) {
  const session = sessionSvc.get(userId);

  // Saludo o palabra de menú → menú principal
  if (isGreeting(text)) {
    if (session.state === STATES.IDLE) return info.handleGreeting(userId);
    return info.sendMainMenu(userId);
  }
  if (isMenuKeyword(text)) {
    return info.sendMainMenu(userId);
  }

  // Número de una opción de la última lista mostrada
  const optionId = wa.resolveButtonReply(text, session.pendingButtonMap);
  if (optionId && (await handleOption(userId, optionId))) return;

  // Primer mensaje con una pregunta directa → saludo corto + respuesta
  if (session.state === STATES.IDLE) {
    await wa.sendText(userId, MSG.greeting.new);
  }

  // Cualquier otra cosa → pregunta libre para la IA
  return info.handleQuestion(userId, text);
}

async function handleOption(userId, optionId) {
  if (optionId.startsWith('MENU_')) return info.handleMenuOption(userId, optionId);
  if (optionId.startsWith('STORE_')) return info.handleStoreSelection(userId, optionId);

  console.warn('[Router] Opción no reconocida:', optionId);
  return false;
}

// ── Detección de saludos y palabras clave ──────────────────────────────────

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')       // quita tildes
    .replace(/[!?.,¡¿💚👋🙂😊]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Solo saludos "puros": "hola", "buenas tardes", "hola buenos días"...
// Un "hola, ¿a qué hora abren?" se trata como pregunta.
const GREETING_RE = /^((hola|hello|hi|hey|buenas|buenos|buen dia|saludos)\s*)+(tardes|noches|dias)?$/;

function isGreeting(text) {
  return GREETING_RE.test(normalize(text));
}

const MENU_WORDS = new Set(['menu', 'inicio', 'opciones', 'start', 'empezar', 'comenzar', 'volver']);

function isMenuKeyword(text) {
  return MENU_WORDS.has(normalize(text));
}

module.exports = router;
