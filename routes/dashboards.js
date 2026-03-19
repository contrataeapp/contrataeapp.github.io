const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireProfessional } = require('../middlewares/authMiddleware');
const { catchAsync } = require('../middlewares/errorHandler');
const multer = require('multer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

function parseCurrencyLike(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function compactText(value) {
    return String(value || '').trim();
}

function buildAvailability(body) {
    const days = Array.isArray(body.working_days)
        ? body.working_days
        : body.working_days ? [body.working_days] : [];

    if (body.available_24h) {
        return days.length ? `${days.join(', ')} • 24h` : 'Disponível 24h';
    }

    const start = compactText(body.availability_start);
    const end = compactText(body.availability_end);
    const dayText = days.join(', ');
    const hourText = start && end ? `${start} às ${end}` : '';
    return [dayText, hourText].filter(Boolean).join(' • ') || null;
}

async function uploadToBucket(bucket, filePath, file) {
    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
}

async function getAllCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

function resolveCategoryFromInput(input, categories) {
    const value = compactText(input).toLowerCase();
    if (!value) return null;
    return categories.find(cat =>
        String(cat.id) === value ||
        String(cat.name || '').toLowerCase() === value ||
        String(cat.slug || '').toLowerCase() === value
    ) || null;
}

async function registerCategorySuggestion(professionalId, suggestion) {
    const text = compactText(suggestion);
    if (!text) return;
    await supabase.from('admin_logs').insert({
        professional_id: professionalId,
        action_type: 'category_suggestion',
        new_values: { suggestion: text },
        performed_by: 'professional-dashboard'
    });
}

router.get('/profissional/dashboard', requireProfessional, catchAsync(async (req, res) => {
    console.log('--- INÍCIO GET /profissional/dashboard ---');
    console.log('UserID na Sessão:', req.session.userId);

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

    const categorias = await getAllCategories();
    const { data: categoriasExtras } = await supabase
        .from('professional_categories')
        .select('category_id, categories(id, name, slug)')
        .eq('professional_id', req.session.userId);

    const categoriasSelecionadas = (categoriasExtras || []).map(item => item.category_id);
    const categoriasExtrasDetalhes = (categoriasExtras || []).map(item => item.categories).filter(Boolean);

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

    const currentPrimaryCategory = categorias.find(cat => cat.id === profissional.category_id);
    const categoryNames = categorias.map(cat => cat.name);
    const selectedAdditionalNames = categoriasExtrasDetalhes
        .filter(cat => cat.id !== profissional.category_id)
        .map(cat => cat.name);

    res.render('dashboards/profissional-dashboard', {
        fullName: req.session.fullName,
        profissional: profissional || {},
        categorias,
        categoryNames,
        categoriasSelecionadas,
        currentPrimaryCategory,
        selectedAdditionalNames,
        servicos: [],
        avaliacoes: reviews || [],
        planos: [],
        pagamentos: pagamentos || [],
        portfolio: portfolio || [],
        contatosRecebidos: 0,
        servicosConcluidos: 0,
        faturamentoMes: profissional?.payment_value || profissional?.valor_pago || '0,00',
        avaliacaoMedia,
        basicProfileComplete,
        profileReadyForApproval,
        activeTab: req.query.tab || 'resumo',
        activeWizard: req.query.wizard === '1',
        flashError: req.query.error || '',
        flashSuccess: req.query.success || '',
        justSavedBasic: req.query.basic === '1'
    });
}));

router.get('/cliente/dashboard', requireAuth, catchAsync(async (req, res) => {
    const { data: profissionaisRecomendados } = await supabase
        .from('professionals')
        .select('*, users(full_name, avatar_url), categories(name)')
        .eq('status', 'active')
        .limit(6);

    res.render('dashboards/cliente-dashboard', {
        fullName: req.session.fullName,
        profissionaisRecomendados: profissionaisRecomendados || [],
        favoritos: [],
        favoritosCont: 0,
        servicosContratados: 0,
        avaliacoesFeiras: 0,
        historico: []
    });
}));

router.post('/profissional/atualizar-perfil', requireProfessional, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'portfolio_images', maxCount: 10 },
    { name: 'portfolio_image', maxCount: 10 }
]), catchAsync(async (req, res) => {
    const body = req.body || {};
    const allCategories = await getAllCategories();

    const primaryCategory = resolveCategoryFromInput(body.category_id || body.primary_category_name, allCategories);
    const additionalInputs = [];
    if (body.additional_category_1) additionalInputs.push(body.additional_category_1);
    if (body.additional_category_2) additionalInputs.push(body.additional_category_2);
    if (body.categories) {
        const arr = Array.isArray(body.categories) ? body.categories : [body.categories];
        additionalInputs.push(...arr);
    }

    const additionalCategories = additionalInputs
        .map(input => resolveCategoryFromInput(input, allCategories))
        .filter(Boolean);

    if (!primaryCategory) {
        return res.redirect('/profissional/dashboard?tab=perfil&wizard=1&error=missing_category#perfil');
    }

    const selectedCategories = [primaryCategory, ...additionalCategories]
        .filter((cat, index, arr) => cat && arr.findIndex(other => other.id === cat.id) === index)
        .slice(0, 3);

    const availability = buildAvailability(body);
    const serviceFeeEnabled = Boolean(body.service_fee_enabled);
    const priceInfo = serviceFeeEnabled
        ? `Taxa de visita: R$ ${(parseCurrencyLike(body.service_fee_amount) || 0).toFixed(2).replace('.', ',')}`
        : compactText(body.price_info) || null;

    const updatePayload = {
        user_id: req.session.userId,
        category_id: primaryCategory.id,
        phone_number: compactText(body.phone_number) || null,
        cep: compactText(body.cep) || null,
        city: compactText(body.city) || null,
        state: compactText(body.state).toUpperCase() || null,
        description: compactText(body.description) || null,
        specialties: compactText(body.specialties) || null,
        price_info: priceInfo,
        availability,
        profile_completed: true,
        approval_requested: false,
        status: 'pending'
    };

    const { error: profError } = await supabase
        .from('professionals')
        .upsert(updatePayload, { onConflict: 'user_id' });
    if (profError) throw profError;

    const fullName = compactText(body.full_name);
    const avatarFile = req.files?.avatar?.[0] || null;
    const userUpdates = {};
    if (fullName) userUpdates.full_name = fullName;
    if (avatarFile) {
        const ext = (avatarFile.originalname.split('.').pop() || 'jpg').toLowerCase();
        const avatarPath = `public/avatar_${req.session.userId}_${Date.now()}.${ext}`;
        userUpdates.avatar_url = await uploadToBucket('avatars', avatarPath, avatarFile);
    }
    if (Object.keys(userUpdates).length) {
        await supabase.from('users').update(userUpdates).eq('id', req.session.userId);
        if (userUpdates.full_name) req.session.fullName = userUpdates.full_name;
    }

    await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
    if (selectedCategories.length) {
        await supabase.from('professional_categories').insert(
            selectedCategories.map(cat => ({ professional_id: req.session.userId, category_id: cat.id }))
        );
    }

    const portfolioFiles = [
        ...(req.files?.portfolio_images || []),
        ...(req.files?.portfolio_image || [])
    ];

    if (portfolioFiles.length) {
        const { data: existingPortfolio } = await supabase
            .from('professional_portfolio')
            .select('id')
            .eq('professional_id', req.session.userId);
        const slotsLeft = Math.max(0, 10 - (existingPortfolio || []).length);
        const allowedFiles = portfolioFiles.slice(0, slotsLeft);
        for (const file of allowedFiles) {
            const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
            const path = `portfolio/portfolio_${req.session.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const imageUrl = await uploadToBucket('avatars', path, file);
            await supabase.from('professional_portfolio').insert({
                professional_id: req.session.userId,
                image_url: imageUrl
            });
        }
    }

    await registerCategorySuggestion(req.session.userId, body.new_profession_request);

    return res.redirect('/profissional/dashboard?tab=perfil&success=profile_saved#perfil');
}));

router.post('/profissional/solicitar-aprovacao', requireProfessional, catchAsync(async (req, res) => {
    const { error } = await supabase
        .from('professionals')
        .update({ approval_requested: true, status: 'pending' })
        .eq('user_id', req.session.userId);

    if (error) throw error;
    res.redirect('/profissional/dashboard?success=approval_requested');
}));

router.post('/profissional/portfolio/adicionar', requireProfessional, upload.fields([
    { name: 'portfolio_image', maxCount: 10 },
    { name: 'portfolio_images', maxCount: 10 }
]), catchAsync(async (req, res) => {
    const files = [
        ...(req.files?.portfolio_image || []),
        ...(req.files?.portfolio_images || [])
    ];

    if (!files.length) return res.redirect('/profissional/dashboard?tab=portfolio#error=missing_image#portfolio');

    const { data: existingPortfolio } = await supabase
        .from('professional_portfolio')
        .select('id')
        .eq('professional_id', req.session.userId);

    const slotsLeft = Math.max(0, 10 - (existingPortfolio || []).length);
    const allowedFiles = files.slice(0, slotsLeft);

    for (const file of allowedFiles) {
        const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
        const path = `portfolio/portfolio_${req.session.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const imageUrl = await uploadToBucket('avatars', path, file);
        await supabase.from('professional_portfolio').insert({ professional_id: req.session.userId, image_url: imageUrl });
    }

    res.redirect('/profissional/dashboard?tab=portfolio&success=portfolio_saved#portfolio');
}));

router.post('/profissional/portfolio/remover', requireProfessional, catchAsync(async (req, res) => {
    const { id } = req.body;
    const { error } = await supabase
        .from('professional_portfolio')
        .delete()
        .eq('id', id)
        .eq('professional_id', req.session.userId);

    if (error) throw error;
    res.redirect('/profissional/dashboard?tab=portfolio&success=portfolio_removed#portfolio');
}));

module.exports = router;
