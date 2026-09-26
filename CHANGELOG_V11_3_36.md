# Contrataê v11.3.36 — fechamento mobile da Área Profissional

## Objetivo
Refinar a camada visual/mobile da dashboard profissional sem reescrever a lógica já aprovada de profissões, rascunho, disponibilidade, portfólio, pré-visualização e publicação.

## Mobile-first
- Sidebar desktop não ocupa mais a primeira tela no celular.
- Navegação mobile própria da Área Profissional com seletor de seção sticky.
- Barra inferior de app com 5 destinos: Resumo, Serviços, Profissões, Portfólio e Mais.
- “Mais” abre bottom sheet nativo com Perfil, Avaliações, Plano, Pagamentos, Início e Sair.
- A seção atual é sincronizada entre URL, seletor e barra inferior.
- Alvos de toque principais foram ajustados para aproximadamente 48 px ou mais.
- Conteúdo fica centralizado e usa melhor a largura da tela.
- Métricas do Resumo passam para grade 2x2 no celular.
- Desempenho por profissão foi compactado.
- Andamento do perfil usa grade compacta, mantendo Portfólio por profissão separado.
- Minhas Profissões mantém um indicador sticky da profissão atualmente editada.
- Estatísticas por profissão ficam em 2 colunas no celular.
- Ações de profissão e disponibilidade foram compactadas sem remover funções.
- Portfólio usa 2 colunas no celular; setas ficam no topo da miniatura e Legenda/Remover no rodapé.
- Legenda continua sobre a região central da imagem.

## Perfil e endereço
- CEP permanece opcional no Meu Perfil.
- Texto explica que endereço pode ser salvo sem CEP e que o CEP melhora a precisão do Maps.
- Novo botão “Não sei meu CEP · buscar pelo endereço”.
- Busca usa Estado + Cidade + Rua/Avenida e oferece opções de CEP para seleção.
- Se nenhuma opção for encontrada, o profissional pode continuar sem CEP e recebe link auxiliar para o Busca CEP dos Correios.
- O Maps continua podendo usar rua, número, bairro, cidade e estado mesmo sem CEP.

## Perfil público
- Tipografia de “Atendimento em [cidade]” normalizada.
- CTA inferior agora usa texto específico, por exemplo “Ver outros Analistas de Sistemas”, evitando ambiguidade de “área”.
- Contagem pública do botão de galeria passa a comunicar portfólio, sem contar a foto de perfil como uma das 10 fotos de trabalho.

## Logs / produção
- Removido log repetitivo “Buscando categoria para slug”.
- Removidos logs da dashboard com UserID da sessão.
- Removidos logs verbosos do fluxo de completar perfil que imprimiam sessão/body/avatar no console.
- Erros relevantes continuam registrados com console.error.

## Banco de dados
Nenhum SQL novo. A v11.3.36 usa o SQL 10 (portfólio/rascunho) e SQL 11 (contato/endereço) já executados nas versões anteriores.

## Referências de UX usadas
- Material Design: bottom navigation para 3–5 destinos principais em telas pequenas; destinos adicionais ficam em navegação secundária.
- Nielsen Norman Group: navegação mobile precisa ser descobrível, acessível e ocupar pouco espaço, priorizando conteúdo.
- web.dev: alvos de toque devem ser grandes o suficiente; referência prática de ~48 px.
