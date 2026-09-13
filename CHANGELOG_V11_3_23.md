# Contrataê v11.3.23 — notificação robusta e rodapé/categorias

## Ajustes aplicados

- Contact leads agora tem fallback por RPC `SECURITY DEFINER`, evitando bloqueio por RLS quando o backend está usando a chave pública do Supabase.
- `/api/contact-leads` tenta insert direto e, se o Supabase bloquear, chama `create_contact_lead`.
- `/api/profissional/contatos-pendentes` tenta select direto e, se bloquear, chama `get_professional_contact_leads`.
- Atualização de status em “Meus Serviços” também tem fallback por `update_contact_lead_status`.
- Contador da dashboard profissional tenta recuperar contatos via RPC quando o select direto não funciona.
- Rodapé/carrossel de parceiros ficou compacto e com imagem sem deformar nas páginas públicas/categorias.
- Removido modal/script duplicado em `categoria-dinamica.ejs`, reduzindo conflito de IDs e comportamento diferente entre páginas.
- `categoria-vazia.ejs` também deixou de duplicar scripts que já vêm pelo footer.

## SQL necessário

Rode o arquivo `SQL_CORRECAO_CONTACT_LEADS_RPC_V11_3_23.sql` no Supabase antes de testar a notificação.

## Teste recomendado

1. Subir a versão no Git/Render.
2. Entrar como cliente.
3. Abrir um perfil público.
4. Clicar em “Contratar Agora” e confirmar o WhatsApp.
5. Entrar como profissional.
6. Abrir “Meus Serviços”.
7. Conferir `SELECT * FROM public.contact_leads ORDER BY contacted_at DESC LIMIT 20;`.
