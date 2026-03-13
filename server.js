require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const helmet = require("helmet");
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// O PULO DO GATO PRO RENDER FUNCIONAR (Google Login e Sessão Segura)
app.set('trust proxy', 1);

// CONFIGURAÇÃO SUPABASE
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// CONFIGURAÇÃO MULTER PARA BANNERS
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 1. MIDDLEWARES BÁSICOS (Sempre no topo)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 2. CONFIGURAÇÃO DE SESSÃO (Deve vir ANTES de qualquer middleware que use req.session)
// No Render, trust proxy deve estar ativo para cookies seguros funcionarem
app.set("trust proxy", 1);

app.use(session({
    secret: process.env.SESSION_SECRET || "contratae_secret_key_2026",
    resave: true, // Forçar salvamento para garantir persistência em proxies
    saveUninitialized: false,
    proxy: true, // Informar ao express-session que estamos atrás de um proxy
    cookie: { 
        secure: process.env.NODE_ENV === "production", // true apenas em produção (HTTPS)
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // Aumentado para 7 dias
        httpOnly: true
    }
}));

// 3. CONFIGURAÇÃO PASSPORT (Deve vir DEPOIS da sessão)
app.use(passport.initialize());
app.use(passport.session());

// Importar Rotas de Autenticação
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

// 4. MIDDLEWARE DE VARIÁVEIS GLOBAIS (Agora com verificação de segurança)
app.use((req, res, next) => {
    const sess = req.session || {};
    res.locals.adminLogado = sess.adminLogado || false;
    res.locals.userId = sess.userId || null;
    res.locals.userType = sess.userType || null;
    res.locals.fullName = sess.fullName || null;
    
    // Gerar avatar com inicial se não houver foto
    res.locals.getAvatar = (user) => {
        if (user && user.avatar_url) return user.avatar_url;
        const name = (user && user.full_name) || (sess.fullName) || "Usuário";
        const initial = name.charAt(0).toUpperCase();
        return `https://ui-avatars.com/api/?name=${initial}&background=ffa500&color=000&bold=true`;
    };
    
    next();
});

// ============================================
// SISTEMA DE LOGIN DO ADMINISTRADOR (Painel Antigo)
// ============================================
const checkAdmin = (req, res, next) => {
    if (req.session && req.session.adminLogado) return next();
    res.redirect('/login-adm'); 
};

const checkAdminAPI = (req, res, next) => {
    if (req.session && req.session.adminLogado) return next();
    res.status(401).json({ erro: 'Acesso negado. Faça login.' });
};

app.get('/login-adm', (req, res) => {
    if (req.session && req.session.adminLogado) return res.redirect('/admin');
    res.render('login_admin', { erro: null });
});

app.post('/login-adm', (req, res) => {
    const { usuario, senha } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || '#Relaxsempre153143';

    if (usuario === adminUser && senha === adminPass) {
        req.session.adminLogado = true;
        res.redirect('/admin');
    } else {
        res.render('login_admin', { erro: 'Usuário ou senha inválidos!' });
    }
});

app.get('/logout-adm', (req, res) => {
    if (req.session) {
        req.session.destroy(); 
    }
    res.redirect('/login-adm');
});

