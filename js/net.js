export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.code = null;
    this.host = false;
    this.bots = 0;
    this.players = [];
    this.connected = false;
    this.status = "offline";
    this.onEvent = null;
  }

  url() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const host = location.host || "127.0.0.1:8765";
    return `${proto}//${host}`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return this.ws;
    this.status = "connecting";
    this.connected = false;
    try {
      if (this.ws) {
        try {
          this.ws.onopen = null;
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close();
        } catch (_) {}
      }
      this.ws = new WebSocket(this.url());
    } catch (err) {
      this.ws = null;
      this.status = "offline";
      this._emit({ t: "err", m: "Could not open a network connection." });
      return null;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.status = "online";
      this._emit({ t: "open" });
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.status = "offline";
      if (!this.id) this._emit({ t: "err", m: "Could not reach the game server. Hard-refresh this page." });
      else this._emit({ t: "close" });
    };
    this.ws.onerror = () => {
      this.status = "offline";
    };
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === "ok") {
        this.id = msg.id;
        this.code = msg.code;
        this.host = !!msg.host;
        this.bots = msg.bots || 0;
        this.map = msg.map || "warehouse";
        this.diff = msg.diff || "normal";
        this.mode = msg.mode || "ffa";
        this.players = msg.players || [];
      }
      if (msg.t === "host") this.host = !!msg.host;
      if (msg.t === "join" || msg.t === "leave") this.players = msg.players || this.players;
      this._emit(msg);
    };
    return this.ws;
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  create(name, bots, map, diff, mode, look, team) {
    this._whenOpen(() => this.send({ t: "create", name, bots, map, diff, mode, look, team }));
  }

  join(code, name, look, team) {
    this._whenOpen(() => this.send({ t: "join", code, name, look, team }));
  }

  leaveRoom() {
    if (this.id || this.code) this.send({ t: "quit" });
    this.id = null;
    this.code = null;
    this.host = false;
    this.players = [];
  }

  watch() {
    this._whenOpen(() => this.send({ t: "watch" }));
  }

  unwatch() {
    this.send({ t: "unwatch" });
  }

  listLobbies() {
    this._whenOpen(() => this.send({ t: "lobbies" }));
  }

  _whenOpen(fn) {
    const ws = this.connect();
    if (!ws) {
      this._emit({ t: "err", m: "Could not open a network connection." });
      return;
    }
    if (ws.readyState === 1) {
      fn();
      return;
    }
    const onOpen = () => {
      ws.removeEventListener("error", onErr);
      fn();
    };
    const onErr = () => {
      ws.removeEventListener("open", onOpen);
      this._emit({ t: "err", m: "Online connection failed. Hard-refresh and try again." });
    };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onErr, { once: true });
  }

  _emit(msg) {
    if (this.onEvent) this.onEvent(msg);
  }
}
