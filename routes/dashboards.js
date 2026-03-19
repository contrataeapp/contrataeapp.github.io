const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireProfessional } = require('../middlewares/authMiddleware');
const { catchAsync } = require('../middlewares/errorHandler');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const FALLBACK_CATEGORIES = [
    { id: 'fallback-eletricista', name: 'Eletricista', slug: 'eletricistas' },
    { id: 'fallback-encanador', name: 'Encanador', slug: 'encanadores' },
    { id: 'fallback-pedreiro', name: 'Pedreiro', slug: 'pedreiros' },
    { id: 'fallback-pintor', name: 'Pintor', slug: 'pintores' },
    { id: 'fallback-montador', name: 'Montador de Móveis', slug: 'montador-moveis' },
    { id: 'fallback-ar', name: 'Técnico em Ar Condicionado', slug: 'ar-condicionado' },
    { id: 'fallback-geladeira', name: 'Técnico em Geladeira', slug: 'geladeira' },
    { id: 'fallback-cameras', name: 'Instalador de Câmeras', slug: 'cameras' },
    { id: 'fallback-marido', name: 'Marido de Aluguel', slug: 'marido-aluguel' },
    { id: 'fallback-outros', name: 'Outros', slug: 'outros' }
];

function getCategoriesWithFallback(rows) {
    return Array.isArray(rows) && rows.length ? rows : FALLBACK_CATEGORIES;
}

// Dashboard do Profissional (SaaS - Protegido)
router.get('/profissional/dashboard', requireProfessional, catchAsync(async (req, res) => {
    console.log("--- INÍCIO GET /profissional/dashboard ---");
    console.log("UserID na Sessão:", req.session.userId);

    let { data: profissional, error } = await supabase
        .from('professionals')
        .select('*, users(full_name, email, avatar_url), categories(name)')
        .eq('user_id', req.session.userId)
        .maybeSingle();

    if (error) throw error;

    if (!profissional) {
        const { data: created, error: createError } = await supabase
            .from('professionals')
            .upsert({
                user_id: req.session.userId,
                status: 'pending',
                profile_completed: false,
                approval_requested: false
            }, { onConflict: 'user_id' })
            .select('*, users(full_name, email, avatar_url), categories(name)')
            .eq('user_id', req.session.userId)
            .maybeSingle();
        if (createError) throw createError;
        profissional = created || {
            user_id: req.session.userId,
            status: 'pending',
            profile_completed: false,
            approval_requested: false
        };
    }

    const { data: categoriasDb } = await supabase.from('categories').select('*').order('name', { ascending: true });
    const categorias = getCategoriesWithFallback(categoriasDb);
    const { data: categoriasExtras } = await supabase
        .from('professional_categories')
        .select('category_id, categories(id, name, slug)')
        .eq('professional_id', req.session.userId);
    const categoriasSelecionadas = (categoriasExtras || []).map(item => item.category_id);

    const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('professional_id', req.session.userId);

    const avaliacaoMedia = reviews && reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : '0';

    const { data: pagamentos } = await supabase
        .from('payment_history')
        .select('*, plans(name)')
        .eq('professional_id', req.session.userId)
        .order('payment_date', { ascending: false });

    const { data: portfolio } = await supabase
        .from('professional_portfolio')
        .select('*')
        .eq('professional_id', req.session.userId)
        .order('created_at', { ascending: false });

    const basicProfileComplete = Boolean(profissional.phone_number && profissional.cep && profissional.city && profissional.state);
    const profileReadyForApproval = Boolean(
        basicProfileComplete &&
        profissional.description &&
        profissional.category_id
    );

    res.render('dashboards/profissional-dashboard', {
        fullName: req.session.fullName,
        profissional: profissional || {},
        categorias: categorias || [],
        categoriasSelecionadas,
        servicos: [],
        avaliacoes: reviews || [],
        planos: [],
        pagamentos: pagamentos || [],
        portfolio: portfolio || [],
        contatosRecebidos: 0,
        servicosConcluidos: 0,
        faturamentoMes: profissional?.payment_value || profissional?.valor_pago || '0,00',
        avaliacaoMedia: avaliacaoMedia,
        basicProfileComplete,
        profileReadyForApproval
    });
}));

