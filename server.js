require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const port = process.env.PORT || 3000;

// CONFIGURAÇÃO SUPABASE
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// MIDDLEWARES
// Desativando CSP restritivo para resolver erros de bloqueio no Render
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

// CONFIGURAÇÃO DE SESSÃO
app.use(session({
    secret: process.env.SESSION_SECRET || "contratae_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// CONFIGURAÇÃO PASSPORT
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ESTRATÉGIA GOOGLE OAUTH
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://contrataeapp.onrender.com/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const { data: user, error } = await supabase
                .from("users")
                .select("*")
                .eq("email", email)
                .single();

            if (error && error.code !== "PGRST116") throw error;

            if (user) {
                // Atualizar google_id se necessário
                if (!user.google_id) {
                    await supabase.from("users").update({ google_id: profile.id, avatar_url: profile.photos[0].value }).eq("id", user.id);
                }
                return done(null, user);
            } else {
                // Criar novo usuário
                const { data: newUser, error: createError } = await supabase
                    .from("users")
                    .insert([{
                        email: email,
                        full_name: profile.displayName,
                        google_id: profile.id,
                        avatar_url: profile.photos[0].value,
                        user_type: "client" // Padrão inicial
                    }])
                    .select()
                    .single();
                
                if (createError) throw createError;
                return done(null, newUser);
            }
        } catch (err) {
            return done(err, null);
        }
    }));
}

