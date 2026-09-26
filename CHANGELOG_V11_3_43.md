# Contrataê v11.3.43 — Público, Institucional e PWA

Base: **v11.3.42 — navegação pública consistente**

Esta versão fecha a rodada de observações públicas/PWA antes de iniciar **Meu Plano**.

## 1. Instalação PWA global
- Convite de instalação disponível para visitantes/clientes/profissionais em páginas públicas compatíveis.
- Android: `Instalar agora` tenta abrir diretamente o prompt nativo do navegador; `Instalar depois` adia a sugestão.
- Se o Android não liberar o prompt automático, a página `/instalar` mostra um fallback manual (`Mais > Instalar e criar atalho/Instalar app`).
- iPhone/iPad: convite também aparece, mas leva ao tutorial porque o iOS exige fluxo pelo navegador.
- `/instalar` agora diferencia Chrome iOS, Safari iOS e outros navegadores.
- O tutorial continua dentro do shell visual do Contrataê.

## 2. Health check do Render
- Novo endpoint extremamente leve: `GET /healthz` -> `200 ok`.
- `render.yaml` agora usa `healthCheckPath: /healthz`.
- O endpoint não consulta Supabase, sessão ou templates, reduzindo falso timeout no health check.

## 3. Cabeçalho logado
- Avatar real do usuário aparece no chip do cabeçalho quando existir; ícone genérico continua como fallback.
- Dropdown profissional passa a mostrar:
  - `Editar meu perfil`
  - `Ver meu perfil publicado`
  - `Área Profissional`
  - `Sair`
- A visualização do próprio perfil usa `ownerView=1`, preservando as proteções existentes contra autocontagem/autoações.

## 4. Busca pública de verdade
- Novo endpoint `GET /api/public/search-suggestions?q=`.
- Busca incremental por categorias/profissões e profissionais ativos.
- Termos como `pedreiro`, `pintor`, `eletricista` e `encanador` levam à categoria correta.
- Cabeçalho, home e barra inferior usam o mesmo mecanismo de sugestões.
- `Busca` na barra inferior abre uma busca no próprio contexto, em vez de simplesmente jogar o usuário para a home.

## 5. Outras Categorias e orientação pública
- `Outras Categorias` ficou mais compacta no mobile: duas colunas quando houver espaço e uma coluna em telas muito estreitas.
- Filtro local reage ao termo recebido pela URL e à digitação.
- Breadcrumbs/contexto foram adicionados às principais páginas de categoria.
- O botão Voltar tenta respeitar histórico interno/same-origin e retorna à etapa anterior quando possível.

## 6. Cadastro e autenticação
- Tela inicial `Cliente / Profissional` recebeu maior affordance visual e CTAs explícitos.
- Antes de o usuário realmente preencher o cadastro, Início/Voltar/Menu não tratam a saída como destrutiva.
- Após edição/preenchimento, a confirmação de saída continua protegendo o fluxo.
- Menu público foi aproximado do padrão global.

## 7. Configurações institucionais pelo ADM
Nova área em `ADM > Configurações da Plataforma`:
- e-mail institucional;
- localização/endereço institucional;
- Instagram + ativo/inativo;
- Facebook + ativo/inativo;
- X/Twitter + ativo/inativo;
- WhatsApp + ativo/inativo + número + mensagem padrão.

Quando um canal está ativo e configurado, ele aparece automaticamente nas áreas públicas que usam as configurações, como rodapé e Contato.

**Requer SQL novo:** `SQL_V11_3_43_CONFIGURACOES_PLATAFORMA.sql`.

## 8. Continuidade e sessão
- A sessão passa a manter também a URL do avatar para o cabeçalho sem consulta repetitiva desnecessária.
- Sessões antigas buscam o avatar uma vez e reutilizam na sessão.

## Não alterado de propósito
- Motor aprovado da Área Profissional.
- Rascunho local por profissão.
- Preview/publicação.
- Portfólio e substituição de fotos.
- Métricas/self-view.
- Estrutura de planos atual: `Meu Plano` fica para a próxima grande versão.

## Próxima versão recomendada
**v11.3.44 — Meu Plano**.
