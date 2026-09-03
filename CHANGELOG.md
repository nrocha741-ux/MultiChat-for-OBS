# Changelog — MultiChat for OBS

Todas as versões abaixo pertencem ao ciclo de desenvolvimento que levou à primeira versão estável.

## 1.0.0 Stable — 2026-09-03
- Primeira versão estável.
- Base funcional congelada a partir da v0.9.5 RC1 aprovada em testes reais.
- Twitch, YouTube, Kick e TikTok funcionando simultaneamente no Dock.
- Distribuição portátil com preparação automática do Node.js.
- Documentação preparada para publicação pública no GitHub.

## 0.9.5 RC1
- Release Candidate baseada na v0.9.4 validada.
- Versionamento unificado e documentação de distribuição revisada.
- Nenhuma alteração nos quatro conectores.

## 0.9.4 — Distribution Polish Beta
- Salvamento local das configurações/canais.
- Seção “Uso no OBS” com endereço do Dock e botão para copiar.
- Limpeza de canais pessoais pré-configurados para distribuição.

## 0.9.3 — Console Launcher Beta
- Launcher em CMD mantido visível durante o uso.
- Etapas de preparação exibidas no console.
- Progresso real para download e extração do Node.js portátil.
- Encerramento automático da instância Node.js ao fechar o launcher.

## 0.9.2 — Portable ZIP Hotfix
- Correções no tratamento/download/extração do ZIP do Node.js portátil.

## 0.9.1 — Portable Launcher Hotfix
- Correções no primeiro launcher portátil e no fluxo de inicialização.

## 0.9.0 — Portable Beta
- Início da distribuição sem exigir Node.js previamente instalado no Windows.
- Runtime Node.js portátil preparado dentro da pasta do projeto.

## 0.8.5 — TikTok Emote Filter Hotfix
- Ajustes no tratamento de mensagens/emotes do TikTok para o modo text-first.

## 0.8.4 — Twitch ACTION Hotfix
- Ajuste no tratamento de mensagens ACTION da Twitch.

## 0.8.3 — Twitch Badge Filter Hotfix
- Filtragem de identificadores técnicos de badges desconhecidos da Twitch.

## 0.8.2 — Badge Hotfix
- Normalização e filtragem de badges úteis entre plataformas.

## 0.8.1 — Text-First / YouTube No API Key
- Pipeline text-first: prioriza texto e evita poluição visual por emotes.
- YouTube passou a operar sem exigir API Key do usuário.

## 0.8.0 — Visual Emotes Beta
- Experimentos de representação visual de emotes e metadados de chat.
- A estratégia foi posteriormente simplificada pelo modo text-first.

## 0.7.1 — TikTok Chat Hotfix
- Parser TikTok reforçado para formatos modernos e legados de payload.
- Corrigidas mensagens vazias.
- Fallbacks para usuário, nome, avatar, texto, ID e timestamp.

## 0.7.0 — TikTok Beta
- Primeira integração TikTok LIVE por @usuário, sem login.
- Reconexão automática e leitura pública de comentários.

## 0.6.3 — Kick Stability Hotfix
- Correção de ownership/failover do transporte Kick no navegador.
- Watchdog para conexão Kick sem atividade.
- Base validada com Twitch + YouTube + Kick simultaneamente.

## 0.6.2 — Stabilization
- YouTube passou a procurar automaticamente uma LIVE quando o canal ainda não estava ao vivo.
- Nova tentativa periódica para reduzir necessidade de reconexão manual.

## 0.6.1 — Kick Browser Beta
- Kick movido para transporte de compatibilidade no navegador após bloqueio HTTP 403 no acesso Node-side.

## 0.6.0 — Kick Beta
- Primeira integração Kick; revelou bloqueio Cloudflare HTTP 403 no método Node-side.

## 0.5.0
- Consolidação do Twitch e YouTube reais no mesmo MultiChat.

## 0.4.0
- Evolução da integração pública da Twitch e arquitetura de adaptadores.

## 0.3.0
- Ciclo inicial de integração real das plataformas.

## 0.2.0
- Evolução do MVP, interface e comunicação local.

## 0.1.0 MVP
- Primeira estrutura funcional do MultiChat for OBS.
- Aplicação web local pensada para uso como Dock de navegador no OBS.
