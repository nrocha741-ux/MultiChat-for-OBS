# Histórico do projeto

O **MultiChat for OBS** nasceu com um objetivo simples: reunir chats públicos de diferentes plataformas em um único Dock do OBS Studio, sem obrigar o streamer a autenticar as próprias contas para a leitura pública suportada.

## Linha de evolução

1. **MVP e arquitetura local (0.1.x–0.5.x)** — interface web local, Socket.IO, adaptadores e primeiros conectores reais.
2. **Kick e estabilização (0.6.x)** — descoberta do bloqueio Cloudflare no acesso Node-side, adoção do transporte de compatibilidade pelo navegador e correções de ownership/failover.
3. **TikTok (0.7.x)** — leitura pública de LIVE por @usuário e parser robusto para comentários.
4. **Apresentação do chat (0.8.x)** — testes com emotes/badges e adoção do pipeline text-first; YouTube sem API Key do usuário.
5. **Distribuição portátil (0.9.x)** — Node.js portátil, launcher CMD, download/extração automáticos, encerramento controlado, persistência das configurações e preparação para distribuição.
6. **1.0.0 Stable** — promoção da RC1 aprovada, congelamento dos conectores e documentação pública.

Para mudanças por versão, consulte `CHANGELOG.md`.
