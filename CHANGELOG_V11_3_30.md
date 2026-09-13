# Contrataê v11.3.30 — refinamento Minhas Profissões e perfil público por profissão

Foco desta versão: não mexer no layout público já acertado e corrigir os detalhes finais da dashboard do profissional por profissão.

## Ajustes realizados

- Corrigida a escolha da profissão no perfil público: `?categoria=analista-de-sistemas` agora tem prioridade real sobre a profissão principal.
- Profissões aprovadas que nasceram de “Outros” passam a ser consideradas públicas pelo slug/nome aprovado, sem cair no perfil principal.
- O perfil público passa a respeitar melhor descrição, disponibilidade, especialidades, preço e portfólio da profissão selecionada.
- Disponibilidade rápida não apaga mais o texto digitado automaticamente.
  - Se já existir texto, abre modal da própria plataforma perguntando se deseja adicionar ao texto atual, substituir ou cancelar.
- Upload de imagem por profissão ficou mais intuitivo.
  - Clicar em um espaço vazio abre o seletor de arquivo.
  - A prévia aparece no próprio espaço clicado e também no bloco de prévia.
  - O botão de envio mostra carregamento para evitar clique duplo/confusão.
- Publicar alterações agora mostra carregamento no botão.
- Após salvar imagem/texto de uma profissão, a tela volta para a profissão selecionada e tenta rolar para o painel correto.
- Foto do perfil no canto superior da dashboard teve o HTML corrigido e mantém clique direto para trocar a imagem.
- Mantidos cabeçalho, rodapé, carrosséis e banners laterais do layout público, sem compactar ou alterar o padrão visual que já estava aprovado.

## Banco de dados

Esta versão não cria tabela nova. Se a v11.3.29 já estava funcionando com `07_profession_profiles_portfolios.sql`, `08_profile_events_metrics.sql` e `09_fix_profession_profiles_rls.sql`, não precisa rodar SQL novo.

## Testes locais feitos

- `node -c server.js`
- `node -c routes/dashboards.js`
- `node -c routes/auth.js`

Não foi executado teste real no Render por aqui.
