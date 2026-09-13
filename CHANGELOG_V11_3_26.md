# v11.3.26 — Dashboard profissional sem quebrar layout público

Foco: melhorar a dashboard do profissional mantendo o layout público já aprovado.

## Melhorias
- Adicionada troca de foto de perfil diretamente em “Meu Perfil”.
- A foto principal é separada dos portfólios por profissão.
- “Minhas Profissões” agora usa seletor/lista suspensa para editar uma profissão por vez.
- Cada profissão mostra descrição, especialidades, disponibilidade, taxa/preço, portfólio próprio e botão “Visualizar como cliente”.
- Botão principal da profissão agora é “Publicar alterações”.
- Adicionadas métricas simples por profissão: visitas nos últimos 30 dias, cliques em contratar, contatos gerados e possível retorno.
- Mantido fallback do portfólio geral antigo quando a profissão ainda não tem fotos próprias.
- O perfil público continua carregando o conteúdo da profissão clicada.

## Banco
- Novo SQL opcional: `sql_scripts/08_profile_events_metrics.sql`.
- Ele cria `professional_profile_events` para medir visitas e cliques por profissão.
- O SQL é não destrutivo: não apaga dados e não altera tabelas antigas.

## Segurança de alteração
- Não houve redesenho do layout público.
- Não houve DROP/DELETE.
- A dashboard continua tolerante caso o SQL de métricas ainda não tenha sido rodado.
