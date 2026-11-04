'use strict';

const NodeCache = require('node-cache');
const { STATES } = require('../flows/stateMachine');

const SESSION_TTL = 60 * 60 * 24; // 24 horas
const cache = new NodeCache({ stdTTL: SESSION_TTL, checkperiod: 600 });

function createSession(userId) {
  return {
    userId,
    state: STATES.IDLE,
    previousState: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    project: {
      prompt: null,
      plan: null,
      assets: [],
      currentResultUrl: null,
      processingJobId: null,
      engine: 'kling', // motor de video activo: 'kling' | 'higgsfield'
    },

    versions: [],
    processingMsgCount: 0,

    // Mapa de botones numerados (fallback cuando Content API no está disponible)
    // { '1': 'PLAN_SEND', '2': 'PLAN_EDIT', '3': 'PLAN_CANCEL' }
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

function saveVersion(session, description) {
  const versionNumber = session.versions.length + 1;
  session.versions.push({
    version: versionNumber,
    description,
    resultUrl: session.project.currentResultUrl,
    plan: { ...session.project.plan },
    date: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  });
  save(session);
  return versionNumber;
}

function restoreVersion(session, versionIndex) {
  const target = session.versions[versionIndex - 1];
  if (!target) return null;
  session.project.currentResultUrl = target.resultUrl;
  session.project.plan = { ...target.plan };
  save(session);
  return target;
}

// Actualiza el mapa de botones pendientes y persiste la sesión
function setPendingButtonMap(session, map) {
  session.pendingButtonMap = map;
  save(session);
}

module.exports = {
  get,
  save,
  reset,
  saveVersion,
  restoreVersion,
  setPendingButtonMap,
};
