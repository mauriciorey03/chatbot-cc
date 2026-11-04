'use strict';

// Estados posibles del flujo conversacional
const STATES = {
  // Fase 1 – Bienvenida y briefing
  IDLE: 'IDLE',
  GREETING: 'GREETING',
  AWAITING_ASSETS: 'AWAITING_ASSETS',
  AWAITING_PROMPT: 'AWAITING_PROMPT',
  GENERATING_SCRIPT: 'GENERATING_SCRIPT',
  AWAITING_SCRIPT_FEEDBACK: 'AWAITING_SCRIPT_FEEDBACK',

  // Fase 2 – Contrato / confirmación
  CONFIRMING_PLAN: 'CONFIRMING_PLAN',
  EDITING_PROMPT: 'EDITING_PROMPT',

  // Fase 3 – Procesamiento
  PROCESSING: 'PROCESSING',
  DELIVERY: 'DELIVERY',

  // Modo ajuste (post-entrega)
  ADJUSTMENT_MODE: 'ADJUSTMENT_MODE',
  CONFIRMING_ADJUSTMENT: 'CONFIRMING_ADJUSTMENT',
  APPLYING_ADJUSTMENT: 'APPLYING_ADJUSTMENT',
};

// Transiciones válidas: cada estado sabe a qué estados puede pasar
const TRANSITIONS = {
  [STATES.IDLE]: [STATES.GREETING],
  [STATES.GREETING]: [STATES.AWAITING_ASSETS, STATES.AWAITING_PROMPT],
  [STATES.AWAITING_ASSETS]: [STATES.AWAITING_PROMPT],
  [STATES.AWAITING_PROMPT]: [STATES.GENERATING_SCRIPT, STATES.CONFIRMING_PLAN],
  [STATES.GENERATING_SCRIPT]: [STATES.AWAITING_SCRIPT_FEEDBACK],
  [STATES.AWAITING_SCRIPT_FEEDBACK]: [STATES.CONFIRMING_PLAN, STATES.GENERATING_SCRIPT],
  [STATES.CONFIRMING_PLAN]: [
    STATES.PROCESSING,
    STATES.EDITING_PROMPT,
    STATES.IDLE,
  ],
  [STATES.EDITING_PROMPT]: [STATES.CONFIRMING_PLAN],
  [STATES.PROCESSING]: [STATES.DELIVERY],
  [STATES.DELIVERY]: [
    STATES.ADJUSTMENT_MODE,
    STATES.GREETING,
    STATES.IDLE,
  ],
  [STATES.ADJUSTMENT_MODE]: [STATES.CONFIRMING_ADJUSTMENT],
  [STATES.CONFIRMING_ADJUSTMENT]: [
    STATES.APPLYING_ADJUSTMENT,
    STATES.ADJUSTMENT_MODE,
    STATES.DELIVERY,
  ],
  [STATES.APPLYING_ADJUSTMENT]: [STATES.DELIVERY],
};

class StateMachine {
  constructor(session) {
    this.session = session;
  }

  get current() {
    return this.session.state || STATES.IDLE;
  }

  canTransition(nextState) {
    const allowed = TRANSITIONS[this.current] || [];
    return allowed.includes(nextState);
  }

  transition(nextState) {
    if (!this.canTransition(nextState)) {
      throw new Error(
        `Transición inválida: ${this.current} → ${nextState}`
      );
    }
    this.session.previousState = this.current;
    this.session.state = nextState;
    return this;
  }

  // Retrocede al estado anterior si existe
  rollback() {
    if (this.session.previousState) {
      this.session.state = this.session.previousState;
      this.session.previousState = null;
    }
  }
}

module.exports = { STATES, StateMachine };
