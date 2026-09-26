# Contrataê v11.3.37 — polimento profissional + visualização segura + PWA

## Foco
Fechar a experiência da Área Profissional sem reescrever o motor aprovado na v11.3.35/v11.3.36.

## Mudanças
- “Resumo” passa a se chamar **Visão Geral** (a rota interna continua `tab=resumo` para não quebrar links).
- Aparência da Área Profissional: **Sistema / Escuro / Claro**, salva apenas neste dispositivo.
- “Ver perfil publicado atual” não abre mais uma segunda aba. Abre um modo proprietário **somente leitura** no mesmo fluxo.
- No modo proprietário, navegação pública, voltar para categoria, banners, Maps, telefone e ações de cliente ficam bloqueados para evitar clique acidental; galeria continua disponível para conferência visual.
- Toolbar explica que é o perfil publicado atual e oferece retorno direto à Área Profissional.
- O link de perfil publicado usa `ownerView=1`, validado pela sessão do próprio profissional. Visitantes comuns continuam recebendo a página pública normal.
- “Ver publicado atual” fica sempre disponível; “Visualizar antes de publicar” e “Publicar alterações” ficam desabilitados sem rascunho e são liberados automaticamente após alteração de informações ou fotos.
- Botões de publicar no Portfólio também ficam bloqueados sem alterações pendentes.
- Registro do Service Worker foi reativado sem cache de páginas/dados, preparando instalação PWA sem risco de dashboard antiga.
- Botão **Instalar Contrataê** aparece no menu “Mais” somente quando o navegador informa que o app pode ser instalado. O prompt nunca aparece sozinho.
- Manifest ganhou `id`, `scope` e atalhos para Área Profissional e Busca.
- Logs de produção foram enxugados novamente: removidos logs de sucesso/debug que expunham IDs de contatos, corpo de banners e IDs/status de avaliações; erros permanecem registrados.
- A guia **Avaliações** deixou de ser uma tela de “próxima fase”: agora mostra avaliação média, quantidade publicada e comentários reais já visíveis no perfil.
- **Meu Plano** foi limpo: removido o botão morto “em breve”; a tela agora mostra plano atual, profissões liberadas, status, valor e período sem prometer uma ação ainda inexistente.
- Mantida a navegação mobile-first da v11.3.36 e o motor de rascunho/preview/publicação já aprovado.

## Banco
Nenhum SQL novo. Mantém SQL 10 e SQL 11 já executados.
