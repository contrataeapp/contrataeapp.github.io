# Contrataê v11.3.32 — Rascunho automático e navegação entre profissionais

## Objetivo
Fechar os pontos de UX encontrados durante os testes da v11.3.31 sem alterar o layout público já aprovado.

## Dashboard profissional — rascunho automático
- “Minhas Profissões” passa a salvar automaticamente no navegador as alterações ainda não publicadas, separadas por profissional e por slot/profissão.
- O rascunho cobre descrição, especialidades, disponibilidade estruturada, taxa de visita e preço médio.
- Status visual informa “Salvando rascunho…”, “Rascunho salvo automaticamente” ou “Tudo publicado”.
- O rascunho é restaurado após F5/recarregamento e também quando o profissional volta de outra área da dashboard no mesmo navegador/dispositivo.
- Ao clicar em “Gerenciar fotos desta profissão” ou “Abrir portfólio”, o rascunho é salvo imediatamente antes da troca de área.
- “Meu Portfólio” recebe o botão “Voltar para editar esta profissão”, retornando diretamente ao mesmo slot profissional.
- A profissão selecionada passa a ser mantida na URL (`tab=profissoes&slot=X` / `tab=portfolio&slot=X`).
- Ao publicar com sucesso, a rota devolve `published=1` e o rascunho daquele slot é limpo somente depois da confirmação do servidor.
- O evento `pagehide` salva o rascunho antes de navegações/reloads, protegendo também o cenário de troca de avatar que submete um formulário e recarrega a página.
- Disponibilidades legadas em texto não reconhecido são preservadas no rascunho e não são sobrescritas automaticamente só porque outro campo foi editado.

## Perfil público — manter o cliente navegando na plataforma
- Perfil público ganhou um link no topo: “Voltar para profissionais de [profissão]”.
- Se o visitante veio diretamente daquela listagem de categoria, o botão usa o histórico para retornar ao ponto anterior da lista; acesso direto ao perfil usa a URL da categoria como fallback.
- No final do perfil existe o CTA “Ver mais profissionais desta área”.
- Esses elementos não aparecem no modo de pré-visualização do próprio profissional.
- Não foi adicionado “Próximo profissional” nesta versão para evitar navegação imprevisível e manter o padrão familiar lista → detalhe → lista.

## Métricas
- Mantida a proteção da v11.3.31: pré-visualização não registra visita e o próprio profissional visualizando seu perfil não entra na métrica pública.

## Ícones de “Outros” — diagnóstico, sem alteração nesta versão
- O ADM já possui campo “Ícone (FontAwesome Class)” e aceita classes como `fas fa-paint-roller`.
- A página `outros.ejs`, porém, ainda renderiza `fas fa-briefcase` de forma fixa para todos os cards.
- Por segurança e foco no fechamento da dashboard, a correção visual dos ícones foi deixada para a próxima etapa, depois da validação da v11.3.32.

## Banco de dados
Nenhum SQL novo é necessário. O rascunho é local e a versão continua usando as tabelas já existentes.

## Arquivos principais alterados
- `views/dashboards/profissional-dashboard.ejs`
- `views/perfil-profissional.ejs`
- `routes/dashboards.js`
