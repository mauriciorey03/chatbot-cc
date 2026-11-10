'use strict';

const NodeCache = require('node-cache');
const { STATES } = require('../flows/stateMachine');

const SESSION_TTL = 60 * 60 * 24; // 24 horas
const MAX_HISTORY = 20;           // mensajes guardados por usuario
const MAX_AUTH_ATTEMPTS = 3;      // cédulas no encontradas antes de remitir al registro web
// Inactividad tras la cual se vuelve a pedir la cédula
const AUTH_TIMEOUT_MS = (Number(process.env.AUTH_TIMEOUT_MINUTES) || 30) * 60 * 1000;
const cache = new NodeCache({ stdTTL: SESSION_TTL, checkperiod: 600 });

function createSession(userId) {
  return {
    userId,
    state: STATES.IDLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivity: Date.now(),

    // Historial para dar contexto a la IA: [{ role, content }]
    history: [],

    // Mapa de opciones numeradas pendientes
    // { '1': 'MENU_HOURS', '2': 'MENU_LOCATION', ... }
    pendingButtonMap: null,

    userName: null,
    isReturning: false,

    // Identificación del cliente en la BD
    authenticated: false,
    documento: null,
    clientName: null,
    authAttempts: 0,

    // Flujos de registro / actualización: ver handlers/register.js y handlers/update.js
    register: null,
    update: null,
  };
}

function get(userId) {
  let session = cache.get(userId);
  if (!session) {
    session = createSession(userId);
    cache.set(userId, session);
  }
  return session;
}

function save(session) {
  session.updatedAt = new Date().toISOString();
  cache.set(session.userId, session);
}

function reset(userId) {
  const existing = cache.get(userId);
  const fresh = createSession(userId);
  if (existing) {
    fresh.userName = existing.userName;
    fresh.isReturning = true;
  }
  cache.set(userId, fresh);
  return fresh;
}

function addToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
  save(session);
}

// Actualiza el mapa de opciones pendientes y persiste la sesión
function setPendingButtonMap(session, map) {
  session.pendingButtonMap = map;
  save(session);
}

// ── Autenticación ───────────────────────────────────────────────────────────

// Registra actividad. Devuelve true si la identificación (o un registro a medias)
// expiró por inactividad.
function touch(session) {
  const active = session.authenticated || session.register;
  const expired = active && Date.now() - session.lastActivity > AUTH_TIMEOUT_MS;
  if (expired) {
    session.authenticated = false;
    session.documento = null;
    session.register = null;
    session.update = null;
    session.pendingButtonMap = null;
    session.history = [];
    session.state = STATES.AUTH;
  }
  session.lastActivity = Date.now();
  save(session);
  return expired;
}

function authenticate(session, documento, clientName) {
  session.authenticated = true;
  session.documento = documento;
  session.clientName = clientName;
  session.authAttempts = 0;
  save(session);
}

// Suma un intento fallido. Devuelve true al llegar al máximo (y reinicia el contador).
function registerFailedAttempt(session) {
  session.authAttempts += 1;
  const blocked = session.authAttempts >= MAX_AUTH_ATTEMPTS;
  if (blocked) session.authAttempts = 0;
  save(session);
  return blocked;
}

module.exports = {
  get,
  save,
  reset,
  addToHistory,
  setPendingButtonMap,
  touch,
  authenticate,
  registerFailedAttempt,
};
