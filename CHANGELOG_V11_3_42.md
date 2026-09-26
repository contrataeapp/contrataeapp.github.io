# Contrataê v11.3.42 — navegação pública consistente

Base: **v11.3.41 — fechamento UX profissional**  
Data: **20/09/2026**  
SQL novo: **não**

## Objetivo
Corrigir inconsistências encontradas durante o teste da área pública sem reescrever a Área Profissional aprovada.

## Alterações
- Barra inferior pública padronizada nas páginas principais: **Início · Busca · Menu · Entrar/Painel**.
- Páginas de categorias, `Outros`, `Contato`, 404, Avaliação e Termos passam a reutilizar o mesmo componente de navegação mobile.
- Usuário logado vê **Painel** no quarto item; o destino respeita Cliente ou Profissional.
- `Menu` abre o mesmo menu público do cabeçalho, sem versões diferentes por página.
- `/auth/login` deixa de bloquear `Início`, `Voltar` e `Menu` antes de o usuário iniciar cadastro/login.
- `Menu` da tela de login abre atalhos públicos reais; `Voltar` usa histórico e cai no início quando necessário.
- Feedback global de carregamento também foi ligado às telas principais de autenticação/onboarding, preservando as regras de confirmação já existentes.
- Dropdown do usuário no cabeçalho corrigido: fechado por padrão, abre/fecha ao tocar em nome/seta, fecha fora/Escape.
- Rótulo `Dashboard` no dropdown virou `Área Profissional` / `Área do Cliente` para ficar mais claro.
- Faixa `Modo Profissional Ativo` permanece abaixo do cabeçalho e o CTA continua levando à Área Profissional.
- Convite de instalação no Android aparece mais cedo no índice com **Instalar agora** e **Instalar depois**.
- Chave de adiamento da instalação foi versionada para que testes antigos não escondam o novo convite.
- Android não recebe tutorial de menu: tenta o prompt nativo. iPhone continua com tutorial manual.
- Pequena auditoria do modo Claro nas páginas públicas: cards de categorias, profissionais, contato e estado vazio acompanham melhor o tema.
- Scripts duplicados em páginas que já recebiam `theme-toggle.js`/`index.js` pelo footer foram removidos.
- Service worker identificado como v11.3.42.

## Não alterado
- Motor de profissões.
- Rascunhos/preview/publicação.
- Portfólio.
- Métricas.
- Banco/Supabase.
- Regras de onboarding já aprovadas.
