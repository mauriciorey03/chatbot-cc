'use strict';

const wa = require('../services/whatsapp');
const sessionSvc = require('../services/session');
const { STATES, StateMachine } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const { handlePlanConfirmation } = require('./phase1_briefing');
const { startProcessing } = require('./phase3_processing');

// ── Manejo de la respuesta al contrato ─────────────────────────────────────

async function handleContractResponse(userId, buttonId) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.CONFIRMING_PLAN) return false;

  const sm = new StateMachine(session);

  switch (buttonId) {
    case 'PLAN_SEND':
      sm.transition(STATES.PROCESSING);
      sessionSvc.save(session);
      await startProcessing(userId, session);
      break;

    case 'PLAN_EDIT':
      sm.transition(STATES.EDITING_PROMPT);
      sessionSvc.save(session);
      await wa.sendText(userId, MSG.contract.editPrompt);
      break;

    case 'PLAN_CANCEL':
      sessionSvc.reset(userId);
      await wa.sendText(userId, MSG.contract.cancelled);
      break;

    default:
      return false;
  }

  return true;
}

// ── Edición del prompt (ajuste del contrato) ────────────────────────────────

async function handlePromptEdit(userId, newText) {
  const session = sessionSvc.get(userId);
  // Acepta tanto EDITING_PROMPT (vía botón) como CONFIRMING_PLAN (texto directo)
  if (![STATES.EDITING_PROMPT, STATES.CONFIRMING_PLAN].includes(session.state)) return false;

  session.project.prompt = newText;
  const sm = new StateMachine(session);
  // Si viene de CONFIRMING_PLAN, pasar primero por EDITING_PROMPT
  if (session.state === STATES.CONFIRMING_PLAN) sm.transition(STATES.EDITING_PROMPT);
  sm.transition(STATES.CONFIRMING_PLAN);
  sessionSvc.save(session);

  // Regenerar el plan con el nuevo prompt
  await handlePlanConfirmation(userId, session);
  return true;
}

module.exports = { handleContractResponse, handlePromptEdit };
