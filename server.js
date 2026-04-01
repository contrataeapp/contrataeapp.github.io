// FIX v11.3.4 cadastro estável: cancelar cadastro agora só sai do fluxo sem apagar conta em rascunho
require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const helmet = require("helmet");
const multer = require('multer');
const InMemorySessionStore = require('./stores/InMemorySessionStore');
const { applyAdminSession, clearAdminSession } = require('./lib/sessionState');

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


function normalizeBannerRecord(b) {
    const rawOrder = Number(b.order ?? 0);
    let posicao = 1;
    let ordem = rawOrder;
    if (rawOrder >= 300) {
        posicao = 4;
        ordem = rawOrder - 300;
    } else if (rawOrder >= 200) {
        posicao = 3;
        ordem = rawOrder - 200;
    } else if (rawOrder >= 100) {
        posicao = 2;
        ordem = rawOrder - 100;
    }
    return {
        ...b,
        titulo: b.title,
        imagem_url: b.image_url,
        link_destino: b.link_destination,
        ativo: b.is_active,
        posicao,
        ordem
    };
}

function normalizeBanners(records) {
    return (records || []).map(normalizeBannerRecord);
}

async function loadPublicBanners() {
    const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order', { ascending: true });
    return normalizeBanners(data || []);
}

async function loadOtherCategories() {
    const excluded = ['pintores','pedreiros','eletricistas','encanadores','outros'];
    const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
    return (data || []).filter(c => !excluded.includes(String(c.slug || '').toLowerCase()));
}

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
app.use((req, res, next) => {
    const accept = String(req.headers.accept || '');
    if (req.method === 'GET' && accept.includes('text/html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Vary', 'Cookie');
    }
    next();
});
app.use(express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Service-Worker-Allowed', '/');
        }
    }
}));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/manifest.webmanifest', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest')));
app.get('/sw.js', (req, res) => {
    res.set('Service-Worker-Allowed', '/');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 2. CONFIGURAÇÃO DE SESSÃO (Deve vir ANTES de qualquer middleware que use req.session)
// No Render, trust proxy deve estar ativo para cookies seguros funcionarem
app.set("trust proxy", 1);

const sessionCookieName = process.env.SESSION_NAME || 'contratae.sid';
const sessionStore = new InMemorySessionStore({ ttlMs: 1000 * 60 * 60 * 24 * 7 });

app.use(session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET || "contratae_secret_key_2026",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax',
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
app.get("/api/comentarios", (req, res) => res.redirect(307, "/api/reviews/admin/list"));
app.post("/api/comentarios/:id/status", (req, res) => res.redirect(307, `/api/reviews/${req.params.id}/status`));

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
        req.session.regenerate((err) => {
            if (err) {
                console.error('Erro ao regenerar sessão do admin:', err);
                return res.render('admin/login_admin', { erro: 'Erro ao iniciar sessão de administrador.' });
            }
            applyAdminSession(req.session);
            req.session.save(() => res.redirect('/admin'));
        });
    } else {
        res.render('admin/login_admin', { erro: 'Usuário ou senha inválidos!' });
    }
});

// Fallback para rotas antigas de admin
app.get('/login-adm', (req, res) => res.redirect('/admin/login'));
app.post('/login-adm', (req, res) => res.redirect(307, '/admin/login'));

app.get('/admin/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(() => {
            res.clearCookie(sessionCookieName, { path: '/' });
            res.clearCookie('connect.sid', { path: '/' });
            res.redirect('/admin/login');
        });
        return;
    }
    res.redirect('/admin/login');
});
app.get('/logout-adm', (req, res) => res.redirect('/admin/logout'));


