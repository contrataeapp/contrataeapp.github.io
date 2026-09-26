# Contrataê v11.3.33 — Portfólio com rascunho + preview unificado

Base: v11.3.32.

## Objetivo
Fechar o fluxo da dashboard profissional sem alterar a identidade visual já aprovada:

**Editar profissão → Gerenciar fotos → Visualizar tudo junto → Salvar e publicar tudo**.

## Alterações

### Meu Portfólio
- Selecionar uma imagem agora inicia o upload automaticamente; foi removida a etapa confusa de selecionar e depois clicar em “Adicionar ao portfólio”.
- Durante o envio há estado visível “Enviando...”.
- Nova imagem entra como **rascunho**, marcada “Nova · não publicada”.
- Fotos publicadas removidas ficam marcadas **“Será removida ao publicar”**; continuam no perfil público até a confirmação.
- Remoção pode ser desfeita antes da publicação.
- Botão **Visualizar alterações** no próprio Meu Portfólio.
- Botão **Salvar e publicar tudo** no Meu Portfólio publica, de uma vez, os dados ainda em rascunho da profissão + mudanças de fotos/legendas.
- Link antigo ficou explícito como **Ver perfil publicado atual**, para diferenciar do preview.
- Cada miniatura ganhou ação **Legenda**. A legenda fica em rascunho até publicar.
- A troca Marceneiro / Analista de Sistemas continua instantânea.

### Minhas Profissões
- O campo de descrição passou a se apresentar como **Apresentação / mini biografia desta profissão**, aproveitando o campo já existente e evitando criar outro campo redundante.
- Rascunho automático da v11.3.32 continua preservado ao entrar no portfólio, atualizar a página e voltar.

### Preview
- A prévia agora possui uma rota GET real. Depois do POST inicial, o rascunho é guardado na sessão e a página redireciona para `/profissional/profissoes/:slot/preview`.
- F5, redimensionar/responsividade ou rotação não devem mais cair em 404.
- O preview aberto a partir de Meu Portfólio usa o mesmo rascunho de descrição, especialidades, horários e preços + fotos ainda não publicadas e já exclui remoções pendentes.
- Continua sem contar visita.
- Publicar pela prévia também confirma as mudanças do portfólio da mesma profissão.

### Perfil público / galeria
- A foto principal recebeu selo **Foto de perfil** para diferenciar avatar de trabalhos do portfólio.
- Adicionado botão visível **Ver todas as fotos (N)**; abre o lightbox com anterior/próxima.
- Legendas publicadas aparecem na galeria/lightbox.
- Ajustes responsivos no grid, toolbar da prévia e lightbox para telas pequenas.

## Banco de dados
Esta versão exige rodar uma vez:

`sql_scripts/10_portfolio_draft_legendas.sql`

O SQL apenas adiciona colunas de estado/legenda à tabela `professional_profession_portfolio`; fotos antigas continuam publicadas.

## Arquivos principais alterados
- `routes/dashboards.js`
- `server.js`
- `views/dashboards/profissional-dashboard.ejs`
- `views/perfil-profissional.ejs`
- `sql_scripts/10_portfolio_draft_legendas.sql`
