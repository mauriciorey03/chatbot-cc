'use strict';

require('dotenv').config();

const express = require('express');
const webhookRouter = require('./routes/webhook');
const { KB } = require('./data/knowledgeBase');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rutas ───────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Twilio status callbacks (delivered, read, failed) — solo acusar recibo
app.post('/status_callback', (_req, res) => res.sendStatus(204));

// ── Arranque ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🤖 Bot de ${KB.shortName} corriendo en http://localhost:${PORT}`);
  console.log(`📡 Webhook URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}/webhook\n`);
});

module.exports = app;