// FUNÇÃO AUXILIAR PARA BANNERS
async function obterBannersAtivos() {
    try {
        const { data, error } = await supabase
            .from("banners")
            .select("*")
            .eq("ativo", true)
            .order("ordem", { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Erro ao obter banners:", err);
        return [];
    }
}

// ============================================
// ROTAS ADMINISTRATIVAS (RESTAURADAS DO BACKUP)
// ============================================
const checkAdmin = (req, res, next) => {
    if (req.session.adminLogado) return next();
    res.redirect("/login-adm"); 
};

app.get("/login-adm", (req, res) => {
    if (req.session.adminLogado) return res.redirect("/admin");
    res.render("login_admin", { erro: null, currentPage: "admin" });
});

app.post("/login-adm", (req, res) => {
    const { usuario, senha } = req.body;
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASS || "#Relaxsempre153143";

    console.log("Tentativa de login admin:", usuario);

    if (usuario === adminUser && senha === adminPass) {
        req.session.adminLogado = true;
        req.session.save((err) => {
            if (err) {
                console.error("Erro ao salvar sessão admin:", err);
                return res.render("login_admin", { erro: "Erro interno ao processar login.", currentPage: "admin", adminLogado: false });
            }
            console.log("Login admin bem-sucedido!");
            res.redirect("/admin");
        });
    } else {
        console.log("Login admin falhou: credenciais incorretas");
        res.render("login_admin", { erro: "Usuário ou senha inválidos!", currentPage: "admin", adminLogado: false });
    }
});

app.get("/logout-adm", (req, res) => {
    req.session.adminLogado = false;
    res.redirect("/login-adm");
});

app.get("/admin", checkAdmin, async (req, res) => {
    try {
        const { categoria, status, busca, ordenar } = req.query;
        // Sincronizado com a nova tabela 'professionals' e fazendo join com 'users'
        let query = supabase.from("professionals").select("*, users(*), categories(*)");
        
        const { data: profissionaisRaw, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;

        // Mapear para o formato esperado pelo admin.ejs (compatibilidade)
        let profissionais = (profissionaisRaw || []).map(p => ({
            id: p.id,
            nome: p.users ? p.users.full_name : "N/A",
            email: p.users ? p.users.email : "N/A",
            foto: p.photo_url || p.users?.avatar_url,
            profissao: p.categories ? p.categories.name : "N/A",
            status: p.status ? p.status.toUpperCase() : "PENDENTE",
            valor_pago: parseFloat(p.valor_pago) || 0,
            data_vencimento: p.data_vencimento
        }));

        if (categoria) profissionais = profissionais.filter(p => p.profissao === categoria);
        if (status) profissionais = profissionais.filter(p => p.status === status);
        if (busca) {
            const termo = busca.toLowerCase();
            profissionais = profissionais.filter(p => 
                p.nome.toLowerCase().includes(termo) || 
                p.profissao.toLowerCase().includes(termo) ||
                p.email.toLowerCase().includes(termo)
            );
        }

        const totais = {
            ativos: profissionais.filter(p => p.status === "ATIVO").length,
            pendentes: profissionais.filter(p => p.status === "PENDENTE").length,
            pausados: profissionais.filter(p => p.status === "PAUSADO").length,
            receitaTotal: profissionais.reduce((acc, p) => acc + p.valor_pago, 0),
            receitaMes: 0 
        };

        res.render("admin", { 
            profissionais, 
            totais, 
            filtroAtivo: { categoria, status, busca, ordenar }, 
            currentPage: "admin", 
            adminLogado: req.session.adminLogado 
        });
    } catch (err) { 
        console.error("Erro no Admin:", err);
        res.render("admin", { 
            profissionais: [], 
            totais: { ativos: 0, pendentes: 0, pausados: 0, receitaTotal: 0, receitaMes: 0 }, 
            filtroAtivo: {}, 
            currentPage: "admin", 
            adminLogado: true 
        }); 
    }
});

// ============================================
// ROTAS PÚBLICAS
// ============================================
app.get("/", async (req, res) => {
    try {
        const banners = await obterBannersAtivos();
        res.render("index", { banners, currentPage: "index", adminLogado: req.session.adminLogado });
    } catch (err) {
        res.render("index", { banners: [], currentPage: "index", adminLogado: req.session.adminLogado });
    }
});

app.get("/contato", async (req, res) => {
    try {
        const banners = await obterBannersAtivos();
        res.render("contato", { banners, currentPage: "contato", adminLogado: req.session.adminLogado });
    } catch (err) {
        res.render("contato", { banners: [], currentPage: "contato", adminLogado: req.session.adminLogado });
    }
});

app.get("/outros", async (req, res) => {
    try {
        const { data: categorias, error } = await supabase.from("categories").select("*").order("name");
        const banners = await obterBannersAtivos();
        res.render("outros", { categorias: categorias || [], banners, currentPage: "outros", adminLogado: req.session.adminLogado });
    } catch (err) {
        res.render("outros", { categorias: [], banners: [], currentPage: "outros", adminLogado: req.session.adminLogado });
    }
});

// ROTAS DE AUTENTICAÇÃO USUÁRIO
app.get("/auth/login", (req, res) => {
    res.render("auth/login", { currentPage: "login", erro: null, adminLogado: req.session.adminLogado });
});

app.get("/auth/cadastro", (req, res) => {
    res.render("auth/cadastro", { currentPage: "cadastro", erro: null, adminLogado: req.session.adminLogado });
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/auth/login" }),
    (req, res) => {
        req.session.userId = req.user.id;
        req.session.userType = req.user.user_type;
        req.session.fullName = req.user.full_name;
        res.redirect("/");
    }
);

// ROTAS DE CATEGORIAS FIXAS
const categoriasFixas = [
    { rota: "pintores", profissao: "Pintor" },
    { rota: "pedreiros", profissao: "Pedreiro" },
    { rota: "eletricistas", profissao: "Eletricista" },
    { rota: "encanadores", profissao: "Encanador" }
];

categoriasFixas.forEach(({ rota, profissao }) => {
    app.get(`/${rota}`, async (req, res) => {
        try {
            const { data, error } = await supabase.from("professionals").select("*, users(*)").eq("status", "active");
            const banners = await obterBannersAtivos();
            res.render(rota, { [rota]: data || [], banners, currentPage: rota, adminLogado: req.session.adminLogado });
        } catch (err) { 
            res.render(rota, { [rota]: [], banners: [], currentPage: rota, adminLogado: req.session.adminLogado }); 
        }
    });
});

// ROTA DINÂMICA PARA CATEGORIAS
app.get("/categoria/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: categoriaData } = await supabase.from("categories").select("*").eq("slug", slug).single();
        
        if (!categoriaData) {
            return res.status(404).render("categoria-vazia", { banners: [], currentPage: "outros", adminLogado: req.session.adminLogado });
        }

        const { data: profissionais } = await supabase
            .from("professionals")
            .select("*, users(*)")
            .eq("category_id", categoriaData.id)
            .eq("status", "active");

        const banners = await obterBannersAtivos();

        if (!profissionais || profissionais.length === 0) {
            return res.render("categoria-vazia", { categoria: categoriaData, banners, currentPage: "outros", adminLogado: req.session.adminLogado });
        }

        res.render("categoria-dinamica", { categoria: categoriaData, profissionais, banners, currentPage: "outros", adminLogado: req.session.adminLogado });
    } catch (err) {
        res.status(500).send("Erro interno do servidor");
    }
});

// ROTA DE CONTATO
app.post("/api/contato", async (req, res) => {
    try {
        const { nome, email, assunto, mensagem } = req.body;
        if (!nome || !email || !assunto || !mensagem) {
            return res.status(400).json({ erro: "Campos obrigatórios não preenchidos" });
        }

        // Salvar no Supabase para o Admin ver
        const { error: dbError } = await supabase
            .from("contatos")
            .insert([{ nome, email, assunto, mensagem, data_envio: new Date() }]);

        if (dbError) console.error("Erro ao salvar contato no banco:", dbError);

        // Enviar por E-mail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER || 'seu-email@gmail.com', pass: process.env.EMAIL_PASS || 'sua-senha-app' }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER || "noreply@contratae.com",
            to: "time.contratae@gmail.com",
            subject: `Novo contato: ${assunto}`,
            html: `<h2>Novo Contato</h2><p><strong>Nome:</strong> ${nome}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Assunto:</strong> ${assunto}</p><p><strong>Mensagem:</strong></p><p>${mensagem}</p>`
        }).catch(err => console.error("Erro ao enviar e-mail:", err));

        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao processar contato:", err);
        res.status(500).json({ erro: "Erro ao enviar mensagem. Tente novamente." });
    }
});

// DASHBOARDS
const dashboardRoutes = require("./routes/dashboards");
app.use("/", dashboardRoutes);

app.listen(port, () => {
    console.log(`🚀 Contrataê v2.2.2 rodando em http://localhost:${port}`);
});
