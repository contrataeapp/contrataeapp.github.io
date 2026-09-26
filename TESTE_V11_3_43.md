# TESTE v11.3.43 — Público, Institucional e PWA

## Antes de testar
1. Publicar a versão.
2. Executar `SQL_V11_3_43_CONFIGURACOES_PLATAFORMA.sql` no Supabase.
3. Confirmar no Render que existe `SUPABASE_SERVICE_ROLE_KEY` nas Environment Variables.
4. No Render, usar `/healthz` como Health Check Path (o `render.yaml` já está preparado).

## A. Render / infraestrutura
- [ ] Abrir `https://contrataeapp.onrender.com/healthz` e confirmar resposta `ok`.
- [ ] Reiniciar/deployar e verificar se o health check deixa de depender da home/Supabase.

## B. Android / instalação
- [ ] Abrir o índice em Android sem o Contrataê instalado.
- [ ] Ver convite `Instalar agora | Instalar depois`.
- [ ] Tocar `Instalar agora` e confirmar que o prompt nativo aparece quando o Chrome liberar a instalação.
- [ ] Se o prompt não for liberado, confirmar que o fluxo leva ao tutorial/fallback Android.
- [ ] Tocar `Instalar depois` e confirmar que o convite não reaparece em cada navegação.
- [ ] Depois de instalado, abrir pelo ícone e verificar modo standalone (sem barra do navegador).

## C. iPhone
- [ ] No Chrome iOS, abrir o site e verificar convite de instalação.
- [ ] Tocar instalar e conferir tutorial Chrome: Compartilhar > Adicionar à Tela de Início > Adicionar.
- [ ] No Safari iOS, conferir tutorial Safari: Compartilhar > Adicionar à Tela de Início > Abrir como App Web (quando aparecer) > Adicionar.
- [ ] Conferir aba `Outro` como fallback.

## D. Cabeçalho / conta
- [ ] Logar como profissional.
- [ ] Confirmar avatar real no chip do usuário (ou ícone fallback se não houver foto).
- [ ] Abrir o dropdown e conferir `Editar meu perfil`, `Ver meu perfil publicado`, `Área Profissional`, `Sair`.
- [ ] `Ver meu perfil publicado` deve manter modo somente visualização e não contar métricas.

## E. Busca pública
- [ ] Tocar `Busca` na barra inferior: deve abrir campo de busca ali, sem redirecionar primeiro à home.
- [ ] Digitar `pedreiro`: sugestão `Pedreiros` deve aparecer enquanto digita.
- [ ] Digitar nome de um profissional ativo e verificar sugestão do perfil.
- [ ] Testar busca pelo cabeçalho e pela home.
- [ ] Enter/botão deve ir ao primeiro resultado coerente; fallback pode abrir `/outros?busca=...`.

## F. Outras Categorias / Voltar
- [ ] Em celular comum, conferir cards em duas colunas.
- [ ] Em largura muito estreita, conferir reflow para uma coluna.
- [ ] Digitar no filtro e verificar redução instantânea dos cards.
- [ ] Abrir categoria e testar breadcrumb/contexto.
- [ ] Voltar deve retornar uma etapa quando houver histórico interno válido.

## G. Cadastro
- [ ] Abrir Criar conta e conferir Cliente/Profissional como escolhas visualmente clicáveis.
- [ ] Antes de preencher qualquer campo: Voltar/Menu/Início não devem acusar perda de cadastro.
- [ ] Depois de preencher campo(s): tentativa de saída deve pedir confirmação.
- [ ] Voltar uma etapa dentro do fluxo deve continuar funcionando quando não for destrutivo.

## H. ADM institucional
- [ ] Entrar no ADM > Configurações da Plataforma.
- [ ] Preencher e-mail/localização.
- [ ] Ativar Instagram/Facebook/X com URLs válidas e salvar.
- [ ] Ativar WhatsApp de teste, número com DDI e mensagem padrão; salvar.
- [ ] Reabrir a aba e confirmar persistência.
- [ ] Abrir Contato/rodapé público e conferir somente os canais ativos.
- [ ] Desativar um canal, salvar e verificar que o ícone some do site.

## I. Regressão profissional rápida
- [ ] Área Profissional abre normalmente.
- [ ] Visão/Serviços/Profissões/Portfólio/Mais continuam rápidos.
- [ ] Alternativo/Claro/Original continuam funcionando.
- [ ] Preview/publicação/portfólio continuam sem regressão.
