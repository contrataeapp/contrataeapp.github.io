# Roteiro de teste — Contrataê v11.3.39

## 1. Aparência automática
1. Abra a Área Profissional em um celular configurado no modo claro.
2. Em Mais > Aparência, confirme `Automático`.
3. O painel deve ficar claro.
4. Mude o aparelho para modo escuro sem trocar a opção no Contrataê.
5. O painel deve acompanhar o aparelho.
6. Teste também Claro e Escuro manualmente.

## 2. Navegação mobile e Voltar
1. Abra Visão Geral.
2. Entre em Serviços, Profissões e Portfólio usando a barra inferior.
3. Use o Voltar do Android/navegador.
4. A Área Profissional deve retornar à guia anterior sem abrir nova aba.
5. Em Mais > Início do Contrataê, confirme que aparece um aviso antes de sair do painel.

## 3. Visão Geral
1. Confirme o botão `Ver meu perfil publicado`.
2. Confira atalhos e métricas por profissão.
3. Confirme que as explicações mais longas não dominam a tela e os botões `?` abrem informação complementar.

## 4. Ver perfil publicado atual
1. Abra pelo botão da Visão Geral e depois repita por Profissões/Portfólio.
2. A página deve abrir na mesma guia.
3. Deve aparecer `Perfil publicado · somente visualização`.
4. Role a página e confirme que o botão flutuante `Área Profissional` continua acessível.
5. Busca/Menu/Painel/WhatsApp/telefone/Maps/avaliação não devem funcionar nessa conferência.
6. Clique em anúncio lateral/flutuante e anúncio de carrossel: nenhum deve abrir site externo.
7. O X para fechar anúncio e setas do carrossel devem continuar funcionando.
8. Abra fotos da galeria/lightbox e confirme que continuam funcionando.
9. Volte usando `Área Profissional` e confirme a guia/slot corretos.

## 5. Métricas do próprio profissional
1. Anote as visitas da profissão.
2. Entre e saia várias vezes de `Ver meu perfil publicado`.
3. Recarregue a dashboard.
4. Essas conferências não devem aumentar visitas nem cliques públicos.

## 6. Meus Serviços
1. Abra Meus Serviços.
2. Contatos recentes devem aparecer com nome, foto ou inicial, profissão, data e status.
3. Em um contato novo, abra `Ver detalhes`.
4. Confirme mensagem e e-mail (quando existir).
5. Marque um contato como `Fechei o serviço`.
6. Ele deve permanecer no histórico, agora com status `Serviço aceito`, e sair da lista de pendências da Visão Geral.
7. Teste também `Não fechei` e `Arquivar`.

## 7. PWA Android
1. Acesse sem estar com o PWA instalado.
2. Aguarde a sugestão `Tenha o Contrataê no celular`.
3. Abra `Ver como instalar`.
4. Quando o navegador oferecer instalação nativa, teste o botão.
5. Depois de instalado, a sugestão não deve continuar aparecendo.

## 8. PWA iPhone/iPad
1. Abra no Safari.
2. Abra a orientação de instalação.
3. Deve explicar Compartilhar > Adicionar à Tela de Início > Adicionar.

## 9. Compartilhamento de link
1. Compartilhe a home e um perfil profissional no WhatsApp ou outro app que gere prévia.
2. Depois que o cache do aplicativo atualizar, a prévia deve usar nome/identidade/logo do Contrataê.

## 10. Regressão obrigatória
- alternar Marceneiro/Analista de Sistemas;
- confirmar portfólios separados e limite 10 por profissão;
- editar descrição/preço/horário;
- Visualizar antes de publicar;
- Salvar e publicar;
- desfazer remoção de foto;
- ordenar fotos;
- confirmar que preview/owner view não contam visita;
- testar desktop e mobile.
