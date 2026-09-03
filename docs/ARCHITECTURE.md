# Arquitetura

## Visão geral
- Backend local: Node.js + Express + Socket.IO.
- Interface: páginas web servidas localmente.
- Dock principal: `/dock`.
- Overlay: `/overlay`.
- Health check: `/health`.
- Porta padrão: `8787`.

## Plataformas
- **Twitch:** adaptador server-side para leitura pública.
- **YouTube:** leitura pública por @handle sem API Key do usuário na versão estável.
- **Kick:** transporte de compatibilidade executado no navegador e encaminhado ao backend local.
- **TikTok:** adaptador server-side baseado em conexão pública de LIVE.

## Normalização
Mensagens de plataformas diferentes são convertidas para um formato comum antes de serem apresentadas pela interface. O pipeline atual é text-first: texto é priorizado; emotes isolados podem ser descartados e badges desconhecidos não são exibidos como identificadores técnicos.

## Persistência
Os canais selecionados são salvos localmente no contexto do navegador/OBS. O projeto não exige uma conta central do MultiChat.
