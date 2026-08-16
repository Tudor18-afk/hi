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
    return `${proto}//${location.host}`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.status = "connecting";
    try {
      this.ws = new WebSocket(this.url());
    } catch (err) {
      this.status = "offline";
      this._emit({ t: "err", m: "Could not open a network connection." });
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.status = "online";
      this._emit({ t: "open" });
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.status = "offline";
      if (!this.id) this._emit({ t: "err", m: "No game server found. Run npm start and open that address to play online." });
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
        this.players = msg.players || [];
      }
      if (msg.t === "host") this.host = !!msg.host;
      if (msg.t === "join" || msg.t === "leave") this.players = msg.players || this.players;
      this._emit(msg);
    };
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  create(name, bots, map, diff) {
    this.connect();
    const go = () => this.send({ t: "create", name, bots, map, diff });
    if (this.ws && this.ws.readyState === 1) go();
    else this.ws.addEventListener("open", go, { once: true });
  }

  join(code, name) {
    this.connect();
    const go = () => this.send({ t: "join", code, name });
    if (this.ws && this.ws.readyState === 1) go();
    else this.ws.addEventListener("open", go, { once: true });
  }

  _emit(msg) {
    if (this.onEvent) this.onEvent(msg);
  }
}
