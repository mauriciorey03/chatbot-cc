'use strict';

const sql = require('mssql');

// Conexión a la base de datos del CRM (SQL Server / Azure SQL).
// Misma base que usa el bot general (db.py): tpContacto, tpValorContacto,
// tpContactoInfoExtra y el procedimiento dbo.PA_SITE_OCR.

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise = null;

// Pool único compartido; si la conexión falla se reintenta en la siguiente llamada
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// Segmentos de tpValorContacto (csegId) por campo.
// Mismo mapeo que update_client() en db.py. Ojo: test_db.py usa 71 (vcsegEmail)
// para email y 74 (vcsegNum) para teléfono; confirmar cuál es el correcto en la BD.
const FIELD_SEGMENT = {
  nombre: 67,
  apellido: 68,
  email: 72,
  telefono: 73,
};

// ── Teléfono de WhatsApp ───────────────────────────────────────────────────
// whatsapp:+573001234567 → 3001234567

function normalizeSenderPhone(sender) {
  if (!sender) return null;

  let phone = sender.replace(/^whatsapp:/, '').replace(/\+/g, '');
  if (phone.startsWith('57') && phone.length === 12) phone = phone.slice(2);
  return phone;
}

// ── Consultas ──────────────────────────────────────────────────────────────

async function getConIdByDocument(documento, request) {
  const req = request || (await getPool()).request();
  const result = await req
    .input('documento', documento)
    .query('SELECT conId FROM tpContacto WHERE conNdoc = @documento');
  return result.recordset[0]?.conId ?? null;
}

// Devuelve "Nombre Apellido" del cliente o null si la cédula no existe.
// Los errores de conexión se propagan para no confundirlos con "no registrado".
async function getClientName(cedula) {
  const pool = await getPool();
  const conId = await getConIdByDocument(cedula, pool.request());
  if (!conId) return null;

  const result = await pool
    .request()
    .input('conId', conId)
    .query('SELECT csegId, vcsegTexto FROM tpValorContacto WHERE conId = @conId');

  let nombre = '';
  let apellido = '';
  for (const row of result.recordset) {
    if (row.csegId === FIELD_SEGMENT.nombre && row.vcsegTexto) nombre = row.vcsegTexto.trim();
    if (row.csegId === FIELD_SEGMENT.apellido && row.vcsegTexto) apellido = row.vcsegTexto.trim();
  }

  // El contacto existe aunque no tenga nombre registrado
  return `${nombre} ${apellido}`.trim() || 'cliente';
}

// ── Autorización de datos personales ───────────────────────────────────────
// Guarda la aceptación de la política (infoPolDat), el celular de WhatsApp
// (infoCel) y la fecha de la autorización (infoFact).

async function savePolicyConsent(request, conId, politica, sender) {
  const result = await request
    .input('politica', politica)
    .input('celular', normalizeSenderPhone(sender))
    .input('conIdExtra', conId)
    .query(`
      UPDATE tpContactoInfoExtra
      SET infoPolDat = @politica,
          infoCel = @celular,
          infoFact = GETDATE()
      WHERE conId = @conIdExtra
    `);

  if (!result.rowsAffected[0]) {
    console.warn(`[DB] tpContactoInfoExtra sin registro para conId=${conId}`);
  }
}

// ── Registro de cliente ────────────────────────────────────────────────────

async function saveClient(data, sender) {
  try {
    const pool = await getPool();
    console.log('[DB] Registrando cliente:', data.documento);

    const sp = await pool
      .request()
      .input('funcion', '2')
      .input('param1', data.documento)
      .input('param2', data.tipoDoc)
      .input('param3', data.nombre)
      .input('param4', data.apellido)
      .input('param5', data.genero)
      .input('param6', data.fecha)
      .input('param7', data.email)
      .input('param8', data.telefono)
      .input('param9', '')
      .output('msgRta', sql.VarChar(1000))
      .execute('dbo.PA_SITE_OCR');

    if (sp.output.msgRta !== 'OK') {
      console.error('[DB] Error en PA_SITE_OCR:', sp.output.msgRta);
      return false;
    }

    const conId = await getConIdByDocument(data.documento, pool.request());
    if (!conId) return false;

    await savePolicyConsent(pool.request(), conId, data.politica ? 1 : 0, sender);
    console.log('[DB] Cliente creado:', data.documento);
    return true;
  } catch (err) {
    console.error('[DB] Error registrando cliente:', err.message);
    return false;
  }
}

// ── Actualización de datos ─────────────────────────────────────────────────
// data: { documento, politica, nombre?, apellido?, email?, telefono? }

async function updateClient(data, sender) {
  let transaction = null;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const conId = await getConIdByDocument(data.documento, new sql.Request(transaction));
    if (!conId) {
      console.error('[DB] Cliente no encontrado:', data.documento);
      await transaction.rollback();
      return false;
    }

    for (const [field, value] of Object.entries(data)) {
      const csegId = FIELD_SEGMENT[field];
      if (!csegId) continue;

      // UPDATE si existe el valor, INSERT si no
      await new sql.Request(transaction)
        .input('conId', conId)
        .input('csegId', csegId)
        .input('valor', value)
        .query(`
          IF EXISTS (SELECT 1 FROM tpValorContacto WHERE conId = @conId AND csegId = @csegId)
            UPDATE tpValorContacto SET vcsegTexto = @valor WHERE conId = @conId AND csegId = @csegId
          ELSE
            INSERT INTO tpValorContacto (conId, csegId, vcsegTexto) VALUES (@conId, @csegId, @valor)
        `);
    }

    await savePolicyConsent(new sql.Request(transaction), conId, data.politica ? 1 : 0, sender);
    await transaction.commit();
    console.log('[DB] Cliente actualizado:', data.documento);
    return true;
  } catch (err) {
    console.error('[DB] Error actualizando cliente:', err.message);
    if (transaction) await transaction.rollback().catch(() => {});
    return false;
  }
}

module.exports = {
  getClientName,
  saveClient,
  updateClient,
  normalizeSenderPhone,
};
