"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");

const PORT = process.env.PORT || 3000;
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ROOM_NAME = process.env.LIVE_ROOM_NAME || "escolha-do-fumo-live";

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn(
    "[aviso] LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET não configurados. " +
    "Configure essas variáveis de ambiente (veja .env.example) para a transmissão funcionar."
  );
}
if (!ADMIN_PASSWORD) {
  console.warn("[aviso] ADMIN_PASSWORD não configurado. Defina essa variável de ambiente para proteger o login de admin.");
}

const roomService = LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
  ? new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

const app = express();
app.use(express.json());
app.use(
  "/vendor",
  express.static(path.join(__dirname, "node_modules", "livekit-client", "dist"))
);
app.use(express.static(path.join(__dirname), { extensions: ["html"] }));

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "convidado";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// Emite um token de acesso à sala. Admin entra sempre com permissão de publicar;
// espectadores comuns entram só podendo assistir e mandar mensagens de dados
// (usadas para pedir permissão de transmitir).
app.post("/api/token", async (req, res) => {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: "Transmissão não configurada no servidor." });
  }

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const isAdminRequest = !!req.body.isAdmin;
  const adminPassword = typeof req.body.adminPassword === "string" ? req.body.adminPassword : "";

  if (!name) {
    return res.status(400).json({ error: "Informe um nome." });
  }

  let isAdmin = false;
  if (isAdminRequest) {
    if (!ADMIN_PASSWORD || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Senha de admin incorreta." });
    }
    isAdmin = true;
  }

  const identity = (isAdmin ? "admin-" : "user-") + slugify(name) + "-" + randomSuffix();

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identity,
    name: name,
    metadata: JSON.stringify({ isAdmin: isAdmin }),
  });

  at.addGrant({
    room: ROOM_NAME,
    roomJoin: true,
    canSubscribe: true,
    canPublish: isAdmin,
    canPublishData: true,
  });

  const token = await at.toJwt();

  res.json({
    token: token,
    url: LIVEKIT_URL,
    identity: identity,
    room: ROOM_NAME,
    isAdmin: isAdmin,
  });
});

function requireAdminPassword(req, res, next) {
  const provided = req.body && req.body.adminPassword;
  if (!ADMIN_PASSWORD || provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  next();
}

// Concede ou revoga permissão de transmitir tela para um participante já conectado.
app.post("/api/admin/set-publish", requireAdminPassword, async (req, res) => {
  if (!roomService) {
    return res.status(503).json({ error: "Transmissão não configurada no servidor." });
  }

  const identity = typeof req.body.identity === "string" ? req.body.identity : "";
  const allow = !!req.body.allow;

  if (!identity) {
    return res.status(400).json({ error: "identity é obrigatório." });
  }

  try {
    await roomService.updateParticipant(ROOM_NAME, identity, {
      permission: {
        canSubscribe: true,
        canPublish: allow,
        canPublishData: true,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao atualizar permissão do participante:", err);
    res.status(500).json({ error: "Não foi possível atualizar a permissão." });
  }
});

// Remove um participante da sala (ex: encerrar a transmissão de alguém).
app.post("/api/admin/remove-participant", requireAdminPassword, async (req, res) => {
  if (!roomService) {
    return res.status(503).json({ error: "Transmissão não configurada no servidor." });
  }

  const identity = typeof req.body.identity === "string" ? req.body.identity : "";
  if (!identity) {
    return res.status(400).json({ error: "identity é obrigatório." });
  }

  try {
    await roomService.removeParticipant(ROOM_NAME, identity);
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao remover participante:", err);
    res.status(500).json({ error: "Não foi possível remover o participante." });
  }
});

app.listen(PORT, function () {
  console.log("Servidor rodando na porta " + PORT);
});
