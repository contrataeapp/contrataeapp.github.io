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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const supabaseAdmin = supabaseServiceKey
    ? createClient(process.env.SUPABASE_URL, supabaseServiceKey, { auth: { persistSession: false } })
    : supabase;


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
    // v11.3.22: a página "Outros" agora também serve como índice/pesquisa geral.
    // Por isso mantemos categorias oficiais principais e extras no mesmo retorno.
    const baseCategories = [
        { name: 'Pintores', slug: 'pintores' },
        { name: 'Pedreiros', slug: 'pedreiros' },
        { name: 'Eletricistas', slug: 'eletricistas' },
        { name: 'Encanadores', slug: 'encanadores' }
    ];

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
    if (error) console.warn('Aviso: não foi possível carregar categorias para /outros:', error.message || error);

    const map = new Map();
    [...baseCategories, ...(data || [])].forEach(cat => {
        const slug = String(cat?.slug || slugifyText(cat?.name || '')).trim().toLowerCase();
        if (!slug || slug === 'outros' || slug === 'outro') return;
        map.set(slug, { ...cat, slug, name: cat?.name || slug });
    });
    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

const STATUS_DB_TO_LABEL = { active: 'ATIVO', pending: 'PENDENTE', paused: 'PAUSADO', excluded: 'EXCLUIDO' };
const STATUS_LABEL_TO_DB = { ATIVO: 'active', ACTIVE: 'active', PENDENTE: 'pending', PENDING: 'pending', PAUSADO: 'paused', PAUSED: 'paused', EXCLUIDO: 'excluded', EXCLUÍDO: 'excluded', EXCLUDED: 'excluded' };
function normalizeStatusForDb(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return STATUS_LABEL_TO_DB[raw.toUpperCase()] || raw.toLowerCase();
}
function statusLabel(value) {
    const db = normalizeStatusForDb(value);
    return STATUS_DB_TO_LABEL[db] || String(value || '').toUpperCase();
}
function parseMoneyLike(value) {
    if (value === undefined || value === null || value === '') return null;
    const cleaned = String(value).replace(/[^\d,.]/g, '').replace(',', '.');
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
}
function slugifyText(text) {
    return String(text || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}


function inferPlanTierFromProfessional(profissional) {
    const explicitPlanName = String(profissional?.plan_name || '').toLowerCase();
    if (explicitPlanName.includes('premium')) return { tier: 'premium', slots: 3, label: 'Plano Premium' };
    if (explicitPlanName.includes('profissional')) return { tier: 'professional', slots: 2, label: 'Plano Profissional' };
    if (explicitPlanName.includes('básico') || explicitPlanName.includes('basico')) return { tier: 'basic', slots: 1, label: 'Plano Básico' };

    const months = Math.min(12, Math.max(1, Number(profissional?.plan_months || profissional?.plan_duration_months || 1) || 1));
    const total = Number(profissional?.plan_price || profissional?.payment_value || 0);
    const plans = {
        basic: { slots: 1, monthly: 30, label: 'Plano Básico' },
        professional: { slots: 2, monthly: 50, label: 'Plano Profissional' },
        premium: { slots: 3, monthly: 70, label: 'Plano Premium' }
    };
    let discount = 0;
    if (months >= 12) discount = 20;
    else if (months >= 6) discount = 12;
    else if (months >= 3) discount = 6;

    return Object.entries(plans).map(([tier, plan]) => ({
        tier,
        slots: plan.slots,
        label: plan.label,
        distance: Math.abs(Number((plan.monthly * months * (1 - discount / 100)).toFixed(2)) - total)
    })).sort((a, b) => a.distance - b.distance)[0] || { tier: 'basic', slots: 1, label: 'Plano Básico' };
}

function isOtherCategory(cat) {
    if (!cat) return false;
    const name = String(cat.name || '').trim().toLowerCase();
    const slug = String(cat.slug || '').trim().toLowerCase();
    return ['outros', 'outro'].includes(name) || ['outros', 'outro'].includes(slug);
}

function buildProfessionSlots(profissional, currentPrimaryCategory, extraDetails, professionRequests, planSlots = 1) {
    const requestsBySlot = (professionRequests || []).reduce((acc, request) => {
        const slot = Number(request.related_slot || 0);
        if (slot && !acc[slot]) acc[slot] = request;
        return acc;
    }, {});

    const extras = (extraDetails || []).filter(cat => cat && cat.id !== profissional?.category_id);
    const slots = [];
    for (let slot = 1; slot <= Math.max(1, planSlots || 1); slot++) {
        const cat = slot === 1 ? currentPrimaryCategory : extras[slot - 2];
        const request = requestsBySlot[slot] || null;
        if (!cat && !request) continue;
        const other = isOtherCategory(cat);
        slots.push({
            slot,
            category: cat || null,
            request,
            isSuggestion: Boolean(request?.requested_name && (!cat || other)),
            displayName: (request?.requested_name && (!cat || other)) ? request.requested_name : (cat?.name || request?.requested_name || 'Não definida'),
            statusLabel: (request?.requested_name && (!cat || other)) ? 'em análise' : '',
            slug: cat?.slug || request?.requested_slug || null
        });
    }
    return slots;
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function formatPublicPhoneForWhatsApp(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '5516996484492';
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    return `55${digits}`;
}

function buildWhatsAppLink(phone, professionalName, professionName) {
    const target = formatPublicPhoneForWhatsApp(phone);
    const name = professionalName || 'um profissional';
    const profession = professionName ? ` de ${professionName}` : '';
    const text = encodeURIComponent(`Olá, vi o perfil${profession} ${name} no Contrataê e gostaria de fazer um orçamento.`);
    return `https://wa.me/${target}?text=${text}`;
}

function normalizePublicProfessional(row, category) {
    const user = row?.users || {};
    const categoryName = category?.name || row?.categories?.name || row?.categoria_principal || 'Profissional';
    const name = user.full_name || row?.full_name || row?.nome || 'Profissional Contrataê';
    const photo = user.avatar_url || row?.avatar_url || row?.foto_url || row?.foto || '/imagens/equipe_site/Mascote.png';
    const id = row?.user_id || row?.id;
    const whatsappLink = buildWhatsAppLink(row?.phone_number || row?.whatsapp || row?.phone, name, categoryName);
    return {
        ...row,
        id,
        user_id: row?.user_id || id,
        nome: name,
        full_name: name,
        foto: photo,
        foto_url: photo,
        profissao: categoryName,
        categoria: categoryName,
        descricao: row?.description || row?.descricao || '',
        whatsapp: row?.phone_number || row?.whatsapp || row?.phone || '',
        whatsapp_link: whatsappLink,
        users: {
            ...user,
            full_name: name,
            avatar_url: photo
        }
    };
}

async function loadActiveProfessionalsForCategory(category) {
    const byUserId = new Map();
    const addRows = (rows) => {
        (rows || []).forEach((row) => {
            const normalized = normalizePublicProfessional(row, category);
            if (normalized.user_id) byUserId.set(normalized.user_id, normalized);
        });
    };

    if (category?.id && isUuid(category.id)) {
        const { data: primaryRows, error: primaryError } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url), categories(name, slug)')
            .eq('status', 'active')
            .eq('category_id', category.id)
            .order('updated_at', { ascending: false });
        if (primaryError) throw primaryError;
        addRows(primaryRows);

        // Também considera profissões adicionais do plano Profissional/Premium.
        // Assim, quando o usuário tiver 2 ou 3 profissões oficiais aprovadas,
        // ele aparece nas páginas públicas correspondentes sem depender apenas da categoria principal.
        const { data: relationRows, error: relationError } = await supabase
            .from('professional_categories')
            .select('professional_id')
            .eq('category_id', category.id);

        if (!relationError && relationRows && relationRows.length) {
            const relationIds = [...new Set(relationRows.map(item => item.professional_id).filter(Boolean))];
            if (relationIds.length) {
                const { data: relatedRows, error: relatedError } = await supabase
                    .from('professionals')
                    .select('*, users(full_name, email, avatar_url), categories(name, slug)')
                    .eq('status', 'active')
                    .in('user_id', relationIds)
                    .order('updated_at', { ascending: false });
                if (relatedError) throw relatedError;
                addRows(relatedRows);
            }
        } else if (relationError) {
            console.warn('Aviso: professional_categories não pôde ser consultada na página pública:', relationError.message || relationError);
        }
    } else {
        const desiredSlug = slugifyText(category?.slug || category?.name);
        const { data: rows, error } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url), categories(name, slug)')
            .eq('status', 'active')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        addRows((rows || []).filter(row => slugifyText(row?.categories?.slug || row?.categories?.name) === desiredSlug));
    }

    return Array.from(byUserId.values());
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


// v11.3.20 - Contato protegido: o WhatsApp do profissional só é liberado depois do login.
// Quando a tabela contact_leads existir, o clique também vira um aviso pendente na dashboard do profissional.
app.post('/api/contact-leads', async (req, res) => {
    try {
        const sessionUserId = req.session?.userId || null;
        const sourceUrl = String(req.body?.source_url || req.headers.referer || '/').slice(0, 500);
        const safeNext = sourceUrl.startsWith('/') ? sourceUrl : '/';

        if (!sessionUserId) {
            return res.status(401).json({
                ok: false,
                login_required: true,
                message: 'Para chamar este profissional com segurança, entre ou crie uma conta de cliente.',
                login_url: `/auth/login?next=${encodeURIComponent(safeNext)}`,
                cadastro_url: `/auth/cadastro-form?type=client&next=${encodeURIComponent(safeNext)}`
            });
        }

        const professionalId = String(req.body?.professional_id || '').trim();
        if (!isUuid(professionalId)) {
            return res.status(400).json({ ok: false, message: 'Profissional inválido.' });
        }

        const { data: professional, error: professionalError } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url)')
            .eq('user_id', professionalId)
            .maybeSingle();
        if (professionalError) throw professionalError;

        if (!professional || String(professional.status || '').toLowerCase() !== 'active') {
            return res.status(404).json({ ok: false, message: 'Este profissional não está disponível para contato agora.' });
        }

        const { data: clientUser } = await supabase
            .from('users')
            .select('id, full_name, email, user_type')
            .eq('id', sessionUserId)
            .maybeSingle();

        const categoryName = String(req.body?.profession || professional.categoria_principal || 'Profissional').trim();
        const clientName = clientUser?.full_name || req.session?.fullName || 'Cliente Contrataê';
        const clientEmail = clientUser?.email || '';
        const message = `Olá, vi o perfil de ${categoryName} ${professional.users?.full_name || 'profissional'} no Contrataê e gostaria de fazer um orçamento.`;

        // Inserção tolerante e robusta:
        // 1) tenta gravar direto (funciona quando existe SERVICE_ROLE_KEY ou RLS liberado);
        // 2) se o Supabase bloquear por RLS, chama a função SECURITY DEFINER criada pelo SQL v11.3.23.
        let leadId = null;
        try {
            const { data: lead, error: leadError } = await supabaseAdmin
                .from('contact_leads')
                .insert({
                    professional_id: professionalId,
                    client_id: sessionUserId,
                    client_name: clientName,
                    client_email: clientEmail,
                    professional_category: categoryName,
                    message,
                    source_url: sourceUrl,
                    status: 'pending'
                })
                .select('id')
                .single();
            if (leadError) throw leadError;
            leadId = lead?.id || null;
        } catch (leadError) {
            console.warn('Insert direto em contact_leads falhou; tentando RPC create_contact_lead:', leadError.message || leadError);
            try {
                const { data: rpcLeadId, error: rpcError } = await supabaseAdmin.rpc('create_contact_lead', {
                    p_professional_id: professionalId,
                    p_client_id: sessionUserId,
                    p_client_name: clientName,
                    p_client_email: clientEmail,
                    p_client_phone: '',
                    p_professional_category: categoryName,
                    p_message: message,
                    p_source_url: sourceUrl
                });
                if (rpcError) throw rpcError;
                leadId = rpcLeadId || null;
            } catch (rpcErr) {
                console.warn('Aviso: contact_leads não registrou o contato. Rode o SQL v11.3.23 para ativar histórico:', rpcErr.message || rpcErr);
            }
        }
        if (leadId) console.log('Contato pendente registrado em contact_leads:', { leadId, professionalId, clientId: sessionUserId, categoryName });

        return res.json({
            ok: true,
            lead_id: leadId,
            history_registered: Boolean(leadId),
            message: 'Contato autorizado. Abrindo WhatsApp com histórico de segurança.',
            whatsapp_url: buildWhatsAppLink(professional.phone_number || professional.whatsapp || professional.phone, professional.users?.full_name || professional.full_name, categoryName)
        });
    } catch (err) {
        console.error('Erro em /api/contact-leads:', err);
        return res.status(500).json({ ok: false, message: 'Não foi possível liberar o contato agora.' });
    }
});

