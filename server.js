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

// CONFIGURAÇÃO SUPABASE - Usando estritamente process.env para segurança no Render
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

// 2. CONFIGURAÇÃO DE SESSÃO
app.use(session({
    secret: process.env.SESSION_SECRET || "contratae_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// 3. CONFIGURAÇÃO PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// Importar Rotas de Autenticação
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

// 4. MIDDLEWARE DE VARIÁVEIS GLOBAIS
app.use((req, res, next) => {
    const sess = req.session || {};
    res.locals.adminLogado = sess.adminLogado || false;
    res.locals.userId = sess.userId || null;
    res.locals.userType = sess.userType || null;
    res.locals.fullName = sess.fullName || null;
    res.locals.user = req.user || null;
    next();
});

// ============================================
// SISTEMA DE LOGIN DO ADMINISTRADOR
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
        
        // Join com users e categories
        let query = supabase
            .from("professionals")
            .select(`
                *,
                users (full_name, email, phone_number),
                categories (name)
            `);

        if (categoria) query = query.eq('category_id', categoria);
        if (status) query = query.eq('status', status.toLowerCase());
        
        const { data: professionals, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;

        let filtrados = (professionals || []).filter(p => p.id && p.users);
        
        if (!status) filtrados = filtrados.filter(p => p.status !== 'excluded');
        
        if (busca) {
            const term = busca.toLowerCase();
            filtrados = filtrados.filter(p => 
                p.users.full_name.toLowerCase().includes(term) || 
                (p.categories && p.categories.name.toLowerCase().includes(term))
            );
        }

        const totais = {
            ativos: professionals.filter(p => p.status === 'active').length,
            pendentes: professionals.filter(p => p.status === 'pending').length,
            pausados: professionals.filter(p => p.status === 'paused').length,
            receitaTotal: professionals.reduce((acc, p) => acc + (parseFloat(p.payment_value) || 0), 0),
            receitaMes: professionals.filter(p => {
                const data = new Date(p.updated_at || p.created_at);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.payment_value) || 0), 0)
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
        const id = req.params.id; // UUID
        let plan_expires_at = new Date();

        if (tipo_prazo === 'dias') plan_expires_at.setDate(plan_expires_at.getDate() + parseInt(prazo));
        else if (tipo_prazo === 'meses') plan_expires_at.setDate(plan_expires_at.getDate() + (parseInt(prazo) * 30));
        else if (tipo_prazo === 'data') plan_expires_at = new Date(prazo);

        const { error: errorAtualizar } = await supabase.from("professionals")
            .update({ 
                status: "active", 
                plan_expires_at: plan_expires_at.toISOString(), 
                payment_value: parseFloat(valor), 
                updated_at: new Date().toISOString() 
            })
            .eq("id", id);
        if (errorAtualizar) throw errorAtualizar;

        await supabase.from("admin_logs").insert({
            professional_id: id, 
            action_type: "APROVAÇÃO",
            new_values: { status: "active", payment_value: parseFloat(valor), plan_expires_at: plan_expires_at.toISOString() },
            edit_reason: motivo || 'Aprovação inicial',
            performed_by: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================
// ROTAS PÚBLICAS E CATEGORIAS
// ============================================
app.get("/", async (req, res) => {
    try {
        const { data: banners } = await supabase.from("banners").select("*").eq("is_active", true).order("order", { ascending: true });
        const { data: categories } = await supabase.from("categories").select("*").order("name", { ascending: true });
        res.render("index", { banners: banners || [], categories: categories || [], currentPage: 'index' });
    } catch (err) {
        console.error(err);
        res.render("index", { banners: [], categories: [], currentPage: 'index' });
    }
});

app.get("/categoria/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        
        const { data: category, error: catError } = await supabase
            .from('categories')
            .select('*')
            .eq('slug', slug)
            .single();
            
        if (catError || !category) throw new Error("Categoria não encontrada");

        const { data: professionals, error } = await supabase
            .from('professionals')
            .select(`
                *,
                users (full_name, avatar_url)
            `)
            .eq('category_id', category.id)
            .eq('status', 'active');
            
        if (error) throw error;
        
        const { data: banners } = await supabase
            .from('banners')
            .select('*')
            .eq('is_active', true)
            .order('order', { ascending: true });

        res.render("categoria", { 
            profissionais: professionals || [],
            categoriaNome: category.name,
            banners: banners || [],
            currentPage: slug
        });
    } catch (err) {
        console.error("Erro na rota de categoria:", err);
        res.status(404).render("404", { mensagem: "Categoria não encontrada." });
    }
});

// DASHBOARDS
const dashboardRoutes = require("./routes/dashboards");
app.use("/", dashboardRoutes);

app.get("/contato", (req, res) => res.render("contato"));
app.post("/api/contato", async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const { error } = await supabase.from("contacts").insert([{ name, email, subject, message }]);
        if (error) throw error;
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.use((req, res) => {
    res.status(404).render("404", { mensagem: "Página não encontrada." });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
