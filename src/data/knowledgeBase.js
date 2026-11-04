'use strict';

// Base de conocimiento de Primavera Urbana.
// Fuente: PrimaveraUrbana-Chatbot-Preguntas-Data.docx
// Para actualizar la información del bot, edita SOLO este archivo.

const KB = {
  name: 'Primavera Urbana Centro Comercial y Empresarial',

  description:
    'El Centro Comercial Primavera Urbana, ubicado en Villavicencio, Meta, es el complejo comercial más exclusivo y único de la ciudad. ' +
    'Su mayor atractivo es que está integrado con un bosque de galería natural y el Caño Buque, ofreciendo una experiencia al aire libre ' +
    'donde puedes ver un acuario gigante con especies de la región, un sendero ecológico y vegetación exuberante mientras compras. ' +
    'Cuenta con tiendas ancla como Falabella y Jumbo, salas de cine y una variada oferta gastronómica de primer nivel.',

  location: {
    address: 'Calle 15 # 40-01',
    neighborhood: 'barrio El Buque',
    city: 'Villavicencio, Meta, Colombia',
  },

  hours: [
    { days: 'Lunes a jueves', time: '10:00 am – 8:00 pm' },
    { days: 'Viernes y sábado', time: '10:00 am – 9:00 pm' },
    { days: 'Domingos y festivos', time: '11:00 am – 8:00 pm' },
  ],

  stores: [
    {
      id: 'FALABELLA',
      name: 'Falabella',
      location: 'Locales 101, 201 y 301 (Piso 1)',
      description:
        'La tienda que lo tiene todo: vestuario, calzado, tecnología, decoración, hogar y mucho más, todo en un solo lugar. ' +
        'También cuenta con Banco Falabella, ubicado en el primer piso por el área del Boulevard Primavera.',
    },
    {
      id: 'CARULLA',
      name: 'Carulla',
      location: 'Local 100',
      description:
        'Supermercado para vivir una vida más fresca: lo que necesitas para cocinar, celebrar y disfrutar de tu hogar.',
    },
    {
      id: 'FARMATODO',
      name: 'Farmatodo',
      location: 'Locales 302, 303 y 304 (Piso 3)',
      description:
        'Cadena de farmacias de autoservicio y tiendas de conveniencia: productos dermatológicos, maquillaje, vitaminas, suplementos y skincare.',
    },
    {
      id: 'CRUZ_VERDE',
      name: 'Cruz Verde',
      location: 'Locales 228 y 229 (Piso 2)',
      description:
        'Una de las cadenas de droguerías y farmacias más grandes de Colombia, líder en la dispensación de medicamentos.',
    },
    {
      id: 'CREPES_WAFFLES',
      name: 'Crepes & Waffles',
      location: 'Local 143 (Piso 1)',
      description:
        'Restaurante y heladería con productos orgánicos y platos saludables. Ideal para planes en familia, cumpleaños o almorzar rico.',
    },
    {
      id: 'VELEZ',
      name: 'Vélez',
      location: 'Locales 109, 110 y 111 (Piso 1)',
      description:
        'Marca colombiana de moda y marroquinería en cuero: cinturones, bolsos y calzado para hombres y mujeres, con enfoque de industria sostenible.',
    },
    {
      id: 'ARTURO_CALLE',
      name: 'Arturo Calle',
      location: 'Local 104 (Piso 1)',
      description:
        'Ropa, calzado, accesorios y marroquinería para toda la familia: hombres, mujeres y niños.',
    },
    {
      id: 'LEONISA',
      name: 'Leonisa',
      location: 'Local 137 (Piso 1)',
      description:
        'Ropa interior femenina, fajas, prendas modeladoras y vestidos de baño.',
    },
    {
      id: 'BELLA_PIEL',
      name: 'Bella Piel',
      location: 'Local 234 (Piso 2)',
      description:
        'Productos dermocosméticos faciales, corporales y capilares.',
    },
    {
      id: 'ADIDAS',
      name: 'Adidas',
      location: 'Locales 219 y 220 (Piso 2)',
      description:
        'Calzado, ropa y accesorios deportivos y de moda.',
    },
  ],

  events: [
    {
      id: 'EXPEDICION',
      name: 'Expedición Primavera',
      description:
        'Una experiencia con la naturaleza dentro de Primavera Urbana: aventuras con aprendizaje sobre la naturaleza, flora y fauna de la región, ' +
        'además de paz, tranquilidad y una conexión única con la naturaleza.',
    },
    {
      id: 'SORTEO_10_ANOS',
      name: 'Primavera Urbana celebra 10 años, floreciendo contigo',
      description:
        'Sorteo de una camioneta BYD YUAN UP modelo 2026. Participan las facturas de compra acumulables iguales o superiores a ' +
        '$500.000 de los establecimientos de comercio y de comidas del sector comercial de Primavera Urbana.',
      startDate: '2026-04-01',
      endDate: '2026-09-30',
      howToParticipate: 'Registrando las facturas en el módulo de Atención al Cliente, en la entrada principal.',
    },
  ],

  customerService: {
    description:
      'Módulo ubicado en la entrada principal donde te entregan la información del centro comercial. Allí puedes inscribir facturas, ' +
      'participar en sorteos, promociones y eventos, conocer las actividades periódicas, validar convenios y radicar PQRS.',
    whatsapp: '+57 311 593 5774',
    whatsappUrl: 'https://wa.me/573115935774',
  },

  services: [
    'Puntos de información',
    'Primeros auxilios',
    'Préstamo de sillas de ruedas',
    'Estacionamiento para automóviles, motocicletas y bicicletas: lunes a domingo de 6:00 am a 11:00 pm',
    'Lockers para cascos: en el semisótano, a un costado del estacionamiento de bicicletas; lunes a domingo de 10:00 am a 10:00 pm',
  ],

  links: {
    restaurants: 'https://primaveraurbana.co/heladerias/restaurantes/',
    stores: 'https://primaveraurbana.co/tiendas/',
  },

  social: {
    instagram: 'https://www.instagram.com/primavera_urbana/',
    facebook: 'https://www.facebook.com/primaveraurbanacc/',
    youtube: 'https://www.youtube.com/channel/UCZ-ai79HGLPnSf25NaZj0iA',
  },
};

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
