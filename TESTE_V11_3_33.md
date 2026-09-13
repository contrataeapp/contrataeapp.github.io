# Roteiro rápido — v11.3.33

## Antes do deploy
1. Rodar `sql_scripts/10_portfolio_draft_legendas.sql` no Supabase.
2. Subir a versão e aguardar o Render ficar Live.

## 1. Fluxo completo — Analista de Sistemas
1. Minhas Profissões → Analista de Sistemas.
2. Mude descrição, especialidade, horário, taxa/preço.
3. NÃO publique.
4. Clique Gerenciar fotos.
5. Confirme que a profissão selecionada continua Analista de Sistemas.
6. Clique em um espaço vazio e selecione uma foto.
7. Deve aparecer “Enviando...” sem precisar clicar em outro botão.
8. Após retornar à tela, a foto deve ter selo “Nova · não publicada”.
9. Clique “Visualizar alterações”.
10. A prévia deve mostrar os textos/horários/preços editados + a nova foto.
11. O contador de visitas não pode subir.
12. Volte e clique “Salvar e publicar tudo”.
13. Abra o perfil público atual e confirme que tudo apareceu.

## 2. Remoção em rascunho
1. Remova uma foto já publicada.
2. Confirme o modal.
3. Ela deve ficar esmaecida com “Será removida ao publicar”.
4. Abra “Ver perfil publicado atual”: ela AINDA deve aparecer.
5. Abra “Visualizar alterações”: ela NÃO deve aparecer.
6. Volte e teste “Desfazer”, ou marque novamente e publique.
7. Só depois de publicar ela deve sumir do perfil público.

## 3. Legenda
1. Clique “Legenda” em uma foto.
2. Escreva uma legenda curta e salve.
3. Ela deve ser indicada como alteração em rascunho.
4. Perfil publicado atual não deve usar a nova legenda ainda.
5. Preview deve mostrar a legenda nova.
6. Publique e confira no perfil público/lightbox.

## 4. Preview responsivo
1. Abra Visualizar alterações.
2. Pressione F5: não pode dar 404.
3. Use modo responsivo 375px/390px ou abra no celular.
4. Toolbar deve empilhar os botões sem estourar a largura.
5. Galeria deve ficar em duas colunas, com a foto principal ocupando a largura.
6. Clique “Ver todas as fotos” e teste anterior/próxima.

## 5. Foto de perfil
- No perfil/preview, a primeira imagem deve ter selo “Foto de perfil”.
- Ela não é gerenciada em Meu Portfólio; continua em Meu Perfil/avatar.

## 6. Separação por profissão
- Marceneiro e Analista de Sistemas precisam continuar com textos, preços, disponibilidade e fotos independentes.
- Trocar o seletor do portfólio deve mudar imediatamente sem redirecionamento confuso.
