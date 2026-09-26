# Testes v11.3.36

## 1. Mobile — navegação principal
1. Abra /profissional/dashboard em largura aproximada de 360–430 px.
2. Confirme que a sidebar vertical desktop NÃO aparece.
3. Confirme o seletor sticky “Área do Profissional · seção atual”.
4. Teste Resumo, Serviços, Profissões e Portfólio pela barra inferior.
5. Abra “Mais” e teste Meu Perfil, Avaliações, Meu Plano e Pagamentos.
6. Confirme que seletor, URL e botão ativo da barra inferior acompanham a seção correta.
7. Confirme que “Sair” e “Ir para o início” funcionam no menu Mais.

## 2. Mobile — Resumo
1. Visitas, cliques, contatos e avaliação devem aparecer em grade 2x2.
2. Desempenho por profissão deve ficar compacto e legível.
3. Andamento do perfil deve mostrar dados em formato compacto.
4. Portfólio por profissão deve continuar separado por nome e quantidade.

## 3. Mobile — Minhas Profissões
1. Entre em Marceneiro.
2. Role a tela e confirme o indicador sticky “Editando agora · Marceneiro”.
3. Troque para Analista de Sistemas e confirme a troca do indicador.
4. Edite bio/especialidades/horário e confirme que rascunho continua funcionando.
5. Preview e publicar devem continuar iguais à v11.3.35.

## 4. Mobile — Portfólio
1. Confirme 2 miniaturas por linha em celular comum.
2. Setas de posição devem ficar no TOPO das miniaturas.
3. Legenda e Remover devem ficar no RODAPÉ.
4. Texto da legenda permanece sobre a região central da miniatura.
5. Adicionar/remover/desfazer/ordenar/visualizar/publicar continuam funcionando.
6. Limite permanece 10 fotos de trabalho por profissão, sem contar avatar.

## 5. CEP opcional
### Com CEP
1. Digite um CEP e clique Buscar.
2. Confira preenchimento automático.

### Sem saber o CEP
1. Apague o CEP.
2. Preencha Estado, Cidade e Rua/Avenida.
3. Clique “Não sei meu CEP · buscar pelo endereço”.
4. Escolha um resultado e confira o CEP preenchido.
5. Se não houver resultado, confirme que é possível fechar e salvar SEM CEP.
6. Salve endereço sem CEP com exibição pública autorizada e teste “Abrir no Maps”.

## 6. Perfil público
1. “Atendimento em Taquaritinga” deve ter tipografia coerente.
2. CTA inferior deve dizer “Ver outros [profissão]”.
3. Com 10 fotos de trabalho, botão deve indicar “Ver portfólio (10 fotos)”, embora a foto de perfil continue visível separadamente.

## 7. Regressão desktop
No desktop, confirme rapidamente:
- Sidebar normal.
- Resumo.
- Minhas Profissões.
- Meu Portfólio.
- Preview.
- Publicação.
- Meu Perfil/endereço.
- WhatsApp e proteção de perfil próprio.

## 8. Logs Render
Durante o teste, confirme que não aparecem repetidamente:
- “Buscando categoria para slug”
- “UserID na Sessão” na dashboard
Erros reais continuam devendo aparecer no log.
