'use strict';

const wa = require('../services/whatsapp');
const ai = require('../services/ai');
const sessionSvc = require('../services/session');
const mediaSvc = require('../services/media');
const { STATES, StateMachine } = require('../flows/stateMachine');
const MSG = require('../utils/messages');

// ── Entrada al flujo: saludo inicial ────────────────────────────────────────

async function handleGreeting(userId) {
  const session = sessionSvc.get(userId);
  const sm = new StateMachine(session);

  sm.transition(STATES.GREETING);

  const greeting = session.isReturning
    ? MSG.greeting.returning(session.userName)
    : MSG.greeting.new;

  const result = await wa.sendButtons(userId, greeting, MSG.greeting.buttons);

  sm.transition(STATES.AWAITING_ASSETS);
  if (result.buttonMap) sessionSvc.setPendingButtonMap(session, result.buttonMap);
  sessionSvc.save(session);
}

// ── Elección de acción desde el saludo ─────────────────────────────────────

async function handleGreetingAction(userId, buttonId) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.AWAITING_ASSETS) return false;

  const contextMsg = MSG.greeting.actionContext[buttonId];
  if (!contextMsg) return false;

  await wa.sendText(userId, contextMsg);
  return true;
}

// ── Recepción de medios (imagen, video, audio) ──────────────────────────────

// mediaUrl: URL directa de Twilio (req.body.MediaUrl0)
async function handleMediaReceived(userId, mediaUrl, mimeType) {
  const session = sessionSvc.get(userId);

  if (![STATES.AWAITING_ASSETS, STATES.AWAITING_PROMPT].includes(session.state)) {
    return false;
  }

  // Detectar audio → transcribir automáticamente
  const type = mediaSvc.detectAssetType(mimeType);
  if (type === 'audio') {
    await wa.sendText(userId, MSG.audio.detected);
  }

  // Guardar el archivo
  let asset;
  try {
    asset = await mediaSvc.saveMediaFromWhatsApp(mediaUrl, mimeType);
  } catch (err) {
    if (err.message === 'FILE_TOO_LARGE') {
      await wa.sendText(userId, MSG.limits.fileTooLarge);
      return true;
    }
    if (err.message.startsWith('UNSUPPORTED_FORMAT')) {
      const fmt = err.message.split(':')[1];
      await wa.sendText(userId, MSG.limits.unsupportedFormat(fmt));
      return true;
    }
    throw err;
  }

  session.project.assets.push(asset);
  sessionSvc.save(session);

  // Si ya tiene assets, pide el prompt
  if (session.state === STATES.AWAITING_ASSETS) {
    const sm = new StateMachine(session);
    sm.transition(STATES.AWAITING_PROMPT);
    sessionSvc.save(session);
    await wa.sendText(userId, MSG.briefing.askForPrompt);
  }

  return true;
}

// ── Recepción del prompt de texto ──────────────────────────────────────────

async function handlePromptReceived(userId, text) {
  const session = sessionSvc.get(userId);

  if (![STATES.AWAITING_ASSETS, STATES.AWAITING_PROMPT].includes(session.state)) {
    return false;
  }

  // Verificar limitaciones
  const limitation = await ai.detectLimitations(text);
  if (limitation.hasLimitation) {
    await wa.sendText(userId, MSG.limits.videoTooLong);
    return true;
  }

  session.project.prompt = text;
  sessionSvc.save(session);

  const sm = new StateMachine(session);

  // Si venía de AWAITING_ASSETS sin haber subido archivos, normalizar estado primero
  if (session.state === STATES.AWAITING_ASSETS) {
    sm.transition(STATES.AWAITING_PROMPT);
  }

  // Si el prompt sugiere que el usuario necesita ayuda con el concepto → modo copilot
  const needsScript = await shouldGenerateScript(text);
  if (needsScript) {
    sm.transition(STATES.GENERATING_SCRIPT);
    sessionSvc.save(session);
    await handleScriptGeneration(userId, session, text);
  } else {
    sm.transition(STATES.CONFIRMING_PLAN);
    sessionSvc.save(session);
    await handlePlanConfirmation(userId, session);
  }

  return true;
}

async function shouldGenerateScript(prompt) {
  const vaguePhrases = [
    'video para vender', 'video de', 'quiero un video', 'hacer un video',
    'video sobre', 'promover', 'anuncio', 'publicidad',
  ];
  const lower = prompt.toLowerCase();
  return vaguePhrases.some((p) => lower.includes(p)) && prompt.length < 100;
}

async function handleScriptGeneration(userId, session, objective) {
  await wa.sendText(userId, MSG.briefing.processingInput);

  const script = await ai.generateScript(objective);

  const sm = new StateMachine(session);
  sm.transition(STATES.AWAITING_SCRIPT_FEEDBACK);
  sessionSvc.save(session);

  const scriptResult = await wa.sendButtons(
    userId,
    MSG.scriptAssistant.proposal(script),
    [
      { id: 'SCRIPT_APPROVE', title: MSG.scriptAssistant.buttons.approve },
      { id: 'SCRIPT_TONE', title: MSG.scriptAssistant.buttons.changeTone },
      { id: 'SCRIPT_SKIP', title: MSG.scriptAssistant.buttons.skip },
    ]
  );
  if (scriptResult.buttonMap) sessionSvc.setPendingButtonMap(session, scriptResult.buttonMap);
}

async function handleScriptFeedback(userId, buttonId) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.AWAITING_SCRIPT_FEEDBACK) return false;

  const sm = new StateMachine(session);

  if (buttonId === 'SCRIPT_APPROVE' || buttonId === 'SCRIPT_SKIP') {
    sm.transition(STATES.CONFIRMING_PLAN);
    sessionSvc.save(session);
    await handlePlanConfirmation(userId, session);
  } else if (buttonId === 'SCRIPT_TONE') {
    await wa.sendText(userId, '¿Qué tono prefieres? Ejemplo: "más divertido", "formal", "emotivo"...');
    sm.transition(STATES.GENERATING_SCRIPT);
    sessionSvc.save(session);
  }

  return true;
}

async function handlePlanConfirmation(userId, session) {
  const plan = await ai.generatePlan(
    session.project.prompt,
    session.project.assets
  );

  session.project.plan = plan;
  sessionSvc.save(session);

  const body =
    MSG.contract.confirmHeader + plan + MSG.contract.confirmFooter;

  const planResult = await wa.sendButtons(userId, body, [
    { id: 'PLAN_SEND', title: MSG.contract.buttons.send },
    { id: 'PLAN_EDIT', title: MSG.contract.buttons.edit },
    { id: 'PLAN_CANCEL', title: MSG.contract.buttons.cancel },
  ]);
  if (planResult.buttonMap) sessionSvc.setPendingButtonMap(session, planResult.buttonMap);
}

module.exports = {
  handleGreeting,
  handleGreetingAction,
  handleMediaReceived,
  handlePromptReceived,
  handleScriptFeedback,
  handlePlanConfirmation,
};
