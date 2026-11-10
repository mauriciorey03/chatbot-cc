'use strict';

const { KB, eventStatus } = require('../data/knowledgeBase');
const { DOC_TYPE_LABELS } = require('./validators');

// Plantillas de mensajes del bot. Todo el contenido sale de data/knowledgeBase.js

// Política de tratamiento de datos personales (Ley 1581 de 2012)
const POLICY_URL = process.env.POLICY_URL || 'https://wegrowcrm.com/policy.html';
// Registro web al que se remite tras varios intentos fallidos de cédula (opcional)
const REGISTER_URL = process.env.REGISTER_URL;

const POLICY_NOTICE = `📜 *Política de tratamiento de datos personales*\nPuedes consultarla aquí: ${POLICY_URL}`;

// Campos editables en la actualización de datos: opción → { field, label }
const UPDATE_FIELDS = {
  1: { field: 'nombre', label: 'Nombre' },
  2: { field: 'apellido', label: 'Apellido' },
  3: { field: 'telefono', label: 'Teléfono' },
  4: { field: 'email', label: 'Email' },
};

const updateMenu = () =>
  `${Object.entries(UPDATE_FIELDS).map(([n, f]) => `${n}️⃣ ${f.label}`).join('\n')}\n\n0️⃣ Finalizar y volver al menú`;

