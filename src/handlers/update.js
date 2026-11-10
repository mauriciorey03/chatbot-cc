'use strict';

const wa = require('../services/whatsapp');
const db = require('../services/db');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const validators = require('../utils/validators');
const info = require('./info');

// Flujo: elegir campo → escribir nuevo valor → autorizar tratamiento de datos → guardar.
// session.update = { option, value, waitingPolicy }

async function start(userId) {
  const session = sessionSvc.get(userId);
  session.state = STATES.UPDATING;
  session.update = { option: null, value: null, waitingPolicy: false };
  sessionSvc.save(session);

  await wa.sendText(userId, MSG.update.start());
  return true;
}

async function finish(userId, session, message) {
  session.update = null;
  sessionSvc.save(session);
  await info.sendMainMenu(userId, `${message}\n\n${MSG.menu.body}`);
}

async function handle(userId, text) {
  const session = sessionSvc.get(userId);
  const upd = session.update;
  const answer = text.trim();

  if (!upd) return start(userId);
  if (answer === '0') return finish(userId, session, MSG.update.finished);

  // ── Autorización de datos ─────────────────────────────────────────────
  if (upd.waitingPolicy) {
    const consent = validators.politica(answer);
    if (consent.rejected) return finish(userId, session, MSG.update.cancelled);
    if (consent.error) return wa.sendText(userId, MSG.update.policyHelp);

    const { field } = MSG.update.fields[upd.option];
    const ok = await db.updateClient(
      { documento: session.documento, [field]: upd.value, politica: consent.value },
      userId
    );

    session.update = { option: null, value: null, waitingPolicy: false };
    sessionSvc.save(session);
    return wa.sendText(userId, ok ? MSG.update.success() : MSG.update.failed());
  }

  // ── Nuevo valor del campo elegido ─────────────────────────────────────
  if (upd.option) {
    const { field, label } = MSG.update.fields[upd.option];
    const result = validators[field](answer);
    if (result.error) return wa.sendText(userId, result.error);

    upd.value = result.value;
    upd.waitingPolicy = true;
    sessionSvc.save(session);
    return wa.sendText(userId, MSG.update.askPolicy(label, result.value));
  }

  // ── Elección del campo ────────────────────────────────────────────────
  const option = answer.replace(/\D/g, '');
  const selected = MSG.update.fields[option];
  if (!selected) return wa.sendText(userId, MSG.update.invalidOption());

  upd.option = option;
  sessionSvc.save(session);
  return wa.sendText(userId, MSG.update.askValue(selected.label));
}

module.exports = { start, handle };