// ============================================
// ROTAS DO PAINEL ADM (Refatorado para Novo Schema)
// ============================================
app.get("/admin", checkAdmin, async (req, res) => {
    try {
        const { categoria, status, busca, ordenar } = req.query;
        
        // Join com users para pegar o nome e email
        let query = supabase.from("professionals").select(`
            *,
            users (full_name, email),
            categories (name)
        `);
        
        if (categoria) query = query.eq('category_id', categoria);
        if (status) query = query.eq('status', status);
        
        const { data: professionals, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;

        // Mapear para o formato esperado pela view admin.ejs (se necessário)
        let filtrados = (professionals || []).map(p => ({
            id: p.id || p.user_id, // Suporte a ambas as colunas
            nome: p.users?.full_name || 'Sem Nome',
            email: p.users?.email,
            profissao: p.categories?.name || 'Sem Categoria',
            status: p.status.toUpperCase(),
            data_cadastro: p.created_at,
            valor_pago: p.valor_pago || 0,
            data_vencimento: p.data_vencimento
        }));
        
        if (busca) {
            const b = busca.toLowerCase();
            filtrados = filtrados.filter(p => 
                p.nome.toLowerCase().includes(b) || 
                p.profissao.toLowerCase().includes(b) ||
                p.email.toLowerCase().includes(b)
            );
        }
        
        const totais = {
            ativos: filtrados.filter(p => p.status === 'ACTIVE' || p.status === 'ATIVO').length,
            pendentes: filtrados.filter(p => p.status === 'PENDING' || p.status === 'PENDENTE').length,
            pausados: filtrados.filter(p => p.status === 'PAUSED' || p.status === 'PAUSADO').length,
            receitaTotal: filtrados.reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaMes: filtrados.filter(p => {
                const data = new Date(p.data_cadastro);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0)
        };

        res.render("admin", { profissionais: filtrados, totais, filtroAtivo: { categoria, status, busca, ordenar } });
    } catch (err) { 
        console.error("Erro no painel admin:", err);
        res.render("admin", { profissionais: [], totais: { ativos: 0, pendentes: 0, pausados: 0, receitaTotal: 0, receitaMes: 0 }, filtroAtivo: {} }); 
    }
});

// APIs DO PAINEL ADM
app.post("/api/profissionais/:id/aprovar", checkAdminAPI, async (req, res) => {
    try {
        const { valor, tipo_prazo, prazo, motivo } = req.body;
        const id = req.params.id;
        let dataVencimento = new Date();

        if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
        else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
        else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);

        const updateData = { 
            status: "active", 
            data_vencimento: dataVencimento.toISOString(), 
            valor_pago: parseFloat(valor)
        };
        let { error: errorAtualizar } = await supabase.from("professionals")
            .update(updateData)
            .eq("id", id);
        
        if (errorAtualizar && errorAtualizar.message.includes("column professionals.id does not exist")) {
            const { error: retryError } = await supabase.from("professionals")
                .update(updateData)
                .eq("user_id", id);
            errorAtualizar = retryError;
        }
        if (errorAtualizar) throw errorAtualizar;

        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// APIs DE BANNERS
app.get("/api/banners", checkAdminAPI, async (req, res) => {
    try {
        const { data: banners, error } = await supabase
            .from("banners")
            .select("*")
            .order("position", { ascending: true });
        if (error) throw error;
        res.json(banners || []);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// APIs DE CATEGORIAS
app.get("/api/categories", checkAdminAPI, async (req, res) => {
    try {
        const { data, error } = await supabase.from("categories").select("*").order("name");
        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/categories", checkAdminAPI, async (req, res) => {
    try {
        const { name, slug, icon_class } = req.body;
        const { data, error } = await supabase.from("categories").insert([{ name, slug, icon_class }]).select().single();
        if (error) throw error;
        res.json({ sucesso: true, data });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put("/api/categories/:id", checkAdminAPI, async (req, res) => {
    try {
        const { name, slug, icon_class } = req.body;
        const { error } = await supabase.from("categories").update({ name, slug, icon_class }).eq("id", req.params.id);
        if (error) throw error;
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete("/api/categories/:id", checkAdminAPI, async (req, res) => {
    try {
        const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// API DE RELATÓRIOS AVANÇADOS
app.get("/api/admin/reports", checkAdminAPI, async (req, res) => {
    try {
        const { start_date, end_date, category_id, status } = req.query;
        
        let query = supabase.from("professionals").select(`
            *,
            users (full_name, email),
            categories (name)
        `);
        
        if (start_date) query = query.gte('created_at', start_date);
        if (end_date) query = query.lte('created_at', end_date);
        if (category_id) query = query.eq('category_id', category_id);
        if (status) query = query.eq('status', status);
        
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        
        res.json(data || []);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================
// ROTAS DOS USUÁRIOS E PÁGINAS PÚBLICAS
// ============================================
const dashboardRoutes = require("./routes/dashboards");
app.use("/", dashboardRoutes);

app.get("/auth/login", (req, res) => res.render("auth/login", { erro: null }));
app.get("/auth/cadastro", (req, res) => res.render("auth/selecionar-tipo", { actionUrl: "/auth/cadastro-form" }));
app.get("/auth/cadastro-form", (req, res) => {
    const type = req.query.type || 'client';
    res.render("auth/cadastro", { erro: null, userType: type });
});
app.get("/esqueci-senha", (req, res) => res.render("esqueci-senha", { erro: null, sucesso: null }));
app.get("/contato", (req, res) => res.render("contato"));
app.get("/termos-de-uso", (req, res) => res.render("termos_de_uso"));

// ROTA DA HOMEPAGE
app.get("/", async (req, res) => {
    try {
        const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('position', { ascending: true });
        const { data: categories } = await supabase.from('categories').select('*');
        res.render("index", { 
            banners: banners || [],
            categories: categories || [],
            currentPage: 'index'
        });
    } catch (err) {
        res.render("index", { banners: [], categories: [], currentPage: 'index' });
    }
});

// ROTAS DE CATEGORIAS DINÂMICAS
app.get("/categoria/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        console.log("Buscando categoria para slug:", slug);
        
        // Buscar categoria pelo slug
        let { data: category, error: catError } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();
        
        // Fallback para categorias comuns se o banco estiver vazio
        if (!category) {
            const fallbacks = {
                'pintores': { id: 'pintor-id', name: 'Pintor', slug: 'pintores' },
                'pedreiros': { id: 'pedreiro-id', name: 'Pedreiro', slug: 'pedreiros' },
                'eletricistas': { id: 'eletricista-id', name: 'Eletricista', slug: 'eletricistas' },
                'encanadores': { id: 'encanadores-id', name: 'Encanador', slug: 'encanadores' }
            };
            category = fallbacks[slug];
        }

        if (!category) return res.status(404).render("404", { mensagem: "Categoria não encontrada." });

        // Buscar profissionais desta categoria
        let query = supabase
            .from('professionals')
            .select('*, users(full_name, avatar_url)')
            .eq('status', 'active');
        
        // Só filtrar por category_id se for um UUID válido (ou se não for o fallback)
        if (category.id && category.id.length === 36) {
            query = query.eq('category_id', category.id);
        } else {
            // Se for fallback, tentamos buscar pelo nome da categoria se houver essa coluna ou apenas trazemos todos (para teste)
            // No schema real, usaremos o UUID.
        }

        const { data: professionals, error } = await query;
            
        if (error) throw error;
        
        const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('position', { ascending: true });

        // Tentar renderizar view específica ou genérica
        const viewName = ['pintores', 'pedreiros', 'eletricistas', 'encanadores'].includes(slug) ? slug : 'categoria-dinamica';
        
        res.render(viewName, { 
            [slug]: professionals || [],
            profissionais: professionals || [],
            categoriaNome: category.name,
            banners: banners || [],
            currentPage: slug
        });
    } catch (err) {
        console.error("Erro na rota de categoria:", err);
        res.status(404).render("404", { mensagem: "Erro ao carregar categoria." });
    }
});

app.get("/perfil/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { data: professional, error } = await supabase
            .from("professionals")
            .select("*, users(full_name, email, phone_number, avatar_url), categories(name)")
            .eq("id", id)
            .single();

        if (error || !professional) return res.status(404).send("Profissional não encontrado.");
        res.render("perfil-profissional", { profissional });
    } catch (e) {
        res.status(500).send("Erro interno ao carregar o perfil.");
    }
});

app.use((req, res) => res.status(404).render("404", { mensagem: "Página não encontrada." }));

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
