# Contrataê v11.3.16 — correção das páginas públicas de profissional

Base: v11.3.15 fluxo profissional integrado.

## Correções feitas

1. Páginas públicas de categoria
   - Corrigido o problema do card aparecer sem nome do profissional.
   - Corrigido o problema do card usar mascote mesmo quando o usuário tem foto/avatar.
   - Corrigido o link "Ver Perfil", que podia montar `/perfil/undefined` e cair em 404.
   - O botão "Contatar" agora usa o WhatsApp do profissional aprovado quando existir, com fallback para o WhatsApp da plataforma.

2. Busca de profissionais por categoria
   - A rota `/categoria/:slug` agora normaliza os dados vindos do Supabase antes de enviar para as views antigas.
   - A categoria principal continua funcionando por `professionals.category_id`.
   - Também foi preparado suporte para profissões adicionais oficiais via `professional_categories`, importante para planos com 2 ou 3 profissões.

3. Página pública do perfil
   - A rota `/perfil/:id` agora trabalha com `user_id` normalizado.
   - Quando o profissional não existe, mostra a tela 404 visual da plataforma em vez de resposta crua.
   - O WhatsApp do perfil público agora usa link com DDI do Brasil quando o número está salvo sem `55`.

## SQL

Não exige SQL novo.

## Pontos ainda para próxima etapa

- Melhorar o desenho completo da página pública do perfil profissional.
- Melhorar a leitura do horário quando houver atendimento 24h junto com horário normal.
- Criar moderação/aprovação de novas profissões sugeridas para transformar sugestões em categorias oficiais.
- Melhorar hover/estado visual dos botões de imagens no portfólio.
