'use strict';

const express = require('express');
const router = express.Router();

const wa = require('../services/whatsapp');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');

const phase1 = require('../handlers/phase1_briefing');
const phase2 = require('../handlers/phase2_contract');
const phase3 = require('../handlers/phase3_processing');
const adjustment = require('../handlers/adjustment');

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

router.get('/', (_req, res) => res.status(200).send('EditBot webhook activo'));

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
// From=whatsapp:+573001234567, Body=texto, NumMedia=1,
// MediaUrl0=https://..., MediaContentType0=video/mp4

async function processIncoming(body) {
  // Extrae userId sin el prefijo 'whatsapp:'
  const userId = (body.From || '').replace(/^whatsapp:/, '');
  if (!userId) return;

  const session = sessionSvc.get(userId);
  const text = (body.Body || '').trim();
  const numMedia = parseInt(body.NumMedia || '0', 10);
  // Twilio Content API: cuando el usuario toca un quick-reply button,
  // ButtonPayload contiene el ID exacto que definimos (PLAN_SEND, etc.)
  const buttonPayload = (body.ButtonPayload || '').trim();

  console.log(`[Router] userId=${userId} state=${sessionSvc.get(userId).state} numMedia=${numMedia} payload="${buttonPayload}" body="${text.slice(0, 60)}"`);

  // ── Botón de Content API (camino más directo y confiable) ─────────────
  if (buttonPayload) {
    session.pendingButtonMap = null;
    sessionSvc.save(session);
    await handleButtonReply(userId, buttonPayload, sessionSvc.get(userId).state);
    return;
  }

  // ── Media ─────────────────────────────────────────────────────────────
  if (numMedia > 0) {
    await phase1.handleMediaReceived(userId, body.MediaUrl0, body.MediaContentType0);
    return;
  }

  // ── Texto o respuesta de botón (fallback numérico) ────────────────────
  if (text) {
    await routeTextOrButton(userId, text);
  }
}

// ── Router: texto puede ser un botón (ID directo o número) ─────────────────

async function routeTextOrButton(userId, text) {
  const session = sessionSvc.get(userId);
  const state = session.state;

  // Intentar resolver como botón (Content API devuelve el ID; fallback devuelve número)
  const buttonId = wa.resolveButtonReply(text, session.pendingButtonMap)
    || resolveKnownButtonId(text);

  if (buttonId) {
    // Limpiar el mapa de botones usado
    session.pendingButtonMap = null;
    sessionSvc.save(session);
    await handleButtonReply(userId, buttonId, state);
    return;
  }

  // No es botón → tratar como texto libre
  await handleTextMessage(userId, text, state, session);
}

// Botones que llegan como ID textual exacto (cuando Content API funciona)
const KNOWN_BUTTON_IDS = new Set([
  'GREET_EDIT_VIDEO', 'GREET_CREATE', 'GREET_EDIT_IMAGE',
  'PLAN_SEND', 'PLAN_EDIT', 'PLAN_CANCEL',
  'SCRIPT_APPROVE', 'SCRIPT_TONE', 'SCRIPT_SKIP',
  'NEXT_ADJUST', 'NEXT_NEW', 'NEXT_FINISH',
  'ADJ_APPLY', 'ADJ_REWRITE', 'ADJ_CANCEL',
  'ENGINE_KLING', 'ENGINE_HIGGSFIELD',
]);

function resolveKnownButtonId(text) {
  const upper = text.trim().toUpperCase();
  return KNOWN_BUTTON_IDS.has(upper) ? upper : null;
}

async function handleButtonReply(userId, buttonId, state) {
  if (['GREET_EDIT_VIDEO', 'GREET_CREATE', 'GREET_EDIT_IMAGE'].includes(buttonId)) {
    return phase1.handleGreetingAction(userId, buttonId);
  }
  if (['PLAN_SEND', 'PLAN_EDIT', 'PLAN_CANCEL'].includes(buttonId)) {
    return phase2.handleContractResponse(userId, buttonId);
  }
  if (['SCRIPT_APPROVE', 'SCRIPT_TONE', 'SCRIPT_SKIP'].includes(buttonId)) {
    return phase1.handleScriptFeedback(userId, buttonId);
  }
  if (['NEXT_ADJUST', 'NEXT_NEW', 'NEXT_FINISH'].includes(buttonId)) {
    return phase3.handleDeliveryChoice(userId, buttonId);
  }
  if (['ADJ_APPLY', 'ADJ_REWRITE', 'ADJ_CANCEL'].includes(buttonId)) {
    return adjustment.handleAdjustmentConfirmation(userId, buttonId);
  }
  if (['ENGINE_KLING', 'ENGINE_HIGGSFIELD'].includes(buttonId)) {
    return phase3.handleEngineChange(userId, buttonId);
  }
  // Podría ser RESTORE_V1, RESTORE_V2, etc.
  if (buttonId.startsWith('RESTORE_V')) {
    return adjustment.handleVersionSelection(userId, buttonId);
  }

  console.warn('[Router] ButtonId no reconocido:', buttonId);
}

const GREETING_WORDS = ['hola', 'hello', 'hi', 'buenas', 'buenos', 'hey', 'inicio', 'start', 'comenzar', 'empezar', 'menu', 'menú'];

function isGreeting(text) {
  const lower = text.toLowerCase().trim().replace(/[!?.,¡¿]+/g, '').trim();
  return GREETING_WORDS.some((w) => lower === w || lower.startsWith(w + ' '));
}

async function handleTextMessage(userId, text, state, session) {
  // Saludo en cualquier estado (excepto procesamiento activo) → reiniciar
  if (isGreeting(text) && state !== STATES.PROCESSING) {
    sessionSvc.reset(userId);
    return phase1.handleGreeting(userId);
  }

  if (state === STATES.IDLE) {
    return phase1.handleGreeting(userId);
  }
  if ([STATES.AWAITING_ASSETS, STATES.AWAITING_PROMPT].includes(state)) {
    return phase1.handlePromptReceived(userId, text);
  }
  if (state === STATES.CONFIRMING_PLAN) {
    // El usuario escribió en vez de tocar un botón → tratar como ajuste del prompt
    return phase2.handlePromptEdit(userId, text);
  }
  if (state === STATES.EDITING_PROMPT) {
    return phase2.handlePromptEdit(userId, text);
  }
  if (state === STATES.ADJUSTMENT_MODE) {
    return adjustment.handleAdjustmentInput(userId, text);
  }
  if (state === STATES.GENERATING_SCRIPT) {
    session.project.prompt = `${session.project.prompt} (tono: ${text})`;
    sessionSvc.save(session);
    await phase1.handleScriptFeedback(userId, 'SCRIPT_APPROVE');
    return;
  }

  await wa.sendText(userId, 'Escribe "hola" para comenzar un nuevo proyecto. 👋');
}

module.exports = router;
