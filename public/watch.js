const joinCard = document.getElementById('joinCard');
const watchCard = document.getElementById('watchCard');
const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const joinStatus = document.getElementById('joinStatus');
const watchStatus = document.getElementById('watchStatus');
const liveBadge = document.getElementById('liveBadge');
const remoteVideo = document.getElementById('remoteVideo');
const participantCount = document.getElementById('participantCount');

let room = null;

function setStatus(el, msg, kind) {
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// Prefill room name from ?room= query param, e.g. shared by the presenter.
const params = new URLSearchParams(window.location.search);
const prefilledRoom = params.get('room');
if (prefilledRoom) roomInput.value = prefilledRoom;

function updateParticipantCount() {
  if (!room) return;
  const others = room.remoteParticipants.size;
  participantCount.textContent = `Pessoas na sala: ${others + 1}`;
}

function attachTrack(track) {
  if (track.kind === LivekitClient.Track.Kind.Video) {
    track.attach(remoteVideo);
    liveBadge.style.display = 'inline-block';
    setStatus(watchStatus, 'Transmissão ao vivo.', 'ok');
  } else if (track.kind === LivekitClient.Track.Kind.Audio) {
    const audioEl = track.attach();
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
  }
}

async function joinRoom() {
  const roomName = roomInput.value.trim();
  if (!roomName) {
    setStatus(joinStatus, 'Digite o nome da sala.', 'error');
    return;
  }

  joinBtn.disabled = true;
  setStatus(joinStatus, 'Conectando...', '');

  try {
    const [configRes, tokenRes] = await Promise.all([
      fetch('/config').then((r) => r.json()),
      fetch('/api/viewer-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, name: nameInput.value.trim() }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Falha ao entrar na sala.');
        return data;
      }),
    ]);

    if (!configRes.livekitUrl) {
      throw new Error('O servidor não está configurado com LIVEKIT_URL. Veja o README.');
    }

    room = new LivekitClient.Room({ adaptiveStream: true });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => attachTrack(track));
    room.on(LivekitClient.RoomEvent.ParticipantConnected, updateParticipantCount);
    room.on(LivekitClient.RoomEvent.ParticipantDisconnected, updateParticipantCount);
    room.on(LivekitClient.RoomEvent.Disconnected, () => {
      liveBadge.style.display = 'none';
      setStatus(watchStatus, 'A transmissão foi encerrada pelo apresentador.', 'error');
    });

    await room.connect(configRes.livekitUrl, tokenRes.token);

    // Handle tracks published before we finished connecting.
    room.remoteParticipants.forEach((participant) => {
      participant.getTrackPublications().forEach((pub) => {
        if (pub.track) attachTrack(pub.track);
      });
    });

    joinCard.style.display = 'none';
    watchCard.style.display = 'block';
    setStatus(watchStatus, 'Conectado. Aguardando o apresentador compartilhar a tela...', '');
    updateParticipantCount();
  } catch (err) {
    console.error(err);
    setStatus(joinStatus, err.message || 'Não foi possível entrar na sala.', 'error');
    joinBtn.disabled = false;
  }
}

joinBtn.addEventListener('click', joinRoom);

window.addEventListener('beforeunload', () => {
  if (room) room.disconnect();
});
