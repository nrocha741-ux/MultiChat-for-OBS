const socket = io();
const chat = document.querySelector('#chat');
const seen = new Set();

socket.on('chat:message', m => {
  const key = `${m.platform}:${m.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 500) seen.delete(seen.values().next().value);

  const el = document.createElement('article');
  el.className = 'msg';
  el.dataset.platform = m.platform;

  const head = document.createElement('div');
  head.className = 'head';
  const avatar = window.MultiChatVisuals?.makeAvatar(m);
  if (avatar) head.appendChild(avatar);
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = m.displayName;
  head.appendChild(name);
  const badges = document.createElement('span');
  badges.className = 'badges';
  window.MultiChatVisuals?.appendBadges(badges, m.badges || []);
  head.appendChild(badges);
  const p = document.createElement('span');
  p.className = 'platform';
  p.textContent = m.platform.toUpperCase();
  head.appendChild(p);

  const text = document.createElement('div');
  text.className = 'text';
  window.MultiChatVisuals?.appendText(text, m.message);
  el.append(head, text);
  chat.appendChild(el);
  while (chat.children.length > 8) chat.firstChild.remove();
  setTimeout(() => el.remove(), 30000);
});
