# v11.3.25 - Dashboard profissional por profissão

## Objetivo
Preparar o Contrataê para profissionais com até 3 profissões, mantendo o layout público aprovado e começando a separar descrição, disponibilidade, preço e portfólio por profissão.

## Alterações principais
- Nova aba **Minhas Profissões** na dashboard do profissional.
- Cada profissão oficial do plano pode ter:
  - descrição própria;
  - especialidades próprias;
  - disponibilidade própria;
  - preço/taxa própria;
  - até 10 imagens próprias de portfólio.
- Profissões sugeridas/em análise aparecem bloqueadas na dashboard e continuam escondidas para visitantes.
- O perfil público passa a entender o contexto da categoria clicada:
  - `/perfil/:id?categoria=pedreiros` mostra conteúdo/portfólio de pedreiro;
  - `/perfil/:id?categoria=eletricistas` mostra conteúdo/portfólio de eletricista;
  - se não houver portfólio específico, usa o portfólio geral como fallback.
- Os cards das páginas de categoria agora apontam para o perfil com `?categoria=...`.
- A página de perfil público recebeu propagandas laterais no mesmo padrão das páginas públicas.
- Texto do modal de login/contratação ajustado para não expor a lógica interna.

## SQL necessário
Rode antes de testar a nova aba:

`sql_scripts/07_profession_profiles_portfolios.sql`

## Observações honestas
- Esta versão prepara a base funcional da dashboard profissional.
- Ela não remove o portfólio geral antigo; mantém como fallback para não perder imagens existentes.
- A notificação de contatos/serviços pendentes depende da tabela/funções de `contact_leads` já configuradas e da sessão do profissional atualizando a dashboard.
