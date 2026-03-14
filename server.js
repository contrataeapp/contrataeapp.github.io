require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const helmet = require("helmet");
const multer = require('multer');

// Importar Middlewares e Controllers (Arquitetura SaaS)
const { injectUserVars, requireAuth, requireProfessional, requireAdmin } = require('./middlewares/authMiddleware');
const { errorHandler, catchAsync } = require('./middlewares/errorHandler');
const authController = require('./controllers/authController');

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
    resave: true,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true
    }
}));

// 3. CONFIGURAÇÃO PASSPORT (Deve vir DEPOIS da sessão)
app.use(passport.initialize());
app.use(passport.session());

// Importar Rotas de Autenticação
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

// Importar Rotas de Avaliações
const reviewRoutes = require("./routes/reviews");
app.use("/api/reviews", reviewRoutes);

// 4. MIDDLEWARE DE VARIÁVEIS GLOBAIS (SaaS)
app.use(injectUserVars);
app.use((req, res, next) => {
    const sess = req.session || {};
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
// Middlewares Admin (SaaS)
const checkAdmin = requireAdmin;
const checkAdminAPI = (req, res, next) => {
    if (req.session && req.session.adminLogado) return next();
    res.status(401).json({ erro: 'Acesso negado. Faça login.' });
};

// Rota de Login Admin (SaaS)
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.adminLogado) return res.redirect('/admin');
    res.render('admin/login_admin', { erro: null });
});

app.post('/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || '#Relaxsempre153143';

    if (usuario === adminUser && senha === adminPass) {
        req.session.adminLogado = true;
        res.redirect('/admin');
    } else {
        res.render('admin/login_admin', { erro: 'Usuário ou senha inválidos!' });
    }
});

// Fallback para rotas antigas de admin
app.get('/login-adm', (req, res) => res.redirect('/admin/login'));
app.post('/login-adm', (req, res) => res.redirect(307, '/admin/login'));

