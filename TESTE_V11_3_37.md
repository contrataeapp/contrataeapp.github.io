# Teste v11.3.37

1. Abra Área Profissional no celular: “Visão Geral” deve substituir “Resumo” sem perder métricas.
2. Abra Mais > Aparência e teste Sistema, Escuro e Claro. Recarregue a página e confirme persistência.
3. Em Minhas Profissões, sem alterações, “Ver publicado atual” deve funcionar; “Visualizar antes de publicar” e “Publicar alterações” devem ficar desabilitados.
4. Edite bio/especialidade/horário/preço: “Visualizar antes de publicar” e “Publicar alterações” devem liberar.
5. Em Meu Portfólio, sem alterações pendentes, confirme que “Visualizar antes de publicar” e “Salvar e publicar tudo” estão desabilitados.
6. Adicione/ordene/remova/legende uma foto: os botões do Portfólio devem liberar.
7. Clique “Ver perfil publicado atual”: deve abrir no mesmo fluxo, sem segunda aba.
8. Nessa tela, confira a faixa “Perfil publicado atual · somente visualização”. Navegação pública, Voltar para categoria, anúncios, Maps, telefone e botões de cliente não devem executar ação. A galeria pode abrir para conferência.
9. Use “Voltar à Área Profissional”: deve retornar ao Portfólio e profissão corretos.
10. Firefox: repita o item 7. Não deve ocorrer `NS_ERROR_DOM_COOP_FAILED`, pois não há mais abertura por popup/segunda aba nesse fluxo.
11. Chrome/Android: se o navegador considerar o PWA instalável, o menu Mais deve mostrar “Instalar Contrataê”. Se não mostrar, isso não é erro: o botão só aparece quando `beforeinstallprompt` é fornecido pelo navegador.
12. Abra Avaliações: confira média, total e comentários publicados; não deve existir texto técnico de “próxima fase”.
13. Abra Meu Plano: confira plano, profissões liberadas, status, valor e período; não deve existir botão morto “em breve”.
14. Faça regressão rápida em rascunho separado, preview, publicação, limite de 10 fotos e métricas sem auto-visita.

Nenhum SQL novo nesta versão.
