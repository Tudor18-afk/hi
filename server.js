const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8765);
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const COLORS = [0xc23b3b, 0x7a3dff, 0x2ea44f, 0x2e8bc9, 0xd4a017, 0xe056a0, 0x8892a0, 0x4dd4c0];
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ABC[(Math.random() * ABC.length) | 0];
  return s;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

const rooms = new Map();

function roster(room) {
  return [...room.clients.values()].map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    host: c.id === room.hostId,
  }));
}

function getRoom(ws) {
  if (!ws.roomCode) return null;
  return rooms.get(ws.roomCode) || null;
}

function leave(ws) {
  const room = getRoom(ws);
  if (!room) return;
  room.clients.delete(ws);
  const id = ws.playerId;
  ws.roomCode = null;
  if (room.clients.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === id) {
    const next = room.clients.values().next().value;
    room.hostId = next.id;
    send(next.ws, { t: "host", host: true });
  }
  broadcast(room, { t: "leave", id, players: roster(room) });
}

function broadcast(room, msg, except) {
  const raw = JSON.stringify(msg);
  for (const c of room.clients.values()) {
    if (c.ws !== except && c.ws.readyState === 1) c.ws.send(raw);
  }
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.playerId = null;
  ws.roomCode = null;

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "create") {
      leave(ws);
      let code = makeCode();
      while (rooms.has(code)) code = makeCode();
      const name = String(msg.name || "PLAYER").slice(0, 12).toUpperCase() || "PLAYER";
      const bots = Math.max(0, Math.min(8, Number(msg.bots) || 0));
      const room = {
        code,
        bots,
        nextId: 1,
        hostId: 0,
        clients: new Map(),
      };
      const id = room.nextId++;
      room.hostId = id;
      const color = COLORS[0];
      room.clients.set(ws, { ws, id, name, color });
      ws.playerId = id;
      ws.roomCode = code;
      rooms.set(code, room);
      send(ws, { t: "ok", id, code, host: true, bots, players: roster(room) });
      return;
    }

    if (msg.t === "join") {
      const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const room = rooms.get(code);
      if (!room) {
        send(ws, { t: "err", m: "Room not found. Create one or check the code." });
        return;
      }
      if (room.clients.size >= 8) {
        send(ws, { t: "err", m: "Room is full." });
        return;
      }
      leave(ws);
      const name = String(msg.name || "PLAYER").slice(0, 12).toUpperCase() || "PLAYER";
      const id = room.nextId++;
      const color = COLORS[(id - 1) % COLORS.length];
      room.clients.set(ws, { ws, id, name, color });
      ws.playerId = id;
      ws.roomCode = code;
      send(ws, { t: "ok", id, code, host: id === room.hostId, bots: room.bots, players: roster(room) });
      broadcast(room, { t: "join", id, name, color, players: roster(room) }, ws);
      return;
    }

    const room = getRoom(ws);
    if (!room) return;
    const from = room.clients.get(ws);
    if (!from) return;

    if (msg.t === "st" || msg.t === "shot" || msg.t === "hit" || msg.t === "bst" || msg.t === "reset") {
      msg.id = from.id;
      broadcast(room, msg, ws);
    }
  });

  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXUS ARENA at http://localhost:${PORT}`);
});
