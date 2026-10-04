(() => {
  const badgeLabels = {
    broadcaster: 'Streamer', owner: 'Streamer', moderator: 'Mod', mod: 'Mod',
    subscriber: 'Sub', member: 'Membro', vip: 'VIP', founder: 'Fundador',
    premium: 'Prime', staff: 'Staff', partner: 'Parceiro', verified: 'Verificado',
    sub_gifter: 'Sub Gifter', artist: 'Artista', bits: 'Bits'
  };

  function primitive(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  function firstPrimitive(...values) {
    for (const value of values) {
      const out = primitive(value).trim();
      if (out && out !== '[object Object]') return out;
    }
    return '';
  }

  function cleanBadge(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const id = raw.trim().toLowerCase();
      if (!id || id === '[object object]') return null;
      return { id, label: badgeLabels[id] || '', image: '' };
    }
    if (typeof raw !== 'object') return null;

    const id = firstPrimitive(raw.id, raw.setId, raw.type, raw.name).toLowerCase();
    const label = firstPrimitive(raw.label, raw.text, raw.title, raw.name, badgeLabels[id]);
    const image = firstPrimitive(raw.image, raw.imageUrl, raw.url);
    if (!id && !label && !image) return null;
    return { id, label, image, count: primitive(raw.count) };
  }

  function appendBadges(container, badges = []) {
    const seen = new Set();
    for (const raw of Array.isArray(badges) ? badges : []) {
      const badge = cleanBadge(raw);
      if (!badge) continue;
      const key = `${badge.id}|${badge.label}|${badge.image}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (badge.image) {
        const img = document.createElement('img');
        img.className = 'badge-img';
        img.src = badge.image;
        img.alt = badge.label || '';
        img.title = badge.label || badge.id || '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => img.remove();
        container.appendChild(img);
        continue;
      }

      const label = badge.label || badgeLabels[badge.id];
      if (!label || label === '[object Object]') continue;
      const span = document.createElement('span');
      span.className = `badge badge-${badge.id || 'generic'}`;
      span.title = label;
      span.textContent = badge.count ? `${label} ${badge.count}` : label;
      container.appendChild(span);
    }
  }

function appendText(container, message = "", emotes = []) {
  const text = String(message || "");
  const list = Array.isArray(emotes) ? emotes : [];

  if (!list.length) {
    container.appendChild(document.createTextNode(text));
    return;
  }

  const sorted = [...list].sort((a, b) => Number(a.start) - Number(b.start));
  let position = 0;

  for (const emote of sorted) {
    const start = Number(emote.start);
    const end = Number(emote.end);

    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < position || start < 0 || end < start || end >= text.length) continue;

    if (start > position) {
      container.appendChild(document.createTextNode(text.slice(position, start)));
    }

    const img = document.createElement("img");
    img.className = "chat-emote";
    img.alt = emote.name || "";
    img.title = emote.name || "";

    if (emote.platform === "kick") {
      img.src = "https:" + "//files.kick.com/emotes/" + encodeURIComponent(emote.id) + "/fullsize";
    } else {
      img.src = "https:" + "//static-cdn.jtvnw.net/emoticons/v2/" + encodeURIComponent(emote.id) + "/default/dark/2.0";
    }

    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";

    img.onerror = () => {
      img.replaceWith(document.createTextNode(text.slice(start, end + 1)));
    };

    container.appendChild(img);
    position = end + 1;
  }

  if (position < text.length) {
    container.appendChild(document.createTextNode(text.slice(position)));
  }
}
  function makeAvatar(message) {
    if (!message?.avatar || typeof message.avatar !== 'string') return null;
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = message.avatar;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    return img;
  }

  window.MultiChatVisuals = { appendBadges, appendText, makeAvatar };
})();
