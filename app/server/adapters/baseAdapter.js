const EventEmitter = require('events');

class BaseAdapter extends EventEmitter {
  constructor(platform) {
    super();
    this.platform = platform;
    this.connected = false;
    this.channel = null;
  }

  async connect(channel) {
    this.channel = channel;
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
    this.channel = null;
  }

  status() {
    return { platform: this.platform, connected: this.connected, channel: this.channel };
  }
}

module.exports = BaseAdapter;
