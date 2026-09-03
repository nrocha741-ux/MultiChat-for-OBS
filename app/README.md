# MultiChat for OBS v1.0.0 Stable

Aplicação interna do pacote portátil MultiChat for OBS. Para uso normal, execute `MultiChat_START.cmd` na pasta principal.

## Core preservado
- Twitch: leitura pública sem login.
- YouTube: leitura pública por `@handle`, sem API Key.
- Kick: leitura pública em modo navegador.
- TikTok: leitura pública de LIVE por `@usuário`.
- Modo text-first: emotes são ignorados e o texto restante é preservado.

## Desenvolvimento/diagnóstico
O launcher portátil prepara o Node.js e executa esta aplicação automaticamente. Para diagnóstico, use `MultiChat_DEBUG.cmd` na raiz do pacote.
