# Análise do Projeto Contrataê: Banco de Dados e Autenticação

## Introdução

Este relatório apresenta uma análise detalhada do projeto Contrataê, com foco na estrutura do banco de dados no Supabase e no fluxo de autenticação de usuários, incluindo o login via Google. A análise foi solicitada para identificar inconsistências, potenciais conflitos e problemas de usabilidade, além de fornecer uma recomendação sobre a necessidade de refatoração do banco de dados.

## 1. Análise do Fluxo de Autenticação e Usabilidade

### 1.1. Login com Google e Redirecionamento

O problema principal reportado — usuário que faz login com Google é redirecionado para o dashboard do cliente sem opção de saída — foi confirmado através da análise do código.

- **Causa Raiz:** O arquivo `routes/auth.js`, na rota de callback do Google (`/google/callback`), redireciona o usuário para a raiz (`/`) se ele for do tipo `client`. No entanto, a lógica de onboarding força um usuário recém-criado via Google a definir seu tipo (`client` ou `professional`). Após o onboarding, se o usuário escolher "cliente", ele é direcionado para a raiz, que por sua vez o redireciona para o dashboard do cliente. O problema é que o dashboard do cliente (`views/cliente-dashboard.ejs`) possui uma barra de navegação lateral própria e não inclui o cabeçalho principal (`views/partials/header.ejs`), que contém o menu de navegação e o botão "Sair".

- **Código Relevante (`routes/auth.js`):

```javascript
// ... na rota /google/callback
if (req.user.user_type === 'professional') {
    res.redirect('/profissional/completar-perfil');
} else {
    // Clientes vão direto para a raiz, que pode redirecionar ao dashboard
    res.redirect('/');
}
```

- **Código do Dashboard do Cliente (`views/cliente-dashboard.ejs`):

```html
<!-- A barra lateral tem seu próprio link de logout -->
<aside class="sidebar">
    <nav>
        <ul>
            <!-- ... outros itens -->
            <li><a href="/auth/logout"><i class="fas fa-power-off"></i> Sair</a></li>
        </ul>
    </nav>
</aside>
```

**Diagnóstico:** O botão "Sair" **existe** no dashboard do cliente, mas está na barra lateral e não no cabeçalho superior, como em outras páginas. O usuário pode não ter notado o link na barra lateral. A experiência do usuário é inconsistente, pois a navegação principal desaparece, causando a sensação de estar "preso".

### 1.2. Onboarding de Usuários

O sistema força corretamente um novo usuário (criado via Google ou manualmente) a passar por uma tela de `onboarding` para definir seu tipo, `client` ou `professional`. Isso é uma boa prática e está funcionando conforme o esperado. A lógica em `server.js` e `routes/auth.js` garante que usuários sem `user_type` definido sejam sempre redirecionados para `/onboarding`.

## 2. Análise da Estrutura do Banco de Dados

Após analisar o arquivo de especificação do banco de dados (`pasted_content.txt`) e cruzar as informações com o uso das tabelas no código-fonte, foram identificados vários pontos de melhoria.

### 2.1. Redundância e Nomenclatura

Foram encontradas tabelas com propósitos muito similares e uma mistura de idiomas (português e inglês) nos nomes das tabelas e colunas, como suspeitado pelo usuário.

| Tabela(s) Redundante(s) | Tabela em Uso no Código | Análise e Conflito |
| :--- | :--- | :--- |
| `avaliacoes`, `ratings` | `comments` | O código utiliza a tabela `comments` para buscar avaliações no painel de administração (`server.js`, linha 336). As tabelas `avaliacoes` e `ratings` não são referenciadas no backend, indicando que são legadas ou não utilizadas. Isso gera confusão e duplicação de dados. |
| `profissionais` | `professionals` | O código utiliza **ambas** as tabelas em contextos diferentes. O painel de administração (`server.js`) usa majoritariamente `profissionais`, enquanto as rotas de dashboard do profissional e de categorias (`routes/dashboards.js` e `server.js`) usam `professionals`. Isso é um **ponto crítico de conflito** que pode levar a inconsistências graves de dados. |

### 2.2. Inconsistências de Relacionamento

- **`users` vs. `professionals`/`profissionais`:** Um usuário pode ter `user_type = 'professional'`, mas não há garantia de que um registro correspondente exista na tabela `professionals` ou `profissionais`. O código tenta buscar um perfil profissional (`routes/dashboards.js`, linha 21), mas não trata o caso em que o perfil não existe, o que pode causar erros ou comportamentos inesperados no dashboard do profissional.

