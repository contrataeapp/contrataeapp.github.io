# Próximas etapas após v11.3.41

## 1. v11.3.42 — Meu Plano (prioridade imediata)
- Evitar jargão `upgrade/downgrade` na interface.
- Usar: `Mudar de plano`, `Aumentar meu plano`, `Reduzir meu plano`, `Liberar mais profissões`.
- Mostrar plano atual, novo plano, quantidade de profissões e impacto no valor antes da confirmação.
- Solicitação de mudança com comprovante/WhatsApp conforme regra comercial.
- Solicitação chega ao ADM.
- ADM confere e aprova.
- Aumento libera slot(s) novos para cadastro.
- Redução nunca apaga profissão ou portfólio: usuário escolhe o que continua ativo e o excedente fica em stand-by.
- Preservar possibilidade de reativação futura.

## 2. Meus Serviços / Leads / Orçamentos
- `Tenho interesse`, `Quero orçamento`, `Contratar`.
- Visita passiva continua anônima; somente interesse explícito vira lead identificado.
- Lead: avatar existente do cliente, nome, data, profissão e WhatsApp/e-mail permitido.
- Criar orçamento dentro do lead.
- Descrição, itens, valores, validade e status.
- Compartilhar por WhatsApp e e-mail.
- Histórico: novo, orçamento enviado, aceito, não fechado, em andamento, concluído.
- Gerar PDF de Orçamento / Ordem de Serviço / Comprovante de Serviço com aviso `DOCUMENTO NÃO FISCAL`.
- NFS-e verdadeira fica para integração fiscal separada futura.

## 3. Anexos temporários do cliente
- Fotos do problema são diferentes do avatar.
- Bucket/estrutura separados e temporários.
- Descrição + fotos opcionais na solicitação de orçamento.
- Depois de visualização/status/prazo, anexos podem expirar e ser removidos automaticamente.
- Histórico textual/financeiro do orçamento permanece.
- Se anexo expirar, permitir `Solicitar nova foto`.

## 4. Conta e acesso
- `Mais -> Meu Perfil/Conta -> Desativar meu perfil profissional`.
- Solicitação vai ao ADM.
- Perfil fica oculto/stand-by, sem exclusão imediata de dados.
- Reativação futura possível conforme política.
- Revisar `Esqueci minha senha`, troca/recuperação de e-mail e segurança de conta.

## 5. Rascunho no Supabase (melhoria, não urgência)
- v11.3.41 mantém rascunho local para não arriscar regressão.
- Futuramente: autosave de rascunho no Supabase por profissão para continuidade entre aparelhos.
- Publicado e rascunho devem continuar separados; nada é publicado automaticamente.

## 6. Área do Cliente
Depois que Área Profissional estiver fechada:
- polimento mobile equivalente;
- histórico de interesses/orçamentos/serviços;
- avaliações vinculadas a interações reais;
- favoritos;
- troca clara entre modo Cliente e modo Profissional usando a mesma identidade quando possível.

## 7. Institucional / ADM
- Página Quem Somos/Sobre o Contrataê.
- Página Instalar já existe; continuar refinando com testes reais Android/iOS.
- ADM futuro: configurações institucionais editáveis (e-mail, localização, Instagram, Facebook, X/Twitter etc.) refletidas no site público.
