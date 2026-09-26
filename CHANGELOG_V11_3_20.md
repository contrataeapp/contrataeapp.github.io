# Contrataê v11.3.20 — contato protegido e perfil público funcional

## Ajustes principais

- O botão **Contratar Agora/Contatar** não expõe mais o número do WhatsApp do profissional no HTML público das páginas de categoria/perfil.
- Visitante sem login agora recebe modal pedindo para **entrar ou criar conta de cliente** antes de chamar o profissional.
- Cadastro/login de cliente passou a preservar `next`, voltando para o perfil/categoria depois do acesso.
- Clique autorizado em profissional logado registra um contato em `contact_leads`, quando o SQL novo estiver rodado.
- Dashboard do profissional ganhou área de **Serviços pendentes**, com alerta visual piscando e sons enviados pelo usuário.
- Profissional pode marcar contato como **Aceitei o serviço**, **Não fechei** ou **Arquivar**.
- Profissões sugeridas/em análise não aparecem mais como tags públicas no perfil do profissional.
- Tags públicas de profissões aprovadas agora são clicáveis e levam para a categoria correspondente.
- Texto “Mascote Contrataê garante sua segurança” foi substituído por mensagem mais clara de histórico e segurança.
- Galeria do perfil público ganhou lightbox para ampliar/navegar imagens sem sair da página.
- Imagens da galeria pública usam `object-fit: contain` para reduzir cortes/zoom excessivo.

## SQL novo

Rodar `sql_scripts/06_contact_leads.sql` no Supabase para ativar histórico/notificações de contatos.

Sem esse SQL, o WhatsApp ainda abre para cliente logado, mas a dashboard não registra o serviço pendente.

## Arquivos de áudio

- `public/audio/novo-contato.mp3`
- `public/audio/alerta-contato.mp3`

Observação: navegadores podem bloquear áudio automático até o usuário clicar em alguma área da dashboard.
