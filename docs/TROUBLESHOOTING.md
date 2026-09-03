# Solução de problemas

## O Dock não abre
- Mantenha `MultiChat_START.cmd` aberto.
- Verifique se o launcher exibiu `MULTICHAT CONECTADO`.
- Abra `http://127.0.0.1:8787/dock`.
- Use `MultiChat_DEBUG.cmd` para diagnóstico.

## Porta 8787 ocupada
Feche outra instância do MultiChat. Se necessário, use `MultiChat_STOP.cmd` e inicie novamente.

## Primeira execução demora
É esperado: o launcher pode precisar baixar/extrair o Node.js portátil e instalar as dependências npm.

## Uma plataforma parou de conectar
Serviços públicos das plataformas podem mudar. Teste primeiro outra LIVE/canal público válido e consulte os logs de diagnóstico antes de alterar o conector.

## OBS
Adicione `http://127.0.0.1:8787/dock` em **Painéis → Docks de navegador personalizados**.