app.get('/api/profissional/contatos-pendentes', requireProfessional, async (req, res) => {
    try {
        let leads = [];

        // Leitura por RPC primeiro. Quando o Supabase está com RLS ativo, o SELECT direto
        // pode voltar [] sem erro; isso escondia contatos que já tinham sido gravados.
        try {
            const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_professional_contact_leads', {
                p_professional_id: req.session.userId,
                p_status: 'pending',
                p_limit: 20
            });
            if (rpcError) throw rpcError;
            leads = rpcData || [];
        } catch (rpcErr) {
            console.warn('RPC get_professional_contact_leads falhou; tentando SELECT direto:', rpcErr.message || rpcErr);
            const { data, error } = await supabaseAdmin
                .from('contact_leads')
                .select('*')
                .eq('professional_id', req.session.userId)
                .eq('status', 'pending')
                .order('contacted_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            leads = data || [];
        }

        return res.json({ ok: true, leads });
    } catch (err) {
        console.warn('Aviso: contatos pendentes indisponíveis. Rode o SQL v11.3.23 se a tabela/funções ainda não existirem:', err.message || err);
        return res.json({ ok: false, leads: [], setup_required: true });
    }
});

app.post('/api/profissional/contatos/:id/status', requireProfessional, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const allowed = ['accepted', 'declined', 'archived'];
        const status = allowed.includes(String(req.body?.status || '').toLowerCase()) ? String(req.body.status).toLowerCase() : 'archived';
        const note = String(req.body?.note || '').slice(0, 500);
        try {
            const { error } = await supabaseAdmin
                .from('contact_leads')
                .update({ status, professional_note: note || null, responded_at: new Date().toISOString() })
                .eq('id', id)
                .eq('professional_id', req.session.userId);
            if (error) throw error;
        } catch (directErr) {
            console.warn('Update direto em contact_leads falhou; tentando RPC update_contact_lead_status:', directErr.message || directErr);
            const { data: updated, error: rpcError } = await supabaseAdmin.rpc('update_contact_lead_status', {
                p_lead_id: id,
                p_professional_id: req.session.userId,
                p_status: status,
                p_note: note || null
            });
            if (rpcError) throw rpcError;
            if (!updated) return res.status(404).json({ ok: false, message: 'Contato não encontrado.' });
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('Erro ao atualizar contato:', err);
        return res.status(500).json({ ok: false, message: 'Não foi possível atualizar este contato.' });
    }
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
        const { categoria, status, busca, ordenar, cidade } = req.query;
        const statusDb = normalizeStatusForDb(status);

        let query = supabase.from("professionals").select(`
            *,
            users (full_name, email, avatar_url),
            categories (name, slug)
        `);

        if (statusDb) query = query.eq('status', statusDb);
        else query = query.neq('status', 'excluded');

        const { data: professionals, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;

        let filtrados = (professionals || []).map(p => ({
            id: p.user_id,
            nome: p.users?.full_name || 'Sem Nome',
            email: p.users?.email || '',
            profissao: p.categories?.name || 'Sem Categoria',
            status: statusLabel(p.status),
            status_db: normalizeStatusForDb(p.status),
            data_cadastro: p.created_at,
            valor_pago: p.payment_value || p.plan_price || 0,
            data_vencimento: p.data_vencimento,
            foto: p.users?.avatar_url || null,
            whatsapp: p.phone_number || '',
            cidade: p.city || ''
        }));

        if (categoria) {
            const c = String(categoria).toLowerCase();
            filtrados = filtrados.filter(p => p.profissao.toLowerCase() === c || p.profissao.toLowerCase().includes(c));
        }
        if (cidade) {
            const c = String(cidade).toLowerCase();
            filtrados = filtrados.filter(p => String(p.cidade || '').toLowerCase().includes(c));
        }
        if (busca) {
            const b = String(busca).toLowerCase();
            filtrados = filtrados.filter(p =>
                p.nome.toLowerCase().includes(b) ||
                p.profissao.toLowerCase().includes(b) ||
                p.email.toLowerCase().includes(b)
            );
        }
        if (ordenar === 'nome') filtrados.sort((a, b) => a.nome.localeCompare(b.nome));
        if (ordenar === 'valor') filtrados.sort((a, b) => Number(b.valor_pago || 0) - Number(a.valor_pago || 0));

        const totais = {
            ativos: filtrados.filter(p => p.status_db === 'active').length,
            pendentes: filtrados.filter(p => p.status_db === 'pending').length,
            pausados: filtrados.filter(p => p.status_db === 'paused').length,
            receitaTotal: filtrados.reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaMes: filtrados.filter(p => {
                const data = new Date(p.data_cadastro);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0)
        };

        res.render("admin/admin", { profissionais: filtrados, totais, filtroAtivo: { categoria, status: statusDb, busca, ordenar, cidade } });
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


app.put("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const id = req.params.id;
        const { valor, tipo_prazo, prazo, motivo } = req.body || {};
        const updateData = { updated_at: new Date().toISOString() };
        const valorPago = parseMoneyLike(valor);
        if (valorPago !== null) updateData.payment_value = valorPago;
        if (tipo_prazo && prazo) {
            let dataVencimento = new Date();
            const prazoNumero = Number.parseInt(prazo, 10);
            if (tipo_prazo === 'dias' && Number.isFinite(prazoNumero)) dataVencimento.setDate(dataVencimento.getDate() + prazoNumero);
            else if (tipo_prazo === 'meses' && Number.isFinite(prazoNumero)) dataVencimento.setMonth(dataVencimento.getMonth() + prazoNumero);
            else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);
            if (!Number.isNaN(dataVencimento.getTime())) updateData.data_vencimento = dataVencimento.toISOString();
        }
        const { error } = await supabase.from('professionals').update(updateData).eq('user_id', id);
        if (error) throw error;
        await supabase.from('admin_logs').insert({ professional_id: id, action_type: 'admin_profile_edit', new_values: { ...updateData, motivo: motivo || null }, performed_by: 'admin-panel' });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao editar profissional:', err);
        res.status(500).json({ erro: err.message });
    }
});

