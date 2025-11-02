// Put this at /api/signaling.js
// Very small in-memory signaling store. Not persistent across cold starts.
// Handles POST to add messages and GET to fetch messages for a room.
// CORS enabled.

const rooms = {}; // { roomCode: [ {id,from,to,type,data,ts} ] }

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  // Simple CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await (new Promise((r) => {
        let d = "";
        req.on("data", c => d += c);
        req.on("end", () => r(JSON.parse(d || "{}")));
      }));
      const { room, from = "anon", to = null, type = "msg", data } = body;
      if (!room) return res.status(400).json({ error: "room required" });

      if (!rooms[room]) rooms[room] = [];
      const msg = { id: randomId(), room, from, to, type, data, ts: Date.now() };
      rooms[room].push(msg);

      // Keep message array size reasonable
      if (rooms[room].length > 200) rooms[room].shift();

      return res.json({ ok: true, id: msg.id });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "GET") {
    const room = req.query.room || req.url.split("?")[1] && new URLSearchParams(req.url.split("?")[1]).get("room");
    if (!room) return res.status(400).json({ error: "room required" });

    const since = parseInt(req.query.since || "0", 10) || 0;
    const to = req.query.to || null;
    const from = req.query.from || null;

    const list = (rooms[room] || []).filter(m => m.ts > since &&
      (to ? (m.to === to || m.to === null) : true) &&
      (from ? (m.from === from || m.to === from) : true)
    );
    return res.json({ ok: true, messages: list, now: Date.now() });
  }

  res.status(405).json({ error: "Method not allowed" });
}
