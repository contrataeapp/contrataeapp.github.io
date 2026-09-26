# Contrataê v11.3.41 — Fechamento UX da Área Profissional

Base: v11.3.40.

## Objetivo desta versão
Último polimento de UX/UI antes de iniciar o bloco funcional **Meu Plano**. A prioridade foi melhorar orientação, feedback de carregamento, instalação PWA, publicação de rascunhos e clareza dos controles do portfólio sem reescrever o motor já aprovado de profissões, preview e publicação.

## Alterações principais

### 1. Navegação pública e Modo Profissional
- O cabeçalho público permanece no topo; a faixa `Modo Profissional Ativo` agora fica abaixo dele, sem quebrar `Acessar Dashboard` em duas linhas.
- A ação da faixa foi renomeada visualmente para `Área Profissional` e recebeu feedback de carregamento.
- O menu do usuário no cabeçalho (nome/avatar + seta) voltou a abrir/fechar de forma explícita e acessível.
- A ordem `header -> faixa de modo` foi padronizada nas páginas públicas que usam a faixa.

### 2. Feedback global de navegação
- Criado `/public/js/navigation-feedback.js`.
- Links internos e formulários passam a responder imediatamente com uma barra de progresso no topo quando a navegação pode demorar.
- Ações com rótulo de carregamento podem exibir spinner/texto enquanto aguardam a próxima página.
- Evita a sensação de “cliquei ou não clicou?” em transições de 2–5 segundos.

### 3. Página /instalar e PWA
- `/instalar` passou a usar o mesmo cabeçalho, faixa de modo, rodapé e navegação inferior das páginas públicas.
- Corrigido o espaço vazio excessivo no fim da tela mobile.
- Android: `Instalar agora` aciona diretamente o prompt nativo quando o navegador disponibiliza `beforeinstallprompt`; `Instalar depois` adia a sugestão.
- Android não mostra tutorial de menu do navegador.
- iPhone/iPad: tutorial manual `Safari -> Compartilhar -> Adicionar à Tela de Início -> Adicionar`.
- O convite público foi ajustado para mostrar `Instalar agora` no Android e `Ver como instalar` apenas no iOS.
- Corrigido o registro do service worker para visitantes anônimos: o cabeçalho não interrompe mais a inicialização quando não há usuário logado.

### 4. Área Profissional — orientação e Gestalt
- `Editando agora` no mobile ganhou aparência de pill preenchido com contraste maior, adaptado aos temas Original, Claro e Alternativo.
- O ícone `?` mantém área de toque confortável, mas hover/focus/pressed permanecem circulares, sem caixa quadrada aparente.
- `Mais opções` foi corrigido para não cortar cards/textos nem criar rolagem horizontal; em telas muito estreitas passa para uma coluna.
- Mantidos os três visuais aprovados: Original, Claro e Alternativo.

### 5. Rascunho e publicação
- Texto do rascunho foi simplificado: alterações ficam como rascunho e só aparecem aos clientes depois de publicar.
- Aviso de mudanças ainda não publicadas ganhou destaque/pulsação sutil, respeitando `prefers-reduced-motion`.
- Ao alterar campos como mini biografia, especialidades, disponibilidade e preços, aparece feedback curto indicando a profissão e que a alteração foi para o rascunho.
- Antes de publicar, o profissional recebe um resumo do que mudou e escolhe entre:
  - `Visualizar antes`
  - `Salvar e publicar tudo`
- O fluxo continua preservando o perfil publicado até a confirmação explícita.

### 6. Portfólio
- Controles ficaram semanticamente separados:
  - `Legenda` com ícone de texto;
  - `Substituir` com ícone de imagens/troca;
  - `Remover` com lixeira vermelha.
- `Substituir foto` preserva legenda e posição e cria rascunho; a imagem publicada atual permanece pública até `Salvar e publicar tudo`.
- Se o profissional desfizer a substituição antes de publicar, a foto substituta de rascunho é descartada e a foto anterior é restaurada sem criar uma 11ª imagem ativa.
- Nenhuma nova coluna/banco foi exigida para essa substituição.

### 7. Visualização do perfil publicado
- Mantido o modo somente visualização do proprietário.
- A faixa `Modo Profissional Ativo` também é bloqueada visual e funcionalmente nesse modo, assim como ações públicas/anúncios já bloqueados.
- Ao abrir o perfil publicado pela dashboard, aparece feedback imediato de carregamento.

## Banco de dados
**Nenhum SQL novo nesta versão.**

As migrations SQL 10 e SQL 11 já foram executadas no ambiente do usuário e continuam sendo a base esperada.

## Próxima etapa sugerida
v11.3.42 — **Meu Plano**: mudar plano, aumentar/reduzir quantidade de profissões, mostrar impacto de valor, comprovante, solicitação ao ADM, aprovação e liberação/stand-by de slots sem apagar dados.
