# Contrataê v11.3.35 — fechamento de perfil, contato e orientação

- disponibilidade pública ignora especificamente anotações legadas de implementação e mostra 'a combinar' até o profissional publicar a nova disponibilidade estruturada;
- botão de retorno do perfil público virou uma pílula minimalista e sticky, permanecendo acessível durante a rolagem;
- resumo não soma mais todos os portfólios: mostra profissão + quantidade separadamente;
- portfólio mostra permanentemente qual profissão está sendo editada e pulsa o seletor ao entrar na área;
- controles de ordenar/legenda/remover foram reorganizados para a parte inferior da miniatura, com ícones compactos no mobile;
- Meu Perfil ganhou máscara de WhatsApp, telefone fixo opcional, máscara/busca de CEP via endpoint já existente, rua, número, bairro, complemento e opção de exibir ou ocultar endereço completo;
- perfil público pode mostrar botão 'Abrir no Maps' somente quando o profissional autorizou endereço completo;
- texto interno de roadmap foi removido do Resumo;
- corrigida duplicação de elemento da imagem do lightbox;
- orçamento/faturamento real continuam adiados para depois da aprovação desta dashboard, evitando regressão agora.

## Banco
Rodar `sql_scripts/11_professional_contact_address.sql` uma vez antes de salvar os novos campos de endereço/telefone fixo.
