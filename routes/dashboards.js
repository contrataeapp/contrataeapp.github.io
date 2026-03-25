// FIX v11.3.4 cadastro estável: bloqueia dashboard antes da conclusão e preserva plano/meses no onboarding
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireProfessional } = require('../middlewares/authMiddleware');
const { catchAsync } = require('../middlewares/errorHandler');
const multer = require('multer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 10, fileSize: 8 * 1024 * 1024 } });

function compactText(value) {
    return String(value || '').trim();
}

function parsePlanConfig(body) {
    const tier = compactText(body.plan_tier) || 'basic';
    const months = Math.min(12, Math.max(1, Number(body.plan_months || 1) || 1));
    const plans = {
        basic: { slots: 1, monthly: 30, label: 'Plano Básico' },
        professional: { slots: 2, monthly: 50, label: 'Plano Profissional' },
        premium: { slots: 3, monthly: 70, label: 'Plano Premium' }
    };
    const plan = plans[tier] || plans.basic;
    let discount = 0;
    if (months >= 12) discount = 20;
    else if (months >= 6) discount = 12;
    else if (months >= 3) discount = 6;
    const total = Number((plan.monthly * months * (1 - discount / 100)).toFixed(2));
    return { tier, months, plan, discount, total };
}


function inferPlanTierFromProfessional(profissional) {
    const months = Math.min(12, Math.max(1, Number(profissional?.plan_duration_months || 1) || 1));
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
    const entries = Object.entries(plans).map(([tier, plan]) => ({
        tier,
        slots: plan.slots,
        label: plan.label,
        distance: Math.abs(Number((plan.monthly * months * (1 - discount / 100)).toFixed(2)) - total)
    })).sort((a, b) => a.distance - b.distance);
    return entries[0] || { tier: 'basic', slots: 1, label: 'Plano Básico' };
}

function normalizeProfileStatus(profissional) {
    return String(profissional?.profile_status || '').toLowerCase();
}

function parseCurrencyLike(value) {
    if (value === undefined || value === null || value === '') return null;
    const cleaned = String(value).replace(/[^\d,]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function buildAvailability(body) {
    const days = Array.isArray(body.working_days)
        ? body.working_days
        : body.working_days ? [body.working_days] : [];

    if (body.available_24h) {
        if (!days.length) return 'Funcionamento 24h';
        return `24h nos dias: ${days.join(', ')}`;
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

async function registerCategorySuggestion(professionalId, email, suggestion, slotIndex) {
    const text = compactText(suggestion);
    if (!text) return;
    await supabase.from('profession_requests').insert({
        user_id: professionalId,
        email: email || null,
        requested_name: text,
        requested_slug: text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        related_slot: slotIndex,
        source: 'professional_onboarding',
        status: 'pending'
    });
    await supabase.from('admin_logs').insert({
        professional_id: professionalId,
        action_type: 'category_suggestion',
        new_values: { suggestion: text, slot: slotIndex },
        performed_by: 'professional-onboarding'
    });
}

async function getProfessionalBundle(userId) {
    let { data: profissional, error } = await supabase
        .from('professionals')
        .select('*, users(full_name, email, avatar_url), categories(name)')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    if (!profissional) {
        const { data: created, error: createError } = await supabase
            .from('professionals')
            .upsert({
                user_id: userId,
                status: 'pending',
                profile_completed: false,
                approval_requested: false
            }, { onConflict: 'user_id' })
            .select('*, users(full_name, email, avatar_url), categories(name)')
            .eq('user_id', userId)
            .maybeSingle();
        if (createError) throw createError;
        profissional = created;
    }

    const categorias = await getAllCategories();
    const { data: categoriasExtras } = await supabase
        .from('professional_categories')
        .select('category_id, categories(id, name, slug)')
        .eq('professional_id', userId);

    const currentPrimaryCategory = categorias.find(cat => cat.id === profissional?.category_id) || null;
    const extraDetails = (categoriasExtras || []).map(item => item.categories).filter(Boolean);
    const selectedAdditionalIds = extraDetails.filter(cat => cat.id !== profissional?.category_id).slice(0, 2).map(cat => cat.id);

    const { data: portfolio } = await supabase
        .from('professional_portfolio')
        .select('*')
        .eq('professional_id', userId)
        .order('created_at', { ascending: false });

    const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('professional_id', userId);

    const { data: pagamentos } = await supabase
        .from('payment_history')
        .select('*, plans(name)')
        .eq('professional_id', userId)
        .order('payment_date', { ascending: false });

    const { data: approvalLogs } = await supabase
        .from('admin_logs')
        .select('*')
        .eq('professional_id', userId)
        .in('action_type', ['approval_request', 'approval_granted'])
        .order('action_at', { ascending: false });

    const { data: professionRequests } = await supabase
        .from('profession_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    return {
        profissional: profissional || {},
        categorias,
        currentPrimaryCategory,
        selectedAdditionalIds,
        portfolio: portfolio || [],
        reviews: reviews || [],
        pagamentos: pagamentos || [],
        approvalLogs: approvalLogs || [],
        professionRequests: professionRequests || [],
        selectedSlotsCount: 1 + Math.min((categoriasExtras || []).length, 2)
    };
}

router.get('/profissional/onboarding', requireProfessional, catchAsync(async (req, res) => {
    const bundle = await getProfessionalBundle(req.session.userId);
    const basicProfileComplete = Boolean(bundle.profissional.phone_number && bundle.profissional.cep && bundle.profissional.city && bundle.profissional.state);

    if (!basicProfileComplete) {
        return res.redirect('/auth/completar-perfil');
    }

    const actualSelectedCount = [bundle.profissional.category_id, ...bundle.selectedAdditionalIds].filter(Boolean).length;
    const inferredPlan = inferPlanTierFromProfessional(bundle.profissional);
    const queryTier = compactText(req.query.tier);
    const savedPlanTier = queryTier || inferredPlan.tier || (actualSelectedCount >= 3 ? 'premium' : actualSelectedCount === 2 ? 'professional' : 'basic');
    const savedPlanMonths = Number(req.query.months || bundle.profissional.plan_duration_months || 1);

    res.render('dashboards/profissional-onboarding', {
        user: bundle.profissional.users || {},
        profissional: bundle.profissional,
        categorias: bundle.categorias,
        currentPrimaryCategory: bundle.currentPrimaryCategory,
        selectedAdditionalIds: bundle.selectedAdditionalIds,
        portfolio: bundle.portfolio,
        flashError: req.query.error || '',
        flashSuccess: req.query.success || '',
        startStep: Number(req.query.step || 1),
        savedPlanTier,
        savedPlanMonths,
        displayName: bundle.profissional.users?.full_name || req.session.fullName,
        savedSuggestion: '',
        professionRequests: bundle.professionRequests || []
    });
}));

router.post('/profissional/onboarding/salvar', requireProfessional, upload.any(), catchAsync(async (req, res) => {
    const body = req.body || {};
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const saveMode = 'final';
    const currentStepLabel = Number(body.current_step || 1);
    const currentStep = Number(body.current_step || 1);
    const allCategories = await getAllCategories();
    const planConfig = parsePlanConfig(body);

    const categorySlots = [
        resolveCategoryFromInput(body.primary_category_id || body.primary_category_name, allCategories),
        resolveCategoryFromInput(body.additional_category_1, allCategories),
        resolveCategoryFromInput(body.additional_category_2, allCategories)
    ].slice(0, planConfig.plan.slots);

    const customSuggestions = [
        compactText(body.new_profession_request_1),
        compactText(body.new_profession_request_2),
        compactText(body.new_profession_request_3)
    ];

    const selectedCategories = categorySlots.filter(Boolean);
    const primaryCategory = categorySlots[0] || null;
    const selectedSlotsCount = categorySlots.reduce((acc, cat, idx) => {
        if (!cat) return acc;
        const isOther = ['outros', 'outro'].includes(String(cat.slug || '').toLowerCase()) || ['outros', 'outro'].includes(String(cat.name || '').toLowerCase());
        if (isOther && !customSuggestions[idx]) return acc;
        return acc + 1;
    }, 0);

    const basicData = {
        phone_number: String(body.phone_number || '').replace(/\D/g, '').slice(0,11) || null,
        cep: String(body.cep || '').replace(/\D/g, '').slice(0,8) || null,
        city: compactText(body.city).replace(/[^A-Za-zÀ-ÿ\s]/g, '') || null,
        state: compactText(body.state).replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0,2) || null,
        description: compactText(body.description) || null,
        specialties: compactText(body.specialties) || null,
        availability: buildAvailability(body)
    };

    const serviceFeeAmount = parseCurrencyLike(body.service_fee_amount);
    const serviceFeeEnabled = Boolean(body.service_fee_enabled) || serviceFeeAmount !== null;
    const priceInfo = serviceFeeEnabled && serviceFeeAmount !== null
        ? `Taxa de visita: R$ ${serviceFeeAmount.toFixed(2).replace('.', ',')}`
        : null;

    const isCompleteForSave = Boolean(primaryCategory && basicData.phone_number && basicData.cep && basicData.city && basicData.state);
    const profilePayload = {
        user_id: req.session.userId,
        ...basicData,
        price_info: priceInfo,
        price_value: serviceFeeAmount,
        payment_value: planConfig.total,
        plan_duration_months: planConfig.months,
        plan_price: planConfig.total,
        status: 'pending',
        approval_requested: false,
        submitted_at: null,
        profile_status: saveMode === 'final' && isCompleteForSave ? 'completed' : 'draft',
        profile_completed: saveMode === 'final' ? isCompleteForSave : false
    };

    if (primaryCategory) {
        profilePayload.category_id = primaryCategory.id;
    }

    const { error: profError } = await supabase
        .from('professionals')
        .upsert(profilePayload, { onConflict: 'user_id' });
    if (profError) throw profError;

    const displayName = compactText(body.display_name || body.full_name);
    const userUpdates = {};
    if (displayName) userUpdates.full_name = displayName;

    const avatarFile = uploadedFiles.find(file => file.fieldname === 'avatar') || null;
    if (avatarFile) {
        const ext = (avatarFile.originalname.split('.').pop() || 'jpg').toLowerCase();
        const avatarPath = `public/avatar_${req.session.userId}_${Date.now()}.${ext}`;
        userUpdates.avatar_url = await uploadToBucket('avatars', avatarPath, avatarFile);
    }
    if (Object.keys(userUpdates).length) {
        await supabase.from('users').update(userUpdates).eq('id', req.session.userId);
        if (userUpdates.full_name) req.session.fullName = userUpdates.full_name;
    }

    if (saveMode === 'final' && selectedCategories.length) {
        await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
        await supabase.from('professional_categories').insert(
            selectedCategories.map(cat => ({ professional_id: req.session.userId, category_id: cat.id }))
        );
    }

    const portfolioFiles = uploadedFiles
        .filter(file => file.fieldname === 'portfolio_images' || file.fieldname.startsWith('portfolio_image_slot_'));
    if (currentStepLabel === 4 && portfolioFiles.length > 3) {
        return res.redirect('/profissional/onboarding?step=4&error=No onboarding inicial você pode enviar até 3 imagens');
    }
    if (portfolioFiles.length) {
        const { data: existingPortfolio } = await supabase
            .from('professional_portfolio')
            .select('id')
            .eq('professional_id', req.session.userId);
        const maxAllowedNow = currentStepLabel === 4 ? 3 : 10;
        const slotsLeft = Math.max(0, Math.min(maxAllowedNow, 10) - (existingPortfolio || []).length);
        for (const file of portfolioFiles.slice(0, slotsLeft)) {
            const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
            const path = `portfolio/portfolio_${req.session.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const imageUrl = await uploadToBucket('avatars', path, file);
            await supabase.from('professional_portfolio').insert({ professional_id: req.session.userId, image_url: imageUrl });
        }
    }

    await supabase.from('profession_requests').delete().eq('user_id', req.session.userId).eq('source', 'professional_onboarding');
    for (const [index, cat] of categorySlots.entries()) {
        if (!cat) continue;
        const isOther = ['outros', 'outro'].includes(String(cat.slug || '').toLowerCase()) || ['outros', 'outro'].includes(String(cat.name || '').toLowerCase());
        if (isOther && customSuggestions[index]) {
            await registerCategorySuggestion(req.session.userId, req.session.email || profissional?.users?.email || null, customSuggestions[index], index + 1);
        }
    }

    if (!primaryCategory) {
        return res.redirect('/profissional/onboarding?step=2&error=Selecione pelo menos uma profissão para finalizar');
    }
    if (selectedSlotsCount < planConfig.plan.slots) {
        return res.redirect(`/profissional/onboarding?step=2&error=Complete as ${planConfig.plan.slots} profissões do plano escolhido antes de continuar`);
    }

    req.session.professionalReady = true;
    return req.session.save(() => res.redirect('/profissional/dashboard?success=Perfil concluído com sucesso'));
}));

router.post('/profissional/perfil/atualizar', requireProfessional, catchAsync(async (req, res) => {
    const body = req.body || {};
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const displayName = compactText(body.display_name);
    const availability = buildAvailability(body);
    const fee = parseCurrencyLike(body.service_fee_amount);
    const serviceFeeEnabled = Boolean(body.service_fee_enabled) || fee !== null;
    const priceInfo = serviceFeeEnabled && fee !== null
        ? `Taxa de visita: R$ ${fee.toFixed(2).replace('.', ',')}`
        : null;

    await supabase.from('professionals').update({
        phone_number: String(body.phone_number || '').replace(/\D/g, '').slice(0,11) || null,
        cep: String(body.cep || '').replace(/\D/g, '').slice(0,8) || null,
        city: compactText(body.city).replace(/[^A-Za-zÀ-ÿ\s]/g, '') || null,
        state: compactText(body.state).replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0,2) || null,
        specialties: compactText(body.specialties) || null,
        description: compactText(body.description) || null,
        availability,
        price_info: priceInfo,
        price_value: fee,
        approval_requested: false,
        submitted_at: null,
        profile_status: 'completed'
    }).eq('user_id', req.session.userId);

    if (displayName) {
        await supabase.from('users').update({ full_name: displayName }).eq('id', req.session.userId);
        req.session.fullName = displayName;
    }
    res.redirect('/profissional/dashboard?tab=perfil&success=Perfil atualizado com sucesso');
}));

router.post('/profissional/plano/atualizar', requireProfessional, catchAsync(async (req, res) => {
    const allCategories = await getAllCategories();
    const planConfig = parsePlanConfig(req.body || {});
    const bundle = await getProfessionalBundle(req.session.userId);
    const primary = resolveCategoryFromInput(req.body.primary_category_id || bundle.profissional.category_id, allCategories) || bundle.currentPrimaryCategory;
    const additions = [req.body.additional_category_1, req.body.additional_category_2]
        .map(v => resolveCategoryFromInput(v, allCategories))
        .filter(Boolean);
    const selected = [primary, ...additions].filter((cat, i, arr) => cat && arr.findIndex(o => o.id === cat.id) === i).slice(0, planConfig.plan.slots);
    if (!selected.length) return res.redirect('/profissional/dashboard?tab=planos&error=Escolha pelo menos uma profissão antes de mudar o plano');
    await supabase.from('professionals').update({
        category_id: selected[0].id,
        payment_value: planConfig.total,
        plan_duration_months: planConfig.months,
        plan_price: planConfig.total,
        approval_requested: false,
        submitted_at: null,
        profile_status: 'completed'
    }).eq('user_id', req.session.userId);
    await supabase.from('professional_categories').delete().eq('professional_id', req.session.userId);
    await supabase.from('professional_categories').insert(selected.map(cat => ({ professional_id: req.session.userId, category_id: cat.id })));
    res.redirect('/profissional/dashboard?tab=planos&success=Plano e profissões atualizados');
}));

router.get('/profissional/dashboard', requireProfessional, catchAsync(async (req, res) => {
    console.log('--- INÍCIO GET /profissional/dashboard ---');
    console.log('UserID na Sessão:', req.session.userId);

    const bundle = await getProfessionalBundle(req.session.userId);
    const profissional = bundle.profissional;
    const basicProfileComplete = Boolean(profissional.phone_number && profissional.cep && profissional.city && profissional.state);
    if (!basicProfileComplete) return res.redirect('/auth/completar-perfil');
    if (!profissional.profile_completed) return res.redirect('/profissional/onboarding?step=1&error=Conclua as 4 etapas do cadastro antes de acessar sua dashboard');
    const profileReadyForApproval = Boolean(basicProfileComplete && profissional.description && profissional.category_id && bundle.portfolio.length > 0);
    const approvalPending = Boolean(profissional.approval_requested);
    const isApproved = String(profissional.status || '').toLowerCase() === 'active';
    const profileStatus = normalizeProfileStatus(profissional) || (profileReadyForApproval ? 'completed' : 'draft');
    const latestApprovalRequest = (bundle.approvalLogs || []).find(log => log.action_type === 'approval_request') || null;

    const actualSelectedCount = Number(bundle.selectedSlotsCount || [profissional.category_id, ...bundle.selectedAdditionalIds].filter(Boolean).length || 1);
    const inferredPlan = inferPlanTierFromProfessional(profissional);
    const selectedCount = Math.max(actualSelectedCount, inferredPlan.slots || 1);
    const currentPlanName = inferredPlan.label || 'Plano Básico';

    const avaliacaoMedia = bundle.reviews.length > 0
        ? (bundle.reviews.reduce((acc, r) => acc + r.rating, 0) / bundle.reviews.length).toFixed(1)
        : '0';

    res.render('dashboards/profissional-dashboard', {
        fullName: req.session.fullName,
        profissional,
        portfolio: bundle.portfolio,
        pagamentos: bundle.pagamentos,
        avaliacoes: bundle.reviews,
        currentPrimaryCategory: bundle.currentPrimaryCategory,
        selectedAdditionalCategories: bundle.categorias.filter(cat => bundle.selectedAdditionalIds.includes(cat.id)),
        basicProfileComplete,
        profileReadyForApproval,
        activeTab: req.query.tab || 'resumo',
        flashError: req.query.error || '',
        flashSuccess: req.query.success || '',
        contatosRecebidos: 0,
        servicosConcluidos: 0,
        faturamentoMes: Number(0).toFixed(2).replace('.', ','),
        avaliacaoMedia,
        currentPlanName,
        selectedCount,
        approvalPending,
        isApproved,
        profileStatus,
        latestApprovalRequest
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

router.post('/profissional/solicitar-aprovacao', requireProfessional, upload.single('payment_proof'), catchAsync(async (req, res) => {
    const body = req.body || {};
    const bundle = await getProfessionalBundle(req.session.userId);
    const profissional = bundle.profissional || {};
    const basicProfileComplete = Boolean(profissional.phone_number && profissional.cep && profissional.city && profissional.state);
    const profileReadyForApproval = Boolean(basicProfileComplete && profissional.description && profissional.category_id && bundle.portfolio.length > 0);

    if (profissional.approval_requested) {
        return res.redirect('/profissional/dashboard?success=Seu perfil já está em análise');
    }

    if (!profileReadyForApproval) {
        return res.redirect('/profissional/dashboard?error=Complete seu perfil antes de enviar para análise');
    }

    const sentByWhatsapp = body.payment_sent_whatsapp === 'on';
    let paymentProofUrl = null;
    if (!sentByWhatsapp && !req.file) {
        return res.redirect('/profissional/dashboard?tab=resumo&error=Envie o comprovante de pagamento ou marque que enviou pelo WhatsApp');
    }
    if (req.file) {
        const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
        const path = `payments/payment_${req.session.userId}_${Date.now()}.${ext}`;
        paymentProofUrl = await uploadToBucket('avatars', path, req.file);
    }

    const { error } = await supabase
        .from('professionals')
        .update({ approval_requested: true, status: 'pending', profile_status: 'under_review', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', req.session.userId);

    if (error) throw error;

    await supabase.from('admin_logs').insert({
        professional_id: req.session.userId,
        action_type: 'approval_request',
        new_values: {
            profile: 'sent_to_review',
            category_id: profissional.category_id || null,
            price_info: profissional.price_info || null,
            price_value: profissional.price_value || null,
            description: profissional.description || null,
            plan_duration_months: profissional.plan_duration_months || null,
            plan_price: profissional.plan_price || profissional.payment_value || null,
            payment_proof_url: paymentProofUrl,
            payment_sent_whatsapp: sentByWhatsapp,
            user_avatar_url: profissional.users?.avatar_url || null
        },
        performed_by: 'professional-dashboard'
    });

    res.redirect('/profissional/dashboard?success=Solicitação enviada para análise');
}));

router.post('/profissional/portfolio/adicionar', requireProfessional, upload.fields([
    { name: 'portfolio_image', maxCount: 10 },
    { name: 'portfolio_images', maxCount: 10 }
]), catchAsync(async (req, res) => {
    const files = [
        ...(req.files?.portfolio_image || []),
        ...(req.files?.portfolio_images || [])
    ];

    if (!files.length) return res.redirect('/profissional/dashboard?tab=portfolio&error=Selecione ao menos uma imagem');

    const { data: existingPortfolio } = await supabase
        .from('professional_portfolio')
        .select('id')
        .eq('professional_id', req.session.userId);

    const slotsLeft = Math.max(0, 10 - (existingPortfolio || []).length);
    const allowedFiles = files.slice(0, slotsLeft);

    if (!allowedFiles.length) return res.redirect('/profissional/dashboard?tab=portfolio&error=Seu portfólio já atingiu o limite de 10 imagens');

    for (const file of allowedFiles) {
        const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
        const path = `portfolio/portfolio_${req.session.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const imageUrl = await uploadToBucket('avatars', path, file);
        await supabase.from('professional_portfolio').insert({ professional_id: req.session.userId, image_url: imageUrl });
    }

    await supabase.from('professionals').update({ approval_requested: false, submitted_at: null, profile_status: 'completed' }).eq('user_id', req.session.userId);
    res.redirect('/profissional/dashboard?tab=portfolio&success=Imagens adicionadas ao portfólio');
}));

router.post('/profissional/portfolio/remover', requireProfessional, catchAsync(async (req, res) => {
    const { id } = req.body;
    const { error } = await supabase
        .from('professional_portfolio')
        .delete()
        .eq('id', id)
        .eq('professional_id', req.session.userId);

    if (error) throw error;
    await supabase.from('professionals').update({ approval_requested: false, submitted_at: null, profile_status: 'completed' }).eq('user_id', req.session.userId);
    res.redirect('/profissional/dashboard?tab=portfolio&success=Imagem removida');
}));

module.exports = router;
