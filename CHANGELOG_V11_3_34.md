# Contrataê v11.3.34 — fechamento da dashboard profissional

## Foco
Refino do fluxo já aprovado, sem alterar a arquitetura visual pública.

## Ajustes
- remove texto interno de UX da navegação pública;
- máscaras monetárias pt-BR para taxa/preço (ex.: 50 -> 50,00; 1234,5 -> 1.234,50) e parser de servidor mais tolerante;
- Resumo passa a priorizar visitas, cliques, contatos e avaliação, com desempenho e possível retorno estimado por profissão;
- explicação clara de que faturamento/orçamentos entram em módulo próprio e comprovante de serviço não é documento fiscal;
- orientação visual ao continuar da profissão para o portfólio;
- portfólio mantém 10 imagens de trabalho, sem contar a foto de perfil;
- ordenação das imagens por setas, mantida como rascunho local e efetivada somente ao publicar;
- mensagens de upload/legenda/remoção retornam para a área de edição do portfólio em vez de jogar o usuário ao topo;
- botão de prévia do portfólio renomeado/destacado como “Visualizar antes de publicar”;
- prévia ganhou ações persistentes de Voltar/Publicar e feedback “Processando...” no envio;
- lightbox move contador para cima e legenda para uma barra separada embaixo;
- botão Contratar usa identidade visual do WhatsApp e feedback de processamento;
- profissional não pode gerar contato nem avaliação no próprio perfil (bloqueio visual + backend);
- métricas continuam ignorando visitas do próprio profissional e prévias.

## SQL
Nenhum SQL novo. Mantém os SQLs já usados até a v11.3.33, inclusive o SQL 10 para rascunho/legendas.

## Adiado para a etapa ADM
- métricas de banners/carrossel por anunciante;
- exportação PDF/Excel do ADM;
- ícones dinâmicos das profissões “Outros”;
- módulo completo de orçamento, valor fechado e comprovante de serviço não fiscal.
