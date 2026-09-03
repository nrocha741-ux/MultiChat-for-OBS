const BaseAdapter = require('./baseAdapter');

class YouTubeAdapter extends BaseAdapter {
  constructor({ retryIntervalMs = 60000 } = {}) {
    super('youtube');
    this.retryIntervalMs = Math.max(30000, Number(retryIntervalMs) || 60000);
    this.liveChat = null;
    this.retryTimer = null;
    this.stopped = true;
    this.handle = '';
    this.generation = 0;
  }

  cleanHandle(value) {
    const clean = String(value || '').trim()
      .replace(/^https?:\/\/(www\.)?youtube\.com\//i, '')
      .replace(/^@?/, '@')
      .replace(/\/(live|streams|videos).*$/i, '')
      .trim();
    return clean === '@' ? '' : clean;
  }

  stopCurrent(reason = 'reiniciando') {
    const chat = this.liveChat;
    this.liveChat = null;
    if (chat) {
      try { chat.stop(reason); } catch {}
      try { chat.removeAllListeners(); } catch {}
    }
  }

  scheduleRetry(detail, delay = this.retryIntervalMs) {
    if (this.stopped) return;
    this.connected = false;
    clearTimeout(this.retryTimer);
    const seconds = Math.round(delay / 1000);
    this.emit('status', {
      ...this.status(), pending: true, live: false,
      detail: `${detail} Nova verificação automática em ${seconds}s.`
    });
    const generation = this.generation;
    this.retryTimer = setTimeout(() => {
      if (!this.stopped && generation === this.generation) this.tryStart();
    }, delay);
  }

  textOnly(messageParts) {
    // Intencionalmente lemos apenas trechos de texto. Emojis/emotes que o
    // YouTube fornece como objetos de imagem ficam fora do MultiChat.
    return (Array.isArray(messageParts) ? messageParts : [])
      .map(part => (part && typeof part.text === 'string') ? part.text : '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  badgeList(item) {
    return [
      item?.isOwner ? 'owner' : null,
      item?.isModerator ? 'moderator' : null,
      item?.isMembership ? 'member' : null,
      item?.isVerified ? 'verified' : null
    ].filter(Boolean);
  }

  async tryStart() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopCurrent('nova tentativa');

    const generation = this.generation;
    let mod;
    try {
      mod = require('youtube-chat-next');
    } catch (err) {
      this.emit('error', new Error(`Módulo youtube-chat-next não instalado. Execute npm install. (${err.message})`));
      this.scheduleRetry('YouTube sem API Key: módulo de leitura indisponível.', 120000);
      return;
    }

    const LiveChat = mod?.LiveChat;
    if (!LiveChat) {
      this.emit('error', new Error('youtube-chat-next não expôs LiveChat.'));
      this.scheduleRetry('YouTube sem API Key: conector incompatível.', 120000);
      return;
    }

    const liveChat = new LiveChat({ handle: this.handle }, 1000, 'live');
    this.liveChat = liveChat;
    let started = false;
    let retryScheduled = false;

    const stillCurrent = () => !this.stopped && generation === this.generation && this.liveChat === liveChat;
    const retryOnce = (detail, delay = this.retryIntervalMs) => {
      if (!stillCurrent() || retryScheduled) return;
      retryScheduled = true;
      this.stopCurrent('aguardando nova live');
      this.scheduleRetry(detail, delay);
    };

    liveChat.on('start', liveId => {
      if (!stillCurrent()) return;
      started = true;
      this.connected = true;
      this.emit('status', {
        ...this.status(), connected: true, pending: false, live: true,
        videoId: String(liveId || ''),
        detail: `LIVE ${this.handle} encontrada automaticamente sem API Key (somente leitura).`
      });
    });

    liveChat.on('chat', item => {
      if (!stillCurrent()) return;
      const message = this.textOnly(item?.message);
      if (!message) return; // mensagem somente com emote/emoji: não exibir

      const author = item?.author || {};
      const avatar = typeof author?.thumbnail?.url === 'string' ? author.thumbnail.url : '';
      const timestamp = item?.timestamp instanceof Date
        ? item.timestamp.getTime()
        : Date.parse(item?.timestamp) || Date.now();

      this.emit('message', {
        id: item?.id,
        platform: 'youtube',
        channel: this.handle,
        username: author?.channelId || author?.name || 'unknown',
        displayName: author?.name || author?.channelId || 'YouTube user',
        avatar,
        message,
        timestamp,
        badges: this.badgeList(item),
        emotes: [],
        metadata: { anonymousReader: true, unofficialWebReader: true }
      });
    });

    liveChat.on('end', reason => {
      if (!stillCurrent()) return;
      retryOnce(`${this.handle}: a LIVE terminou ou o chat deixou de estar disponível${reason ? ` (${reason})` : ''}.`, 15000);
    });

    liveChat.on('error', err => {
      if (!stillCurrent()) return;
      const name = String(err?.name || '');
      const message = String(err?.message || err || 'erro desconhecido');
      if (/NotLive/i.test(name) || /not live|offline|no live/i.test(message)) {
        retryOnce(`${this.handle}: sem LIVE pública ativa.`);
      } else if (/RateLimit/i.test(name) || /429|rate.?limit/i.test(message)) {
        retryOnce(`YouTube limitou temporariamente a leitura pública de ${this.handle}.`, 120000);
      } else {
        this.emit('error', new Error(`YouTube sem API Key: ${message}`));
        retryOnce(`Falha temporária ao ler ${this.handle}.`, 120000);
      }
    });

    try {
      const ok = await liveChat.start();
      if (!stillCurrent()) return;
      if (!ok && !started && !retryScheduled) retryOnce(`${this.handle}: sem LIVE pública ativa.`);
    } catch (err) {
      if (!stillCurrent()) return;
      const message = String(err?.message || err || 'erro desconhecido');
      if (/not live|offline|no live/i.test(message)) retryOnce(`${this.handle}: sem LIVE pública ativa.`);
      else {
        this.emit('error', new Error(`YouTube sem API Key: ${message}`));
        retryOnce(`Falha temporária ao ler ${this.handle}.`, 120000);
      }
    }
  }

  async connect(channel) {
    await this.disconnect();
    const handle = this.cleanHandle(channel);
    if (!handle) throw new Error('Informe o @handle do canal YouTube.');
    this.handle = handle;
    this.channel = handle;
    this.stopped = false;
    this.generation += 1;
    this.emit('status', {
      ...this.status(), connected: false, pending: true,
      detail: `Procurando LIVE pública de ${handle} sem login e sem API Key…`
    });
    await this.tryStart();
  }

  async disconnect() {
    this.stopped = true;
    this.generation += 1;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopCurrent('desconectado pelo MultiChat');
    this.handle = '';
    await super.disconnect();
  }
}

module.exports = YouTubeAdapter;
