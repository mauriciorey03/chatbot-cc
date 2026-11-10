'use strict';

// Estados posibles del flujo conversacional
const STATES = {
  IDLE: 'IDLE',               // Sin conversación activa → se saluda
  AUTH: 'AUTH',               // Esperando cédula (o REGISTRO)
  REGISTERING: 'REGISTERING', // Registro de cliente en curso
  UPDATING: 'UPDATING',       // Actualización de datos en curso
  MENU: 'MENU',               // Menú principal mostrado
  STORE_LIST: 'STORE_LIST',   // Lista de tiendas mostrada
  CHATTING: 'CHATTING',       // Preguntas libres respondidas por la IA
};

module.exports = { STATES };
