# v11.3.18 - Perfil público carregando dentro da plataforma

Correções:

1. `/perfil/:id`
   - Corrigido erro interno causado por funções de plano/profissões que estavam em outro arquivo e não existiam no `server.js`.
   - A página pública agora consegue montar os dados do profissional, plano, profissões oficiais e profissões sugeridas.
   - Incluído `userId` no render para evitar erro EJS quando visitante não está logado.

2. Página 404
   - Mantido fallback visual dentro da plataforma.
   - Se um perfil realmente não existir ou não estiver ativo, cai na página visual do Contrataê, não em texto cru.

3. Cards públicos
   - Ajuste extra de `object-position` para fotos verticais nos cards de categoria.
   - Evita cortar apenas topo/cabelo quando a imagem vem de avatar vertical.

SQL:
- Não exige SQL novo.
