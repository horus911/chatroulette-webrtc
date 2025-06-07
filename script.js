const ws = new WebSocket("wss://expensive-hurricane-crow.glitch.me");
let localStream;
let peerConnection;
let remoteVideoEl;
let isMuted = false;

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

ws.onopen = () => {
  showToast("Connecté au serveur WebSocket", "success");
};

ws.onmessage = async ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.type === "offer") {
    createPeer();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", answer }));
  } else if (msg.type === "answer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
  } else if (msg.type === "ice") {
    peerConnection?.addIceCandidate(new RTCIceCandidate(msg.ice));
  } else if (msg.type === "count") {
    document.getElementById("userCount").textContent = "Utilisateurs connectés : " + msg.count;
  }
};

function showToast(text, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.className = `show ${type}`;
  setTimeout(() => (toast.className = ""), 3000);
}

async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const video = document.createElement("video");
    video.srcObject = localStream;
    video.muted = true;
    video.autoplay = true;
    video.classList.add("self");
    const div = document.createElement("div");
    div.className = "video self";
    div.appendChild(video);
    document.getElementById("videos").appendChild(div);
  } catch (e) {
    showToast("Erreur caméra/micro : " + e.message, "error");
  }
}

function createPeer() {
  peerConnection = new RTCPeerConnection(config);
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      ws.send(JSON.stringify({ type: "ice", ice: candidate }));
    }
  };
  peerConnection.ontrack = ({ streams: [stream] }) => {
    if (!remoteVideoEl) {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      const div = document.createElement("div");
      div.className = "video remote";
      div.appendChild(video);
      document.getElementById("videos").appendChild(div);
      remoteVideoEl = video;
    }
  };
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
}

async function callNext() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    if (remoteVideoEl?.parentNode) remoteVideoEl.parentNode.remove();
    remoteVideoEl = null;
  }

  createPeer();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", offer }));
}

document.getElementById("nextBtn").onclick = callNext;
document.getElementById("muteBtn").onclick = () => {
  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;
  document.getElementById("muteBtn").textContent = isMuted ? "🔈 Unmute" : "🔇 Mute";
};
document.getElementById("stopBtn").onclick = () => {
  if (peerConnection) peerConnection.close();
  peerConnection = null;
  if (remoteVideoEl?.parentNode) remoteVideoEl.parentNode.remove();
  remoteVideoEl = null;
};

initMedia();
