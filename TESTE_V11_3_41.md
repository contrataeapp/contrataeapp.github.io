# Roteiro de teste — Contrataê v11.3.41

Faça preferencialmente os testes em Android real e depois uma conferência rápida no desktop.

## 1. Cabeçalho / Modo Profissional
1. Entre como profissional e vá para a página inicial pública.
2. Confirme que o cabeçalho Contrataê permanece no topo.
3. Confirme que `Modo Profissional Ativo` aparece abaixo do cabeçalho.
4. Confirme que `Área Profissional` fica em uma única linha e não quebra o layout.
5. Toque no nome/avatar/seta do usuário e confirme que o menu abre e fecha.
6. Toque em `Área Profissional` e observe feedback imediato de carregamento.

## 2. Feedback de carregamento
1. Navegue entre páginas públicas.
2. Em uma navegação que demore, confirme a barra fina de progresso no topo.
3. Entre em `Ver meu perfil publicado` pela Área Profissional.
4. Confirme `Abrindo seu perfil publicado...`/feedback imediato antes da troca de página.
5. Use `Área Profissional` para voltar e confirme que não parece um clique sem resposta.

## 3. Instalação Android
1. Abra `/instalar` no Chrome/Android sem o PWA instalado.
2. Confirme que a página usa o mesmo cabeçalho/rodapé/navegação do Contrataê.
3. Role até o fim: não deve existir faixa vazia grande abaixo do conteúdo.
4. A tela deve mostrar `Instalar agora` e `Instalar depois`.
5. Toque `Instalar agora`: quando o Chrome tiver liberado a instalação, deve abrir o prompt nativo.
6. Confirme que não há instruções mandando procurar opção no menu do Android.
7. Toque `Instalar depois` e confira que volta ao Contrataê sem nova pergunta imediata.

## 4. Instalação iPhone/iPad
1. Abra `/instalar` em iPhone/iPad.
2. Confira o passo a passo: Safari -> Compartilhar -> Adicionar à Tela de Início -> Adicionar.

## 5. Mais opções — mobile
1. Entre na Área Profissional e abra `Mais`.
2. Verifique Meu Perfil, Avaliações, Meu Plano, Pagamentos, Aparência, Instalar Contrataê, Início do Contrataê e Sair.
3. Não deve haver corte lateral nem barra de rolagem horizontal.
4. Em tela estreita, confirme que os cards continuam legíveis.

## 6. Ajuda contextual (?)
1. Em Meus Serviços, toque no `?`.
2. A explicação deve abrir e fechar normalmente.
3. Pressione/foque o botão: a aparência visual deve continuar circular, sem quadrado/sombra quadrada atrás.

## 7. Profissão ativa
1. Abra Minhas Profissões.
2. Role a tela.
3. Confirme que o indicador sticky da profissão ativa tem fundo preenchido e é fácil de perceber.
4. Troque Marceneiro/Analista de Sistemas.
5. O contexto visual deve mudar imediatamente sem animação contínua cansativa.

## 8. Feedback de rascunho
1. Altere a mini biografia e saia do campo.
2. Deve aparecer feedback curto indicando que a mini biografia daquela profissão foi atualizada no rascunho.
3. Repita com especialidades, disponibilidade, taxa de visita e preço médio.
4. Confirme que o perfil público não muda antes de publicar.

## 9. Publicação
1. Faça duas ou mais alterações.
2. Confirme que `Publicar alterações` passa de inativo para ativo.
3. Clique para publicar.
4. Antes da publicação, deve aparecer um resumo do que mudou.
5. Teste `Visualizar antes`.
6. Volte e teste `Salvar e publicar tudo`.
7. Confirme que informações e portfólio da profissão são publicados juntos.

## 10. Portfólio
1. Confira os controles: `Legenda`, `Substituir`, `Remover`.
2. Clique `Legenda` e altere a legenda.
3. Clique `Substituir` e escolha outra imagem.
4. Antes de publicar, a foto publicada atual deve continuar sendo a pública; a nova deve existir como rascunho.
5. Verifique se legenda e posição foram preservadas.
6. Visualize antes de publicar e depois publique.
7. Confirme que o limite continua sendo 10 imagens ativas por profissão.

## 11. Perfil publicado do proprietário
1. Abra `Ver perfil publicado atual`.
2. Confirme que anúncios, contato, navegação pública e a faixa do Modo Profissional não recebem cliques acidentais.
3. Galeria pode continuar sendo visualizada.
4. A visita do próprio profissional não deve incrementar métricas.

## 12. Regressão essencial
- Meu Perfil: CEP por número e `Não sei meu CEP` continuam funcionando.
- Marceneiro e Analista continuam independentes.
- Portfólios continuam separados.
- Preview não conta visita.
- Tema Original, Claro e Alternativo continuam funcionando.
- Sair continua funcionando.