// Rotas legadas de categorias (mantidas para compatibilidade com links antigos)
app.get('/pintores', (req, res) => res.redirect(302, '/categoria/pintores'));
app.get('/pedreiros', (req, res) => res.redirect(302, '/categoria/pedreiros'));
app.get('/eletricistas', (req, res) => res.redirect(302, '/categoria/eletricistas'));
app.get('/encanadores', (req, res) => res.redirect(302, '/categoria/encanadores'));
app.get('/outros', catchAsync(async (req, res) => {
    const banners = await loadPublicBanners();
    const extraCategories = await loadOtherCategories();
    res.render('outros', { banners, currentPage: 'outros', extraCategories });
}));

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
            valor_pago: p.payment_value || p.plan_price || 0,
            data_vencimento: p.data_vencimento,
            foto: p.users?.avatar_url || null,
            whatsapp: p.phone_number || '',
            cidade: p.city || ''
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
        const { valor, tipo_prazo, prazo, motivo, payment_verified_whatsapp } = req.body;
        const id = req.params.id;
        let dataVencimento = new Date();
        const prazoNumero = Number.parseInt(prazo, 10);

        if (tipo_prazo === 'dias' && Number.isFinite(prazoNumero)) dataVencimento.setDate(dataVencimento.getDate() + prazoNumero);
        else if (tipo_prazo === 'meses' && Number.isFinite(prazoNumero)) dataVencimento.setMonth(dataVencimento.getMonth() + prazoNumero);
        else if (tipo_prazo === 'data' && prazo) dataVencimento = new Date(prazo);

        const valorPago = Number.parseFloat(valor);
        const updateData = {
            status: "active",
            approval_requested: false,
            submitted_at: null,
            profile_status: 'approved',
            data_vencimento: dataVencimento.toISOString(),
            payment_value: Number.isFinite(valorPago) ? valorPago : 0,
            approved_at: new Date().toISOString()
        };
        const { error: errorAtualizar } = await supabase.from("professionals")
            .update(updateData)
            .eq("user_id", id);

        if (errorAtualizar) throw errorAtualizar;

        try {
            await supabase.from('admin_logs').insert({
                professional_id: id,
                action_type: 'approval_granted',
                new_values: {
                    valor_pago: updateData.payment_value,
                    payment_verified_whatsapp: payment_verified_whatsapp === true || payment_verified_whatsapp === 'true' || payment_verified_whatsapp === 'on',
                    tipo_prazo,
                    prazo,
                    motivo: motivo || null,
                    data_vencimento: updateData.data_vencimento
                },
                performed_by: 'admin-panel'
            });
        } catch (logErr) {
            console.error('Falha ao registrar log de aprovação:', logErr);
        }

        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao aprovar profissional:', err);
        res.status(500).json({ erro: err.message });
    }
});

// APIs DE BANNERS (SaaS - Com Upload para Supabase Storage)
app.get("/api/banners", checkAdminAPI, async (req, res) => {
    try {
        const { data: banners, error } = await supabase
            .from("banners")
            .select("*")
            .order("order", { ascending: true });
        if (error) throw error;
        res.json(banners || []);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/api/banners', upload.single('imagem'), async (req, res) => {
  console.log('--- INÍCIO POST /api/banners ---');
  console.log('Dados recebidos:', req.body);
  try {
    const {
      titulo,
      link_destination,
      posicao,
      ordem,
      ativo
    } = req.body;
    let image_url = null;
    // upload imagem se existir
    if (req.file) {
      const fileName = `banner_${Date.now()}_${req.file.originalname}`;
      const { error: uploadError } = await supabase
        .storage
        .from('banners')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });
      if (uploadError) {
        console.error('Erro upload banner:', uploadError);
        return res.status(500).json({ error: 'Erro upload imagem' });
      }
      const { data } = supabase
        .storage
        .from('banners')
        .getPublicUrl(fileName);
      image_url = data.publicUrl;
      console.log('Imagem enviada:', image_url);
    }
    // converter posição numérica → enum
    const positionMap = {
      '1': 'home',
      '2': 'home',
      '3': 'category',
      '4': 'category'
    };
    const numericOrder = parseInt(ordem) || 0;
    let normalizedOrder = numericOrder;
    if (String(posicao) === '2') normalizedOrder = 100 + numericOrder;
    else if (String(posicao) === '3') normalizedOrder = 200 + numericOrder;
    else if (String(posicao) === '4') normalizedOrder = 300 + numericOrder;

    const bannerData = {
      title: titulo,
      image_url: image_url,
      link_destination: link_destination || null,
      position: positionMap[posicao] || 'home',
      order: normalizedOrder,
      is_active: ativo === 'true' || ativo === true,
      edited_by: 'admin'
    };
    console.log('Dados enviados ao banco:', bannerData);
    const { error } = await supabase
      .from('banners')
      .insert(bannerData);
    if (error) {
      console.error('Erro ao salvar banner:', error);
      return res.status(500).json({ error: error.message });
    }
    console.log('Banner salvo com sucesso');
    res.json({
      success: true,
      sucesso: true,
      message: 'Banner criado com sucesso'
    });
  } catch (err) {
    console.error('Erro geral banner:', err);
    res.status(500).json({
      error: 'Erro interno servidor'
    });
  }
});

