'use strict';

const NodeCache = require('node-cache');
const { STATES } = require('../flows/stateMachine');

const SESSION_TTL = 60 * 60 * 24; // 24 horas
const MAX_HISTORY = 20;           // mensajes guardados por usuario
const cache = new NodeCache({ stdTTL: SESSION_TTL, checkperiod: 600 });

function createSession(userId) {
  return {
    userId,
    state: STATES.IDLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Historial para dar contexto a la IA: [{ role, content }]
    history: [],

    // Mapa de opciones numeradas pendientes
    // { '1': 'MENU_HOURS', '2': 'MENU_LOCATION', ... }
    pendingButtonMap: null,

    userName: null,
    isReturning: false,
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

module.exports = {
  get,
  save,
  reset,
  addToHistory,
  setPendingButtonMap,
};
