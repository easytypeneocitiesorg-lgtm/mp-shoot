// Simple WebSocket game server for Vercel
import { WebSocketServer } from "ws";

const rooms = {}; // { code: { players: { id: ws }, state: { id: {...} } } }

function makeCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function handler(req, res) {
  if (res.socket.server.wss) {
    res.end("WebSocket server already running");
    return;
  }

  const wss = new WebSocketServer({ noServer: true });
  res.socket.server.wss = wss;

  res.socket.server.on("upgrade", (req2, socket, head) => {
    if (req2.url.startsWith("/api/server")) {
      wss.handleUpgrade(req2, socket, head, (ws) => {
        wss.emit("connection", ws, req2);
      });
    }
  });

  wss.on("connection", (ws) => {
    let roomCode = null;
    let playerId = Math.random().toString(36).slice(2, 9);

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.t === "create") {
          roomCode = makeCode();
          rooms[roomCode] = { players: {}, state: {} };
          rooms[roomCode].players[playerId] = ws;
          ws.send(JSON.stringify({ t: "room", code: roomCode, id: playerId }));
        } 
        else if (data.t === "join") {
          roomCode = data.code;
          if (!rooms[roomCode]) {
            ws.send(JSON.stringify({ t: "error", msg: "Room not found" }));
            return;
          }
          rooms[roomCode].players[playerId] = ws;
          ws.send(JSON.stringify({ t: "joined", code: roomCode, id: playerId }));
          broadcast(roomCode, { t: "join", id: playerId }, playerId);
        } 
        else if (data.t === "state" && roomCode) {
          const r = rooms[roomCode];
          if (!r) return;
          r.state[playerId] = data;
          broadcast(roomCode, { ...data, id: playerId }, playerId);
        } 
        else if (data.t === "bullet" && roomCode) {
          broadcast(roomCode, { t: "bullet", id: playerId, b: data.b }, playerId);
        }
      } catch {}
    });

    ws.on("close", () => {
      if (roomCode && rooms[roomCode]) {
        delete rooms[roomCode].players[playerId];
        delete rooms[roomCode].state[playerId];
        broadcast(roomCode, { t: "leave", id: playerId }, playerId);
        if (Object.keys(rooms[roomCode].players).length === 0) delete rooms[roomCode];
      }
    });
  });

  res.end("WebSocket server started");
}

function broadcast(roomCode, msg, exceptId) {
  const r = rooms[roomCode];
  if (!r) return;
  for (const [id, ws] of Object.entries(r.players)) {
    if (id === exceptId) continue;
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
}
