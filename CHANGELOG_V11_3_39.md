# Contrataê v11.3.39 — Fechamento UX da Área Profissional

Base: v11.3.38.

Esta versão fecha o polimento de navegação/visualização/PWA antes do próximo bloco funcional de plano e profissões. A regra principal foi preservar o motor já aprovado de profissões separadas, rascunhos, portfólio, pré-visualização e publicação.

## Área Profissional
- Aparência agora oferece **Automático / Claro / Escuro**.
- `Automático` é o padrão quando ainda não existe preferência salva e acompanha o tema do aparelho.
- Mantida a barra inferior mobile como navegação principal: Visão, Serviços, Profissões, Portfólio e Mais.
- Uso mais forte de divulgação progressiva: explicações secundárias ficam atrás de `?` em vez de ocupar a tela toda.
- `Início do Contrataê` avisa antes de sair da Área Profissional para evitar confusão.
- Navegação entre guias passa a registrar histórico no navegador; o botão Voltar do Android/navegador consegue retornar entre as áreas visitadas.
- Visão Geral ganhou ação direta **Ver meu perfil publicado**.

## Perfil publicado do próprio profissional
- Continua abrindo na mesma guia.
- Faixa persistente: **Perfil publicado · somente visualização**.
- Novo botão flutuante **Área Profissional** acompanha a rolagem no mobile.
- O antigo retorno público inferior para categoria fica oculto neste modo para não confundir o proprietário.
- Busca, Menu, Painel, contato, telefone, Maps, avaliações e navegação pública permanecem bloqueados.
- Anúncios laterais e links de carrossel também ficam bloqueados para clique; o profissional ainda consegue enxergar a composição real da página.
- Fechar anúncio e controles visuais do carrossel continuam utilizáveis.
- `ownerView=1` também é ignorado explicitamente pelas métricas, além da proteção já existente por usuário logado: a conferência do próprio perfil não registra visita/clique público.

## PWA e identidade
- Ícones próprios do Contrataê em 48, 180, 192 e 512 px.
- `manifest.webmanifest` atualizado para instalação como PWA e atalhos de busca/Área Profissional.
- Metadados para instalação no iPhone/iPad.
- Sugestão de instalação dentro da própria interface, sem depender apenas do aviso do navegador.
- Android: usa o prompt nativo quando o navegador o disponibiliza.
- iPhone/iPad: mostra instruções para Adicionar à Tela de Início.
- A sugestão pode ser adiada e não aparece quando o app já está instalado.
- Open Graph/Twitter Card/ícones adicionados às páginas públicas para melhorar a identidade visual ao compartilhar links.

## Meus Serviços / contatos
- A área passa a mostrar histórico recente de contatos, não apenas os pendentes.
- Cartões mais leves: foto/initial do cliente, nome, profissão, data e status.
- Detalhes ficam recolhidos e abrem sob demanda.
- E-mail existente no lead fica acessível nos detalhes.
- Leads novos continuam com ações para marcar serviço fechado, não fechado ou arquivar.
- A foto não é copiada para a tabela de contatos: o sistema usa `client_id` para buscar o avatar atual em `users.avatar_url`, evitando duplicar imagens no banco.
- O painel da Visão Geral continua mostrando somente contatos pendentes que precisam de atenção.

## Banco de dados
Nenhuma migração nova é necessária nesta versão. A melhoria de contatos reutiliza a estrutura já criada pelo SQL/RPC v11.3.23.
