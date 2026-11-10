'use strict';

const express = require('express');
const router = express.Router();

const wa = require('../services/whatsapp');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const { KB } = require('../data/knowledgeBase');

const info = require('../handlers/info');
const auth = require('../handlers/auth');
const register = require('../handlers/register');
const update = require('../handlers/update');

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

router.get('/', (_req, res) => res.status(200).send(`Bot de ${KB.shortName} activo`));

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

  console.log(`[Router] userId=${userId} state=${session.state} auth=${session.authenticated} numMedia=${numMedia} payload="${buttonPayload}" body="${text.slice(0, 60)}"`);

  // Identificación vencida por inactividad → se vuelve a pedir la cédula
  if (sessionSvc.touch(session)) {
    await wa.sendText(userId, MSG.auth.expired);
    return;
  }

  // Imágenes, audios, etc. sin texto → solo atendemos texto
  if (numMedia > 0 && !text && !buttonPayload) {
    await wa.sendText(userId, MSG.mediaNotSupported);
    return;
  }

  const input = buttonPayload || text;
  if (!input) return;

  // "menú" en cualquier momento cancela el registro/actualización en curso
  if (isMenuKeyword(input)) {
    session.register = null;
    session.update = null;
    sessionSvc.save(session);
    return session.authenticated ? info.sendMainMenu(userId) : auth.sendWelcome(userId);
  }

  if (session.state === STATES.REGISTERING) return register.handle(userId, input);
  if (session.state === STATES.UPDATING) return update.handle(userId, input);

  // Sin cédula validada no se muestra el menú
  if (!session.authenticated) return auth.handle(userId, input);

  if (buttonPayload) {
    await handleOption(userId, buttonPayload);
    return;
  }

  await routeText(userId, text);
}

// ── Router de texto (cliente identificado) ─────────────────────────────────

async function routeText(userId, text) {
  const session = sessionSvc.get(userId);

  // Saludo → menú principal con saludo personalizado
  if (isGreeting(text)) return info.handleGreeting(userId);

  // Número de una opción de la última lista mostrada
  const optionId = wa.resolveButtonReply(text, session.pendingButtonMap);
  if (optionId && (await handleOption(userId, optionId))) return;

  // Cualquier otra cosa → pregunta libre para la IA
  return info.handleQuestion(userId, text);
}

async function handleOption(userId, optionId) {
  if (optionId === 'MENU_UPDATE') return update.start(userId);
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
