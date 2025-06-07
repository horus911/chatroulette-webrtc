const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Serveur WebSocket démarré sur le port 8080');

let clients = [];
let waitingClient = null;

function send(ws, data) {
  ws.send(JSON.stringify(data));
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).substr(2, 9);
  clients.push(ws);
  console.log('Client connecté', ws.id);

  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch(e) {
      console.error('Message JSON invalide:', message);
      return;
    }

    if(data.type === 'join') {
      if(waitingClient && waitingClient !== ws) {
        // On crée la paire
        send(ws, { type: 'match', partnerId: waitingClient.id, initiator: true });
        send(waitingClient, { type: 'match', partnerId: ws.id, initiator: false });
        waitingClient.partner = ws;
        ws.partner = waitingClient;
        waitingClient = null;
      } else {
        waitingClient = ws;
        send(ws, { type: 'waiting' });
      }
    }
    else if(data.type === 'signal' && ws.partner) {
      // Transmet le signal à l’autre partenaire
      send(ws.partner, { type: 'signal', signal: data.signal, from: ws.id });
    }
    else if(data.type === 'next') {
      // Le client veut changer de partenaire
      if(ws.partner) {
        send(ws.partner, { type: 'partner_left' });
        ws.partner.partner = null;
        ws.partner = null;
      }
      if(waitingClient === ws) {
        waitingClient = null;
      }
      send(ws, { type: 'waiting' });
      // Remet le client en attente pour une nouvelle paire
      if(waitingClient) {
        send(waitingClient, { type: 'match', partnerId: ws.id, initiator: false });
        send(ws, { type: 'match', partnerId: waitingClient.id, initiator: true });
        waitingClient.partner = ws;
        ws.partner = waitingClient;
        waitingClient = null;
      } else {
        waitingClient = ws;
      }
    }
  });

  ws.on('close', () => {
    console.log('Client déconnecté', ws.id);
    clients = clients.filter(c => c !== ws);
    if(ws.partner) {
      send(ws.partner, { type: 'partner_left' });
      ws.partner.partner = null;
      ws.partner = null;
    }
    if(waitingClient === ws) {
      waitingClient = null;
    }
  });
});
