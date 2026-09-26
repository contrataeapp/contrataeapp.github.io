# v11.3.27 - Ajustes de dashboard profissional e análise de profissões no ADM

Base: v11.3.26.

## Mantido
- Layout público aprovado não foi redesenhado.
- Fluxo de contato/WhatsApp foi mantido.
- SQL da v11.3.26 continua válido; esta versão não exige nova tabela.

## Dashboard profissional
- A foto/avatar no canto superior direito agora é clicável para trocar a foto de perfil diretamente.
- A aba Minhas Profissões ganhou guia rápido de uso para o primeiro contato do profissional.
- O seletor de profissão agora também permite visualizar profissões em análise, exibindo aviso em vez de esconder/desabilitar completamente.
- Adicionado aviso visual "Você está editando" dentro de cada profissão.
- Botão renomeado para "Visualizar antes de publicar".
- Ajustado alerta flutuante de novo contato para não ficar como frase perdida/cortada no rodapé da página.

## Painel ADM
- A aba Solicitações agora também lista profissões novas pendentes de profissionais já ativos.
- O ADM pode aprovar ou recusar uma profissão solicitada.
- Ao aprovar uma profissão nova, o sistema cria a categoria se ela ainda não existir, vincula ao profissional e sincroniza a estrutura de profissões por perfil quando disponível.
- Quando um profissional é aprovado, profissões pendentes do cadastro também são tentadas automaticamente.
- A lista de profissionais mostra profissões pendentes em análise junto do profissional.
- Assinaturas vencidas aparecem como VENCIDO e com destaque visual no vencimento/status.
- O modal de edição do ADM deixa claro que é para pagamento/vencimento e mostra resumo do profissional.

## Segurança de migração
- Não há DROP/DELETE destrutivo novo.
- Não há SQL novo obrigatório nesta versão.
