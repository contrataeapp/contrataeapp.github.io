# Contrataê v11.3.31 — Dashboard profissional, portfólio e pré-visualização

## Objetivo
Fechar o fluxo principal da Área do Profissional sem redesenhar as páginas públicas já aprovadas. A versão reduz etapas escondidas, separa responsabilidades e evita que a pré-visualização contamine as métricas.

## Minhas Profissões
- Mantém descrição, especialidades, disponibilidade e preços separados por profissão.
- Remove o gerenciamento duplicado de imagens desta área; as fotos passam a ser tratadas somente em **Meu Portfólio**.
- Substitui o antigo “Montar disponibilidade rápido” por editor estruturado, sem textarea livre e sem modal “Adicionar/Substituir”.
- Horários usam intervalos de 30 minutos (08:00, 08:30, 09:00...).
- Mantém opção de atendimento 24h, com seleção dos dias efetivamente cobertos e feriados.
- O horário final só oferece opções posteriores ao horário inicial.
- Sábado, domingo e feriado podem usar o horário padrão, horário diferente ou “não atende”.
- A disponibilidade é atualizada no rascunho conforme o usuário altera os controles; não existe mais a etapa escondida de clicar em “Aplicar”.
- Taxa/preço foram separados em:
  - “Cobro taxa de visita” (sim/não + valor);
  - “Preço médio do serviço” (opcional).
- “Visualizar antes de publicar” envia o estado atual do formulário para uma prévia real, sem publicar no banco.
- Na prévia há “Voltar e editar” e “Publicar e voltar à Área Profissional”.
- O rascunho é preservado no navegador ao voltar da prévia.

## Pré-visualização e métricas
- A prévia usa o mesmo layout do perfil público, mantendo cabeçalho, carrosséis, banners laterais e responsividade.
- A prévia não chama o rastreador de visitas.
- Visitas/cliques do próprio profissional ao próprio perfil também deixam de ser contabilizados.
- A dashboard ignora eventos históricos identificados com `visitor_user_id` igual ao próprio profissional.
- Chips de outras profissões, contratação e avaliação ficam protegidos/desativados durante a prévia para evitar navegação acidental.

## Meu Portfólio
- Torna-se o único local para adicionar/remover imagens de serviço.
- O seletor de profissão troca o portfólio imediatamente; não existe mais o botão confuso “Abrir portfólio selecionado”.
- A profissão escolhida permanece na URL (`tab=portfolio&slot=X`) para sobreviver a recarregamentos.
- Espaços vazios são clicáveis para escolher imagem.
- A imagem selecionada mostra prévia e explica claramente que ainda precisa ser enviada.
- Upload mostra estado de carregamento e retorna para o mesmo portfólio/profissão.
- Remoção usa modal da própria plataforma antes de apagar a foto.
- Cada profissão exibe contador de imagens e botão “Ver perfil publicado”.
- A profissão principal recebe uma cópia segura do portfólio inicial legado quando ainda não possui portfólio específico; o portfólio legado não é apagado.
- Profissões secundárias sem fotos próprias não herdam mais fotos da profissão principal no perfil público.

## Meu Perfil
- Fica responsável por identidade global: foto principal, nome, WhatsApp, CEP, cidade e estado.
- Descrição/especialidades/disponibilidade/preços deixam de ser editados aqui para evitar dois lugares alterando o mesmo serviço.
- Upload/troca de avatar mostra feedback visual “Enviando nova foto de perfil...”.

## Consistência de dados
- Novas profissões adicionais começam com conteúdo de serviço independente, em vez de copiar automaticamente descrição/preço da profissão principal.
- Se um mini-perfil já existe e um campo foi deliberadamente apagado, ele não volta a herdar o valor global antigo.
- Perfil público usa os dados da profissão selecionada mesmo quando algum campo está vazio.
- Estimativa de retorno usa preferencialmente o preço médio; se não houver, usa a taxa de visita.

## Banco / SQL
**Não há SQL novo obrigatório nesta versão.**

A v11.3.31 usa as tabelas já introduzidas pelas versões anteriores:
- `professional_profession_profiles`
- `professional_profession_portfolio`
- `professional_profile_events`

Se a v11.3.30 já publicava alterações e fazia upload por profissão sem erro de RLS, não rode SQL adicional.

Se surgir erro explícito de RLS/permissão, utilize o script já existente:
`sql_scripts/09_fix_profession_profiles_rls.sql`

## Compatibilidade
- Mantido o layout público existente como base.
- Não altera banners, carrosséis ou estrutura geral do perfil público.
- Mantém rotas antigas de portfólio por compatibilidade, mas a nova interface usa as rotas específicas por profissão.