app.post("/api/profissionais/:id/status", checkAdminAPI, async (req, res) => {
    try {
        const id = req.params.id;
        const novoStatus = normalizeStatusForDb(req.body?.novoStatus);
        const allowed = ['active', 'pending', 'paused', 'excluded'];
        if (!allowed.includes(novoStatus)) return res.status(400).json({ erro: 'Status inválido' });
        const updateData = { status: novoStatus, updated_at: new Date().toISOString() };
        if (novoStatus === 'active') updateData.profile_status = 'approved';
        if (req.body?.renovar) {
            const valorPago = parseMoneyLike(req.body.valor);
            if (valorPago !== null) updateData.payment_value = valorPago;
            const tipoPrazo = req.body.tipo_prazo;
            const prazo = req.body.prazo;
            const prazoNumero = Number.parseInt(prazo, 10);
            let dataVencimento = new Date();
            if (tipoPrazo === 'dias' && Number.isFinite(prazoNumero)) dataVencimento.setDate(dataVencimento.getDate() + prazoNumero);
            else if (tipoPrazo === 'meses' && Number.isFinite(prazoNumero)) dataVencimento.setMonth(dataVencimento.getMonth() + prazoNumero);
            else if (tipoPrazo === 'data' && prazo) dataVencimento = new Date(prazo);
            if (!Number.isNaN(dataVencimento.getTime())) updateData.data_vencimento = dataVencimento.toISOString();
        }
        const { error } = await supabase.from('professionals').update(updateData).eq('user_id', id);
        if (error) throw error;
        await supabase.from('admin_logs').insert({ professional_id: id, action_type: 'admin_status_change', new_values: { status: novoStatus, motivo: req.body?.motivo || null }, performed_by: 'admin-panel' });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao alterar status:', err);
        res.status(500).json({ erro: err.message });
    }
});

