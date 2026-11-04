'use strict';

const { KB, eventStatus } = require('../data/knowledgeBase');

// Plantillas de mensajes del bot. Todo el contenido sale de data/knowledgeBase.js

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

  // ── Varios ──────────────────────────────────────────────────────────────
  followUp: '¿Te ayudo con algo más? Escribe tu pregunta o *menú* para ver las opciones. 💚',

  mediaNotSupported:
    'Por ahora solo puedo leer mensajes de texto. 🙏 Escríbeme tu pregunta o *menú* para ver las opciones.',

  // ── Errores ─────────────────────────────────────────────────────────────
  errors: {
    generic: () =>
      `Ups, tuve un problema para responderte. 😅 Intenta de nuevo en un momento o escribe *menú*.\n\n` +
      `Si es urgente, comunícate con Atención al Cliente: ${KB.customerService.whatsappUrl}`,
  },
};

module.exports = MESSAGES;
