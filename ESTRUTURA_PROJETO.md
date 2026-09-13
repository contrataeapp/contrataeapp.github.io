# 🏗️ Estrutura do Projeto Contrataê (Março 2026)

Este documento serve como um guia técnico para qualquer IA (como o Gemini) ou desenvolvedor que assuma o projeto. Ele detalha a arquitetura, as tecnologias e a função de cada arquivo.

---

## 🛠️ Tecnologias Utilizadas
- **Backend:** Node.js com Express.
- **Frontend:** EJS (Embedded JavaScript) para templates dinâmicos.
- **Banco de Dados:** Supabase (PostgreSQL) com autenticação via Google OAuth (Passport.js).
- **Hospedagem:** Render (com suporte a proxies e sessões seguras).
- **Estilização:** CSS puro com foco em responsividade mobile (estilo App).

---

## 📂 Estrutura de Pastas e Arquivos

### 📁 `/` (Raiz)
- **`server.js`**: O coração da aplicação. Configura middlewares (sessão, segurança, CORS), inicializa o Passport, define as rotas do Painel Administrativo e as APIs de gestão de profissionais.
- **`package.json`**: Lista de dependências (express, supabase, passport, bcrypt, etc.).
- **`.env`**: Variáveis de ambiente (Supabase URL/Key, Google Client ID/Secret, Session Secret).

### 📁 `routes/` (Lógica de Rotas)
- **`auth.js`**: Gerencia todo o fluxo de autenticação. Inclui o login tradicional (e-mail/senha) e o login social com Google (estilo Airbnb: procura e-mail -> vincula ID -> cria se novo).
- **`dashboards.js`**: Controla as rotas de visualização dos dashboards de Clientes e Profissionais.

### 📁 `views/` (Templates HTML/EJS)
- **`index.ejs`**: Página inicial com busca de profissionais e banners dinâmicos.
- **`admin.ejs`**: Painel administrativo completo (gestão de status, pagamentos e relatórios).
- **`cadastro.ejs`**: Formulário de registro com opção de "olhinho" na senha e login Google.
- **`login.ejs` / `login_admin.ejs`**: Telas de acesso.
- **`categoria.ejs`**: Template genérico que exibe profissionais de qualquer categoria (Diarista, Eletricista, etc.).
- **`404.ejs`**: Página de erro amigável para rotas inexistentes.
- **`avaliacao.ejs` / `termos_de_uso.ejs`**: Páginas institucionais do rodapé.

#### 📁 `views/partials/` (Componentes Reutilizáveis)
- **`header.ejs`**: Cabeçalho com menu mobile e botão de tema (claro/escuro).
- **`footer.ejs`**: Rodapé com barra de navegação inferior (estilo App) e script do V-Libras.
- **`head.ejs`**: Metadados, fontes e links de CSS comuns.

### 📁 `public/` (Arquivos Estáticos)
#### 📁 `public/css/`
- **`index.css`**: Estilos da home e componentes globais.
- **`admin.css`**: Estilos específicos do painel administrativo (responsivo).
- **`style_laranja_preto.css`**: Identidade visual principal da marca.
#### 📁 `public/js/`
- **`index.js`**: Lógica do menu mobile, V-Libras e interações da home.
- **`admin.js`**: Lógica do painel admin (modais, filtros, geração de relatórios PDF/Excel).
- **`theme-toggle.js`**: Script que gerencia a alternância entre modo claro e escuro.

---

## 🔑 Fluxos Críticos

### 1. Login com Google (Airbnb Style)
Implementado em `routes/auth.js`. O sistema não cria contas duplicadas. Se o e-mail já existe, ele apenas vincula o Google ID. Se for novo, cria a conta como "Cliente" por padrão.

### 2. Painel Administrativo
As ações de **Pausar/Reativar** e **Relatórios** dependem de rotas de API no `server.js` que comunicam com o Supabase. O RLS (Row Level Security) está desativado temporariamente para garantir que o Admin consiga gerir tudo sem bloqueios.

### 3. Responsividade Mobile
As páginas `contato.ejs`, `outros.ejs` e `admin.ejs` foram ajustadas para exibir uma barra de navegação inferior no mobile, simulando a experiência de um aplicativo nativo.

---

## 🚀 Próximos Passos Recomendados
1. **PWA:** Criar `manifest.json` para tornar o site instalável.
2. **Portfólio:** Criar rota para upload de múltiplas imagens de trabalho.
3. **Mensagens WhatsApp:** Automatizar o texto de orçamento nos links.
4. **Segurança:** Reativar o RLS no Supabase com políticas específicas para o Admin.