// Formatea 'YYYY-MM-DD' como '30 de septiembre de 2026'
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const MESSAGES = {
  // ── Saludo y menú principal ─────────────────────────────────────────────
  greeting: {
    new: `¡Hola! 💚 Bienvenido a *Primavera Urbana*, el centro comercial que florece con la naturaleza en Villavicencio. 🌿

Soy tu asistente virtual y puedo ayudarte con horarios, tiendas, eventos, servicios y más.`,

    returning: (name) =>
      `¡Hola de nuevo${name ? `, ${name}` : ''}! 💚 ¿En qué te puedo ayudar hoy?`,
  },

  menu: {
    body: '¿Sobre qué quieres información? Responde con el número de la opción o escríbeme tu pregunta. 👇',
    sections: [
      {
        title: 'Menú principal',
        rows: [
          { id: 'MENU_HOURS',    title: '🕐 Horarios' },
          { id: 'MENU_LOCATION', title: '📍 Ubicación' },
          { id: 'MENU_STORES',   title: '🛍️ Tiendas y marcas' },
          { id: 'MENU_EVENTS',   title: '🎉 Eventos y sorteos' },
          { id: 'MENU_SERVICES', title: '🅿️ Parqueadero y servicios' },
          { id: 'MENU_SUPPORT',  title: '💬 Atención al cliente / PQRS' },
          { id: 'MENU_SOCIAL',   title: '📱 Redes sociales' },
          { id: 'MENU_UPDATE',   title: '✏️ Actualizar mis datos' },
        ],
      },
    ],
    footer: '_Escribe *menú* en cualquier momento para volver aquí._',
  },

  // ── Respuestas directas del menú ────────────────────────────────────────
  info: {
    hours: () =>
      `*Horario de Primavera Urbana* 🕐\n\n${KB.hours.map((h) => `• ${h.days}: ${h.time}`).join('\n')}\n\n` +
      `🅿️ El parqueadero funciona de lunes a domingo de 6:00 am a 11:00 pm.`,

    location: () =>
      `*Ubicación* 📍\n\n${KB.location.address}, ${KB.location.neighborhood}\n${KB.location.city}\n\n` +
      `🗺️ Cómo llegar: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Primavera Urbana ${KB.location.address} Villavicencio`)}`,

    storesBody: '*Tiendas y marcas* 🛍️\n\nElige una tienda para ver dónde queda y qué ofrece:',

    storesFooter: () =>
      `🔎 Directorio completo: ${KB.links.stores}\n🍽️ Restaurantes: ${KB.links.restaurants}`,

    storeDetail: (store) =>
      `*${store.name}*\n📍 ${store.location}\n\n${store.description}`,

    events: () => {
      const blocks = KB.events.map((e) => {
        const status = eventStatus(e);
        let text = `*${e.name}*\n${e.description}`;
        if (e.startDate) {
          const range = `del ${formatDate(e.startDate)} al ${formatDate(e.endDate)}`;
          if (status === 'finalizado') {
            text += `\n\n⏱️ Este sorteo estuvo vigente ${range} y ya finalizó. Para conocer resultados o próximas promociones, acércate a Atención al Cliente.`;
          } else if (status === 'próximo') {
            text += `\n\n⏱️ Inicia el ${formatDate(e.startDate)} (vigente ${range}).`;
          } else {
            text += `\n\n⏱️ Vigente ${range}.\n📝 ${e.howToParticipate}`;
          }
        }
        return text;
      });
      return `*Eventos y actividades* 🎉\n\n${blocks.join('\n\n———\n\n')}`;
    },

    services: () =>
      `*Servicios para ti* 🅿️\n\n${KB.services.map((s) => `• ${s}`).join('\n')}`,

    support: () =>
      `*Atención al Cliente* 💬\n\n${KB.customerService.description}\n\n` +
      `📲 WhatsApp: ${KB.customerService.whatsapp}\n${KB.customerService.whatsappUrl}`,

    social: () =>
      `*Síguenos en redes* 📱\n\n• Instagram: ${KB.social.instagram}\n• Facebook: ${KB.social.facebook}\n• YouTube: ${KB.social.youtube}`,
  },

  // ── Identificación con cédula ───────────────────────────────────────────
  auth: {
    welcome: () =>
      `${MESSAGES.greeting.new}\n\n${POLICY_NOTICE}\n\n` +
      `Para continuar, envía tu *número de cédula*.\nSi aún no estás registrado, escribe *REGISTRO*.`,

    askId: 'Para continuar, envía tu *número de cédula* (solo números).\nSi aún no estás registrado, escribe *REGISTRO*.',

    hello: (name) => `¡Hola, ${name}! 💚 Qué bueno tenerte por aquí.`,

    notFound: 'No encontramos tu cédula. 🤔\nIntenta nuevamente o escribe *REGISTRO* para registrarte.',

    blocked: () =>
      `No encontramos tu cédula. 🤔\n\nPuedes registrarte escribiendo *REGISTRO*` +
      (REGISTER_URL ? ` o aquí: ${REGISTER_URL}` : '') +
      `\n\nSi necesitas ayuda: ${KB.customerService.whatsappUrl}`,

    expired: '⏰ Tu sesión se cerró por inactividad.\n\nEnvía tu número de cédula para continuar.',

    alreadyRegistered: 'Esa cédula ya está registrada. ✅ Envíala de nuevo para ingresar.',
  },

  // ── Registro de cliente ─────────────────────────────────────────────────
  register: {
    start: (firstQuestion) =>
      `📝 *Iniciemos tu registro*\n\n${POLICY_NOTICE}\n\n` +
      `Al final te pediremos autorizar el tratamiento de tus datos.\n` +
      `Escribe *cancelar* en cualquier momento para salir.\n\n${firstQuestion}`,

    questions: {
      documento: '📄 Ingresa tu número de documento:',
      tipoDoc: '📌 Tipo de documento:\n1️⃣ CC\n2️⃣ CE\n3️⃣ PAS',
      nombre: '👤 Ingresa tus nombres (solo nombres):',
      apellido: '👤 Ingresa tus apellidos:',
      genero: '⚧ Género (Masculino o Femenino):',
      fecha: '📅 Fecha de nacimiento (AAAA-MM-DD):',
      email: '📧 Correo electrónico:',
      telefono: '📱 Número de teléfono:',
      politica:
        `${POLICY_NOTICE}\n\n¿Autorizas el tratamiento de tus datos personales conforme a esta política?\n\n` +
        `1️⃣ Acepto\n2️⃣ No acepto`,
    },

    summary: (data) =>
      `📝 *Confirma tus datos:*\n\n` +
      `📄 Documento: ${data.documento}\n` +
      `📌 Tipo: ${DOC_TYPE_LABELS[data.tipoDoc]}\n` +
      `👤 Nombre: ${data.nombre}\n` +
      `👤 Apellido: ${data.apellido}\n` +
      `⚧ Género: ${data.genero}\n` +
      `📅 Nacimiento: ${data.fecha}\n` +
      `📧 Email: ${data.email}\n` +
      `📱 Teléfono: ${data.telefono}\n` +
      `📜 Política de datos: Aceptada ✅\n\n` +
      `Responde:\n✅ *SI* → guardar\n❌ *NO* → cancelar\n✏️ *EDITAR campo* → corregir (ej: editar email)`,

    confirmHelp: 'Responde *SI*, *NO* o *EDITAR campo* (ej: editar email).',
    invalidField: '⚠️ Campo inválido. Puedes editar: documento, tipo, nombre, apellido, genero, fecha, email o telefono.',
    reenter: (question) => `✏️ ${question}`,

    policyRejected:
      '❌ Sin tu autorización no podemos registrar tus datos, así que cancelamos el registro.\n\n' +
      'Si cambias de opinión, escribe *REGISTRO*.',
    cancelled: '❌ Registro cancelado.\n\nEnvía tu cédula para ingresar o escribe *REGISTRO*.',
    success: '✅ ¡Registro completado!',
    failed: () =>
      `❌ No pudimos completar tu registro. Intenta más tarde o comunícate con Atención al Cliente: ${KB.customerService.whatsappUrl}`,
  },

  // ── Actualización de datos ──────────────────────────────────────────────
  update: {
    fields: UPDATE_FIELDS,

    start: () =>
      `✏️ *Actualización de datos*\n\n${POLICY_NOTICE}\n\n` +
      `Para actualizar tus datos debes aceptar la política.\n\n¿Qué deseas editar?\n\n${updateMenu()}`,

    askValue: (label) => `✏️ Escribe el nuevo valor para *${label}*:`,

    askPolicy: (label, value) =>
      `Vas a cambiar *${label}* a: ${value}\n\n${POLICY_NOTICE}\n\n` +
      `¿Autorizas el tratamiento de tus datos personales conforme a esta política?\n\n1️⃣ Acepto\n2️⃣ Cancelar`,

    policyHelp: 'Responde 1 (Acepto) o 2 (Cancelar).',
    invalidOption: () => `Selecciona una opción válida:\n\n${updateMenu()}`,
    success: () => `✅ Datos actualizados correctamente.\n\n¿Deseas modificar otro campo?\n\n${updateMenu()}`,
    failed: () => `❌ No pudimos actualizar tus datos. Intenta más tarde.\n\n${updateMenu()}`,
    cancelled: '❌ Actualización cancelada.',
    finished: '✅ Proceso finalizado.',
  },

  // ── Varios ──────────────────────────────────────────────────────────────
  followUp: '¿Te ayudo con algo más? Escribe tu pregunta o *menú* para ver las opciones. 💚',

  mediaNotSupported:
    'Por ahora solo puedo leer mensajes de texto. 🙏 Escríbeme tu pregunta o *menú* para ver las opciones.',

  // ── Errores ─────────────────────────────────────────────────────────────
  errors: {
    generic: () =>
      `Ups, tuve un problema para responderte. 😅 Intenta de nuevo en un momento o escribe *menú*.\n\n` +
      `Si es urgente, comunícate con Atención al Cliente: ${KB.customerService.whatsappUrl}`,

    db: () =>
      `Ups, no pudimos validar tu información en este momento. 😅 Intenta de nuevo en unos minutos.\n\n` +
      `Si es urgente, comunícate con Atención al Cliente: ${KB.customerService.whatsappUrl}`,
  },
};

module.exports = MESSAGES;
