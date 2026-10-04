require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { normalizeMessage } = require('./services/chatNormalizer');
const YouTubeAdapter = require('./adapters/youtube');
const TwitchAdapter = require('./adapters/twitch');
const MockAdapter = require('./adapters/mock');
const TikTokAdapter = require('./adapters/tiktok');

function env(name, fallback = '') { return process.env[name] ?? fallback; }
function yes(value) { return Boolean(String(value || '').trim()); }
function cleanChannel(platform, channel = '') {
  const value = String(channel).trim();
  if (platform === 'twitch') return value.replace(/^@/, '').toLowerCase();
  if (platform === 'youtube') return value.toLowerCase();
  return value.toLowerCase();
}
function parseKickContent(rawContent = '') {
  const text = String(rawContent || '');
  const emotes = [];
  const emoteRegex = /\[emote:(\d+):([^\]]+)\]/gi;

  let content = '';
  let lastIndex = 0;
  let match;

  while ((match = emoteRegex.exec(text)) !== null) {
    content += text.slice(lastIndex, match.index);

    const start = content.length;
    const id = match[1];
    const name = match[2];

    emotes.push({
      id,
      name,
      start,
      end: start,
      platform: 'kick'
    });

    content += '\uFFFC';
    lastIndex = match.index + match[0].length;
  }

  content += text.slice(lastIndex);

  return { content, emotes };
}
const VERSION = '1.0.0';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = Number(env('PORT', '8787'));
const PORTABLE_MODE = /^(1|true|yes)$/i.test(String(env('MULTICHAT_PORTABLE', '0')));
const PORTABLE_IDLE_MS = Math.max(5000, Number(env('MULTICHAT_IDLE_SHUTDOWN_MS', '20000')) || 20000);
let portableHadClient = false;
let portableIdleTimer = null;

