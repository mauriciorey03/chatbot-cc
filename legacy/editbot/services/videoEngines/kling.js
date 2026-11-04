'use strict';

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://api.klingai.com';
const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const SECRET_KEY = process.env.KLING_SECRET_KEY;

// ── JWT auth (HS256, válido 30 min) ─────────────────────────────────────────

function generateJWT() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: ACCESS_KEY, exp: now + 1800, nbf: now - 5 })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${generateJWT()}`, 'Content-Type': 'application/json' };
}

// ── Construcción del payload según los assets del proyecto ─────────────────

function buildPayload(project) {
  const hasVideo = project.assets.some((a) => a.type === 'video');
  const hasImage = project.assets.some((a) => a.type === 'image');
  const prompt = project.plan || project.prompt;

  if (hasVideo) {
    const videoAsset = project.assets.find((a) => a.type === 'video');
    return {
      model_name: 'kling-v1',
      video_url: videoAsset.url,
      prompt,
      duration: '5',
      cfg_scale: 0.5,
    };
  }

  if (hasImage) {
    const imageAsset = project.assets.find((a) => a.type === 'image');
    return {
      model_name: 'kling-v1',
      image: imageAsset.url,
      prompt,
      duration: '5',
      cfg_scale: 0.5,
    };
  }

  // Text-to-video
  return {
    model_name: 'kling-v1',
    prompt,
    duration: '5',
    aspect_ratio: '16:9',
    cfg_scale: 0.5,
  };
}

// ── Submit job ───────────────────────────────────────────────────────────────

async function submitJob(project) {
  const hasVideo = project.assets.some((a) => a.type === 'video');
  const hasImage = project.assets.some((a) => a.type === 'image');

  let endpoint;
  if (hasVideo) {
    endpoint = '/v1/videos/video2video';
  } else if (hasImage) {
    endpoint = '/v1/videos/image2video';
  } else {
    endpoint = '/v1/videos/text2video';
  }

  const { data } = await axios.post(
    `${BASE_URL}${endpoint}`,
    buildPayload(project),
    { headers: authHeaders() }
  );

  if (data.code !== 0) {
    throw new Error(`Kling API error: ${data.message}`);
  }

  return { taskId: data.data.task_id, endpoint };
}

// ── Poll job status ──────────────────────────────────────────────────────────

async function pollStatus(taskId, endpoint) {
  const pollEndpoint = endpoint || '/v1/videos/text2video';
  const { data } = await axios.get(
    `${BASE_URL}${pollEndpoint}/${taskId}`,
    { headers: authHeaders() }
  );

  if (data.code !== 0) {
    throw new Error(`Kling poll error: ${data.message}`);
  }

  const task = data.data;

  if (task.task_status === 'succeed') {
    const videoUrl = task.task_result?.videos?.[0]?.url;
    return { status: 'completed', resultUrl: videoUrl, isLargeFile: false };
  }

  if (task.task_status === 'failed') {
    return { status: 'failed', resultUrl: null };
  }

  return { status: 'processing', resultUrl: null };
}

module.exports = { submitJob, pollStatus };
