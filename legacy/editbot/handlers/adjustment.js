'use strict';

const wa = require('../services/whatsapp');
const ai = require('../services/ai');
const sessionSvc = require('../services/session');
const mediaSvc = require('../services/media');
const { STATES, StateMachine } = require('../flows/stateMachine');
const MSG = require('../utils/messages');
const { deliverResult } = require('./phase3_processing');

// ── Recepción del mensaje de ajuste ────────────────────────────────────────

async function handleAdjustmentInput(userId, text) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.ADJUSTMENT_MODE) return false;

  // Detectar si quiere volver a una versión anterior
  const rollbackIntent = await ai.detectRollbackIntent(text);
  if (rollbackIntent.isRollback) {
    await handleRollbackRequest(userId, session, rollbackIntent.versionHint);
    return true;
  }

  // Interpretar el ajuste en términos del proyecto actual
  const adjustmentDescription = await ai.interpretAdjustment(
    text,
    session.project.plan,
    session.versions
  );

  // Guardar el ajuste interpretado en sesión
  session.pendingAdjustment = { original: text, interpreted: adjustmentDescription };
  sessionSvc.save(session);

  const sm = new StateMachine(session);
  sm.transition(STATES.CONFIRMING_ADJUSTMENT);
  sessionSvc.save(session);

  await wa.sendButtons(
    userId,
    MSG.adjustment.confirmAdjustment(adjustmentDescription),
    [
      { id: 'ADJ_APPLY', title: '✅ Aplicar cambio' },
      { id: 'ADJ_REWRITE', title: '✏️ Redescribir' },
      { id: 'ADJ_CANCEL', title: '↩️ Volver' },
    ]
  );

  return true;
}

// ── Confirmación del ajuste ────────────────────────────────────────────────

async function handleAdjustmentConfirmation(userId, buttonId) {
  const session = sessionSvc.get(userId);
  if (session.state !== STATES.CONFIRMING_ADJUSTMENT) return false;

  const sm = new StateMachine(session);

  switch (buttonId) {
    case 'ADJ_APPLY':
      await applyAdjustment(userId, session, sm);
      break;

    case 'ADJ_REWRITE':
      sm.transition(STATES.ADJUSTMENT_MODE);
      sessionSvc.save(session);
      await wa.sendText(userId, 'Claro, dime de nuevo qué quieres cambiar:');
      break;

    case 'ADJ_CANCEL':
      sm.transition(STATES.DELIVERY);
      sessionSvc.save(session);
      await wa.sendText(userId, 'De acuerdo, el video queda como estaba.');
      break;

    default:
      return false;
  }

  return true;
}

async function applyAdjustment(userId, session, sm) {
  // Guardar versión actual antes de sobrescribir
  const versionNum = sessionSvc.saveVersion(
    session,
    session.pendingAdjustment.original
  );

  await wa.sendText(userId, MSG.adjustment.versionSaved(versionNum));
  await wa.sendText(userId, MSG.adjustment.applyingChange);

  sm.transition(STATES.APPLYING_ADJUSTMENT);
  sessionSvc.save(session);

  // Actualizar el plan con el ajuste incremental
  session.project.plan = `${session.project.plan}\n\n*Ajuste aplicado:* ${session.pendingAdjustment.interpreted}`;
  sessionSvc.save(session);

  // Enviar job de ajuste al motor externo
  let jobId;
  try {
    jobId = await mediaSvc.submitVideoJob(session.project);
    session.project.processingJobId = jobId;
    sessionSvc.save(session);
  } catch {
    await wa.sendText(userId, MSG.errors.generic);
    return;
  }

  // Simular polling simple para ajuste (sin mensajes intermedios extra)
  setTimeout(async () => {
    try {
      const status = await mediaSvc.pollJobStatus(jobId);
      if (status.status === 'completed') {
        await deliverResult(userId, session, status);
      }
    } catch {
      await wa.sendText(userId, MSG.errors.generic);
    }
  }, 5000);
}

// ── Rollback a versión anterior ────────────────────────────────────────────

async function handleRollbackRequest(userId, session, versionHint) {
  if (session.versions.length === 0) {
    await wa.sendText(userId, MSG.history.noHistory);
    return;
  }

  // Si el hint es válido, restaurar directamente
  const targetIndex = versionHint || session.versions.length;
  const restored = sessionSvc.restoreVersion(session, targetIndex);

  if (!restored) {
    await wa.sendList(
      userId,
      MSG.history.list(session.versions),
      'Ver versiones',
      [
        {
          title: 'Versiones disponibles',
          rows: session.versions.map((v) => ({
            id: `RESTORE_V${v.version}`,
            title: `Versión ${v.version}`,
            description: v.description,
          })),
        },
      ]
    );
    return;
  }

  await wa.sendText(userId, MSG.adjustment.rollback(restored.version));

  const sm = new StateMachine(session);
  sm.transition(STATES.DELIVERY);
  sessionSvc.save(session);

  // Re-enviar resultado restaurado
  await deliverResult(userId, session, {
    status: 'completed',
    resultUrl: restored.resultUrl,
    isLargeFile: false,
  });
}

// ── Selección de versión desde lista ───────────────────────────────────────

async function handleVersionSelection(userId, listId) {
  const session = sessionSvc.get(userId);
  if (!listId.startsWith('RESTORE_V')) return false;

  const versionNum = parseInt(listId.replace('RESTORE_V', ''), 10);
  await handleRollbackRequest(userId, session, versionNum);
  return true;
}

module.exports = {
  handleAdjustmentInput,
  handleAdjustmentConfirmation,
  handleVersionSelection,
};
