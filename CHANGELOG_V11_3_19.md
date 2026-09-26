# Contrataê v11.3.19 — Correção visual do Perfil Público

## Base
- v11.3.18 (`contrataeapp_v11_3_18_perfil_publico_corrigido.zip`)

## Correções feitas

### 1. Perfil público carregando sem CSS do cabeçalho
- Corrigido `views/perfil-profissional.ejs` para carregar também `/css/index.css`.
- Motivo: o perfil público usava o mesmo partial `partials/header`, porém não carregava a folha de estilo que estiliza `.airbnb-header`, `.header-grid`, `.search-pill`, `.categories-nav`, `.login-pill`, menu desktop/mobile e rodapé.
- Resultado esperado: `/perfil/:id` deve abrir dentro do layout normal da plataforma, sem logo gigante/menu quebrado.

### 2. Galeria do perfil público com tamanho mais controlado
- Ajustei a grade da galeria do perfil para altura um pouco menor e largura máxima controlada.
- Mantive a foto principal com `object-fit: cover`, mas com posição mais segura para retratos.
- Resultado esperado: o perfil público continua bonito, mas sem parecer uma página “estourada”.

## Arquivos alterados
- `views/perfil-profissional.ejs`

## Banco de dados
- Não precisa rodar SQL novo.

## Testes locais feitos
- `node -c server.js` passou sem erro de sintaxe.

## Testes recomendados após deploy
1. Abrir `/categoria/eletricistas` e clicar em **Ver Perfil**.
2. Abrir `/categoria/pedreiros` e clicar em **Ver Perfil**.
3. Abrir diretamente `/perfil/39ae9006-b64a-4aa3-a533-9bc2e2227e4e`.
4. Abrir diretamente `/perfil/23e345a4-6415-41af-b2a2-dca3b2cd4205`.
5. Conferir se cabeçalho, busca, menu, VLibras, rodapé e perfil público ficam com o visual normal da plataforma.
