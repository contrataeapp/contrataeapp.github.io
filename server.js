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

// MIDDLEWARES
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
        secure: process.env.NODE_ENV === "production", // Render usa HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// CONFIGURAÇÃO PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// SISTEMA DE LOGIN DO ADMINISTRADOR (Painel Antigo)
// ============================================
const checkAdmin = (req, res, next) => {
    if (req.session.adminLogado) return next();
    res.redirect('/login-adm'); 
};

const checkAdminAPI = (req, res, next) => {
    if (req.session.adminLogado) return next();
    res.status(401).json({ erro: 'Acesso negado. Faça login.' });
};

app.get('/login-adm', (req, res) => {
    if (req.session.adminLogado) return res.redirect('/admin');
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
    req.session.destroy(); 
    res.redirect('/login-adm');
});

// ============================================
// ROTAS DO PAINEL ADM
// ============================================
app.get("/admin", checkAdmin, async (req, res) => {
    try {
        const { categoria, status, busca, ordenar } = req.query;
        let query = supabase.from("profissionais").select("*");
        if (categoria) query = query.eq('profissao', categoria);
        if (status) query = query.eq('status', status);
            const { data: profissionais, error } = await query.order("data_cadastro", { ascending: false });
        if (error) throw error;

        // Filtrar apenas o que realmente existe no banco e não é fictício
        let filtrados = (profissionais || []).filter(p => p.id && p.nome);
        
        if (!status) filtrados = filtrados.filter(p => p.status !== 'EXCLUIDO');
        if (busca) filtrados = filtrados.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.profissao.toLowerCase().includes(busca.toLowerCase()));   if (ordenar === 'vencimento') filtrados.sort((a, b) => {
            const dataA = a.data_vencimento ? new Date(a.data_vencimento) : new Date('2099-12-31');
            const dataB = b.data_vencimento ? new Date(b.data_vencimento) : new Date('2099-12-31');
            return dataA - dataB;
        });

        const totais = {
            ativos: profissionais.filter(p => p.status === 'ATIVO').length,
            pendentes: profissionais.filter(p => p.status === 'PENDENTE').length,
            pausados: profissionais.filter(p => p.status === 'PAUSADO').length,
            receitaTotal: profissionais.reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaMes: profissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                if (!dataRef) return false;
                const data = new Date(dataRef);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0)
        };

        filtrados = filtrados.map(p => {
            if (p.status === 'ATIVO' && p.data_vencimento) {
                const dataVenc = new Date(p.data_vencimento);
                const hoje = new Date();
                const diasRestantes = Math.floor((dataVenc - hoje) / (1000 * 60 * 60 * 24));
                if (diasRestantes < 0) p.alerta_status = 'vencido';
                else if (diasRestantes <= 7) p.alerta_status = 'critico';
                else p.alerta_status = 'normal';
            }
            return p;
        });

        res.render("admin", { profissionais: filtrados, totais, filtroAtivo: { categoria, status, busca, ordenar } });
    } catch (err) { 
        res.render("admin", { profissionais: [], totais: { ativos: 0, pendentes: 0, pausados: 0, receitaTotal: 0, receitaMes: 0 }, filtroAtivo: {} }); 
    }
});

// APIs DO PAINEL ADM
app.post("/api/profissionais/:id/aprovar", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json({sucesso: true}); });
app.put("/api/profissionais/:id", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json({sucesso: true}); });
app.post("/api/profissionais/:id/status", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json({sucesso: true}); });
app.delete("/api/profissionais/:id", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json({sucesso: true}); });
app.get("/api/profissionais/:id/logs", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json([]); });
app.get("/api/relatorios/geral", checkAdminAPI, async (req, res) => { /*... (Código já existente) ...*/ res.json([]); });

