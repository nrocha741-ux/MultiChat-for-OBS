// MultiChat Kick browser compatibility transport.
// Reads public Kick chat without asking the streamer for credentials.
// The channel lookup is deliberately performed in the browser because Kick's
// Cloudflare protection may reject the same public request from Node.js.
(() => {
  const PUSHER_KEY = '32cbd69e4b950bf97679';
  const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;
  const API_URLS = [
    'https://kick.com/api/v1/channels/{slug}',
    'https://kick.com/api/v2/channels/{slug}'
  ];

  function cleanSlug(v = '') {
    return String(v).trim().replace(/^https?:\/\/(?:www\.)?kick\.com\//i, '').split(/[/?#]/)[0].replace(/^@/, '').toLowerCase();
  }

  class MultiChatKickBrowser {
    constructor(channel) {
      this.channel = cleanSlug(channel);
      this.ws = null;
      this.chatroomId = null;
      this.destroyed = false;
      this.pingTimer = null;
      this.reconnectTimer = null;
      this.listeners = new Map();
      this.lastActivityAt = 0;
      this.watchdogTimer = null;
    }
    on(name, fn) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(fn); return this;
    }
    emit(name, data) { for (const fn of this.listeners.get(name) || []) { try { fn(data); } catch {} } }
    async connect() {
      this.destroyed = false;
      this.closeSocket();
      this.emit('status', { state: 'resolving', detail: `Localizando chat público kick.com/${this.channel} pelo navegador…` });
      try {
        this.chatroomId = await this.resolveChatroomId();
        this.openSocket();
      } catch (err) {
        this.emit('error', { message: err?.message || String(err) });
      }
    }
    async resolveChatroomId() {
      if (!this.channel) throw new Error('Informe o nome do canal Kick.');
      let corsOrNetwork = false;
      for (const template of API_URLS) {
        const url = template.replace('{slug}', encodeURIComponent(this.channel));
        try {
          const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          const id = Number(data?.chatroom?.id || data?.id);
          if (Number.isFinite(id) && id > 0) return id;
        } catch { corsOrNetwork = true; }
      }
      if (corsOrNetwork) throw new Error('O navegador não conseguiu consultar o chatroom da Kick (CORS/Cloudflare).');
      throw new Error('A Kick respondeu, mas não retornou um chatroom.id válido para este canal.');
    }
    openSocket() {
      if (this.destroyed || !this.chatroomId) return;
      this.closeSocket();
      const ws = new WebSocket(PUSHER_URL);
      this.ws = ws;
      ws.onopen = () => {
        this.lastActivityAt = Date.now();
        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
        }, 30000);
        this.watchdogTimer = setInterval(() => {
          if (ws !== this.ws || ws.readyState !== WebSocket.OPEN) return;
          if (Date.now() - this.lastActivityAt > 90000) {
            this.emit('status', { state: 'reconnecting', detail: 'Kick ficou sem atividade no gateway. Renovando a conexão…' });
            try { ws.close(); } catch {}
          }
        }, 15000);
      };
      ws.onmessage = e => {
        this.lastActivityAt = Date.now();
        let frame;
        try { frame = JSON.parse(e.data); } catch { return; }
        if (frame.event === 'pusher:connection_established') {
          ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${this.chatroomId}.v2` } }));
          return;
        }
        if (frame.event === 'pusher_internal:subscription_succeeded' || frame.event === 'pusher:subscription_succeeded') {
          this.emit('connected', { chatroomId: this.chatroomId }); return;
        }
        if (frame.event === 'pusher:ping') {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
          return;
        }
        if (frame.event !== 'App\\Events\\ChatMessageEvent' && frame.event !== 'App\\Events\\ChatMessageSentEvent') return;
        let raw = frame.data;
        if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return; } }
        this.emit('message', raw || {});
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.clearPing();
        if (!this.destroyed) {
          this.emit('status', { state: 'reconnecting', detail: 'Conexão Kick caiu. Reconectando pelo navegador…' });
          this.reconnectTimer = setTimeout(() => this.openSocket(), 3000);
        }
      };
    }
    clearPing() {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    }
    closeSocket() {
      this.clearPing();
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
      const ws = this.ws; this.ws = null;
      if (ws) { ws.onclose = null; ws.onerror = null; try { ws.close(); } catch {} }
    }
    disconnect() { this.destroyed = true; this.closeSocket(); }
  }

  window.MultiChatKickBrowser = MultiChatKickBrowser;
})();
