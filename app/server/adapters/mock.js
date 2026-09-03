const BaseAdapter = require('./baseAdapter');
const names = ['ViewerBR', 'MapMaker', 'PlayerOne', 'AnaLive', 'GamerSP'];
const texts = ['Boa noite!', 'Salve King!', 'Bora jogar?', 'Cheguei na live 👋', 'Muito bom esse projeto!'];
class MockAdapter extends BaseAdapter {
  constructor(platform) { super(platform); }
  async connect(channel) {
    await super.connect(channel);
    this.emit('status', { ...this.status(), live: true, detail: 'Modo demonstração' });
    this.timer = setInterval(() => {
      const i = Math.floor(Math.random()*names.length);
      this.emit('message', { platform:this.platform, channel, username:names[i], displayName:names[i], message:texts[Math.floor(Math.random()*texts.length)], timestamp:Date.now() });
    }, 3500);
  }
  async disconnect(){ clearInterval(this.timer); await super.disconnect(); }
}
module.exports = MockAdapter;
