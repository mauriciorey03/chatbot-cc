'use strict';

// Base de conocimiento del cliente. Los datos viven en client.js (privado, ignorado
// por git); si no existe se usa la plantilla client.example.js.
// Para actualizar la información del bot, edita SOLO client.js.

function loadClient() {
  try {
    return require('./client');
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND' || !err.message.includes('./client')) throw err;
    console.warn('[KB] No existe src/data/client.js: usando los datos de ejemplo (client.example.js)');
    return require('./client.example');
  }
}

const KB = loadClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

// Fecha de hoy en Colombia, formato YYYY-MM-DD
function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function eventStatus(event, today = todayISO()) {
  if (!event.startDate || !event.endDate) return 'permanente';
  if (today < event.startDate) return 'próximo';
  if (today > event.endDate) return 'finalizado';
  return 'vigente';
}

function findStore(id) {
  return KB.stores.find((s) => s.id === id) || null;
}

// Serializa la base de conocimiento como texto para el prompt del modelo.
// Debe ser determinista (sin fechas) para que el prompt caching funcione.
function toPromptText() {
  const lines = [];
  lines.push(`# ${KB.name}`, '', KB.description, '');

  lines.push('## Ubicación');
  lines.push(`${KB.location.address}, ${KB.location.neighborhood}, ${KB.location.city}.`, '');

  lines.push('## Horario del centro comercial');
  KB.hours.forEach((h) => lines.push(`- ${h.days}: ${h.time}`));
  lines.push('');

  lines.push('## Tiendas y marcas');
  KB.stores.forEach((s) => lines.push(`- ${s.name} — ${s.location}. ${s.description}`));
  lines.push(`Directorio completo de tiendas y otros espacios: ${KB.links.stores}`);
  lines.push(`Mapa de restaurantes: ${KB.links.restaurants}`, '');

  lines.push('## Eventos y actividades');
  KB.events.forEach((e) => {
    let line = `- ${e.name}: ${e.description}`;
    if (e.startDate) line += ` Vigencia: del ${e.startDate} al ${e.endDate}.`;
    if (e.howToParticipate) line += ` Cómo participar: ${e.howToParticipate}`;
    lines.push(line);
  });
  lines.push('');

  lines.push('## Atención al cliente');
  lines.push(KB.customerService.description);
  lines.push(`WhatsApp de atención: ${KB.customerService.whatsapp} (${KB.customerService.whatsappUrl})`, '');

  lines.push('## Servicios adicionales');
  KB.services.forEach((s) => lines.push(`- ${s}`));
  lines.push('');

  lines.push('## Redes sociales');
  lines.push(`- Instagram: ${KB.social.instagram}`);
  lines.push(`- Facebook: ${KB.social.facebook}`);
  lines.push(`- YouTube: ${KB.social.youtube}`);

  return lines.join('\n');
}

module.exports = { KB, todayISO, eventStatus, findStore, toPromptText };
