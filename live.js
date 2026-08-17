(function () {
  "use strict";

  var LivekitClient = window.LivekitClient;
  var Room = LivekitClient.Room;
  var RoomEvent = LivekitClient.RoomEvent;
  var Track = LivekitClient.Track;

  var joinCard = document.getElementById("live-join-card");
  var nameInput = document.getElementById("live-name-input");
  var adminCheck = document.getElementById("live-admin-check");
  var adminPassField = document.getElementById("live-admin-pass-field");
  var adminPassInput = document.getElementById("live-admin-pass-input");
  var joinBtn = document.getElementById("live-join-btn");
  var joinError = document.getElementById("live-join-error");

  var roomDiv = document.getElementById("live-room");
  var statusEl = document.getElementById("live-status");
  var statusText = document.getElementById("live-status-text");
  var actionsDiv = document.getElementById("live-actions");
  var adminRequestsCard = document.getElementById("live-admin-requests-card");
  var requestsList = document.getElementById("live-requests-list");
  var requestsEmpty = document.getElementById("live-requests-empty");
  var videoGrid = document.getElementById("live-video-grid");
  var emptyMsg = document.getElementById("live-empty-msg");
  var toastStack = document.getElementById("toast-stack");

  var room = null;
  var myIdentity = null;
  var myName = null;
  var isAdmin = false;
  var canPublish = false;
  var isSharing = false;
  var pendingRequests = {}; // identity -> name
  var adminPasswordCache = "";

  function showToast(text) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    toastStack.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 5000);
  }

  adminCheck.addEventListener("change", function () {
    adminPassField.hidden = !adminCheck.checked;
  });

  joinBtn.addEventListener("click", function () {
    joinRoom();
  });

  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") joinRoom();
  });
  adminPassInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") joinRoom();
  });

  function joinRoom() {
    var name = nameInput.value.trim();
    var wantsAdmin = adminCheck.checked;
    var pass = adminPassInput.value;

    joinError.textContent = "";

    if (!name) {
      joinError.textContent = "Digite seu nome para entrar.";
      return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = "Entrando...";

    fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, isAdmin: wantsAdmin, adminPassword: pass }),
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) throw new Error(data.error || "Não foi possível entrar.");
          return data;
        });
      })
      .then(function (data) {
        myIdentity = data.identity;
        myName = name;
        isAdmin = !!data.isAdmin;
        canPublish = isAdmin;
        if (isAdmin) adminPasswordCache = pass;
        return connectRoom(data.url, data.token);
      })
      .catch(function (err) {
        joinError.textContent = err.message || "Erro ao entrar na transmissão.";
      })
      .finally(function () {
        joinBtn.disabled = false;
        joinBtn.textContent = "Entrar";
      });
  }

  function connectRoom(url, token) {
    room = new Room();

    room.on(RoomEvent.TrackSubscribed, renderVideoGrid);
    room.on(RoomEvent.TrackUnsubscribed, renderVideoGrid);
    room.on(RoomEvent.LocalTrackPublished, renderVideoGrid);
    room.on(RoomEvent.LocalTrackUnpublished, renderVideoGrid);
    room.on(RoomEvent.ParticipantConnected, renderVideoGrid);
    room.on(RoomEvent.ParticipantDisconnected, renderVideoGrid);
    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.Disconnected, function () {
      statusEl.classList.remove("connected");
      statusText.textContent = "Desconectado";
    });

    return room.connect(url, token).then(function () {
      joinCard.hidden = true;
      roomDiv.hidden = false;
      statusEl.classList.add("connected");
      statusText.textContent = "Conectado como " + myName + (isAdmin ? " (admin)" : "");
      adminRequestsCard.hidden = !isAdmin;
      renderActions();
      renderVideoGrid();
    });
  }

  function sendData(payload, opts) {
    var bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant.publishData(bytes, opts || { reliable: true });
  }

  function handleData(payload, participant) {
    var msg;
    try {
      msg = JSON.parse(new TextDecoder().decode(payload));
    } catch (e) {
      return;
    }

    if (msg.type === "request-broadcast" && isAdmin) {
      pendingRequests[msg.identity] = msg.name;
      renderRequests();
    } else if (msg.type === "broadcast-approved" && msg.identity === myIdentity) {
      canPublish = true;
      showToast("Você foi liberado para transmitir a tela!");
      renderActions();
    } else if (msg.type === "broadcast-denied" && msg.identity === myIdentity) {
      showToast("Seu pedido para transmitir foi negado.");
    } else if (msg.type === "broadcast-revoked" && msg.identity === myIdentity) {
      canPublish = false;
      if (isSharing) stopSharing();
      showToast("Sua permissão para transmitir foi removida.");
      renderActions();
    } else if (msg.type === "request-cancelled" && isAdmin) {
      delete pendingRequests[msg.identity];
      renderRequests();
    }
  }

  function renderRequests() {
    requestsList.innerHTML = "";
    var identities = Object.keys(pendingRequests);
    requestsEmpty.hidden = identities.length !== 0;

    identities.forEach(function (identity) {
      var row = document.createElement("div");
      row.className = "request-row";

      var label = document.createElement("span");
      label.textContent = pendingRequests[identity] + " quer transmitir a tela";
      row.appendChild(label);

      var actions = document.createElement("div");
      actions.className = "req-actions";

      var approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.className = "chip-btn win";
      approveBtn.textContent = "Aprovar";
      approveBtn.addEventListener("click", function () {
        setParticipantPublish(identity, true).then(function () {
          sendData({ type: "broadcast-approved", identity: identity });
          delete pendingRequests[identity];
          renderRequests();
        });
      });

      var denyBtn = document.createElement("button");
      denyBtn.type = "button";
      denyBtn.className = "del-btn";
      denyBtn.textContent = "Negar";
      denyBtn.addEventListener("click", function () {
        sendData({ type: "broadcast-denied", identity: identity });
        delete pendingRequests[identity];
        renderRequests();
      });

      actions.appendChild(approveBtn);
      actions.appendChild(denyBtn);
      row.appendChild(actions);
      requestsList.appendChild(row);
    });
  }

  function setParticipantPublish(identity, allow) {
    return fetch("/api/admin/set-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: identity, allow: allow, adminPassword: adminPasswordCache }),
    }).then(function (resp) {
      if (!resp.ok) throw new Error("Falha ao atualizar permissão.");
      return resp.json();
    });
  }

  function renderActions() {
    actionsDiv.innerHTML = "";

    if (canPublish) {
      var shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "btn-ghost";
      shareBtn.textContent = isSharing ? "Parar de compartilhar" : "Compartilhar minha tela";
      shareBtn.addEventListener("click", function () {
        if (isSharing) stopSharing();
        else startSharing();
      });
      actionsDiv.appendChild(shareBtn);
    } else {
      var reqBtn = document.createElement("button");
      reqBtn.type = "button";
      reqBtn.className = "btn-ghost";
      reqBtn.textContent = "Pedir para transmitir";
      reqBtn.addEventListener("click", function () {
        sendData({ type: "request-broadcast", identity: myIdentity, name: myName });
        reqBtn.disabled = true;
        reqBtn.textContent = "Pedido enviado...";
        showToast("Pedido enviado ao admin.");
      });
      actionsDiv.appendChild(reqBtn);
    }

    var leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.className = "btn-danger";
    leaveBtn.textContent = "Sair";
    leaveBtn.addEventListener("click", leaveRoom);
    actionsDiv.appendChild(leaveBtn);
  }

  function startSharing() {
    room.localParticipant
      .setScreenShareEnabled(true, { audio: true })
      .then(function () {
        isSharing = true;
        renderActions();
      })
      .catch(function (err) {
        if (err && err.name !== "NotAllowedError") {
          showToast("Não foi possível compartilhar a tela.");
        }
      });
  }

  function stopSharing() {
    room.localParticipant.setScreenShareEnabled(false).then(function () {
      isSharing = false;
      renderActions();
    });
  }

  function tileId(identity) {
    return "video-tile-" + identity.replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function renderVideoGrid() {
    var tiles = [];

    function collect(participant, isLocal) {
      participant.trackPublications.forEach(function (pub) {
        if (pub.source !== Track.Source.ScreenShare) return;
        if (!pub.track) return;
        tiles.push({ participant: participant, publication: pub, isLocal: isLocal });
      });
    }

    collect(room.localParticipant, true);
    room.remoteParticipants.forEach(function (p) {
      collect(p, false);
    });

    videoGrid.innerHTML = "";
    emptyMsg.hidden = tiles.length !== 0;

    tiles.forEach(function (t) {
      var tile = document.createElement("div");
      tile.className = "video-tile";
      tile.id = tileId(t.participant.identity);

      var video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = t.isLocal;
      t.publication.track.attach(video);
      tile.appendChild(video);

      var label = document.createElement("span");
      label.className = "video-label";
      label.textContent = (t.participant.name || t.participant.identity) + (t.isLocal ? " (você)" : "");
      tile.appendChild(label);

      if (isAdmin && !t.isLocal) {
        var stopBtn = document.createElement("button");
        stopBtn.type = "button";
        stopBtn.className = "btn-danger video-stop";
        stopBtn.textContent = "Encerrar";
        stopBtn.addEventListener("click", function () {
          setParticipantPublish(t.participant.identity, false).then(function () {
            sendData({ type: "broadcast-revoked", identity: t.participant.identity });
          });
        });
        tile.appendChild(stopBtn);
      }

      videoGrid.appendChild(tile);
    });
  }

  function leaveRoom() {
    if (room) room.disconnect();
    roomDiv.hidden = true;
    joinCard.hidden = false;
    videoGrid.innerHTML = "";
    pendingRequests = {};
    isSharing = false;
    canPublish = false;
    room = null;
  }
})();
