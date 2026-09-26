# CONTINUAR PROJETO CONTRATAÊ — CHECKPOINT OBRIGATÓRIO

> **Se este projeto for aberto em outro chat:** anexe o ZIP mais recente, peça para ler este arquivo inteiro e use esta versão como base. Não reescreva motores já aprovados sem necessidade.

## Identificação
- Projeto: Contrataê
- Versão atual: **v11.3.43 — público, institucional e PWA**
- Base: **v11.3.42 — navegação pública consistente**
- Produção: `https://contrataeapp.onrender.com`
- Repositório: `https://github.com/contrataeapp/contrataeapp.github.io.git`
- Git: `contrataeapp` / `time.contratae@gmail.com`
- Backend: Node + Express + EJS no Render
- Banco/storage: Supabase
- Identidade pública: preto/grafite + laranja
- Área Profissional: Original / Claro / Alternativo (usuário gostou do Alternativo)

## Regra de entrega
- O ZIP precisa conter `package.json`, `server.js`, `views/`, `public/` etc. DIRETAMENTE na raiz do ZIP.
- Nunca voltar ao formato pasta-da-versão dentro de outra pasta-da-versão.
- Atualizar este checkpoint em toda nova versão.

## SQL
### Já executados pelo usuário
- SQL 10 — portfólio draft/legendas.
- SQL 11 — contato/endereço/show_full_address.
- SQL/RPC de contact_leads das versões anteriores já faz parte da base.

### NOVO e obrigatório na v11.3.43
- **SQL 12 — `SQL_V11_3_43_CONFIGURACOES_PLATAFORMA.sql`**
- Cria `public.platform_settings` para dados institucionais/redes sociais.
- O servidor grava usando SERVICE ROLE; não abrir UPDATE público por RLS.
- Confirmar no Render a variável `SUPABASE_SERVICE_ROLE_KEY`.

## Infraestrutura v11.3.43
- Novo endpoint `/healthz` -> `200 ok`, sem banco/sessão/templates.
- `render.yaml` usa `healthCheckPath: /healthz`.
- Motivo: houve um evento isolado no Render `HTTP health check failed (timed out after 5 seconds)` apesar de o Node iniciar na porta 10000.

## Núcleo profissional aprovado — NÃO REGREDIR
- Avatar global; dados/portfólio separados por profissão.
- Até 10 fotos de trabalho por profissão; avatar fora da contagem.
- Rascunho local por profissão nesta fase. Não migrar para Supabase durante polimentos sem necessidade.
- Preview reúne rascunho e não conta visita.
- Ver próprio perfil publicado não conta visita/clique/lead/avaliação.
- Profissional não se contrata nem se avalia.
- Publicar alterações inativo sem mudanças.
- Resumo antes de publicar; preview antes de publicar.
- Portfólio: Legenda / Substituir / Remover, ordem, desfazer, limite 10.
- CEP e busca de CEP por endereço aprovados.
- Área Profissional mobile: `Visão | Serviços | Profissões | Portfólio | Mais`.
- Ajuda contextual `?` abre/fecha.
- Pill `Editando agora · profissão` destacado.
- Loading imediato em ações demoradas.

## Navegação pública — v11.3.42/v11.3.43
- Barra inferior pública segue shell consistente por estado.
- Busca da barra inferior abre busca direta, não deve simplesmente jogar para o índice.
- v11.3.43 adiciona autocomplete/sugestões para categorias e profissionais.
- `Outras Categorias` é compacta no mobile (2 colunas quando couber).
- Breadcrumb/contexto adicionado às principais páginas de categoria.
- Voltar deve respeitar histórico interno/etapa quando possível.

## Cabeçalho logado — v11.3.43
- Usar avatar real se houver; fallback para ícone.
- Profissional: `Editar meu perfil | Ver meu perfil publicado | Área Profissional | Sair`.
- Avatar com telefone/e-mail embutido é questão de moderação FUTURA; não criar blur automático agora.

## PWA — comportamento desejado e implementado
- Convite é global para qualquer usuário mobile elegível, não só profissional.
- Android: `Instalar agora | Instalar depois`; tentar prompt nativo via `beforeinstallprompt`.
- Se o Android não liberar prompt, `/instalar` mostra fallback manual.
- iPhone/iPad: convite também aparece; tutorial separado para Chrome iOS e Safari iOS.
- Não insistir a cada página: `Instalar depois` cria intervalo antes de nova sugestão.
- PWA instalado deve abrir em standalone; não tentar controlar/ocultar à força os gestos/botões do sistema Android.

## ADM > Configurações da Plataforma — v11.3.43
Campos:
- e-mail institucional;
- localização/endereço;
- Instagram URL + ativar/desativar;
- Facebook URL + ativar/desativar;
- X/Twitter URL + ativar/desativar;
- WhatsApp opcional + número + ativar/desativar + mensagem padrão.
Regra: canal vazio/desativado fica oculto; canal ativo + válido aparece no site público.

## Linguagem e UX
- Pensar primeiro em usuário leigo.
- Aplicar Gestalt/HCI: proximidade, agrupamento, contraste, consistência, affordance, feedback e baixa carga cognitiva.
- Não usar jargões desnecessários na interface.
- Qualquer ação com espera perceptível deve responder imediatamente.
- Contrataê deve ter identidade própria; outras plataformas são referência apenas de clareza/leveza.

## Teste obrigatório desta versão
Leia `TESTE_V11_3_43.md`.
Prioridade:
1. `/healthz` e Render.
2. Android instalar agora/depois.
3. iPhone Chrome/Safari.
4. dropdown com avatar/ver perfil publicado.
5. busca incremental mobile/header/home.
6. Outras Categorias e breadcrumbs/Voltar.
7. cadastro antes/depois de começar a preencher.
8. ADM Configurações da Plataforma + Contato/rodapé.
9. regressão rápida da Área Profissional.

## Próxima grande prioridade
**v11.3.44 — Meu Plano**.
- Aumentar/reduzir plano e profissões.
- Mostrar efeito no valor e período.
- Comprovante/solicitação -> ADM -> aprovação.
- Redução NUNCA apaga profissão automaticamente; excedentes ficam inativos/stand-by.

Depois: Meus Serviços/leads -> orçamento -> WhatsApp/e-mail -> PDF não fiscal -> anexos temporários -> stand-by de conta -> recuperação de acesso -> Área do Cliente -> preparação final de lançamento.
