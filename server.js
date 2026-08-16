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
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

const COLORS = [0xc23b3b, 0x7a3dff, 0x2ea44f, 0x2e8bc9, 0xd4a017, 0xe056a0, 0x8892a0, 0x4dd4c0];
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HAIR = new Set(["bald", "buzz", "short", "long", "mohawk", "pony"]);
const HELMS = new Set(["none", "cap", "tactical"]);
const BEARDS = new Set(["none", "stubble", "full"]);

function sanitizeLook(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const num = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n >>> 0 : fb;
  };
  return {
    skin: num(o.skin, 0xe8c4a0),
    hair: HAIR.has(o.hair) ? o.hair : "short",
    hairColor: num(o.hairColor, 0x2a1a12),
    shirt: num(o.shirt, 0x3d4a38),
    pants: num(o.pants, 0x2a2e32),
    vest: !(o.vest === false || o.vest === 0),
    helmet: HELMS.has(o.helmet) ? o.helmet : "none",
    beard: BEARDS.has(o.beard) ? o.beard : "none",
    iris: num(o.iris, 0x3a5a38),
  };
}

function makeCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ABC[(Math.random() * ABC.length) | 0];
  return s;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

const rooms = new Map();
const watchers = new Set();
const MAX_PLAYERS = 8;

function roster(room) {
  return [...room.clients.values()].map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    host: c.id === room.hostId,
    look: c.look || null,
  }));
}

function getRoom(ws) {
  if (!ws.roomCode) return null;
  return rooms.get(ws.roomCode) || null;
}

function lobbyInfo(room) {
  let host = "HOST";
  for (const c of room.clients.values()) {
    if (c.id === room.hostId) {
      host = c.name;
      break;
    }
  }
  return {
    code: room.code,
    host,
    players: room.clients.size,
    max: MAX_PLAYERS,
    bots: room.bots,
    map: room.map,
    diff: room.diff,
    mode: room.mode || "ffa",
  };
}

function lobbyPayload() {
  return { t: "lobbies", rooms: [...rooms.values()].map(lobbyInfo) };
}

function sendLobbies(ws) {
  send(ws, lobbyPayload());
}

function broadcastLobbies() {
  const raw = JSON.stringify(lobbyPayload());
  for (const ws of watchers) {
    if (ws.readyState === 1 && !ws.roomCode) ws.send(raw);
  }
}

function watch(ws) {
  if (ws.roomCode) return;
  watchers.add(ws);
  sendLobbies(ws);
}

function unwatch(ws) {
  watchers.delete(ws);
}

function leave(ws) {
  const room = getRoom(ws);
  if (!room) return;
  room.clients.delete(ws);
  const id = ws.playerId;
  ws.roomCode = null;
  if (room.clients.size === 0) {
    rooms.delete(room.code);
    broadcastLobbies();
    return;
  }
  if (room.hostId === id) {
    const next = room.clients.values().next().value;
    room.hostId = next.id;
    send(next.ws, { t: "host", host: true });
  }
  broadcast(room, { t: "leave", id, players: roster(room) });
  broadcastLobbies();
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

const wss = new WebSocketServer({ server, perMessageDeflate: false });

wss.on("connection", (ws) => {
  try {
    if (ws._socket && ws._socket.setNoDelay) ws._socket.setNoDelay(true);
  } catch (_) {}
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

    if (msg.t === "watch" || msg.t === "lobbies") {
      watch(ws);
      return;
    }

    if (msg.t === "unwatch") {
      unwatch(ws);
      return;
    }

    if (msg.t === "quit") {
      leave(ws);
      return;
    }

    if (msg.t === "create") {
      leave(ws);
      unwatch(ws);
      let code = makeCode();
      while (rooms.has(code)) code = makeCode();
      const name = String(msg.name || "PLAYER").slice(0, 12).toUpperCase() || "PLAYER";
      const bots = Math.max(0, Math.min(8, Number(msg.bots) || 0));
      const map = ["warehouse", "yard", "labs"].includes(msg.map) ? msg.map : "warehouse";
      const diff = ["easy", "normal", "hard", "insane"].includes(msg.diff) ? msg.diff : "normal";
      const mode = ["ffa", "tdm", "ctf", "koth"].includes(msg.mode) ? msg.mode : "ffa";
      const room = {
        code,
        bots,
        map,
        diff,
        mode,
        nextId: 1,
        hostId: 0,
        clients: new Map(),
      };
      const id = room.nextId++;
      room.hostId = id;
      const color = COLORS[0];
      const look = sanitizeLook(msg.look);
      room.clients.set(ws, { ws, id, name, color, look });
      ws.playerId = id;
      ws.roomCode = code;
      rooms.set(code, room);
      send(ws, { t: "ok", id, code, host: true, bots, map, diff, mode, players: roster(room) });
      broadcastLobbies();
      return;
    }

    if (msg.t === "join") {
      const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const room = rooms.get(code);
      if (!room) {
        send(ws, { t: "err", m: "Room not found. Create one or check the code." });
        return;
      }
      if (room.clients.size >= MAX_PLAYERS) {
        send(ws, { t: "err", m: "Room is full." });
        return;
      }
      leave(ws);
      unwatch(ws);
      const name = String(msg.name || "PLAYER").slice(0, 12).toUpperCase() || "PLAYER";
      const id = room.nextId++;
      const color = COLORS[(id - 1) % COLORS.length];
      const look = sanitizeLook(msg.look);
      room.clients.set(ws, { ws, id, name, color, look });
      ws.playerId = id;
      ws.roomCode = code;
      send(ws, { t: "ok", id, code, host: id === room.hostId, bots: room.bots, map: room.map, diff: room.diff, mode: room.mode || "ffa", players: roster(room) });
      broadcast(room, { t: "join", id, name, color, look, players: roster(room) }, ws);
      broadcastLobbies();
      return;
    }

    const room = getRoom(ws);
    if (!room) return;
    const from = room.clients.get(ws);
    if (!from) return;

    if (msg.t === "look") {
      from.look = sanitizeLook(msg.look);
      broadcast(room, { t: "look", id: from.id, name: from.name, color: from.color, look: from.look }, ws);
      return;
    }

    if (msg.t === "st" || msg.t === "shot" || msg.t === "hit" || msg.t === "bst" || msg.t === "reset" || msg.t === "shop" || msg.t === "next" || msg.t === "obj") {
      msg.id = from.id;
      if (msg.look) {
        from.look = sanitizeLook(msg.look);
        msg.look = from.look;
      }
      if (msg.t === "bst" && Array.isArray(msg.bots)) {
        for (const b of msg.bots) {
          if (b && b.look) b.look = sanitizeLook(b.look);
        }
      }
      broadcast(room, msg, ws);
    }
  });

  ws.on("close", () => {
    unwatch(ws);
    leave(ws);
  });
  ws.on("error", () => {
    unwatch(ws);
    leave(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXUS ARENA at http://localhost:${PORT}`);
});
