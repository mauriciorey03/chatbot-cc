'use strict';

// Plantilla de los datos del cliente. Copia este archivo como client.js
// (ignorado por git) y reemplaza los valores con la información real.

module.exports = {
  name: 'Centro Comercial Ejemplo',
  shortName: 'CC Ejemplo',
  // Frase que acompaña el nombre en la bienvenida
  tagline: 'tu centro comercial de confianza. 🛍️',

  description:
    'El Centro Comercial Ejemplo reúne tiendas, restaurantes y servicios en un solo lugar. ' +
    'Cuenta con tiendas ancla, zona de comidas y espacios para toda la familia.',

  location: {
    address: 'Calle 1 # 2-3',
    neighborhood: 'barrio Centro',
    city: 'Ciudad, Departamento, País',
  },

  parkingHours: 'lunes a domingo de 6:00 am a 10:00 pm',

  hours: [
    { days: 'Lunes a sábado', time: '10:00 am – 8:00 pm' },
    { days: 'Domingos y festivos', time: '11:00 am – 7:00 pm' },
  ],

  // id: identificador único en mayúsculas (se usa como STORE_<id>)
  stores: [
    {
      id: 'TIENDA_A',
      name: 'Tienda A',
      location: 'Local 101 (Piso 1)',
      description: 'Ropa, calzado y accesorios para toda la familia.',
    },
    {
      id: 'TIENDA_B',
      name: 'Tienda B',
      location: 'Local 201 (Piso 2)',
      description: 'Tecnología, celulares y accesorios.',
    },
  ],

  // startDate / endDate (YYYY-MM-DD) son opcionales: con ellas el bot calcula si el evento está vigente
  events: [
    {
      id: 'EVENTO_PERMANENTE',
      name: 'Actividad permanente',
      description: 'Descripción de una actividad sin fecha de finalización.',
    },
    {
      id: 'SORTEO',
      name: 'Gran sorteo',
      description: 'Sorteo de un premio entre quienes registren facturas de compra.',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      howToParticipate: 'Registrando las facturas en el módulo de Atención al Cliente.',
    },
  ],

  customerService: {
    description:
      'Módulo de atención donde puedes inscribir facturas, participar en sorteos y radicar PQRS.',
    whatsapp: '+57 300 000 0000',
    whatsappUrl: 'https://wa.me/573000000000',
  },

  services: [
    'Puntos de información',
    'Primeros auxilios',
    'Estacionamiento para automóviles y motocicletas',
  ],

  links: {
    restaurants: 'https://example.com/restaurantes/',
    stores: 'https://example.com/tiendas/',
  },

  social: {
    instagram: 'https://www.instagram.com/example/',
    facebook: 'https://www.facebook.com/example/',
    youtube: 'https://www.youtube.com/@example',
  },
};