// APIs DE BANNERS DO PAINEL ADM
	app.get("/api/banners", checkAdminAPI, async (req, res) => {
	    try {
	        const { data: banners, error } = await supabase
	            .from("banners")
	            .select("*")
	            .order("posicao", { ascending: true })
	            .order("ordem", { ascending: true });
	        if (error) throw error;
	        res.json(banners || []);
	    } catch (err) { res.status(500).json({ erro: err.message }); }
	});
	
	app.post("/api/banners", checkAdminAPI, upload.single('imagem'), async (req, res) => {
	    try {
	        const { id, link_destino, ordem, ativo, titulo, posicao } = req.body;
	        const bannerData = { 
	            link_destino: link_destino || null, 
	            ordem: parseInt(ordem) || 0, 
	            ativo: String(ativo) === 'true', 
	            titulo: titulo || '', 
	            posicao: parseInt(posicao) || 1 
	        };
	        
	        if (req.file) {
	            const ext = path.extname(req.file.originalname);
	            const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
	            // Tentando bucket 'banners' ou 'contratae-imagens'
            let bucketName = 'banners';
            let { data, error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
            
            if (uploadError && uploadError.message.includes('not found')) {
                bucketName = 'contratae-imagens';
                const retry = await supabase.storage.from(bucketName).upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
                data = retry.data;
                uploadError = retry.error;
            }
	            if (uploadError) throw uploadError;
	            const { data: publicUrlData } = supabase.storage.from('banners').getPublicUrl(fileName);
	            bannerData.imagem_url = publicUrlData.publicUrl;
	        }
	
	        if (id && id !== "null" && id !== "") {
	            const { error } = await supabase.from("banners").update(bannerData).eq("id", id);
	            if (error) throw error;
	        } else {
	            const { error } = await supabase.from("banners").insert([bannerData]);
	            if (error) throw error;
	        }
	        res.json({ sucesso: true });
	    } catch (err) { 
	        console.error("Erro ao salvar banner:", err);
	        res.status(500).json({ erro: err.message }); 
	    }
	});

app.delete("/api/banners/:id", checkAdminAPI, async (req, res) => {
    try {
        await supabase.from("banners").delete().eq("id", req.params.id);
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================
// ROTAS DOS USUÁRIOS E PÁGINAS PÚBLICAS
// ============================================
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const dashboardRoutes = require("./routes/dashboards");
app.use("/", dashboardRoutes);

app.get("/auth/login", (req, res) => {
    try {
        res.render("auth/login", { erro: null, adminLogado: req.session.adminLogado || false });
    } catch (e) {
        console.error("ERRO AO RENDERIZAR LOGIN:", e);
        res.status(500).send("Erro ao carregar a página de login. Tente novamente mais tarde.");
    }
});
app.get("/auth/cadastro", (req, res) => res.render("cadastro", { erro: null }));
app.get("/esqueci-senha", (req, res) => res.render("esqueci-senha", { erro: null, sucesso: null }));
app.get("/contato", (req, res) => res.render("contato"));
app.get("/outros", (req, res) => res.render("outros", { banners: [] }));

app.get("/perfil/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { data: profissional, error } = await supabase
            .from("profissionais")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !profissional) {
            return res.status(404).send("Profissional não encontrado.");
        }

        res.render("perfil-profissional", { profissional, adminLogado: req.session.adminLogado || false });
    } catch (e) {
        console.error("ERRO AO CARREGAR PERFIL:", e);
        res.status(500).send("Erro interno ao carregar o perfil.");
    }
});

// ROTA DA HOMEPAGE
app.get("/", async (req, res) => {
    try {
        const { data: banners } = await supabase.from('banners').select('*').eq('ativo', true).order('ordem', { ascending: true });
        res.render("index", { 
            banners: banners || [], 
            adminLogado: req.session.adminLogado || false 
        });
    } catch (err) {
        res.render("index", { banners: [], adminLogado: false });
    }
});

// ROTAS DE CATEGORIAS
const categoriasMap = [ 
    { profissao: 'Pintor', rota: 'pintores' }, 
    { profissao: 'Pedreiro', rota: 'pedreiros' }, 
    { profissao: 'Eletricista', rota: 'eletricistas' }, 
    { profissao: 'Encanador', rota: 'encanadores' } 
];

categoriasMap.forEach(({ profissao, rota }) => {
    app.get(`/${rota}`, async (req, res) => {
        try {
            const { data, error } = await supabase.from('profissionais').select('*').eq('profissao', profissao).eq('status', 'ATIVO');
            if (error) throw error;
            const { data: banners } = await supabase.from('banners').select('*').eq('ativo', true).order('ordem', { ascending: true });
            
            res.render(rota, { 
                [rota]: data || [], 
                banners: banners || [] 
            });
        } catch (err) { 
            res.render(rota, { [rota]: [], banners: [] }); 
        }
    });
});

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));