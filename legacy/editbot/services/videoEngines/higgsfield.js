'use strict';

const axios = require('axios');

const BASE_URL = 'https://api.higgsfield.ai';
const API_KEY = process.env.HIGGSFIELD_API_KEY;

function authHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

// ── Construcción del payload ─────────────────────────────────────────────────

function buildPayload(project) {
  const prompt = project.plan || project.prompt;
  const hasVideo = project.assets.some((a) => a.type === 'video');
  const hasImage = project.assets.some((a) => a.type === 'image');

  if (hasVideo) {
    const asset = project.assets.find((a) => a.type === 'video');
    return { prompt, video_url: asset.url, aspect_ratio: '16:9' };
  }
  if (hasImage) {
    const asset = project.assets.find((a) => a.type === 'image');
    return { prompt, image_url: asset.url, aspect_ratio: '16:9' };
  }
  return { prompt, aspect_ratio: '16:9', duration: 5 };
}

// ── Submit job ───────────────────────────────────────────────────────────────

async function submitJob(project) {
  const hasVideo = project.assets.some((a) => a.type === 'video');
  const hasImage = project.assets.some((a) => a.type === 'image');

  let endpoint;
  if (hasVideo) {
    endpoint = '/v1/generation/video-to-video';
  } else if (hasImage) {
    endpoint = '/v1/generation/image-to-video';
  } else {
    endpoint = '/v1/generation/text-to-video';
  }

  const { data } = await axios.post(
    `${BASE_URL}${endpoint}`,
    buildPayload(project),
    { headers: authHeaders() }
  );

  // Higgsfield devuelve { id } o { job_id } según el endpoint
  const taskId = data.id || data.job_id;
  if (!taskId) throw new Error('Higgsfield: no se obtuvo task ID');

  return { taskId, endpoint };
}

// ── Poll job status ──────────────────────────────────────────────────────────

async function pollStatus(taskId) {
  const { data } = await axios.get(
    `${BASE_URL}/v1/generation/${taskId}`,
    { headers: authHeaders() }
  );

  const s = data.status;

  if (s === 'completed' || s === 'succeeded') {
    const resultUrl = data.output?.video_url || data.video_url;
    return { status: 'completed', resultUrl, isLargeFile: false };
  }
  if (s === 'failed' || s === 'error') {
    return { status: 'failed', resultUrl: null };
  }
  return { status: 'processing', resultUrl: null };
}

module.exports = { submitJob, pollStatus };
