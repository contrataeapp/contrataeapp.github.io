# Contrataê v11.3.38 — navegação mobile simplificada e Visão Geral acionável

Base: v11.3.37.

## Objetivo

Refinar a Área do Profissional sem alterar o motor aprovado de profissões, rascunhos, portfólio, preview e publicação.

## Alterações

### Navegação mobile
- Removido o select superior que duplicava a navegação.
- A barra inferior passa a ser o único ponto de navegação principal no celular: Visão, Serviços, Profissões, Portfólio e Mais.
- O topo mobile agora apenas informa a seção atual.
- O seletor de profissão continua existindo somente nas telas em que ele realmente muda o perfil que está sendo editado.

### Tema claro/escuro
- Removidos os selects de Aparência da dashboard.
- A Área do Profissional agora usa o mesmo padrão visual da plataforma: botão simples sol/lua.
- A preferência usa a chave global `theme` do navegador para manter consistência com o restante do Contrataê.
- Contraste do modo claro reforçado em textos secundários, cartões, ajuda, avaliações e blocos de profissão/portfólio.

### Aviso de perfil aprovado
- O bloco verde “Seu perfil está aprovado e publicado” agora pode ser recolhido e expandido.
- A preferência de recolhimento é lembrada no dispositivo.
- Os atalhos internos do aviso navegam sem recarregar a dashboard.

### Visão Geral
- Criados atalhos clicáveis para:
  - Meus Serviços
  - Minhas Profissões
  - Meu Portfólio
  - Meu Perfil
  - Meu Plano
- Os atalhos exibem contexto útil, como quantidade de profissões, fotos e contatos.
- “Desempenho por profissão” continua separado por profissão e agora cada cartão leva diretamente à profissão correspondente para edição.
- Mantidas as métricas gerais de visitas, cliques, contatos e avaliação.
- Texto interno de “Próximo passo” substituído por orientação simples para o profissional manter o perfil atualizado.

### PWA / compatibilidade
- Service Worker identificado como v11.3.38.
- Nenhuma alteração de banco de dados nesta versão.
- Nenhuma mudança nas regras de publicação, limite de portfólio ou isolamento entre profissões.
