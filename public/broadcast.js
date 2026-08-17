const setupCard = document.getElementById('setupCard');
const liveCard = document.getElementById('liveCard');
const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const setupStatus = document.getElementById('setupStatus');
const liveStatus = document.getElementById('liveStatus');
const liveBadge = document.getElementById('liveBadge');
const localPreview = document.getElementById('localPreview');
const viewerCount = document.getElementById('viewerCount');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');

let room = null;

function setStatus(el, msg, kind) {
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function updateViewerCount() {
  if (!room) return;
  viewerCount.textContent = String(room.remoteParticipants.size);
}

async function startBroadcast() {
  const roomName = roomInput.value.trim();
  if (!roomName) {
    setStatus(setupStatus, 'Digite um nome para a sala.', 'error');
    return;
  }

  startBtn.disabled = true;
  setStatus(setupStatus, 'Conectando...', '');

  try {
    const [configRes, tokenRes] = await Promise.all([
      fetch('/config').then((r) => r.json()),
      fetch('/api/host-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomName,
          name: nameInput.value.trim(),
          password: passwordInput.value,
        }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Falha ao autenticar.');
        return data;
      }),
    ]);

    if (!configRes.livekitUrl) {
      throw new Error('O servidor não está configurado com LIVEKIT_URL. Veja o README.');
    }

    room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

    room.on(LivekitClient.RoomEvent.ParticipantConnected, updateViewerCount);
    room.on(LivekitClient.RoomEvent.ParticipantDisconnected, updateViewerCount);
    room.on(LivekitClient.RoomEvent.Disconnected, () => {
      setStatus(liveStatus, 'Transmissão encerrada.', 'error');
      liveBadge.style.display = 'none';
    });

    await room.connect(configRes.livekitUrl, tokenRes.token);

    await room.localParticipant.setScreenShareEnabled(true, { audio: true });

    // Grab the local screen share video track for the preview.
    const screenPub = room.localParticipant.getTrackPublication(
      LivekitClient.Track.Source.ScreenShare
    );
    if (screenPub && screenPub.track) {
      screenPub.track.attach(localPreview);
    }

    // If the user clicks the browser's own "Stop sharing" control, react to it.
    room.on(LivekitClient.RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === LivekitClient.Track.Source.ScreenShare) {
        setStatus(liveStatus, 'Compartilhamento de tela interrompido.', 'error');
        stopBroadcast();
      }
    });

    const url = new URL('/watch.html', window.location.origin);
    url.searchParams.set('room', roomName);
    shareLink.value = url.toString();

    setupCard.style.display = 'none';
    liveCard.style.display = 'block';
    liveBadge.style.display = 'inline-block';
    setStatus(liveStatus, 'Transmitindo.', 'ok');
    updateViewerCount();
  } catch (err) {
    console.error(err);
    setStatus(setupStatus, err.message || 'Não foi possível iniciar a transmissão.', 'error');
    startBtn.disabled = false;
    if (room) {
      room.disconnect();
      room = null;
    }
  }
}

async function stopBroadcast() {
  if (room) {
    await room.disconnect();
    room = null;
  }
  liveBadge.style.display = 'none';
  liveCard.style.display = 'none';
  setupCard.style.display = 'block';
  startBtn.disabled = false;
  setStatus(setupStatus, 'Transmissão encerrada.', '');
}

startBtn.addEventListener('click', startBroadcast);
stopBtn.addEventListener('click', stopBroadcast);
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copyBtn.textContent = 'Copiado!';
    setTimeout(() => (copyBtn.textContent = 'Copiar link'), 1500);
  } catch {
    shareLink.select();
  }
});

window.addEventListener('beforeunload', () => {
  if (room) room.disconnect();
});
