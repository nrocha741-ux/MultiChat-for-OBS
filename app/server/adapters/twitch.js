const WebSocket = require('ws');
const BaseAdapter = require('./baseAdapter');

function parseTags(raw = '') {
  const tags = {};
  for (const entry of raw.split(';')) {
    const i = entry.indexOf('=');
    if (i === -1) continue;
    const key = entry.slice(0, i);
    const value = entry.slice(i + 1)
      .replace(/\\s/g, ' ')
      .replace(/\\:/g, ';')
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
    tags[key] = value;
  }
  return tags;
}

const TWITCH_ALLOWED_BADGES = new Set([
  'broadcaster',
  'moderator',
  'subscriber',
  'vip',
  'founder',
  'premium',
  'staff',
  'partner',
  'verified',
  'artist',
  'bits'
]);

function parseBadges(value = '') {
  if (!value) return [];
  // A Twitch pode enviar IDs técnicos ou badges específicos do canal que não
  // fazem sentido como texto no MultiChat. Mantemos apenas badges conhecidos
  // e úteis para leitura rápida; todo identificador desconhecido é descartado.
  return value
    .split(',')
    .map(x => x.split('/')[0].trim().toLowerCase())
    .filter(id => id && TWITCH_ALLOWED_BADGES.has(id));
}

function parseEmotes(value = '', text = '') {
  if (!value) return [];
  const chars = Array.from(text);
  const out = [];
  for (const group of value.split('/')) {
    const [id, ranges = ''] = group.split(':');
    if (!id || !ranges) continue;
    for (const range of ranges.split(',')) {
      const [startRaw, endRaw] = range.split('-');
      const start = Number(startRaw), end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) continue;
      const name = chars.slice(start, end + 1).join('');
      out.push({ id, start, end, name });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function makeAnonymousNick() {
  // Formato tradicional aceito pelo chat público da Twitch para clientes somente leitura.
  return `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
}

class TwitchAdapter extends BaseAdapter {
  constructor() {
    super('twitch');
    this.ws = null;
    this.manualClose = false;
    this.nick = '';
    this.reconnectTimer = null;
  }

  async connect(channel) {
    const cleanChannel = String(channel || '').trim().replace(/^@/, '').toLowerCase();
    if (!cleanChannel) throw new Error('Informe o nome do canal Twitch.');

    await this.disconnect();
    this.channel = cleanChannel;
    this.manualClose = false;
    this.nick = makeAnonymousNick();

    await this.#openSocket(cleanChannel);
  }

  async #openSocket(cleanChannel) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      this.ws = ws;

      const finishError = (err) => {
        if (settled) return;
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      const timeout = setTimeout(() => {
        finishError(new Error('Tempo esgotado ao entrar no chat público da Twitch.'));
        try { ws.close(); } catch {}
      }, 12000);

      ws.on('open', () => {
        // Conexão anônima, somente leitura: nenhuma conta/token do usuário é enviado.
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
        ws.send('PASS SCHMOOPIIE\r\n');
        ws.send(`NICK ${this.nick}\r\n`);
        ws.send(`JOIN #${cleanChannel}\r\n`);
      });

      ws.on('message', data => {
        const payload = data.toString('utf8');
        for (const lineRaw of payload.split(/\r?\n/)) {
          const line = lineRaw.trim();
          if (!line) continue;

          if (line.startsWith('PING ')) {
            if (ws.readyState === WebSocket.OPEN) ws.send(`PONG ${line.slice(5)}\r\n`);
            continue;
          }

          if (/Login authentication failed|Improperly formatted auth/i.test(line)) {
            clearTimeout(timeout);
            finishError(new Error('A Twitch recusou a conexão anônima de leitura.'));
            try { ws.close(); } catch {}
            continue;
          }

          if (line.includes(` 366 ${this.nick} #${cleanChannel} `) ||
              line.includes(`ROOMSTATE #${cleanChannel}`) ||
              line.includes(`:${this.nick}!${this.nick}@${this.nick}.tmi.twitch.tv JOIN #${cleanChannel}`)) {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              this.connected = true;
              this.emit('status', {
                ...this.status(),
                live: null,
                readOnly: true,
                anonymous: true,
                detail: `Chat público #${cleanChannel} conectado sem login (somente leitura).`
              });
              resolve();
            }
          }

          const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.*)$/);
          if (!match) continue;
          const [, tagRaw, login, room, text] = match;
          if (room.toLowerCase() !== cleanChannel) continue;
          const tags = parseTags(tagRaw);

          this.emit('message', {
            id: tags.id,
            platform: 'twitch',
            channel: cleanChannel,
            username: login,
            displayName: tags['display-name'] || login,
            message: text,
            timestamp: Number(tags['tmi-sent-ts']) || Date.now(),
            badges: parseBadges(tags.badges),
            emotes: parseEmotes(tags.emotes, text),
            metadata: {
              color: tags.color || '',
              subscriber: tags.subscriber === '1',
              mod: tags.mod === '1',
              firstMessage: tags['first-msg'] === '1',
              anonymousReader: true
            }
          });
        }
      });

      ws.on('error', err => {
        clearTimeout(timeout);
        if (!settled) finishError(err);
        else this.emit('error', new Error(`Twitch IRC: ${err.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        const wasConnected = this.connected;
        this.connected = false;
        if (!settled) finishError(new Error('A Twitch encerrou a conexão antes de entrar no chat.'));
        if (!this.manualClose && wasConnected) {
          this.emit('status', {
            ...this.status(), connected: false,
            detail: 'Conexão com a Twitch caiu. Reconectando automaticamente…'
          });
          this.reconnectTimer = setTimeout(() => {
            this.#openSocket(cleanChannel).catch(err => {
              this.emit('error', new Error(`Falha ao reconectar Twitch: ${err.message}`));
            });
          }, 3000);
        }
      });
    });
  }

  async disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN && this.channel) ws.send(`PART #${this.channel}\r\n`);
        ws.close();
      } catch {}
    }
    await super.disconnect();
  }
}

module.exports = TwitchAdapter;