app.delete("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const id = req.params.id;
        const motivo = String(req.body?.motivo || '').trim();
        const updateData = { status: 'excluded', approval_requested: false, submitted_at: null, profile_status: 'excluded', updated_at: new Date().toISOString() };
        const { error } = await supabase.from('professionals').update(updateData).eq('user_id', id);
        if (error) throw error;
        await supabase.from('admin_logs').insert({ professional_id: id, action_type: 'admin_profile_excluded', new_values: { status: 'excluded', motivo: motivo || null }, performed_by: 'admin-panel' });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao excluir profissional:', err);
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
    const next = req.query.next && String(req.query.next).startsWith('/') ? req.query.next : '';
    res.render("auth/cadastro", { erro: null, userType: type, next });
});

// API PARA SOLICITAÇÕES DE APROVAÇÃO (ADMIN)
app.get("/admin/api/solicitacoes", async (req, res) => {
    if (!req.session.adminLogado) {
        return res.status(403).json({ erro: "Acesso negado" });
    }
    try {
        const { data, error } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url), categories(name, slug)')
            .eq('approval_requested', true)
            .eq('status', 'pending')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        const ids = (data || []).map(item => item.user_id);
        let logsByProfessional = {};
        let requestsByProfessional = {};
        let categoriesByProfessional = {};

        if (ids.length) {
            const [{ data: logs }, { data: requests }, { data: profCats }] = await Promise.all([
                supabase.from('admin_logs').select('*').in('professional_id', ids).eq('action_type', 'approval_request').order('action_at', { ascending: false }),
                supabase.from('profession_requests').select('*').in('user_id', ids).order('created_at', { ascending: true }),
                supabase.from('professional_categories').select('professional_id, category_id, created_at, categories(name, slug)').in('professional_id', ids).order('created_at', { ascending: true })
            ]);
            logsByProfessional = (logs || []).reduce((acc, log) => {
                if (!acc[log.professional_id]) acc[log.professional_id] = log;
                return acc;
            }, {});
            requestsByProfessional = (requests || []).reduce((acc, item) => {
                if (!acc[item.user_id]) acc[item.user_id] = [];
                acc[item.user_id].push(item);
                return acc;
            }, {});
            categoriesByProfessional = (profCats || []).reduce((acc, item) => {
                if (!acc[item.professional_id]) acc[item.professional_id] = [];
                if (item.categories) acc[item.professional_id].push(item.categories);
                return acc;
            }, {});
        }

        const enriched = (data || []).map(item => {
            const requests = requestsByProfessional[item.user_id] || [];
            const cats = categoriesByProfessional[item.user_id] || [];
            const selectedProfessions = cats.map((cat, index) => {
                const slot = index + 1;
                const isOther = ['outros','outro'].includes(slugifyText(cat.slug || cat.name));
                const req = requests.find(r => Number(r.related_slot) === slot);
                return {
                    slot,
                    name: isOther && req ? req.requested_name : cat.name,
                    status: isOther && req ? 'em análise' : 'cadastrada',
                    original_category: cat.name
                };
            });
            return {
                ...item,
                latest_request_log: logsByProfessional[item.user_id] || null,
                profession_requests: requests,
                selected_professions: selectedProfessions
            };
        });
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});


