# v11.3.21 - Ajustes de confiança no perfil público e contato protegido

## Corrigido/refinado
- Texto do modal de login para contato sem revelar a lógica de proteção do número.
- Modal de segurança após login agora informa de forma mais natural que o profissional será notificado na plataforma.
- Galeria do perfil público no mobile agora mostra a imagem principal e miniaturas, evitando parecer que só existe uma foto.
- Seta direita do lightbox foi afastada para não competir com o botão do VLibras.
- Disponibilidade do perfil público ficou dividida em linhas mais claras, separando atendimento 24h, horário comum, sábado/domingo/feriado.
- Perfil público e categoria dinâmica recebem a barra inferior mobile padrão: Início, Busca, Menu e Painel/Entrar.
- Dashboard do cliente: recomendações deixam de mostrar só descrição; passam a mostrar foto, nome, categoria e botão Ver perfil.

## Diagnóstico adicionado
- `/api/contact-leads` agora registra no log do Render quando um contato pendente é salvo em `contact_leads`, incluindo leadId, profissional e cliente.
