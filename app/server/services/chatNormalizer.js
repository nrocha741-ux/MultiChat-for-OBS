function stripTwitchEmotes(text, emotes = []) {
  const chars = Array.from(String(text || ''));
  const remove = new Set();
  for (const emote of Array.isArray(emotes) ? emotes : []) {
    const start = Number(emote?.start);
    const end = Number(emote?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) continue;
    for (let i = start; i <= end && i < chars.length; i += 1) remove.add(i);
  }
  return chars.filter((_, index) => !remove.has(index)).join('');
}

function stripTwitchAction(text = '') {
  const value = String(text || '');
  // Mensagens /me da Twitch chegam via IRC como CTCP ACTION:
  // \x01ACTION texto\x01. Removemos apenas o envelope técnico,
  // preservando integralmente o texto escrito pelo usuário.
  const match = value.match(/^\x01ACTION(?:\s+)?([\s\S]*?)\x01$/i);
  return match ? match[1] : value;
}

function textOnlyMessage(input) {
  const platform = String(input?.platform || '').toLowerCase();
  let text = String(input?.message || '');

  if (platform === 'twitch') {
    text = stripTwitchEmotes(text, input?.emotes);
    text = stripTwitchAction(text);
  }
  if (platform === 'kick') text = text.replace(/\[emote:\d+:[^\]]+\]/gi, ' ');
  if (platform === 'tiktok') {
    // TikTok text-first: removemos tokens textuais de reação e também emojis Unicode.
    // Se a mensagem contiver somente emoji/emote, o servidor a descartará depois
    // porque normalizeMessage retornará message vazio.
    text = text.replace(/\[[a-z][a-z0-9_-]{0,31}\]/gi, ' ');
    text = text
      // flags (pares de Regional Indicator)
      .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' ')
      // keycap emoji: 0-9, #, * + variation selector opcional + combining keycap
      .replace(/[0-9#*]\uFE0F?\u20E3/gu, ' ')
      // pictogramas/emoji, incluindo sequências ZWJ; removemos também VS16/modificadores.
      .replace(/\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu, ' ')
      .replace(/[\uFE0F\u200D]/gu, ' ')
      .replace(/\p{Emoji_Modifier}/gu, ' ');
  }

  return text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
}

function normalizeMessage(input) {
  return {
    id: input.id || `${input.platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platform: input.platform,
    channel: input.channel || '',
    username: input.username || 'unknown',
    displayName: input.displayName || input.username || 'Unknown',
    message: textOnlyMessage(input),
    avatar: input.avatar || '',
    badges: Array.isArray(input.badges) ? input.badges : [],
    // v0.8.1: MultiChat é text-first. Emotes não são encaminhados ao frontend.
    emotes: [],
    timestamp: input.timestamp || Date.now(),
    metadata: input.metadata || {}
  };
}

module.exports = { normalizeMessage, textOnlyMessage, stripTwitchAction };
