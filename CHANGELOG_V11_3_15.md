# Contrataê v11.3.15 — fluxo profissional integrado

Base usada: `contrataeapp_v11_3_14_cadastro_reestabilizado.zip`.

## Correções principais

- Onboarding agora atualiza a URL conforme a etapa real: `step=1`, `step=2`, `step=3`, `step=4`, preservando plano e meses na URL.
- Disponibilidade ganhou resumo oculto enviado no submit para evitar perda de dias/horários ao finalizar.
- Atendimento 24h agora permite cenário híbrido: dias 24h específicos + dias com horário padrão + sábado/domingo/feriado como exceções.
- Dashboard profissional passa a exibir profissões escolhidas com sugestões em análise, por exemplo: `Marceneiro` + `analista de sistemas · em análise`.
- Solicitação de aprovação agora registra profissões selecionadas, profissões sugeridas e disponibilidade no log administrativo.
- Painel admin de solicitações passa a mostrar profissões sugeridas em “Outros” no modal de análise.
- Modal de aprovação do admin agora preenche automaticamente valor do plano, tipo “Meses” e quantidade de meses.
- Filtro de status do admin corrigido para usar os valores reais do enum: `active`, `pending`, `paused`, `excluded`.
- Botão “Excluir perfil” da dashboard profissional corrigido: agora abre modal próprio e envia para rota segura de exclusão/ocultação.
- APIs administrativas mínimas adicionadas para editar valor/prazo, pausar/reativar e ocultar profissional sem quebrar enum.
- Botões de imagem/ações receberam hover visual simples.

## Sem SQL obrigatório

Esta versão não exige SQL novo. Ela usa as tabelas já existentes: `professionals`, `professional_categories`, `profession_requests`, `professional_portfolio` e `admin_logs`.

## Observação importante

As novas profissões sugeridas continuam em `profession_requests` com status `pending`. A categoria real só deve virar categoria oficial depois de aprovação/moderação em versão futura.
