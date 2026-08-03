# Contrataê v11.3.24

Prioridade: recuperar aparência das páginas públicas e manter notificação funcionando.

- Removeu as regras v11.3.23 que compactavam o carrossel do rodapé.
- Padronizou categorias dinâmicas com o mesmo visual das páginas principais: título, chamada de parceiros, card centralizado, ordem Contatar/Ver Perfil e hover do botão.
- Ajustou o rodapé partial para usar o mesmo padrão das páginas principais, incluindo banners por posicao=2 e fallback Ponto Forte.
- Corrigiu a leitura de contatos pendentes usando RPC primeiro, pois o SELECT direto podia voltar vazio por RLS mesmo com o lead gravado.
- Mantém SQL v11.3.23, sem necessidade de novo SQL se ele já foi rodado.
- Removeu arquivos PROMPT_MANUS*.txt do pacote.
