# Contrataê v11.3.22 - ajustes pós-teste de perfil, categorias e contato

## Corrigido
- Modal de contato dos cards de categoria agora usa o mesmo texto seguro do perfil, sem mencionar exposição pública do número.
- Aviso antes do WhatsApp agora informa que o profissional também será notificado pela plataforma.
- SQL `06_contact_leads.sql` ajustado para resolver bloqueio de RLS em `contact_leads`.
- Páginas dinâmicas de novas categorias carregam CSS/header padrão para não quebrar layout.
- Página de categoria dinâmica não duplica plural no título.
- Cards públicos passam a redimensionar a imagem sem cortar rosto.
- Tags/profissões ainda em análise deixam de aparecer no perfil público como se fossem oficiais.
- Página "Outros" ganhou botão de lupa clicável e busca mais tolerante, incluindo categorias principais.
- Página vazia usa cabeçalho/tema escuro consistente.

## Observação
- Para a notificação de contatos funcionar, rode novamente o SQL `sql_scripts/06_contact_leads.sql` ou pelo menos o trecho de correção de RLS informado na resposta.