// Dashboard do Cliente (SaaS - Protegido)
router.get('/cliente/dashboard', requireAuth, catchAsync(async (req, res) => {
    // Profissionais recomendados (ativos)
    const { data: profissionaisRecomendados } = await supabase
        .from('professionals')
        .select('*, users(full_name, avatar_url), categories(name)')
        .eq('status', 'active')
        .limit(6);
    
    res.render('dashboards/cliente-dashboard', {
        fullName: req.session.fullName,
        profissionaisRecomendados: profissionaisRecomendados || [],
        favoritos: [], // Implementar se houver tabela de favoritos
        favoritosCont: 0,
        servicosContratados: 0,
        avaliacoesFeiras: 0,
        historico: []
    });
}));

// Atualizar perfil do profissional
router.post('/profissional/atualizar-perfil', requireProfessional, catchAsync(async (req, res) => {
    const {
        category_id,
        category_primary,
        category_extra_1,
        category_extra_2,
        selected_plan,
        plan_months,
        description,
        phone_number,
        cep,
        city,
        state,
        specialties,
        price_info,
        availability,
        categories
    } = req.body;

    const selectedPlan = selected_plan || 'basic';
    const planLimit = selectedPlan === 'premium' ? 3 : selectedPlan === 'professional' ? 2 : 1;

    const legacyCategories = Array.isArray(categories) ? categories : (categories ? [categories] : []);
    const combined = [
        category_id,
        category_primary,
        category_extra_1,
        category_extra_2,
        ...legacyCategories
    ].filter(Boolean);

    const finalSelected = Array.from(new Set(combined)).slice(0, planLimit);
    const finalCategoryId = finalSelected[0] || null;
    const profileReadyForApproval = Boolean(phone_number && cep && city && state && description && finalCategoryId);

    const payload = {
        user_id: req.session.userId,
        category_id: finalCategoryId,
        description: description || '',
        phone_number: phone_number || null,
        cep: cep || null,
        city: city || null,
        state: state || null,
        specialties: specialties || null,
        price_info: price_info || null,
        availability: availability || null,
        profile_completed: profileReadyForApproval
    };

    const { error: profError } = await supabase
        .from('professionals')
        .upsert(payload, { onConflict: 'user_id' });

    if (profError) throw profError;

    await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
    if (finalSelected.length > 0) {
        const rows = finalSelected.map(catId => ({ professional_id: req.session.userId, category_id: catId }));
        await supabase.from('professional_categories').insert(rows);
    }

    const params = new URLSearchParams();
    params.set('tab', 'perfil');
    if (selectedPlan) params.set('plan', selectedPlan);
    if (plan_months) params.set('months', String(plan_months));
    res.redirect(`/profissional/dashboard?${params.toString()}#perfil`);
}));

// Solicitar aprovação do perfil
router.post('/profissional/solicitar-aprovacao', requireProfessional, catchAsync(async (req, res) => {
    const { error } = await supabase
        .from('professionals')
        .update({ 
            approval_requested: true,
            status: 'pending'
        })
        .eq('user_id', req.session.userId);
    
    if (error) throw error;
    res.redirect('/profissional/dashboard');
}));

// Adicionar foto ao portfólio
router.post('/profissional/portfolio/adicionar', requireProfessional, upload.single('portfolio_image'), catchAsync(async (req, res) => {
    let image_url = (req.body && req.body.image_url) ? req.body.image_url.trim() : '';

    if (req.file) {
        const fileExt = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `portfolio_${req.session.userId}_${Date.now()}.${fileExt}`;
        const filePath = `portfolio/${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        image_url = urlData.publicUrl;
    }

    if (!image_url) return res.redirect('/profissional/dashboard#portfolio');

    const { error } = await supabase
        .from('professional_portfolio')
        .insert([{ professional_id: req.session.userId, image_url }]);

    if (error) throw error;
    res.redirect('/profissional/dashboard#portfolio');
}));

// Remover foto do portfólio
router.post('/profissional/portfolio/remover', requireProfessional, catchAsync(async (req, res) => {
    const { id } = req.body;
    const { error } = await supabase
        .from('professional_portfolio')
        .delete()
        .eq('id', id)
        .eq('professional_id', req.session.userId);
    
    if (error) throw error;
    res.redirect('/profissional/dashboard#portfolio');
}));

module.exports = router;
