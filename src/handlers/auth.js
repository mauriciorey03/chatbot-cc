'use strict';

const wa = require('../services/whatsapp');
const db = require('../services/db');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const info = require('./info');
const register = require('./register');

// Un mensaje cuenta como cédula si solo trae dígitos y separadores (20.649.831, 20 649 831)
const ID_RE = /^[\d.\s-]+$/;
const MIN_ID_LENGTH = 6;

async function sendWelcome(userId) {
  const session = sessionSvc.get(userId);
  await wa.sendText(userId, MSG.auth.welcome());
  session.state = STATES.AUTH;
  sessionSvc.save(session);
}

// Mensajes de un usuario aún no identificado: cédula, REGISTRO o cualquier otra cosa
async function handle(userId, text) {
  if (text.trim().toLowerCase() === 'registro') return register.start(userId);

  const cedula = text.replace(/\D/g, '');
  if (!ID_RE.test(text.trim()) || cedula.length < MIN_ID_LENGTH) {
    // Ya vio la bienvenida (con la política) → solo se le recuerda qué enviar
    if (sessionSvc.get(userId).state === STATES.AUTH) return wa.sendText(userId, MSG.auth.askId);
    return sendWelcome(userId);
  }

  let name;
  try {
    name = await db.getClientName(cedula);
  } catch (err) {
    console.error('[Auth] Error consultando la BD:', err.message);
    await wa.sendText(userId, MSG.errors.db());
    return;
  }

  const session = sessionSvc.get(userId);

  if (!name) {
    const blocked = sessionSvc.registerFailedAttempt(session);
    session.state = STATES.AUTH;
    sessionSvc.save(session);
    await wa.sendText(userId, blocked ? MSG.auth.blocked() : MSG.auth.notFound);
    return;
  }

  sessionSvc.authenticate(session, cedula, name);
  await info.sendMainMenu(userId, `${MSG.auth.hello(name)}\n\n${MSG.menu.body}`);
}

module.exports = { handle, sendWelcome };
