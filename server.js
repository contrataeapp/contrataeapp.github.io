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
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(session({
    secret: process.env.SESSION_SECRET || "contratae_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production", // Render usa HTTPS
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
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
    // Verifica se req.session existe antes de acessar propriedades
    const sess = req.session || {};
    res.locals.adminLogado = sess.adminLogado || false;
    res.locals.userId = sess.userId || null;
    res.locals.userType = sess.userType || null;
    res.locals.fullName = sess.fullName || null;
    
    // Adicionar objeto user global para todas as views EJS
    res.locals.user = req.user || null;
    
    // Lógica de Redirecionamento Inteligente (Onboarding)
    if (req.user && !req.path.startsWith('/auth') && !req.path.startsWith('/onboarding') && !req.path.startsWith('/public')) {
        if (!req.user.user_type) {
            return res.redirect('/onboarding');
        }
    }
    
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
        if (busca) filtrados = filtrados.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.profissao.toLowerCase().includes(busca.toLowerCase()));
        
        if (ordenar === 'vencimento') filtrados.sort((a, b) => {
            const dataA = a.data_vencimento ? new Date(a.data_vencimento) : new Date('2099-12-31');
            const dataB = b.data_vencimento ? new Date(b.data_vencimento) : new Date('2099-12-31');
            return dataA - dataB;
        });

        // BUSCAR TODOS OS PROFISSIONAIS PARA O RESUMO GLOBAL (Independente de filtros)
        const { data: todosProfissionais } = await supabase.from("profissionais").select("*");
        const hoje = new Date();
        const trintaDiasAtras = new Date(new Date().setDate(hoje.getDate() - 30));
        const seteDiasAtras = new Date(new Date().setDate(hoje.getDate() - 7));

        const totais = {
            ativos: todosProfissionais.filter(p => p.status === 'ATIVO').length,
            pendentes: todosProfissionais.filter(p => p.status === 'PENDENTE').length,
            pausados: todosProfissionais.filter(p => p.status === 'PAUSADO').length,
            receitaTotal: todosProfissionais.reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaMes: todosProfissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                if (!dataRef) return false;
                const data = new Date(dataRef);
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receita30d: todosProfissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                return dataRef && new Date(dataRef) >= trintaDiasAtras;
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receita7d: todosProfissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                return dataRef && new Date(dataRef) >= seteDiasAtras;
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaHoje: todosProfissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                if (!dataRef) return false;
                const data = new Date(dataRef);
                return data.toDateString() === hoje.toDateString();
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

        const { error: errorAtualizar } = await supabase.from("profissionais")
            .update({ status: "ATIVO", data_vencimento: dataVencimento.toISOString(), valor_pago: parseFloat(valor), data_ultima_edicao: new Date().toISOString() })
            .eq("id", id);
        if (errorAtualizar) throw errorAtualizar;

        await supabase.from("logs_adm").insert({
            id_profissional: id, tipo_acao: "APROVAÇÃO",
            valores_novos: { status: "ATIVO", valor_pago: parseFloat(valor), data_vencimento: dataVencimento.toISOString() },
            motivo_edicao: motivo || 'Aprovação inicial',
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const { valor, tipo_prazo, prazo, motivo } = req.body;
        const id = req.params.id;
        let updateData = { data_ultima_edicao: new Date().toISOString() };
        let tipoAcaoText = "EDIÇÃO";

        if (valor !== undefined && prazo) tipoAcaoText = "VALOR E VENCIMENTO";
        else if (valor !== undefined) tipoAcaoText = "APENAS VALOR";
        else if (prazo) tipoAcaoText = "APENAS VENCIMENTO";

        if (valor !== undefined) updateData.valor_pago = parseFloat(valor);
        if (prazo) {
            let dataVencimento = new Date();
            if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
            else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
            else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);
            updateData.data_vencimento = dataVencimento.toISOString();
        }

        await supabase.from("profissionais").update(updateData).eq("id", id);

        await supabase.from("logs_adm").insert({
            id_profissional: id, tipo_acao: tipoAcaoText,
            valores_novos: updateData,
            motivo_edicao: motivo || 'Sem motivo registrado',
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/profissionais/:id/status", checkAdminAPI, async (req, res) => {
    try {
        const { novoStatus, motivo, renovar, valor, tipo_prazo, prazo } = req.body;
        const id = req.params.id;

        const { data: profAtual } = await supabase.from("profissionais").select("*").eq("id", id).single();
        
        let updateData = { status: novoStatus, data_ultima_edicao: new Date().toISOString() };
        let tipoAcao = novoStatus === 'PAUSADO' ? 'CONTA PAUSADA' : 'CONTA REATIVADA';
        
        if (novoStatus === 'ATIVO' && renovar) {
            updateData.valor_pago = parseFloat(valor);
            let dataVencimento = new Date();
            if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
            else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
            else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);
            updateData.data_vencimento = dataVencimento.toISOString();
            tipoAcao = 'REATIVADA COM RENOVAÇÃO';
        }

        const { error } = await supabase.from("profissionais").update(updateData).eq("id", id);
        if (error) throw error;
        
        await supabase.from("logs_adm").insert({
            id_profissional: id, 
            tipo_acao: tipoAcao,
            valores_anteriores: { status: profAtual.status },
            valores_novos: updateData,
            motivo_edicao: motivo || 'Ação de status', 
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const { senha, motivo } = req.body;
        const adminPass = process.env.ADMIN_PASS || '#Relaxsempre153143';

        if (senha !== adminPass) {
            return res.status(401).json({ erro: 'Senha de administrador incorreta!' });
        }

        const id = req.params.id;
        const { data: profAtual } = await supabase.from("profissionais").select("*").eq("id", id).single();

        const { error } = await supabase.from("profissionais").update({ status: 'EXCLUIDO', data_ultima_edicao: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        
        await supabase.from("logs_adm").insert({
            id_profissional: id, 
            tipo_acao: 'EXCLUSÃO DE CONTA',
            valores_anteriores: { status: profAtual.status },
            valores_novos: { status: 'EXCLUIDO' },
            motivo_edicao: motivo || 'Excluído pelo Administrador', 
            realizado_por: 'Admin'
        });
        
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get("/api/profissionais/:id/logs", checkAdminAPI, async (req, res) => {
    try {
        const { data: logs, error } = await supabase.from("logs_adm").select("*").eq("id_profissional", req.params.id).order("data_acao", { ascending: false });
        if (error) throw error;
        res.json(logs);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get("/api/relatorios/geral", checkAdminAPI, async (req, res) => {
    try {
        const { data, error } = await supabase.from("logs_adm").select(`*, profissionais (nome, profissao)`).order("data_acao", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get("/api/comentarios", checkAdminAPI, async (req, res) => {
    try {
        const { data, error } = await supabase.from("comments").select(`*, users (full_name), profissionais (nome)`).order("created_at", { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

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
            let bucketName = 'banners';
            let { data, error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
            
            if (uploadError && uploadError.message.includes('not found')) {
                bucketName = 'contratae-imagens';
                const retry = await supabase.storage.from(bucketName).upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
                data = retry.data;
                uploadError = retry.error;
            }
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
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

const dashboardRoutes = require("./routes/dashboards");
app.use("/", dashboardRoutes);

app.get("/auth/login", (req, res) => {
    try {
        res.render("auth/login", { erro: null });
    } catch (e) {
        console.error("ERRO AO RENDERIZAR LOGIN:", e);
        res.status(500).send("Erro ao carregar a página de login.");
    }
});

app.get("/auth/cadastro", (req, res) => {
    try {
        res.render("cadastro", { erro: null });
    } catch (e) {
        console.error("ERRO AO RENDERIZAR CADASTRO:", e);
        res.status(500).send("Erro ao carregar a página de cadastro.");
    }
});

// ROTA DE ONBOARDING
app.get("/onboarding", (req, res) => {
    if (!req.user) return res.redirect("/auth/login");
    if (req.user.user_type) return res.redirect("/");
    res.render("onboarding", { erro: null });
});

app.post("/onboarding", async (req, res) => {
    if (!req.user) return res.status(401).send("Não autorizado");
    const { user_type } = req.body;
    
    if (user_type !== 'client' && user_type !== 'professional') {
        return res.render("onboarding", { erro: "Escolha uma opção válida" });
    }

    try {
        const { error } = await supabase
            .from("users")
            .update({ user_type })
            .eq("id", req.user.id);
        
        if (error) throw error;
        
        // Atualizar objeto na sessão
        req.user.user_type = user_type;
        
        if (user_type === 'professional') {
            res.redirect("/profissional/completar-perfil");
        } else {
            res.redirect("/");
        }
    } catch (err) {
        console.error("Erro no onboarding:", err);
        res.render("onboarding", { erro: "Erro ao salvar sua escolha" });
    }
});

app.get("/esqueci-senha", (req, res) => res.render("esqueci-senha", { erro: null, sucesso: null }));
app.get("/contato", (req, res) => res.render("contato"));
app.get("/outros", (req, res) => res.render("outros", { banners: [] }));
app.get("/avaliacao", (req, res) => res.render("avaliacao"));
app.get("/termos-de-uso", (req, res) => res.render("termos_de_uso"));

// ROTA PARA COMPLETAR PERFIL PROFISSIONAL
app.get("/profissional/completar-perfil", async (req, res) => {
    if (!req.user || req.user.user_type !== 'professional') return res.redirect("/");
    
    // Verificar se já existe perfil profissional
    const { data: prof } = await supabase
        .from("profissionais")
        .select("*")
        .eq("user_id", req.user.id)
        .single();
        
    res.render("completar_perfil", { profissional: prof || {}, erro: null });
});

app.post("/profissional/completar-perfil", async (req, res) => {
    if (!req.user || req.user.user_type !== 'professional') return res.status(401).send("Não autorizado");
    
    const { nome, profissao, telefone, cidade, descricao, preco_medio } = req.body;
    
    try {
        const profData = {
            user_id: req.user.id,
            nome,
            profissao,
            telefone,
            cidade,
            descricao,
            preco_medio: parseFloat(preco_medio) || 0,
            status: 'PENDENTE',
            data_cadastro: new Date().toISOString()
        };

        const { error } = await supabase
            .from("profissionais")
            .upsert(profData, { onConflict: 'user_id' });
            
        if (error) throw error;
        
        res.render("completar_perfil_sucesso");
    } catch (err) {
        console.error("Erro ao completar perfil:", err);
        res.render("completar_perfil", { profissional: req.body, erro: "Erro ao salvar seu perfil profissional." });
    }
});

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

        res.render("perfil-profissional", { profissional });
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
            currentPage: 'index'
        });
    } catch (err) {
        res.render("index", { banners: [], currentPage: 'index' });
    }
});

// ROTAS DE CATEGORIAS DINÂMICAS
app.get("/categoria/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        const slugsMap = {
            'pintores': 'Pintor',
            'pedreiros': 'Pedreiro',
            'eletricistas': 'Eletricista',
            'encanadores': 'Encanador'
        };

        const profissao = slugsMap[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
        
        const { data: profissionais, error } = await supabase
            .from('profissionais')
            .select('*')
            .eq('profissao', profissao)
            .eq('status', 'ATIVO');
            
        if (error) throw error;
        
        const { data: banners } = await supabase
            .from('banners')
            .select('*')
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        const viewName = ['pintores', 'pedreiros', 'eletricistas', 'encanadores'].includes(slug) ? slug : 'categoria';
        
        res.render(viewName, { 
            [slug]: profissionais || [],
            profissionais: profissionais || [],
            categoriaNome: profissao,
            banners: banners || [],
            currentPage: slug
        });
    } catch (err) {
        console.error("Erro na rota de categoria:", err);
        res.status(404).render("404", { mensagem: "Categoria não encontrada ou erro no servidor." });
    }
});

// Redirecionamentos para manter compatibilidade com links antigos
app.get("/pintores", (req, res) => res.redirect("/categoria/pintores"));
app.get("/pedreiros", (req, res) => res.redirect("/categoria/pedreiros"));
app.get("/eletricistas", (req, res) => res.redirect("/categoria/eletricistas"));
app.get("/encanadores", (req, res) => res.redirect("/categoria/encanadores"));

// Rota 404 para páginas não encontradas
app.use((req, res) => {
    res.status(404).render("404", { mensagem: "Página não encontrada." });
});

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