function schedulePortableShutdown() {
  if (!PORTABLE_MODE || !portableHadClient || io.engine.clientsCount > 0) return;
  clearTimeout(portableIdleTimer);
  portableIdleTimer = setTimeout(async () => {
    if (io.engine.clientsCount > 0) return;
    console.log('[Portable] Nenhum Dock/navegador conectado. Encerrando MultiChat.');
    for (const entry of subscriptions.values()) {
      if (entry.adapter) await entry.adapter.disconnect().catch(() => {});
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  }, PORTABLE_IDLE_MS);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function capabilities() {
  return {
    twitch: { ready: true, anonymous: true, readOnly: true, needs: [] },
    youtube: { ready: true, anonymous: true, readOnly: true, unofficialWebReader: true, needs: [] },
    kick: { ready: true, anonymous: true, readOnly: true, experimental: true, browserCompatibility: true, needs: [] },
    tiktok: { ready: true, anonymous: true, readOnly: true, experimental: true, needs: [] }
  };
}

app.get('/health', (_, res) => res.json({ ok: true, name: 'MultiChat for OBS', version: VERSION, subscriptions: subscriptions.size, capabilities: capabilities() }));
app.get('/api/capabilities', (_, res) => res.json({ version: VERSION, capabilities: capabilities() }));
app.get('/overlay', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'overlay.html')));
app.get('/dock', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

async function makeAdapter(platform, demo = false) {
  if (demo) return new MockAdapter(platform);
  if (platform === 'youtube') return new YouTubeAdapter();
  if (platform === 'twitch') return new TwitchAdapter();
  if (platform === 'tiktok') return new TikTokAdapter();
  return null;
}

// Um único adapter por plataforma/canal é compartilhado entre o navegador,
// o Dock do OBS e qualquer outro cliente local. Isso evita mensagens duplicadas
// e evita polling duplicado nas plataformas.
const subscriptions = new Map();
const socketKeys = new Map();
const recentMessages = new Map();

function subscriptionKey(platform, channel, demo) {
  return `${demo ? 'demo' : 'live'}:${platform}:${cleanChannel(platform, channel)}`;
}

function rememberMessage(message) {
  const id = `${message.platform}:${message.id}`;
  const now = Date.now();
  const seenAt = recentMessages.get(id);
  if (seenAt && now - seenAt < 10 * 60 * 1000) return false;
  recentMessages.set(id, now);
  if (recentMessages.size > 6000) {
    for (const [key, when] of recentMessages) {
      if (now - when > 10 * 60 * 1000) recentMessages.delete(key);
      if (recentMessages.size <= 4000) break;
    }
  }
  return true;
}

function emitToSubscribers(entry, event, payload) {
  for (const socketId of entry.sockets) io.to(socketId).emit(event, payload);
}

async function acquire(socket, item, demo) {
  const key = subscriptionKey(item.platform, item.channel, demo);
  let entry = subscriptions.get(key);

  if (entry) {
    entry.sockets.add(socket.id);
    socketKeys.get(socket.id).add(key);
    if (entry.lastStatus) socket.emit('platform:status', entry.lastStatus);
    // Kick has one browser transport owner. If the previous owner disappeared
    // while other local clients (e.g. OBS Dock) kept the shared subscription alive,
    // immediately promote this socket instead of leaving a false "connected" state.
    if (entry.platform === 'kick' && !entry.kickOwnerSocketId) {
      entry.kickOwnerSocketId = socket.id;
      socket.emit('kick:browser-connect', { channel: entry.channel, reason: 'owner-recovery' });
    }
    return;
  }

  // Kick usa um transporte de compatibilidade no Browser Dock. O lookup público
  // do chatroom é feito pelo Chromium/OBS para evitar o HTTP 403 que a proteção
  // Cloudflare devolveu ao Node.js no teste real. As mensagens retornam ao ChatHub
  // pelo Socket.IO e continuam passando pela deduplicação global.
  if (item.platform === 'kick' && !demo) {
    entry = {
      key, adapter: null, sockets: new Set([socket.id]), lastStatus: null,
      platform: 'kick', channel: cleanChannel('kick', item.channel),
      kickOwnerSocketId: socket.id
    };
    subscriptions.set(key, entry);
    socketKeys.get(socket.id).add(key);
    socket.emit('kick:browser-connect', { channel: entry.channel, reason: 'initial-owner' });
    return;
  }

  const adapter = await makeAdapter(item.platform, demo);
  if (!adapter) {
    socket.emit('platform:status', {
      platform: item.platform, connected: false, pending: true,
      detail: 'Conector planejado para uma próxima versão.'
    });
    return;
  }

  entry = { key, adapter, sockets: new Set([socket.id]), lastStatus: null };
  subscriptions.set(key, entry);
  socketKeys.get(socket.id).add(key);

  adapter.on('message', raw => {
    const msg = normalizeMessage(raw);
    if (!msg.message && !(Array.isArray(msg.emotes) && msg.emotes.length)) return;
    if (!rememberMessage(msg)) return;
    emitToSubscribers(entry, 'chat:message', msg);
  });
  adapter.on('status', status => {
    entry.lastStatus = status;
    emitToSubscribers(entry, 'platform:status', status);
  });
  adapter.on('error', err => {
    const status = {
      platform: item.platform, connected: false, error: true,
      detail: err.message
    };
    entry.lastStatus = status;
    emitToSubscribers(entry, 'platform:status', status);
  });

  try {
    await adapter.connect(item.channel);
  } catch (err) {
    const status = { platform: item.platform, connected: false, error: true, detail: err.message };
    entry.lastStatus = status;
    emitToSubscribers(entry, 'platform:status', status);
  }
}

async function releaseKey(socketId, key) {
  const entry = subscriptions.get(key);
  if (!entry) return;
  entry.sockets.delete(socketId);

  if (entry.platform === 'kick' && entry.kickOwnerSocketId === socketId) {
    entry.kickOwnerSocketId = null;
    // Browser/OBS clients can come and go independently. Promote another
    // subscribed socket so the upstream Kick WebSocket is never orphaned.
    const nextOwner = entry.sockets.values().next().value;
    if (nextOwner) {
      entry.kickOwnerSocketId = nextOwner;
      const takeoverStatus = {
        platform: 'kick', connected: false, pending: true,
        detail: 'Reconectando leitura pública da Kick após troca do cliente responsável…'
      };
      entry.lastStatus = takeoverStatus;
      emitToSubscribers(entry, 'platform:status', takeoverStatus);
      io.to(nextOwner).emit('kick:browser-connect', { channel: entry.channel, reason: 'owner-takeover' });
    }
  }

  if (entry.sockets.size === 0) {
    subscriptions.delete(key);
    if (entry.adapter) await entry.adapter.disconnect().catch(() => {});
  }
}

async function releaseSocket(socketId) {
  const keys = socketKeys.get(socketId);
  if (!keys) return;
  for (const key of [...keys]) await releaseKey(socketId, key);
  keys.clear();
}

io.on('connection', socket => {
  portableHadClient = true;
  clearTimeout(portableIdleTimer);
  socketKeys.set(socket.id, new Set());
  socket.emit('server:ready', { version: VERSION, capabilities: capabilities() });

  socket.on('chat:connect', async config => {
    await releaseSocket(socket.id);
    const selected = Array.isArray(config?.platforms) ? config.platforms : [];
    for (const item of selected) {
      if (!item?.enabled || !item?.channel) continue;
      await acquire(socket, item, Boolean(config.demo));
    }
  });


  socket.on('kick:browser-status', payload => {
    const channel = cleanChannel('kick', payload?.channel || '');
    const key = subscriptionKey('kick', channel, false);
    const entry = subscriptions.get(key);
    if (!entry || !entry.sockets.has(socket.id)) return;
    if (entry.kickOwnerSocketId && entry.kickOwnerSocketId !== socket.id) return;
    const status = {
      platform: 'kick',
      connected: Boolean(payload?.connected),
      pending: Boolean(payload?.pending),
      error: Boolean(payload?.error),
      detail: String(payload?.detail || '')
    };
    entry.lastStatus = status;
    emitToSubscribers(entry, 'platform:status', status);
  });

  socket.on('kick:browser-message', payload => {
    const channel = cleanChannel('kick', payload?.channel || '');
    const key = subscriptionKey('kick', channel, false);
    const entry = subscriptions.get(key);
    if (!entry || !entry.sockets.has(socket.id)) return;
    if (entry.kickOwnerSocketId && entry.kickOwnerSocketId !== socket.id) return;
    const raw = payload?.message || {};
    const sender = raw.sender || {};
    // Reutiliza exatamente a estratégia de badges da v0.6.3, que foi
    // validada em uso real: converte cada badge Kick para uma string simples.
    const badges = Array.isArray(sender.identity?.badges)
      ? sender.identity.badges
          .map(b => String(b?.type || b?.text || b?.name || '').trim().toLowerCase())
          .filter(Boolean)
      : [];
    const { content, emotes: kickEmotes } = parseKickContent(raw.content || '');
    const created = raw.created_at || raw.createdAt || Date.now();
    const parsedTime = Date.parse(created);
    const msg = normalizeMessage({
      id: raw.id || raw.message_id,
      platform: 'kick', channel,
      username: sender.slug || sender.username || `user-${sender.id || 'unknown'}`,
      displayName: sender.username || sender.slug || 'Kick user',
      avatar: sender.profile_picture || sender.profile_pic || sender.avatar || '',
      message: content,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
      badges, emotes: kickEmotes,
      metadata: { color: sender.identity?.color || '', senderId: sender.id || null, chatroomId: payload?.chatroomId || null, anonymousReader: true }
    });
    if (!msg.message && !(Array.isArray(msg.emotes) && msg.emotes.length)) return;
    if (!rememberMessage(msg)) return;
    emitToSubscribers(entry, 'chat:message', msg);
  });

  socket.on('chat:disconnect', async () => {
    await releaseSocket(socket.id);
    socket.emit('chat:disconnected');
  });

  socket.on('disconnect', async () => {
    await releaseSocket(socket.id);
    socketKeys.delete(socket.id);
    schedulePortableShutdown();
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`MultiChat for OBS v${VERSION}: http://127.0.0.1:${PORT}/dock`));
