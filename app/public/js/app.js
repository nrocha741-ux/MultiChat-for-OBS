const socket = io();
const chat = document.querySelector('#chat');
const statuses = document.querySelector('#statuses');
let filter = 'all';
let lastConfig = null;
let userDisconnected = false;
const visibleMessageIds = new Set();
let kickBrowser = null;
const $ = id => document.getElementById(id);

let saved = {};
try { saved = JSON.parse(localStorage.getItem('multichat-config-v2') || localStorage.getItem('multichat-config') || '{}'); } catch { saved = {}; }
for (const p of ['twitch', 'youtube', 'kick', 'tiktok']) {
  if (saved[p]?.channel && $(`${p}Channel`)) $(`${p}Channel`).value = saved[p].channel;
  if (typeof saved[p]?.enabled === 'boolean' && $(`${p}Enabled`)) $(`${p}Enabled`).checked = saved[p].enabled;
}
if (typeof saved.demo === 'boolean') $('demoMode').checked = saved.demo;

function statusText(s) {
  if (s.error) return 'erro';
  if (s.connected) return 'conectado';
  if (s.pending) return 'aguardando';
  return 'offline';
}

function renderPlatformStatus(s) {
  let el = document.querySelector(`[data-status="${s.platform}"]`);
  if (!el) {
    el = document.createElement('span');
    el.className = 'status';
    el.dataset.status = s.platform;
    statuses.appendChild(el);
  }
  el.classList.toggle('error', Boolean(s.error));
  el.classList.toggle('connected', Boolean(s.connected));
  el.textContent = `${s.platform}: ${statusText(s)}${s.detail ? ' — ' + s.detail : ''}`;
}

function showCapabilities(capabilities = {}) {
  const twitch = capabilities.twitch;
  if (twitch?.ready && twitch?.anonymous) renderPlatformStatus({ platform: 'twitch', connected: false, detail: 'pronto para leitura pública sem login' });
  const youtube = capabilities.youtube;
  if (youtube && !youtube.ready) renderPlatformStatus({ platform: 'youtube', connected: false, detail: `backend não configurado (${(youtube.needs || []).join(', ') || 'configuração necessária'})` });
  const kick = capabilities.kick;
  if (kick?.ready) renderPlatformStatus({ platform: 'kick', connected: false, detail: 'beta — modo navegador para contornar o bloqueio HTTP 403 do Node.js' });
  const tiktok = capabilities.tiktok;
  if (tiktok?.ready) renderPlatformStatus({ platform: 'tiktok', connected: false, detail: 'beta — leitura pública de LIVE sem login' });
}

function buildConfig() {
  return {
    demo: $('demoMode').checked,
    platforms: ['twitch', 'youtube', 'kick', 'tiktok'].map(platform => ({
      platform,
      enabled: $(`${platform}Enabled`).checked,
      channel: $(`${platform}Channel`).value.trim()
    }))
  };
}

function saveConfig(config) {
  const data = { demo: config.demo };
  for (const item of config.platforms) data[item.platform] = item;
  localStorage.setItem('multichat-config-v2', JSON.stringify(data));
}

function connectChats({ preserveStatuses = false } = {}) {
  const config = buildConfig();
  lastConfig = config;
  userDisconnected = false;
  saveConfig(config);
  if (!preserveStatuses) statuses.innerHTML = '';
  socket.emit('chat:connect', config);
}

socket.on('connect', () => {
  $('serverStatus').textContent = '● servidor conectado';
  $('serverStatus').classList.add('online');
  if (lastConfig && !userDisconnected) {
    statuses.innerHTML = '';
    socket.emit('chat:connect', lastConfig);
  }
});

socket.on('disconnect', () => {
  $('serverStatus').textContent = '● servidor desconectado — reconectando…';
  $('serverStatus').classList.remove('online');
});

socket.on('server:ready', info => {
  const version = document.getElementById('version');
  if (version) version.textContent = `v${info.version}`;
  showCapabilities(info.capabilities);
});