- **Chaves Estrangeiras:** A estrutura fornecida não detalha as chaves estrangeiras, mas a forma como as queries são feitas (ex: `comments` buscando dados de `users` e `profissionais`) sugere que os relacionamentos existem. No entanto, a duplicidade de tabelas como `profissionais` e `professionals` quebra a integridade referencial.

## 3. Diagnóstico Geral e Recomendações

O sistema possui uma base funcional, mas a estrutura do banco de dados apresenta problemas significativos que justificam uma refatoração. Manter o estado atual com correções pontuais seria arriscado e ineficiente a longo prazo.

**Recomendação principal: Recriar o schema do banco de dados.**

A recriação permitirá consolidar tabelas, padronizar a nomenclatura (recomendo o uso exclusivo de inglês para seguir as convenções do Supabase e de bibliotecas Node.js) e estabelecer relacionamentos claros e íntegros.

### 3.1. Proposta de Novo Schema (Otimizado)

A seguir, uma proposta de schema que unifica as tabelas, padroniza nomes e mantém todas as funcionalidades críticas.

- **`users`**: Tabela central para todos os usuários.
  - `id` (uuid, pk)
  - `email` (text, unique)
  - `password` (text, nullable) - Nulo para usuários OAuth.
  - `full_name` (text)
  - `avatar_url` (text)
  - `google_id` (text, unique, nullable)
  - `user_type` (enum: 'client', 'professional')
  - `created_at`, `updated_at`

- **`professionals`**: Perfil detalhado do profissional, com relação 1-para-1 com `users`.
  - `user_id` (uuid, pk, fk para `users.id`)
  - `category_id` (uuid, fk para `categories.id`)
  - `description` (text)
  - `price_info` (text)
  - `availability` (text)
  - `status` (enum: 'active', 'pending', 'paused')
  - `payment_value` (numeric)
  - `plan_expires_at` (timestamptz)
  - `created_at`, `updated_at`

- **`categories`**: Categorias de serviços.
  - `id` (uuid, pk)
  - `name` (text, unique)
  - `slug` (text, unique)
  - `icon_url` (text)

- **`reviews`**: Unifica `avaliacoes`, `comments` e `ratings`.
  - `id` (uuid, pk)
  - `professional_id` (uuid, fk para `professionals.user_id`)
  - `client_id` (uuid, fk para `users.id`)
  - `rating` (integer, 1-5)
  - `comment` (text)
  - `status` (enum: 'visible', 'hidden', 'pending')
  - `created_at`, `updated_at`

- **`services`**: Mantida, mas com chaves estrangeiras claras.
  - `id` (uuid, pk)
  - `professional_id` (uuid, fk para `professionals.user_id`)
  - `client_name` (text) - Pode ser substituído por `client_id` se o cliente também for um usuário logado.
  - `description` (text)
  - `value` (numeric)
  - `status` (enum: 'pending', 'completed', 'canceled')
  - `created_at`, `updated_at`

- **`favorites`**, **`banners`**, **`contatos`**, **`logs_adm`**: Podem ser mantidas com pequenas adaptações de nomenclatura e chaves estrangeiras para o novo schema.

### 3.2. Plano de Ação Sugerido

1.  **Backup Completo:** Antes de qualquer alteração, realize um backup completo do seu banco de dados Supabase.
2.  **Gerar Script SQL:** Com base na proposta acima, posso gerar um script SQL completo para criar o novo schema.
3.  **Refatoração do Código:** O código do backend (`server.js`, `routes/*.js`) precisará ser atualizado para usar os novos nomes de tabelas e colunas. Esta é a etapa mais crítica e demorada.
    -   Unificar todas as chamadas para `profissionais` e `professionals` para a nova tabela `professionals`.
    -   Substituir chamadas a `comments` pela nova tabela `reviews`.
    -   Ajustar as queries do painel de administração para refletir o novo schema.
4.  **Migração de Dados:** Criar scripts para migrar os dados das tabelas antigas para as novas, garantindo que nenhuma informação seja perdida.
5.  **Correção da Usabilidade:** Unificar a experiência do usuário, garantindo que o cabeçalho principal (`partials/header.ejs`) seja incluído em **todas** as páginas, incluindo os dashboards, para fornecer uma navegação consistente e um ponto de saída claro.

## Conclusão

O projeto está em um ponto onde a complexidade acidental do banco de dados começa a gerar riscos operacionais e de desenvolvimento. **A recomendação é fortemente a favor da refatoração do schema do banco de dados.** Embora exija um esforço inicial de planejamento e execução, os benefícios em termos de manutenibilidade, estabilidade e escalabilidade futura são imensos.

Estou à disposição para gerar o script SQL para o novo schema e auxiliar no processo de refatoração do código, se assim desejar. Por favor, me informe como gostaria de prosseguir.
