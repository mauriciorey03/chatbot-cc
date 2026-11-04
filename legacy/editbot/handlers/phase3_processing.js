'use strict';

const wa = require('../services/whatsapp');
const sessionSvc = require('../services/session');
const mediaSvc = require('../services/media');
const { STATES, StateMachine } = require('../flows/stateMachine');
const MSG = require('../utils/messages');

const STATUS_INTERVAL_MS = 30_000;
const MAX_STATUS_MSGS = 4;

// ── Inicio del procesamiento ────────────────────────────────────────────────

async function startProcessing(userId, session) {
  await wa.sendText(userId, MSG.processing.start);

  let jobId;
  try {
    jobId = await mediaSvc.submitVideoJob(session.project);
  } catch (err) {
    console.error('[Processing] Error al enviar job:', err);
    await wa.sendText(userId, MSG.errors.generic);
    return;
  }

  session.project.processingJobId = jobId;
  session.processingMsgCount = 0;
  sessionSvc.save(session);

  scheduleStatusMessages(userId, jobId);
}

// ── Mensajes intermedios automáticos ───────────────────────────────────────

function scheduleStatusMessages(userId, jobId) {
  let msgIndex = 0;

  const interval = setInterval(async () => {
    const session = sessionSvc.get(userId);

    if (session.state !== STATES.PROCESSING) {
      clearInterval(interval);
      return;
    }

    if (msgIndex < MSG.processing.intermediate.length) {
      await wa.sendText(userId, MSG.processing.intermediate[msgIndex]);
      msgIndex++;
      session.processingMsgCount++;
      sessionSvc.save(session);
    }

    if (session.processingMsgCount >= MAX_STATUS_MSGS) {
      clearInterval(interval);
      await wa.sendText(userId, MSG.errors.timeout);
      return;
    }

    try {
      const status = await mediaSvc.pollJobStatus(jobId);
      if (status.status === 'completed') {
        clearInterval(interval);
        await deliverResult(userId, session, status);
      } else if (status.status === 'failed') {
        clearInterval(interval);
        await wa.sendText(userId, MSG.errors.generic);
      }
    } catch {
      // Reintentará en el siguiente ciclo
    }
  }, STATUS_INTERVAL_MS);
}

// ── Entrega del resultado ───────────────────────────────────────────────────

async function deliverResult(userId, session, jobResult) {
  const sm = new StateMachine(session);
  sm.transition(STATES.DELIVERY);

  session.project.currentResultUrl = jobResult.resultUrl;
  sessionSvc.save(session);

  if (jobResult.isLargeFile) {
    await wa.sendCtaUrl(userId, MSG.processing.done, '🍿 Ver Video', jobResult.resultUrl);
  } else {
    await wa.sendText(userId, MSG.processing.done);
    await wa.sendMedia(userId, 'video', jobResult.resultUrl, '');
  }

  // Botones de siguiente paso (máx. 3 en Twilio con Content API)
  const result = await wa.sendButtons(userId, MSG.processing.nextSteps, [
    { id: 'NEXT_ADJUST', title: MSG.processing.buttons.adjust },
    { id: 'NEXT_NEW', title: MSG.processing.buttons.createNew },
    { id: 'NEXT_FINISH', title: MSG.processing.buttons.finish },
  ]);

  if (result.buttonMap) {
    sessionSvc.setPendingButtonMap(session, result.buttonMap);
  }

  // Mensaje separado con selector de motor (no ocupa slot de botón)
  await sendEngineSelector(userId, session);
}

// ── Selector de motor de video ──────────────────────────────────────────────

async function sendEngineSelector(userId, session) {
  const result = await wa.sendButtons(
    userId,
    MSG.engineSelector.prompt(session.project.engine),
    [
      { id: 'ENGINE_KLING', title: MSG.engineSelector.buttons.kling },
      { id: 'ENGINE_HIGGSFIELD', title: MSG.engineSelector.buttons.higgsfield },
    ]
  );

  // Solo actualiza el mapa si el de los botones principales no estaba en sesión
  // (sendEngineSelector se llama después de deliverResult que ya puede haber seteado un mapa)
  // Guardamos el mapa del selector en una clave separada para no pisar el anterior.
  // Como los dos mensajes llegan en secuencia rápida, el usuario verá dos menús;
  // tomamos el último mapa como el pendiente.
  if (result.buttonMap) {
    sessionSvc.setPendingButtonMap(session, result.buttonMap);
  }
}

// ── Cambio de motor ─────────────────────────────────────────────────────────

async function handleEngineChange(userId, buttonId) {
  const session = sessionSvc.get(userId);
  const engine = buttonId === 'ENGINE_HIGGSFIELD' ? 'higgsfield' : 'kling';
  session.project.engine = engine;
  sessionSvc.save(session);
  await wa.sendText(userId, MSG.engineSelector.changed(engine));
  return true;
}

// ── Elección post-entrega ───────────────────────────────────────────────────

async function handleDeliveryChoice(userId, buttonId) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.DELIVERY) return false;

  const sm = new StateMachine(session);

  switch (buttonId) {
    case 'NEXT_ADJUST':
      sm.transition(STATES.ADJUSTMENT_MODE);
      sessionSvc.save(session);
      await wa.sendText(userId, MSG.adjustment.welcome);
      break;

    case 'NEXT_NEW':
      sessionSvc.reset(userId);
      await wa.sendText(userId, MSG.greeting.new);
      break;

    case 'NEXT_FINISH':
      if (session.project.currentResultUrl) {
        await wa.sendCtaUrl(
          userId,
          '¡Gracias por usar EditBot! Aquí tienes tu archivo final 🎬',
          '⬇️ Descargar',
          session.project.currentResultUrl
        );
      }
      await wa.sendText(
        userId,
        '¡Hasta la próxima! Cuando quieras crear algo nuevo, solo escríbeme. 👋'
      );
      sessionSvc.reset(userId);
      break;

    default:
      return false;
  }

  return true;
}

module.exports = {
  startProcessing,
  deliverResult,
  handleDeliveryChoice,
  handleEngineChange,
};
