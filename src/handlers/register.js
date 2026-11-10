'use strict';

const wa = require('../services/whatsapp');
const db = require('../services/db');
const sessionSvc = require('../services/session');
const { STATES } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const validators = require('../utils/validators');
const info = require('./info');

// Pasos del registro, en orden. La autorización de datos (politica) va al final
// y es obligatoria: sin ella no se guarda nada.
const STEPS = ['documento', 'tipoDoc', 'nombre', 'apellido', 'genero', 'fecha', 'email', 'telefono', 'politica'];

// "editar <campo>" → paso
const EDITABLE = {
  documento: 'documento',
  tipo: 'tipoDoc',
  tipodoc: 'tipoDoc',
  nombre: 'nombre',
  nombres: 'nombre',
  apellido: 'apellido',
  apellidos: 'apellido',
  genero: 'genero',
  fecha: 'fecha',
  email: 'email',
  correo: 'email',
  telefono: 'telefono',
};

const normalize = (text) => text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function stop(session, state) {
  session.register = null;
  session.state = state;
  sessionSvc.save(session);
}

async function start(userId) {
  const session = sessionSvc.get(userId);
  session.state = STATES.REGISTERING;
  session.register = { step: STEPS[0], data: {}, confirming: false, editing: false };
  sessionSvc.save(session);

  await wa.sendText(userId, MSG.register.start(MSG.register.questions[STEPS[0]]));
}

async function handle(userId, text) {
  const session = sessionSvc.get(userId);
  const reg = session.register;
  const answer = normalize(text);

  if (!reg) return start(userId);

  if (answer === 'cancelar') {
    stop(session, STATES.AUTH);
    return wa.sendText(userId, MSG.register.cancelled);
  }

  // ── Confirmación final ────────────────────────────────────────────────
  if (reg.confirming) {
    if (answer === 'si') return save(userId, session);

    if (answer === 'no') {
      stop(session, STATES.AUTH);
      return wa.sendText(userId, MSG.register.cancelled);
    }

    if (answer.startsWith('editar')) {
      const step = EDITABLE[answer.replace('editar', '').trim()];
      if (!step) return wa.sendText(userId, MSG.register.invalidField);

      reg.step = step;
      reg.confirming = false;
      reg.editing = true;
      sessionSvc.save(session);
      return wa.sendText(userId, MSG.register.reenter(MSG.register.questions[step]));
    }

    return wa.sendText(userId, MSG.register.confirmHelp);
  }

  // ── Respuesta al paso actual ──────────────────────────────────────────
  const result = validators[reg.step](text);

  if (result.rejected) {
    stop(session, STATES.AUTH);
    return wa.sendText(userId, MSG.register.policyRejected);
  }
  if (result.error) return wa.sendText(userId, result.error);

  // El documento ya existe → no se registra de nuevo
  if (reg.step === 'documento') {
    try {
      if (await db.getClientName(result.value)) {
        stop(session, STATES.AUTH);
        return wa.sendText(userId, MSG.auth.alreadyRegistered);
      }
    } catch (err) {
      console.error('[Register] Error consultando la BD:', err.message);
      return wa.sendText(userId, MSG.errors.db());
    }
  }

  reg.data[reg.step] = result.value;

  const nextStep = STEPS[STEPS.indexOf(reg.step) + 1];
  if (reg.editing || !nextStep) {
    reg.editing = false;
    reg.confirming = true;
    sessionSvc.save(session);
    return wa.sendText(userId, MSG.register.summary(reg.data));
  }

  reg.step = nextStep;
  sessionSvc.save(session);
  return wa.sendText(userId, MSG.register.questions[nextStep]);
}

async function save(userId, session) {
  const { data } = session.register;

  if (!data.politica || !(await db.saveClient(data, userId))) {
    stop(session, STATES.AUTH);
    return wa.sendText(userId, MSG.register.failed());
  }

  const name = `${data.nombre} ${data.apellido}`;
  session.register = null;
  sessionSvc.authenticate(session, data.documento, name);
  await info.sendMainMenu(userId, `${MSG.register.success}\n\n${MSG.auth.hello(name)}\n\n${MSG.menu.body}`);
}

module.exports = { start, handle };
