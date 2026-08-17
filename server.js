require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_URL,
  HOST_PASSWORD,
  PORT = 3000,
} = process.env;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.warn(
    '[aviso] LIVEKIT_API_KEY, LIVEKIT_API_SECRET ou LIVEKIT_URL nao estao definidos.\n' +
    'Copie .env.example para .env e preencha com os dados do seu projeto em https://cloud.livekit.io'
  );
}

// Exposes only the public WS url to the frontend, never the secret.
app.get('/config', (req, res) => {
  res.json({ livekitUrl: LIVEKIT_URL || '' });
});

function safeRoomName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

function safeIdentity(name) {
  return String(name || 'convidado')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .slice(0, 40) || 'convidado';
}

// Host requests a token that allows publishing (screen share).
app.post('/api/host-token', async (req, res) => {
  try {
    const { room, name, password } = req.body || {};

    if (HOST_PASSWORD && password !== HOST_PASSWORD) {
      return res.status(401).json({ error: 'Senha de apresentador incorreta.' });
    }

    const roomName = safeRoomName(room);
    if (!roomName) {
      return res.status(400).json({ error: 'Nome da sala invalido.' });
    }

    const identity = `host-${safeIdentity(name)}-${crypto.randomBytes(3).toString('hex')}`;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: safeIdentity(name),
      ttl: '4h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishSources: ['screen_share', 'screen_share_audio'],
      canSubscribe: true,
      canUpdateOwnMetadata: true,
      roomCreate: true,
    });

    const token = await at.toJwt();
    res.json({ token, room: roomName, identity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao gerar token do apresentador.' });
  }
});

// Viewer requests a token that can only subscribe (watch), never publish.
app.post('/api/viewer-token', async (req, res) => {
  try {
    const { room, name } = req.body || {};

    const roomName = safeRoomName(room);
    if (!roomName) {
      return res.status(400).json({ error: 'Nome da sala invalido.' });
    }

    const identity = `viewer-${safeIdentity(name)}-${crypto.randomBytes(3).toString('hex')}`;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: safeIdentity(name),
      ttl: '4h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canUpdateOwnMetadata: false,
      roomCreate: false,
    });

    const token = await at.toJwt();
    res.json({ token, room: roomName, identity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao gerar token do espectador.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