app.get('/api/cep/:cep', async (req, res) => {
    try {
        const cep = String(req.params.cep || '').replace(/\D/g, '').slice(0, 8);
        if (cep.length !== 8) return res.status(400).json({ error: 'CEP inválido' });
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) return res.status(404).json({ error: 'CEP não encontrado' });
        return res.json({
            cep: data.cep || cep,
            city: data.localidade || '',
            state: data.uf || ''
        });
    } catch (error) {
        console.error('Erro ao consultar CEP:', error);
        return res.status(500).json({ error: 'Erro ao consultar CEP' });
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
        const basicProfileComplete = Boolean(profissional && profissional.phone_number && profissional.city && profissional.state);
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

app.get('/auth/cancelar-profissional', (req, res) => res.redirect('/'));

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
        if (cep && cep.length !== 8) return res.redirect(303, '/auth/completar-perfil?error=Informe um CEP válido com 8 números ou deixe o campo vazio');
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

        // Buscar e normalizar profissionais ativos desta categoria.
        // Antes a view recebia o registro cru do Supabase e esperava campos como
        // nome/foto/id; por isso o card público aparecia sem nome e o botão
        // "Ver Perfil" podia montar /perfil/undefined e cair no 404.
        const professionals = await loadActiveProfessionalsForCategory(category);
        
        // Tentar renderizar view específica ou genérica
        const viewName = ['pintores', 'pedreiros', 'eletricistas', 'encanadores'].includes(slug) ? slug : 'categoria-dinamica';
        
        res.render(viewName, { 
            [slug]: professionals,
            profissionais: professionals,
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
        const banners = await loadPublicBanners();

        if (!isUuid(id)) {
            return res.status(404).render("404", {
                mensagem: "Perfil inválido ou não encontrado.",
                banners,
                currentPage: 'perfil'
            });
        }

        // O link público dos cards usa o users.id/professionals.user_id.
        // Evitamos embed direto de categories aqui porque algumas bases antigas não têm
        // a relação FK exposta para o Supabase/PostgREST e isso derrubava a página em texto cru.
        const { data: professional, error } = await supabase
            .from("professionals")
            .select("*, users(full_name, email, avatar_url)")
            .eq("user_id", id)
            .maybeSingle();

        if (error) throw error;
        if (!professional || String(professional.status || '').toLowerCase() !== 'active') {
            return res.status(404).render("404", {
                mensagem: "Profissional não encontrado ou ainda não aprovado.",
                banners,
                currentPage: 'perfil'
            });
        }

        let primaryCategory = null;
        if (professional.category_id) {
            const { data: category } = await supabase
                .from('categories')
                .select('id, name, slug')
                .eq('id', professional.category_id)
                .maybeSingle();
            primaryCategory = category || null;
        }

        const [{ data: categoryRelations }, { data: professionRequests }, { data: portfolio }, { data: reviews }] = await Promise.all([
            supabase
                .from('professional_categories')
                .select('category_id, created_at, categories(id, name, slug)')
                .eq('professional_id', id)
                .order('created_at', { ascending: true }),
            supabase
                .from('profession_requests')
                .select('requested_name, requested_slug, status, related_slot, created_at')
                .eq('user_id', id)
                .order('related_slot', { ascending: true }),
            supabase
                .from('professional_portfolio')
                .select('*')
                .eq('professional_id', id)
                .order('created_at', { ascending: false }),
            supabase
                .from('reviews')
                .select('*')
                .eq('professional_id', id)
                .order('created_at', { ascending: false })
        ]);

        const relationCategories = (categoryRelations || []).map(item => item.categories).filter(Boolean);
        if (!primaryCategory && relationCategories.length) primaryCategory = relationCategories[0];

        const planInfo = inferPlanTierFromProfessional(professional);
        const professionSlots = buildProfessionSlots(
            professional,
            primaryCategory,
            relationCategories,
            professionRequests || [],
            planInfo.slots
        );

        const publicProfessional = normalizePublicProfessional(professional, primaryCategory);
        const profissional = {
            ...professional,
            ...publicProfessional,
            categories: primaryCategory || { name: publicProfessional.profissao, slug: slugifyText(publicProfessional.profissao) },
            profession_slots: professionSlots,
            plan_label: planInfo.label
        };

        return res.render("perfil-profissional", {
            profissional,
            portfolio: portfolio || [],
            reviews: reviews || [],
            banners,
            userId: req.session?.userId || null,
            currentUser: req.session?.user || null,
            currentPage: slugifyText(primaryCategory?.slug || primaryCategory?.name || '') || 'perfil'
        });
    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
        try {
            const banners = await loadPublicBanners();
            return res.status(500).render("404", {
                mensagem: "Não conseguimos carregar este perfil agora.",
                banners,
                currentPage: 'perfil'
            });
        } catch (_) {
            return res.status(500).render("404", { mensagem: "Não conseguimos carregar este perfil agora." });
        }
    }
});

// Handler Global de Erros (SaaS)
app.use(errorHandler);

// Página 404 (Fallback)
app.use((req, res) => res.status(404).render("404", { mensagem: "Página não encontrada." }));

// Iniciar Servidor
app.listen(port, () => console.log(`🚀 [CONTRATAÊ SaaS]: Servidor rodando na porta ${port}`));