socket.on('kick:browser-connect', ({ channel }) => {
  if (kickBrowser) { kickBrowser.disconnect(); kickBrowser = null; }
  if (!window.MultiChatKickBrowser) {
    socket.emit('kick:browser-status', { channel, error: true, detail: 'Módulo de compatibilidade Kick não foi carregado.' });
    return;
  }
  kickBrowser = new window.MultiChatKickBrowser(channel);
  kickBrowser.on('status', info => socket.emit('kick:browser-status', { channel, pending: true, detail: info.detail || 'Preparando chat da Kick…' }));
  kickBrowser.on('connected', ({ chatroomId }) => socket.emit('kick:browser-status', {
    channel, connected: true,
    detail: `Chat público kick.com/${channel} conectado pelo navegador sem login (somente leitura). Chatroom ${chatroomId}.`
  }));
  kickBrowser.on('message', raw => socket.emit('kick:browser-message', { channel, chatroomId: kickBrowser?.chatroomId || null, message: raw }));
  kickBrowser.on('error', info => socket.emit('kick:browser-status', {
    channel, error: true,
    detail: `${info.message} Se aparecer CORS/Cloudflare, faremos o próximo fallback sem exigir login.`
  }));
  kickBrowser.connect();
});

socket.on('platform:status', renderPlatformStatus);

socket.on('chat:message', m => {
  const uniqueId = `${m.platform}:${m.id}`;
  if (visibleMessageIds.has(uniqueId)) return;
  visibleMessageIds.add(uniqueId);
  if (visibleMessageIds.size > 1000) visibleMessageIds.delete(visibleMessageIds.values().next().value);

  document.querySelector('.empty')?.remove();
  const el = document.createElement('article');
  el.className = 'msg';
  el.dataset.platform = m.platform;
  el.innerHTML = '<div class="msg-head"><span class="avatar-slot"></span><span class="dot"></span><span class="name"></span><span class="badges"></span><span class="platform-name"></span><span class="time"></span></div><div class="text"></div>';
  const avatar = window.MultiChatVisuals?.makeAvatar(m);
  if (avatar) el.querySelector('.avatar-slot').appendChild(avatar); else el.querySelector('.avatar-slot').remove();
  el.querySelector('.name').textContent = m.displayName;
  const badgeBox = el.querySelector('.badges');
  window.MultiChatVisuals?.appendBadges(badgeBox, m.badges || []);
  el.querySelector('.platform-name').textContent = m.platform.toUpperCase();
  el.querySelector('.time').textContent = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const textBox = el.querySelector('.text');
  window.MultiChatVisuals?.appendText(textBox, m.message);
  chat.appendChild(el);
  while (chat.children.length > 150) chat.firstChild.remove();
  el.style.display = filter === 'all' || filter === m.platform ? '' : 'none';
  el.scrollIntoView({ block: 'end' });
});

$('connectBtn').onclick = () => connectChats();
$('disconnectBtn').onclick = () => {
  userDisconnected = true;
  if (kickBrowser) { kickBrowser.disconnect(); kickBrowser = null; }
  socket.emit('chat:disconnect');
};
socket.on('chat:disconnected', () => { statuses.innerHTML = '<span class="status">chats desconectados</span>'; });
$('clearBtn').onclick = () => {
  chat.innerHTML = '<div class="empty">Chat limpo. Aguardando novas mensagens…</div>';
  visibleMessageIds.clear();
};

document.querySelectorAll('.platform input, #demoMode').forEach(el => {
  el.addEventListener('change', () => saveConfig(buildConfig()));
  if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.addEventListener('input', () => saveConfig(buildConfig()));
});

document.querySelectorAll('#filters button').forEach(b => b.onclick = () => {
  filter = b.dataset.filter;
  document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.msg').forEach(x => { x.style.display = filter === 'all' || x.dataset.platform === filter ? '' : 'none'; });
});


const copyDockBtn = $('copyDockBtn');
if (copyDockBtn) copyDockBtn.onclick = async () => {
  const url = $('dockUrl')?.textContent?.trim() || `${location.origin}/dock`;
  const feedback = $('copyFeedback');
  try {
    await navigator.clipboard.writeText(url);
    if (feedback) feedback.textContent = 'Endereço copiado.';
  } catch {
    const area = document.createElement('textarea');
    area.value = url; area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    document.execCommand('copy'); area.remove();
    if (feedback) feedback.textContent = 'Endereço copiado.';
  }
  setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2200);
};

window.addEventListener('beforeunload', () => { if (kickBrowser) kickBrowser.disconnect(); });
