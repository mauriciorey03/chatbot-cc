'use strict';

const wa = require('../services/whatsapp');
const ai = require('../services/ai');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const { KB, findStore } = require('../data/knowledgeBase');
const MSG = require('../utils/messages');

// ── Saludo + menú principal ────────────────────────────────────────────────

async function handleGreeting(userId) {
  const session = sessionSvc.get(userId);
  const greeting = session.isReturning
    ? MSG.greeting.returning(session.userName)
    : MSG.greeting.new;

  await sendMainMenu(userId, `${greeting}\n\n${MSG.menu.body}`);
}

async function sendMainMenu(userId, body = MSG.menu.body) {
  const session = sessionSvc.get(userId);
  const { buttonMap } = await wa.sendList(userId, body, 'Ver opciones', MSG.menu.sections, MSG.menu.footer);
  session.state = STATES.MENU;
  sessionSvc.setPendingButtonMap(session, buttonMap);
}

// ── Opciones del menú ──────────────────────────────────────────────────────

const MENU_REPLIES = {
  MENU_HOURS: MSG.info.hours,
  MENU_LOCATION: MSG.info.location,
  MENU_EVENTS: MSG.info.events,
  MENU_SERVICES: MSG.info.services,
  MENU_SUPPORT: MSG.info.support,
  MENU_SOCIAL: MSG.info.social,
};

async function handleMenuOption(userId, optionId) {
  if (optionId === 'MENU_STORES') return sendStoreList(userId);

  const reply = MENU_REPLIES[optionId];
  if (!reply) return false;

  await wa.sendText(userId, `${reply()}\n\n${MSG.followUp}`);
  const session = sessionSvc.get(userId);
  session.state = STATES.CHATTING;
  sessionSvc.save(session);
  return true;
}

async function sendStoreList(userId) {
  const session = sessionSvc.get(userId);
  const sections = [
    {
      title: 'Tiendas',
      rows: KB.stores.map((s) => ({ id: `STORE_${s.id}`, title: s.name, description: s.location })),
    },
  ];
  const { buttonMap } = await wa.sendList(userId, MSG.info.storesBody, 'Ver tiendas', sections, MSG.info.storesFooter());
  session.state = STATES.STORE_LIST;
  sessionSvc.setPendingButtonMap(session, buttonMap);
  return true;
}

async function handleStoreSelection(userId, buttonId) {
  const store = findStore(buttonId.replace(/^STORE_/, ''));
  if (!store) return false;

  await wa.sendText(userId, `${MSG.info.storeDetail(store)}\n\n${MSG.followUp}`);
  const session = sessionSvc.get(userId);
  session.state = STATES.CHATTING;
  sessionSvc.save(session);
  return true;
}

// ── Preguntas libres (IA con base de conocimiento) ─────────────────────────

async function handleQuestion(userId, text) {
  const session = sessionSvc.get(userId);

  let answer = null;
  try {
    answer = await ai.answerQuestion(text, session.history);
  } catch (err) {
    console.error('[Info] Error consultando la IA:', err);
  }

  if (!answer) {
    await wa.sendText(userId, MSG.errors.generic());
    return;
  }

  await wa.sendText(userId, answer);

  // Se guardan en pareja para que el historial siempre alterne user/assistant
  sessionSvc.addToHistory(session, 'user', text);
  sessionSvc.addToHistory(session, 'assistant', answer);
  session.state = STATES.CHATTING;
  sessionSvc.save(session);
}

module.exports = {
  handleGreeting,
  sendMainMenu,
  handleMenuOption,
  handleStoreSelection,
  handleQuestion,
};
