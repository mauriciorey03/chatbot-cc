'use strict';

// Validadores de los datos del cliente (registro y actualización).
// Cada uno devuelve { value } si es válido o { error } con el mensaje para el usuario.

const NAME_RE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]+$/;

const DOC_TYPES = {
  CC: 1, 1: 1,
  CE: 2, 2: 2,
  PAS: 3, PASAPORTE: 3, 3: 3,
};

const DOC_TYPE_LABELS = { 1: 'CC', 2: 'CE', 3: 'PAS' };

function titleCase(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function documento(msg) {
  const doc = msg.replace(/\D/g, '');
  if (doc.length < 6) return { error: '⚠️ Documento inválido. Escribe solo los números de tu documento.' };
  return { value: doc };
}

function tipoDoc(msg) {
  const value = DOC_TYPES[msg.trim().toUpperCase()];
  if (!value) return { error: '⚠️ Tipo inválido. Responde 1 (CC), 2 (CE) o 3 (PAS).' };
  return { value };
}

function nombre(msg) {
  if (!NAME_RE.test(msg.trim())) return { error: '⚠️ Solo se permiten letras.' };
  return { value: titleCase(msg) };
}

function genero(msg) {
  const text = msg.trim().toUpperCase();
  if (['M', 'MASCULINO', 'HOMBRE'].includes(text)) return { value: 'MASCULINO' };
  if (['F', 'FEMENINO', 'MUJER'].includes(text)) return { value: 'FEMENINO' };
  return { error: '⚠️ Escribe Masculino o Femenino.' };
}

// Acepta 1990-05-21, 1990/5/21, 1990.05.21 → '1990-05-21'
function fecha(msg) {
  const match = msg.trim().match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})$/);
  const invalid = { error: '⚠️ Fecha inválida. Usa el formato AAAA-MM-DD (ej: 1990-05-21).' };
  if (!match) return invalid;

  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  const isReal = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!isReal || date > new Date() || y < 1900) return invalid;

  return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

function email(msg) {
  const text = msg.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return { error: '⚠️ Correo electrónico inválido.' };
  return { value: text };
}

function telefono(msg) {
  const phone = msg.replace(/\D/g, '');
  if (phone.length < 7) return { error: '⚠️ Teléfono inválido.' };
  return { value: phone };
}

// Autorización de tratamiento de datos: { value: 1 } si acepta, { rejected: true } si no
function politica(msg) {
  const text = msg.trim().toLowerCase();
  if (['1', 'acepto', 'si', 'sí'].includes(text)) return { value: 1 };
  if (['2', 'no', 'no acepto'].includes(text)) return { rejected: true };
  return { error: 'Responde 1 (Acepto) o 2 (No acepto).' };
}

module.exports = {
  documento,
  tipoDoc,
  nombre,
  apellido: nombre,
  genero,
  fecha,
  email,
  telefono,
  politica,
  DOC_TYPE_LABELS,
};
