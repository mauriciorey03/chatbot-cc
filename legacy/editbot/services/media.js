'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const wa = require('./whatsapp');
const kling = require('./videoEngines/kling');
const higgsfield = require('./videoEngines/higgsfield');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_SIZE_BYTES = 64 * 1024 * 1024; // 64 MB

const SUPPORTED_TYPES = {
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac'],
};

function detectAssetType(mimeType) {
  for (const [type, mimes] of Object.entries(SUPPORTED_TYPES)) {
    if (mimes.includes(mimeType)) return type;
  }
  return 'unknown';
}

function isSupported(mimeType) {
  return Object.values(SUPPORTED_TYPES).flat().includes(mimeType);
}

// Descarga un archivo de media desde la URL de Twilio y lo guarda localmente.
// mediaUrl: URL directa de Twilio (req.body.MediaUrl0)
// mimeType: req.body.MediaContentType0
async function saveMediaFromWhatsApp(mediaUrl, mimeType) {
  if (!isSupported(mimeType)) {
    throw new Error(`UNSUPPORTED_FORMAT:${mimeType}`);
  }

  const { buffer } = await wa.downloadMedia(mediaUrl);

  if (buffer.byteLength > MAX_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const ext = mimeType.split('/')[1].split(';')[0];
  const filename = `${uuidv4()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filepath, Buffer.from(buffer));

  const publicUrl = `${process.env.BASE_URL}/uploads/${filename}`;

  return {
    type: detectAssetType(mimeType),
    mimeType,
    filename,
    filepath,
    url: publicUrl,
    size: buffer.byteLength,
  };
}

// ── Routing al motor de video ────────────────────────────────────────────────

async function submitVideoJob(project) {
  const engine = project.engine || 'kling';
  console.log(`[Media] Enviando job → motor: ${engine}`);

  let result;
  if (engine === 'higgsfield') {
    result = await higgsfield.submitJob(project);
  } else {
    result = await kling.submitJob(project);
  }

  // Guardamos el endpoint junto al taskId para el polling de Kling
  return JSON.stringify({ taskId: result.taskId, endpoint: result.endpoint, engine });
}

async function pollJobStatus(jobIdStr) {
  let parsed;
  try {
    parsed = JSON.parse(jobIdStr);
  } catch {
    // Compatibilidad con job IDs legacy (string simple)
    return { status: 'failed', resultUrl: null, isLargeFile: false };
  }

  const { taskId, endpoint, engine } = parsed;

  if (engine === 'higgsfield') {
    return higgsfield.pollStatus(taskId);
  }
  return kling.pollStatus(taskId, endpoint);
}

module.exports = {
  saveMediaFromWhatsApp,
  submitVideoJob,
  pollJobStatus,
  detectAssetType,
  isSupported,
};
