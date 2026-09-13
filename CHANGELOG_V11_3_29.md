# Contrataê v11.3.29

Correção focada nos testes da v11.3.28, sem redesenhar o layout público aprovado.

## Corrigido

- Corrigido erro das páginas públicas de categoria que tentavam consultar `professionals.id` em uma base onde `professionals` usa `user_id`.
- Corrigido link de preview/visualização para profissões vindas de “Outros”, evitando abrir `categoria=outros` quando a profissão aprovada é “analista de sistemas”.
- Mantém a profissão selecionada depois de publicar alteração ou adicionar imagem.
- Adicionada correção SQL para RLS/permissões das tabelas de profissões, portfólio por profissão e métricas.
- No ADM, aprovação/recusa de profissão agora usa modal próprio da plataforma, em vez de `confirm`/`prompt`/`alert` do navegador.
- Melhorado upload de imagem por profissão: miniaturas vazias agora abrem o seletor, o botão ficou mais claro, e ao escolher arquivo aparece prévia antes de adicionar.
- Adicionado construtor rápido de disponibilidade com dias e horários, mantendo o campo de texto livre.
- Aba “Meu Portfólio” agora indica que a edição correta é por profissão e oferece seletor para abrir o portfólio específico.

## Observações

- Esta versão exige rodar o SQL `sql_scripts/09_fix_profession_profiles_rls.sql` se o botão “Publicar alterações” estiver dando erro de RLS.
- Não houve `DROP` ou `DELETE` destrutivo no SQL.
