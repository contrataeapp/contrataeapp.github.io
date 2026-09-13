# Checklist de teste — Contrataê v11.3.38

## 1. Navegação mobile
1. Abra a Área do Profissional em largura de celular.
2. Confirme que NÃO existe mais um select superior para trocar de seção.
3. Confirme que o topo mostra somente o nome da seção atual.
4. Navegue por Visão, Serviços, Profissões, Portfólio e Mais pela barra inferior.
5. Abra Meu Perfil, Avaliações, Meu Plano e Pagamentos pelo menu Mais e confirme que o botão Mais fica ativo.

## 2. Tema
6. Toque no ícone de lua/sol no topo.
7. Confirme alternância entre claro e escuro.
8. Recarregue a página e confirme que a preferência foi mantida.
9. Vá para uma página pública do Contrataê que usa o mesmo tema e confirme a consistência da preferência.
10. No modo claro, verifique especialmente textos secundários, cartões, “Seu perfil está aprovado”, formulários e avaliações.

## 3. Perfil aprovado recolhível
11. Recolha “Seu perfil está aprovado e publicado”.
12. Troque de seção e volte à Visão Geral; o bloco deve continuar recolhido.
13. Expanda novamente e teste os botões Minhas Profissões e Meu Portfólio.

## 4. Visão Geral
14. Teste os cinco atalhos: Serviços, Profissões, Portfólio, Perfil e Plano.
15. Confirme que os números de profissão, fotos e contatos fazem sentido para a conta.
16. Em “Desempenho por profissão”, confirme que Marceneiro e Analista de Sistemas continuam com métricas separadas.
17. Toque em uma profissão nesse bloco e confirme que a tela Minhas Profissões abre justamente naquela profissão.

## 5. Regressão obrigatória
18. Edite texto de uma profissão e confirme que a outra profissão não é alterada.
19. Teste “Ver perfil publicado atual”.
20. Faça uma alteração e confirme que “Visualizar antes de publicar” é liberado.
21. Teste adicionar/remover/desfazer/mover uma foto do portfólio.
22. Confirme limite de 10 fotos por profissão.
23. Publique uma alteração e confira o perfil público.
24. Confirme que visualizar o próprio perfil/preview não incrementa visita.
25. Repita “Ver perfil publicado atual” no Firefox.

## Banco de dados
Nenhum SQL novo para a v11.3.38.
