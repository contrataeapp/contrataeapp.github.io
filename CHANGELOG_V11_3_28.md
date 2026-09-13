# v11.3.28 - Correção de publicação e aprovação de profissões

Correções focadas nos testes da v11.3.27:

- Corrigido o caso em que "Publicar alterações" em Minhas Profissões podia retornar "Profissão não encontrada".
- Reforçada a criação/leitura do perfil por profissão para funcionar mesmo quando a categoria aprovada veio de solicitação antiga.
- Corrigida aprovação de profissões no ADM quando a tabela `professional_categories` referencia `professionals.id` em vez de `users.id`.
- Ajustada leitura de categorias adicionais no ADM, no perfil público e nas páginas de categoria para aceitar os dois formatos de relacionamento sem quebrar dados antigos.
- Mantido o layout público aprovado, sem compactar carrossel e sem mexer na aparência principal.

Não exige SQL novo se o SQL da v11.3.26 já foi rodado.