app.get('/admin/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(); 
    }
    res.redirect('/admin/login');
});
app.get('/logout-adm', (req, res) => res.redirect('/admin/logout'));

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
        // Padronizado para usar user_id
        let filtrados = (professionals || []).map(p => ({
            id: p.user_id, 
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

        res.render("admin/admin", { profissionais: filtrados, totais, filtroAtivo: { categoria, status, busca, ordenar } });
    } catch (err) { 
        console.error("Erro no painel admin:", err);
        res.render("admin/admin", { profissionais: [], totais: { ativos: 0, pendentes: 0, pausados: 0, receitaTotal: 0, receitaMes: 0 }, filtroAtivo: {} }); 
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

        // Padronizado para usar user_id
        const updateData = { 
            status: "active", 
            data_vencimento: dataVencimento.toISOString(), 
            valor_pago: parseFloat(valor)
        };
        const { error: errorAtualizar } = await supabase.from("professionals")
            .update(updateData)
            .eq("user_id", id);
        
        if (errorAtualizar) throw errorAtualizar;

        // Registrar Log
        await supabase.from('admin_logs').insert([{
            admin_id: req.session.userId,
            action: 'aprovação',
            target_id: id,
            details: `Profissional aprovado com valor R$ ${valor} e vencimento em ${dataVencimento.toLocaleDateString('pt-BR')}`
        }]);

        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// APIs DE BANNERS (SaaS - Com Upload para Supabase Storage)
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

app.post("/api/banners", checkAdminAPI, upload.single('imagem'), async (req, res) => {
    console.log("--- INÍCIO POST /api/banners ---");
    console.log("Dados recebidos:", req.body);
    try {
        const { id, titulo, link_destination, posicao, ordem, ativo } = req.body;
        let imagem_url = req.body.imagem_url;

        // Se houver novo arquivo, fazer upload para o Supabase Storage
        if (req.file) {
            const file = req.file;
            const fileExt = file.originalname.split('.').pop();
            const fileName = `banner_${Date.now()}.${fileExt}`;
            const filePath = `public/${fileName}`;

            // Tentar upload (Bucket 'banners' deve existir no Supabase)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('banners')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.error("Erro no Supabase Storage (Banners):", uploadError);
                // Se o erro for bucket não encontrado, avisar o admin
                if (uploadError.message && uploadError.message.includes('Bucket not found')) {
                    return res.status(400).json({ 
                        sucesso: false, 
                        erro: "O bucket 'banners' não foi encontrado no Supabase Storage. Por favor, crie-o com acesso público." 
                    });
                }
                throw uploadError;
            }

            // Pegar URL pública
            const { data: urlData } = supabase.storage
                .from('banners')
                .getPublicUrl(filePath);
            
            imagem_url = urlData.publicUrl;
        }

        const bannerData = {
            titulo,
            link_destination,
            posicao: parseInt(posicao),
            ordem: parseInt(ordem),
            is_active: ativo === 'true' || ativo === true,
            image_url: imagem_url
        };

        if (id && id !== 'null' && id !== '') {
            // Update
            const { error } = await supabase.from('banners').update(bannerData).eq('id', id);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabase.from('banners').insert([bannerData]);
            if (error) throw error;
        }

        res.json({ sucesso: true });
    } catch (err) {
        console.error("Erro ao salvar banner:", err);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// APIs DE CATEGORIAS (Acesso para Profissionais e Admin)
app.get("/api/categories", async (req, res) => {
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

// API PARA SOLICITAÇÕES DE APROVAÇÃO (ADMIN)
app.get("/admin/api/solicitacoes", async (req, res) => {
    if (!req.session.adminLogado) {
        return res.status(403).json({ erro: "Acesso negado" });
    }
    try {
        const { data, error } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url), categories(name)')
            .eq('approval_requested', true)
            .eq('status', 'pending')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ROTA PARA COMPLETAR PERFIL (OBRIGATÓRIA PARA PROFISSIONAIS)
app.get("/auth/completar-perfil", async (req, res) => {
    if (!req.session.userId || req.session.userType !== 'professional') {
        return res.redirect('/');
    }
    try {
        const { data: user } = await supabase.from('users').select('*').eq('id', req.session.userId).single();
        const { data: profissional } = await supabase.from('professionals').select('*').eq('user_id', req.session.userId).single();
        const { data: categorias } = await supabase.from('categories').select('*').order('name');
        
        res.render("auth/completar-perfil", { 
            user: user || {}, 
            profissional: profissional || {}, 
            categorias: categorias || [] 
        });
    } catch (err) {
        console.error("Erro ao carregar completar perfil:", err);
        res.redirect('/profissional/dashboard');
    }
});

app.post("/auth/cancelar-profissional", async (req, res) => {
    console.log("--- INÍCIO POST /auth/cancelar-profissional ---");
    if (!req.session.userId) return res.redirect('/');
    
    try {
        console.log("Cancelando cadastro profissional para UserID:", req.session.userId);
        
        // 1. Atualizar tabela users para 'client'
        await supabase.from('users').update({ user_type: 'client' }).eq('id', req.session.userId);
        
        // 2. Atualizar tabela professionals para resetar solicitação
        await supabase.from('professionals').update({ 
            approval_requested: false,
            profile_completed: false,
            status: 'pending' 
        }).eq('user_id', req.session.userId);
        
        // 3. Atualizar sessão
        req.session.userType = 'client';
        
        console.log("Cadastro cancelado com sucesso. Redirecionando para home...");
        res.redirect('/');
    } catch (err) {
        console.error("Erro ao cancelar cadastro profissional:", err);
        res.redirect('/');
    }
});

app.post("/auth/completar-perfil", upload.any(), async (req, res) => {
    console.log("--- INÍCIO POST /auth/completar-perfil ---");
    console.log("UserID na Sessão:", req.session.userId);
    console.log("UserType na Sessão:", req.session.userType);
    
    if (!req.session.userId || req.session.userType !== 'professional') {
        console.log("Acesso negado: Usuário não logado ou não é profissional");
        return res.redirect('/');
    }
    
    try {
        const body = req.body || {};
        console.log("Dados recebidos (body):", body);
        
        const { phone_number, city, state, cep, categories, specialties, description } = body;
        let avatar_url = body.avatar_url;

        // 1. Processar Upload de Avatar (se houver arquivo)
        const avatarFile = req.files ? req.files.find(f => f.fieldname === 'avatar') : null;
        if (avatarFile) {
            console.log("Processando upload de avatar...");
            const fileExt = avatarFile.originalname.split('.').pop();
            const fileName = `avatar_${req.session.userId}_${Date.now()}.${fileExt}`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile.buffer, {
                    contentType: avatarFile.mimetype,
                    upsert: true
                });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatar_url = urlData.publicUrl;
                console.log("Avatar enviado com sucesso:", avatar_url);
            } else {
                console.error("Erro no upload do avatar:", uploadError);
            }
        }
        
        // Atualizar avatar na tabela users se tivermos uma nova URL
        if (avatar_url) {
            console.log("Atualizando avatar_url na tabela users...");
            await supabase.from('users').update({ avatar_url }).eq('id', req.session.userId);
        }
        
        // 2. Atualizar dados na tabela professionals
        console.log("Atualizando dados na tabela professionals...");
        const categoryList = categories ? categories.split(',') : [];
        let category_id = body.category_id; 
        
        if (categoryList.length > 0 && !category_id) {
            const { data: catData } = await supabase.from('categories').select('id').eq('name', categoryList[0]).maybeSingle();
            if (catData) category_id = catData.id;
        }

        const { error } = await supabase.from('professionals').update({
            phone_number,
            city,
            state,
            cep,
            category_id,
            description,
            specialties,
            profile_completed: true,
            approval_requested: true,
            status: 'pending'
        }).eq('user_id', req.session.userId);
        
        if (error) {
            console.error("Erro ao atualizar tabela professionals:", error);
            throw error;
        }
        
        // 3. Salvar múltiplas categorias se houver tabela professional_categories
        if (categoryList.length > 0) {
            try {
                console.log("Salvando categorias extras...");
                const { data: cats } = await supabase.from('categories').select('id, name').in('name', categoryList);
                if (cats && cats.length > 0) {
                    const inserts = cats.map(c => ({ professional_id: req.session.userId, category_id: c.id }));
                    await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
                    await supabase.from('professional_categories').insert(inserts);
                }
            } catch (catErr) {
                console.error("Erro ao salvar categorias extras:", catErr);
            }
        }

        console.log("Perfil salvo com sucesso! Redirecionando para dashboard...");
        return res.redirect('/profissional/dashboard');
    } catch (err) {
        console.error("ERRO CRÍTICO no POST /auth/completar-perfil:", err);
        return res.redirect('/auth/completar-perfil');
    }
});
app.get("/esqueci-senha", (req, res) => res.render("esqueci-senha", { erro: null, sucesso: null }));
app.get("/contato", (req, res) => res.render("contato"));
app.get("/termos-de-uso", (req, res) => res.render("termos_de_uso"));

// ROTA DA HOMEPAGE (SaaS - Protegida com catchAsync)
app.get("/", catchAsync(async (req, res) => {
    const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('position', { ascending: true });
    const { data: categories } = await supabase.from('categories').select('*');
    res.render("index", { 
        banners: banners || [],
        categories: categories || [],
        currentPage: 'index'
    });
}));

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
        // Padronizado para usar user_id
        const { data: professional, error } = await supabase
            .from("professionals")
            .select("*, users(full_name, email, avatar_url), categories(name)")
            .eq("user_id", id)
            .single();

        if (error || !professional) return res.status(404).send("Profissional não encontrado.");

        // Buscar Portfólio
        const { data: portfolio } = await supabase
            .from('professional_portfolio')
            .select('*')
            .eq('professional_id', id)
            .order('created_at', { ascending: false });

        // Buscar Avaliações
        const { data: reviews } = await supabase
            .from('reviews')
            .select('*')
            .eq('professional_id', id)
            .order('created_at', { ascending: false });

        res.render("perfil-profissional", { 
            profissional, 
            portfolio: portfolio || [],
            reviews: reviews || []
        });
    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
        res.status(500).send("Erro interno ao carregar o perfil.");
    }
});

// Handler Global de Erros (SaaS)
app.use(errorHandler);

// Página 404 (Fallback)
app.use((req, res) => res.status(404).render("404", { mensagem: "Página não encontrada." }));

// Iniciar Servidor
app.listen(port, () => console.log(`🚀 [CONTRATAÊ SaaS]: Servidor rodando na porta ${port}`));