// APIs DE CATEGORIAS (Acesso para Profissionais e Admin)
app.get("/api/categories", async (req, res) => {
    try {
        const { data, error } = await supabase.from("categories").select("*").order("name");
        if (error) throw error;
        res.json((data || []).map(cat => ({ ...cat, icon_class: cat.icon_class || cat.icon_url || null })));
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/categories", checkAdminAPI, async (req, res) => {
    try {
        const rawName = String(req.body.name || '').trim();
        const rawIcon = String(req.body.icon_class || req.body.icon_url || '').trim();
        let rawSlug = String(req.body.slug || '').trim().toLowerCase();
        if (!rawName) return res.status(400).json({ erro: 'Nome é obrigatório' });
        if (!rawSlug) rawSlug = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
        const payload = { name: rawName, slug: rawSlug, icon_url: rawIcon || null };
        const { data, error } = await supabase.from("categories").insert([payload]).select().single();
        if (error) throw error;
        res.json({ sucesso: true, data });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put("/api/categories/:id", checkAdminAPI, async (req, res) => {
    try {
        const rawName = String(req.body.name || '').trim();
        const rawIcon = String(req.body.icon_class || req.body.icon_url || '').trim();
        let rawSlug = String(req.body.slug || '').trim().toLowerCase();
        if (!rawName) return res.status(400).json({ erro: 'Nome é obrigatório' });
        if (!rawSlug) rawSlug = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
        const { error } = await supabase.from("categories").update({ name: rawName, slug: rawSlug, icon_url: rawIcon || null }).eq("id", req.params.id);
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

app.get("/auth/login", (req, res) => res.render("auth/login", { erro: null, next: req.query.next || '' }));
app.get("/auth/cadastro", (req, res) => res.render("auth/selecionar-tipo", { actionUrl: "/auth/cadastro-form", next: req.query.next || '' }));
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

        const ids = (data || []).map(item => item.user_id);
        let logsByProfessional = {};
        if (ids.length) {
            const { data: logs } = await supabase
                .from('admin_logs')
                .select('*')
                .in('professional_id', ids)
                .eq('action_type', 'approval_request')
                .order('action_at', { ascending: false });
            logsByProfessional = (logs || []).reduce((acc, log) => {
                if (!acc[log.professional_id]) acc[log.professional_id] = log;
                return acc;
            }, {});
        }

        const enriched = (data || []).map(item => ({
            ...item,
            latest_request_log: logsByProfessional[item.user_id] || null
        }));
        res.json(enriched);
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
        const { data: profissional } = await supabase.from('professionals').select('*').eq('user_id', req.session.userId).maybeSingle();
        const basicProfileComplete = Boolean(profissional && profissional.phone_number && profissional.cep && profissional.city && profissional.state);
        if (basicProfileComplete && profissional?.profile_completed) {
            req.session.professionalReady = true;
            return res.redirect('/profissional/dashboard');
        }
        if (basicProfileComplete) {
            req.session.professionalReady = false;
            return res.redirect('/profissional/onboarding?step=1');
        }
        res.render("auth/completar-perfil", {
            user: user || {},
            profissional: profissional || {},
            error: req.query.error || ''
        });
    } catch (err) {
        console.error("Erro ao carregar completar perfil:", err);
        res.redirect('/');
    }
});

app.post("/auth/cancelar-profissional", async (req, res) => {
    console.log("--- INÍCIO POST /auth/cancelar-profissional ---");
    if (!req.session.userId) return res.redirect('/');
    try {
        const stage = String(req.body.current_step || req.query.step || 'unknown');
        const { data: user } = await supabase.from('users').select('*').eq('id', req.session.userId).maybeSingle();
        const { data: profissional } = await supabase.from('professionals').select('*').eq('user_id', req.session.userId).maybeSingle();
        if (profissional?.profile_completed) {
            return res.redirect(303, '/profissional/dashboard?error=Seu perfil já foi criado. Para ajustar dados, use as áreas da sua conta.');
        }

        await supabase.from('onboarding_abandonos').insert({
            email: user?.email || null,
            full_name: user?.full_name || null,
            phone: profissional?.phone_number || null,
            stage,
            user_type: 'professional',
            reason: 'cancelled_by_user',
            metadata: { route: req.headers.referer || null }
        });

        await supabase.from('professional_portfolio').delete().eq('professional_id', req.session.userId);
        await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
        await supabase.from('profession_requests').delete().eq('user_id', req.session.userId);
        await supabase.from('admin_logs').delete().eq('professional_id', req.session.userId).in('action_type', ['category_suggestion', 'approval_request']);
        await supabase.from('professionals').delete().eq('user_id', req.session.userId);
        await supabase.from('users').delete().eq('id', req.session.userId);

        const sidName = process.env.SESSION_NAME || 'contratae.sid';
        const sessionId = req.sessionID;
        const finalize = () => {
            res.clearCookie(sidName, { path: '/' });
            res.clearCookie('connect.sid', { path: '/' });
            res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
            return res.redirect(303, '/');
        };
        const destroySession = () => {
            req.session.destroy(() => {
                if (req.sessionStore && sessionId) {
                    return req.sessionStore.destroy(sessionId, () => finalize());
                }
                finalize();
            });
        };
        if (typeof req.logout === 'function') {
            return req.logout(() => destroySession());
        }
        return destroySession();
    } catch (err) {
        console.error("Erro ao cancelar cadastro profissional:", err);
        return res.redirect(303, '/');
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

        const phone_number = String(body.phone_number || '').replace(/\D/g, '').slice(0, 11);
        const city = String(body.city || '').replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim();
        const state = String(body.state || '').replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0, 2);
        const cep = String(body.cep || '').replace(/\D/g, '').slice(0, 8);
        const description = body.description;

        if (phone_number.length < 10) return res.redirect(303, '/auth/completar-perfil?error=Informe um WhatsApp válido com DDD');
        if (!city || city.length < 2) return res.redirect(303, '/auth/completar-perfil?error=Informe uma cidade válida');
        if (!state || state.length < 2) return res.redirect(303, '/auth/completar-perfil?error=Informe um estado válido');
        let avatar_url = body.avatar_url;

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

        if (avatar_url) {
            console.log("Atualizando avatar_url na tabela users...");
            await supabase.from('users').update({ avatar_url }).eq('id', req.session.userId);
        }

        console.log("Atualizando dados básicos na tabela professionals...");
        const { error } = await supabase.from('professionals').upsert({
            user_id: req.session.userId,
            phone_number: phone_number || null,
            city: city || null,
            state: state || null,
            cep: cep || null,
            description: description || null,
            profile_completed: false,
            approval_requested: false,
            status: 'pending'
        }, { onConflict: 'user_id' });

        if (error) {
            console.error("Erro ao atualizar tabela professionals:", error);
            throw error;
        }

        console.log("Dados básicos salvos com sucesso! Redirecionando para onboarding...");
        return res.redirect(303, '/profissional/onboarding?step=1&basic=1');
    } catch (err) {
        console.error("ERRO CRÍTICO no POST /auth/completar-perfil:", err);
        return res.redirect('/auth/completar-perfil');
    }
});

app.get("/esqueci-senha", (req, res) => res.render("esqueci-senha", { erro: null, sucesso: null }));
app.get("/contato", catchAsync(async (req, res) => { const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('order', { ascending: true }); res.render("contato", { banners: normalizeBanners(banners || []), currentPage: 'contato' }); }));
app.get("/termos-de-uso", catchAsync(async (req, res) => { const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('order', { ascending: true }); res.render("termos_de_uso", { banners: normalizeBanners(banners || []), currentPage: 'termos' }); }));

// ROTA DA HOMEPAGE (SaaS - Protegida com catchAsync)
app.get("/", catchAsync(async (req, res) => {
    const { data: banners } = await supabase.from('banners').select('*').eq('is_active', true).order('order', { ascending: true });
    const { data: categories } = await supabase.from('categories').select('*');
    res.render("index", { 
        banners: normalizeBanners(banners || []),
        categories: categories || [],
        currentPage: 'index'
    });
}));

// ROTAS DE CATEGORIAS DINÂMICAS
app.get("/categoria/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        console.log("Buscando categoria para slug:", slug);
        
        const banners = await loadPublicBanners();

        if (slug === 'outros') {
            const extraCategories = await loadOtherCategories();
            return res.render('outros', { banners, currentPage: 'outros', extraCategories });
        }

        // Buscar categoria pelo slug
        let { data: category } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();

        // Fallback para categorias comuns se o banco estiver vazio
        if (!category) {
            const fallbacks = {
                'pintores': { id: 'pintor-id', name: 'Pintores', slug: 'pintores' },
                'pedreiros': { id: 'pedreiro-id', name: 'Pedreiros', slug: 'pedreiros' },
                'eletricistas': { id: 'eletricista-id', name: 'Eletricistas', slug: 'eletricistas' },
                'encanadores': { id: 'encanadores-id', name: 'Encanadores', slug: 'encanadores' }
            };
            category = fallbacks[slug];
        }

        if (!category) {
            return res.status(200).render('categoria-vazia', {
                banners,
                currentPage: slug,
                categoriaNome: slug,
                categoriaSlug: slug
            });
        }

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
        
        // Tentar renderizar view específica ou genérica
        const viewName = ['pintores', 'pedreiros', 'eletricistas', 'encanadores'].includes(slug) ? slug : 'categoria-dinamica';
        
        res.render(viewName, { 
            [slug]: professionals || [],
            profissionais: professionals || [],
            categoriaNome: category.name,
            banners,
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
