// FIX v11.3.4 cadastro estável: bloqueia dashboard antes da conclusão e preserva plano/meses no onboarding
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireProfessional } = require('../middlewares/authMiddleware');
const { catchAsync } = require('../middlewares/errorHandler');
const multer = require('multer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const supabaseAdmin = supabaseServiceKey
    ? createClient(process.env.SUPABASE_URL, supabaseServiceKey, { auth: { persistSession: false } })
    : supabase;
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 10, fileSize: 8 * 1024 * 1024 } });

function compactText(value) {
    return String(value || '').trim();
}

function slugifyText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
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
    const explicitPlanName = String(profissional?.plan_name || '').toLowerCase();
    if (explicitPlanName.includes('premium')) return { tier: 'premium', slots: 3, label: 'Plano Premium' };
    if (explicitPlanName.includes('profissional')) return { tier: 'professional', slots: 2, label: 'Plano Profissional' };
    if (explicitPlanName.includes('básico') || explicitPlanName.includes('basico')) return { tier: 'basic', slots: 1, label: 'Plano Básico' };
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
    if (value === undefined || value === null || String(value).trim() === '') return null;
    let raw = String(value).trim().replace(/[^\d,.-]/g, '');
    if (!raw) return null;
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
        // O último separador é tratado como decimal; os anteriores são milhares.
        if (lastComma > lastDot) raw = raw.replace(/\./g, '').replace(',', '.');
        else raw = raw.replace(/,/g, '');
    } else if (lastComma >= 0) {
        raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (lastDot >= 0) {
        const decimals = raw.length - lastDot - 1;
        const dotCount = (raw.match(/\./g) || []).length;
        if (dotCount > 1 || decimals > 2) raw = raw.replace(/\./g, '');
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

function extractAveragePrice(priceInfo) {
    const match = String(priceInfo || '').match(/Preço médio:\s*R\$\s*([\d.,]+)/i);
    if (!match) return '';
    const num = parseCurrencyLike(match[1]);
    return num === null ? '' : num.toFixed(2).replace('.', ',');
}

function buildProfessionPriceInfo({ serviceFeeEnabled, fee, averagePrice }) {
    const parts = [];
    if (serviceFeeEnabled && fee !== null) parts.push(`Taxa de visita: R$ ${fee.toFixed(2).replace('.', ',')}`);
    if (averagePrice !== null) parts.push(`Preço médio: R$ ${averagePrice.toFixed(2).replace('.', ',')}`);
    return parts.join(' • ') || null;
}


function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(v => compactText(v)).filter(Boolean);
    return value ? [compactText(value)].filter(Boolean) : [];
}

function isOtherCategory(cat) {
    if (!cat) return false;
    const name = compactText(cat.name || '').toLowerCase();
    const slug = compactText(cat.slug || '').toLowerCase();
    return ['outros', 'outro'].includes(name) || ['outros', 'outro'].includes(slug);
}

function buildAvailability(body) {
    const clientSummary = compactText(body.availability_summary);
    if (clientSummary) return clientSummary;

    const days = toArray(body.working_days);
    const days24 = toArray(body.working_days_24h);
    const pieces = [];
    const start = compactText(body.availability_start);
    const end = compactText(body.availability_end);
    const is24 = Boolean(body.available_24h);
    const is24AllDays = Boolean(body.available_24h_all_days);

    if (is24) {
        const customNote = compactText(body.availability_24h_note);
        if (customNote) {
            pieces.push(customNote);
        } else if (is24AllDays) {
            pieces.push('Atendimento 24h todos os dias');
        } else if (days24.length) {
            pieces.push(`Atendimento 24h em ${days24.join(', ')}`);
        }
    }

    if (!is24AllDays) {
        const dayText = days.join(', ');
        const hourText = start && end ? `${start} às ${end}` : '';
        const regular = [dayText, hourText].filter(Boolean).join(' • ');
        if (regular) pieces.push(regular);
    }

    const specialMap = [
        { key: 'saturday', label: 'Sábado' },
        { key: 'sunday', label: 'Domingo' },
        { key: 'holiday', label: 'Feriado' }
    ];
    for (const item of specialMap) {
        const mode = compactText(body[`${item.key}_service_mode`]) || (item.key === 'saturday' ? 'same' : 'no');
        if (mode === 'no') continue;
        if (mode === 'same') {
            pieces.push(`${item.label}: mesmo horário padrão`);
            continue;
        }
        const specialStart = compactText(body[`${item.key}_start`]);
        const specialEnd = compactText(body[`${item.key}_end`]);
        if (specialStart && specialEnd) {
            pieces.push(`${item.label}: ${specialStart} às ${specialEnd}`);
        }
    }

    return pieces.filter(Boolean).join(' • ') || null;
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
        const requestStatus = String(request?.status || 'pending').toLowerCase();
        const pendingRequest = Boolean(request?.requested_name && requestStatus === 'pending' && (!cat || other));
        // Quando a profissão nasceu de “Outros”, mesmo aprovada ela deve usar o nome/slug solicitado,
        // não o slug genérico /categoria/outros. Isso evita preview e perfil público abrirem a profissão errada.
        const useRequestName = Boolean(request?.requested_name && (!cat || other || requestStatus === 'approved'));
        const displayName = useRequestName ? request.requested_name : (cat?.name || request?.requested_name || 'Não definida');
        const requestSlug = request?.requested_slug || slugifyText(request?.requested_name || '');
        const resolvedSlug = useRequestName ? requestSlug : (cat?.slug || requestSlug || slugifyText(displayName));
        slots.push({
            slot,
            category: cat || null,
            request,
            requestStatus,
            isSuggestion: pendingRequest,
            displayName,
            statusLabel: pendingRequest ? 'em análise' : '',
            slug: resolvedSlug || null
        });
    }
    return slots;
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

function uniqueUuidList(values) {
    return [...new Set((values || []).filter(Boolean).map(String).filter(isUuid))];
}

function professionalCategoryRelationKeys(userId, profissional) {
    return uniqueUuidList([userId, profissional?.id, profissional?.user_id]);
}

async function preferredProfessionalCategoryRelationId(userId, profissional) {
    let prof = profissional || null;
    if (!prof?.id) {
        const { data } = await supabaseAdmin
            .from('professionals')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        prof = data || prof;
    }
    return prof?.id || userId;
}

async function replaceProfessionalCategoryRelations(userId, profissional, categories) {
    const cleanCategories = (categories || []).filter(Boolean);
    const keys = professionalCategoryRelationKeys(userId, profissional);
    if (keys.length) {
        await supabaseAdmin.from('professional_categories').delete().in('professional_id', keys);
    }
    if (!cleanCategories.length) return;

    const preferredId = await preferredProfessionalCategoryRelationId(userId, profissional);
    const payload = cleanCategories.map(cat => ({ professional_id: preferredId, category_id: cat.id }));
    let { error } = await supabaseAdmin.from('professional_categories').insert(payload);

    // Compatibilidade com bases antigas em que professional_categories.professional_id aponta para users.id.
    if (error && preferredId !== userId) {
        console.warn('Aviso: vínculo de categorias com professionals.id falhou; tentando users.id:', error.message || error);
        const fallbackPayload = cleanCategories.map(cat => ({ professional_id: userId, category_id: cat.id }));
        const retry = await supabaseAdmin.from('professional_categories').insert(fallbackPayload);
        error = retry.error;
    }
    if (error) throw error;
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
    const relationKeys = professionalCategoryRelationKeys(userId, profissional);
    const { data: categoriasExtras } = await supabase
        .from('professional_categories')
        .select('professional_id, category_id, created_at, categories(id, name, slug)')
        .in('professional_id', relationKeys.length ? relationKeys : [userId])
        .order('created_at', { ascending: true });

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

    const inferredPlanForSlots = inferPlanTierFromProfessional(profissional);
    const selectedProfessionSlots = buildProfessionSlots(
        profissional || {},
        currentPrimaryCategory,
        extraDetails,
        professionRequests || [],
        inferredPlanForSlots.slots || 1
    );

    return {
        profissional: profissional || {},
        categorias,
        currentPrimaryCategory,
        selectedAdditionalIds,
        selectedProfessionSlots,
        selectedAdditionalProfessionSlots: selectedProfessionSlots.filter(item => item.slot > 1),
        portfolio: portfolio || [],
        reviews: reviews || [],
        pagamentos: pagamentos || [],
        approvalLogs: approvalLogs || [],
        professionRequests: professionRequests || [],
        selectedSlotsCount: selectedProfessionSlots.length || 0
    };
}



// v11.3.25 - Perfis por profissão: mantém o cadastro antigo funcionando,
// mas cria uma camada nova para descrição, preço, disponibilidade e portfólio por profissão.
function getProfileTableUnavailableError(err) {
    return String(err?.message || err || '').includes('professional_profession_profiles') || String(err?.message || err || '').includes('professional_profession_portfolio');
}

async function safeLoadProfessionProfiles(userId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('professional_profession_profiles')
            .select('*')
            .eq('professional_id', userId)
            .order('slot', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn('Aviso: camada de profissões por perfil indisponível. Rode sql_scripts/07_profession_profiles_portfolios.sql:', err.message || err);
        return [];
    }
}

async function safeLoadProfessionPortfolio(userId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .select('*')
            .eq('professional_id', userId)
            .order('position', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn('Aviso: portfólio por profissão indisponível. Rode sql_scripts/07_profession_profiles_portfolios.sql:', err.message || err);
        return [];
    }
}


function portfolioDraftSchemaUnavailable(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('is_published') || msg.includes('pending_delete') || msg.includes('draft_caption') || msg.includes('caption');
}

function normalizePortfolioPublishState(item) {
    return {
        isPublished: item?.is_published !== false,
        pendingDelete: item?.pending_delete === true,
        hasDraftCaption: item?.draft_caption !== null && item?.draft_caption !== undefined,
        displayCaption: compactText(item?.draft_caption ?? item?.caption ?? '')
    };
}

function portfolioForPreview(items) {
    return (items || []).filter(item => normalizePortfolioPublishState(item).pendingDelete === false).map(item => ({
        ...item,
        caption: normalizePortfolioPublishState(item).displayCaption
    }));
}

function portfolioForPublishedView(items) {
    // Uma remoção marcada continua pública até o profissional confirmar "Salvar e publicar".
    return (items || []).filter(item => normalizePortfolioPublishState(item).isPublished).map(item => ({
        ...item,
        caption: compactText(item?.caption || '')
    }));
}

function hasPortfolioDraftChanges(items) {
    return (items || []).some(item => {
        const state = normalizePortfolioPublishState(item);
        return !state.isPublished || state.pendingDelete || state.hasDraftCaption;
    });
}

function normalizePortfolioOrderInput(value) {
    if (!value) return [];
    let list = value;
    if (typeof value === 'string') {
        try { list = JSON.parse(value); }
        catch (_) { list = value.split(','); }
    }
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.map(item => compactText(item)).filter(id => {
        if (!id || seen.has(id)) return false;
        seen.add(id); return true;
    }).slice(0, 10);
}

function sortPortfolioByDraftOrder(items, orderInput) {
    const order = normalizePortfolioOrderInput(orderInput);
    if (!order.length) return items || [];
    const rank = new Map(order.map((id, index) => [String(id), index]));
    return [...(items || [])].sort((a, b) => {
        const ra = rank.has(String(a?.id)) ? rank.get(String(a.id)) : 999;
        const rb = rank.has(String(b?.id)) ? rank.get(String(b.id)) : 999;
        if (ra !== rb) return ra - rb;
        return Number(a?.position || 0) - Number(b?.position || 0);
    });
}

async function applyProfessionPortfolioOrder(userId, professionProfileId, orderInput) {
    const requested = normalizePortfolioOrderInput(orderInput);
    if (!professionProfileId || !requested.length) return { changed: false };
    const { data: rows, error } = await supabaseAdmin
        .from('professional_profession_portfolio')
        .select('id, position')
        .eq('professional_id', userId)
        .eq('profession_profile_id', professionProfileId)
        .order('position', { ascending: true });
    if (error) throw error;
    const existing = rows || [];
    const allowed = new Set(existing.map(row => String(row.id)));
    const ordered = requested.filter(id => allowed.has(String(id)));
    existing.forEach(row => { if (!ordered.includes(String(row.id))) ordered.push(String(row.id)); });
    let changed = false;
    for (let index = 0; index < ordered.length; index += 1) {
        const id = ordered[index];
        const desired = index + 1;
        const current = existing.find(row => String(row.id) === String(id));
        if (Number(current?.position || 0) === desired) continue;
        const { error: updateError } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .update({ position: desired, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('professional_id', userId);
        if (updateError) throw updateError;
        changed = true;
    }
    return { changed };
}

async function publishProfessionPortfolioDraft(userId, professionProfileId) {
    if (!professionProfileId) return { changed: false, schemaReady: true };
    try {
        const { data: rows, error } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .select('id, caption, draft_caption, is_published, pending_delete')
            .eq('professional_id', userId)
            .eq('profession_profile_id', professionProfileId);
        if (error) throw error;
        const items = rows || [];
        const toDelete = items.filter(item => item.pending_delete === true).map(item => item.id);
        const toPublish = items.filter(item => item.pending_delete !== true && (item.is_published === false || item.draft_caption !== null && item.draft_caption !== undefined));

        if (toDelete.length) {
            const { error: deleteError } = await supabaseAdmin
                .from('professional_profession_portfolio')
                .delete()
                .in('id', toDelete)
                .eq('professional_id', userId);
            if (deleteError) throw deleteError;
        }

        for (const item of toPublish) {
            const patch = {
                is_published: true,
                pending_delete: false,
                updated_at: new Date().toISOString()
            };
            if (item.draft_caption !== null && item.draft_caption !== undefined) {
                patch.caption = compactText(item.draft_caption).slice(0, 180) || null;
                patch.draft_caption = null;
            }
            const { error: updateError } = await supabaseAdmin
                .from('professional_profession_portfolio')
                .update(patch)
                .eq('id', item.id)
                .eq('professional_id', userId);
            if (updateError) throw updateError;
        }
        return { changed: Boolean(toDelete.length || toPublish.length), schemaReady: true };
    } catch (err) {
        if (portfolioDraftSchemaUnavailable(err)) return { changed: false, schemaReady: false, error: err };
        throw err;
    }
}

async function ensurePrimaryProfessionPortfolioSeeded(userId, bundle, professionProfileRows, professionPortfolioRows) {
    const primary = (professionProfileRows || []).find(row => Number(row.slot) === 1);
    if (!primary?.id) return professionPortfolioRows || [];
    const dedicated = (professionPortfolioRows || []).filter(row => row.profession_profile_id === primary.id);
    const legacy = Array.isArray(bundle?.portfolio) ? bundle.portfolio : [];
    if (dedicated.length || !legacy.length) return professionPortfolioRows || [];
    try {
        const payload = legacy.slice(0, 10).map((item, index) => ({
            professional_id: userId, profession_profile_id: primary.id, slot: 1, image_url: item.image_url, position: index + 1
        })).filter(item => item.image_url);
        if (payload.length) {
            const { error } = await supabaseAdmin.from('professional_profession_portfolio').insert(payload);
            if (error) throw error;
            return await safeLoadProfessionPortfolio(userId);
        }
    } catch (err) {
        console.warn('Aviso: não foi possível vincular automaticamente o portfólio inicial à profissão principal:', err.message || err);
    }
    return professionPortfolioRows || [];
}

async function safeLoadProfessionStats(userId) {
    const stats = new Map();
    const ensure = (key) => {
        const clean = slugifyText(key || 'geral') || 'geral';
        if (!stats.has(clean)) {
            stats.set(clean, { visits: 0, clicks: 0, leads: 0, accepted: 0, estimatedReturn: 0 });
        }
        return stats.get(clean);
    };

    try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const { data: events, error } = await supabaseAdmin
            .from('professional_profile_events')
            .select('profession_slug, profession_name, event_type, visitor_user_id, created_at')
            .eq('professional_id', userId)
            .gte('created_at', since.toISOString())
            .limit(1000);
        if (error) throw error;
        (events || []).forEach(event => {
            if (event.visitor_user_id && String(event.visitor_user_id) === String(userId)) return;
            const key = event.profession_slug || event.profession_name || 'geral';
            const row = ensure(key);
            if (event.event_type === 'profile_view') row.visits += 1;
            if (event.event_type === 'contact_click') row.clicks += 1;
        });
    } catch (err) {
        // A tabela de eventos é opcional. Sem ela, a dashboard continua funcionando.
        console.warn('Aviso: métricas de visitas/cliques indisponíveis:', err.message || err);
    }

    try {
        let leads = [];
        try {
            const { data, error } = await supabaseAdmin.rpc('get_professional_contact_leads', {
                p_professional_id: userId,
                p_status: null,
                p_limit: 1000
            });
            if (error) throw error;
            leads = data || [];
        } catch (_) {
            const { data, error } = await supabaseAdmin
                .from('contact_leads')
                .select('professional_category, status, contacted_at')
                .eq('professional_id', userId)
                .limit(1000);
            if (error) throw error;
            leads = data || [];
        }
        (leads || []).forEach(lead => {
            const row = ensure(lead.professional_category || 'geral');
            row.leads += 1;
            if (lead.status === 'accepted') row.accepted += 1;
        });
    } catch (err) {
        console.warn('Aviso: métricas de contatos indisponíveis:', err.message || err);
    }

    return stats;
}

async function ensureProfessionProfilesForBundle(userId, bundle) {
    const slots = (bundle?.selectedProfessionSlots || []).filter(slot => {
        const requestStatus = String(slot.requestStatus || slot.request?.status || '').toLowerCase();
        return !slot.statusLabel && (!slot.isSuggestion || requestStatus === 'approved') && (!isOtherCategory(slot.category) || requestStatus === 'approved');
    });
    if (!slots.length) return [];
    try {
        const payload = slots.map(slot => ({
            professional_id: userId,
            slot: slot.slot,
            category_id: slot.category?.id || null,
            profession_name: slot.displayName,
            profession_slug: slot.slug || null,
            // A profissão principal recebe a base antiga do cadastro. Profissões adicionais
            // começam independentes para não herdar conteúdo de outro serviço sem o usuário perceber.
            description: Number(slot.slot) === 1 ? (bundle.profissional?.description || null) : null,
            specialties: Number(slot.slot) === 1 ? (bundle.profissional?.specialties || null) : null,
            availability: Number(slot.slot) === 1 ? (bundle.profissional?.availability || null) : null,
            price_info: Number(slot.slot) === 1 ? (bundle.profissional?.price_info || null) : null,
            price_value: Number(slot.slot) === 1 ? (bundle.profissional?.price_value || null) : null,
            status: 'active',
            is_primary: Number(slot.slot) === 1
        }));

        // Upsert leve: só cria a base. Não sobrescreve ajustes existentes porque fazemos merge abaixo.
        for (const row of payload) {
            const { data: existing } = await supabaseAdmin
                .from('professional_profession_profiles')
                .select('id')
                .eq('professional_id', userId)
                .eq('slot', row.slot)
                .maybeSingle();
            if (!existing) {
                await supabaseAdmin.from('professional_profession_profiles').insert(row);
            } else {
                await supabaseAdmin.from('professional_profession_profiles').update({
                    category_id: row.category_id,
                    profession_name: row.profession_name,
                    profession_slug: row.profession_slug,
                    is_primary: row.is_primary
                }).eq('id', existing.id);
            }
        }
        return await safeLoadProfessionProfiles(userId);
    } catch (err) {
        console.warn('Aviso: não foi possível preparar perfis por profissão. Rode SQL 07:', err.message || err);
        return [];
    }
}

function buildProfessionProfileCards(bundle, professionProfileRows, professionPortfolioRows, professionStats = new Map()) {
    const profilesBySlot = new Map((professionProfileRows || []).map(row => [Number(row.slot || 0), row]));
    const portfolioByProfile = new Map();
    (professionPortfolioRows || []).forEach(item => {
        const key = item.profession_profile_id;
        if (!portfolioByProfile.has(key)) portfolioByProfile.set(key, []);
        portfolioByProfile.get(key).push(item);
    });

    return (bundle?.selectedProfessionSlots || []).map(slot => {
        const profile = profilesBySlot.get(Number(slot.slot)) || null;
        const requestStatus = String(slot.requestStatus || slot.request?.status || '').toLowerCase();
        const canEdit = Boolean(!slot.statusLabel && (!slot.isSuggestion || requestStatus === 'approved') && (!isOtherCategory(slot.category) || requestStatus === 'approved'));
        const dedicatedPortfolio = profile?.id ? (portfolioByProfile.get(profile.id) || []) : [];
        const legacyPortfolio = Number(slot.slot) === 1 ? (bundle.portfolio || []) : [];
        const nameKey = slugifyText(profile?.profession_name || slot.displayName || 'geral') || 'geral';
        const rawSlug = slugifyText(profile?.profession_slug || slot.slug || nameKey) || nameKey;
        const publicSlug = (!rawSlug || rawSlug === 'outros' || rawSlug === 'outro') ? nameKey : rawSlug;
        const statsKey = publicSlug || nameKey || 'geral';
        const stats = professionStats.get(statsKey) || professionStats.get(nameKey) || professionStats.get('geral') || { visits: 0, clicks: 0, leads: 0, accepted: 0, estimatedReturn: 0 };
        const rawPriceInfoForEstimate = profile ? profile.price_info : (Number(slot.slot) === 1 ? bundle.profissional?.price_info : '');
        const avgPriceForEstimate = parseCurrencyLike(extractAveragePrice(rawPriceInfoForEstimate));
        const rawFeeForEstimate = profile?.price_value ?? (Number(slot.slot) === 1 ? bundle.profissional?.price_value : 0);
        const feeForEstimate = Number(rawFeeForEstimate || 0);
        const priceForEstimate = avgPriceForEstimate !== null ? avgPriceForEstimate : (Number.isFinite(feeForEstimate) ? feeForEstimate : 0);
        const estimatedReturn = Number(stats.accepted || 0) * priceForEstimate;
        return {
            slot: slot.slot,
            canEdit,
            isSuggestion: Boolean(slot.isSuggestion || slot.statusLabel),
            statusLabel: slot.statusLabel || (slot.isSuggestion ? 'em análise' : ''),
            categoryId: slot.category?.id || profile?.category_id || null,
            professionName: profile?.profession_name || slot.displayName || 'Profissão',
            professionSlug: publicSlug || null,
            // Se já existe mini-perfil, até um campo vazio é intencional e não deve
            // cair novamente nos dados gerais antigos da profissão principal.
            description: profile ? (profile.description || '') : (Number(slot.slot) === 1 ? (bundle.profissional?.description || '') : ''),
            specialties: profile ? (profile.specialties || '') : (Number(slot.slot) === 1 ? (bundle.profissional?.specialties || '') : ''),
            availability: profile ? (profile.availability || '') : (Number(slot.slot) === 1 ? (bundle.profissional?.availability || '') : ''),
            priceInfo: profile ? (profile.price_info || '') : (Number(slot.slot) === 1 ? (bundle.profissional?.price_info || '') : ''),
            priceValue: profile ? profile.price_value : (Number(slot.slot) === 1 ? bundle.profissional?.price_value : ''),
            averagePrice: extractAveragePrice(profile ? profile.price_info : (Number(slot.slot) === 1 ? bundle.profissional?.price_info : '')),
            profile,
            // v11.3.33: o editor enxerga também rascunhos. O perfil público continua vendo só o publicado.
            portfolio: dedicatedPortfolio.length ? dedicatedPortfolio : legacyPortfolio,
            portfolioPreview: dedicatedPortfolio.length ? portfolioForPreview(dedicatedPortfolio) : legacyPortfolio,
            portfolioPublished: dedicatedPortfolio.length ? portfolioForPublishedView(dedicatedPortfolio) : legacyPortfolio,
            portfolioHasDraft: dedicatedPortfolio.length ? hasPortfolioDraftChanges(dedicatedPortfolio) : false,
            dedicatedPortfolioCount: dedicatedPortfolio.length,
            legacyFallback: !dedicatedPortfolio.length && legacyPortfolio.length > 0,
            stats: {
                visits: Number(stats.visits || 0),
                clicks: Number(stats.clicks || 0),
                leads: Number(stats.leads || 0),
                accepted: Number(stats.accepted || 0),
                estimatedReturn
            }
        };
    });
}

function findProfessionSlot(bundle, slotParam) {
    const slotNumber = Number(slotParam || 0);
    return (bundle?.selectedProfessionSlots || []).find(item => Number(item.slot) === slotNumber) || null;
}

async function getOrCreateProfessionProfileForSlot(userId, bundle, slotNumber) {
    await ensureProfessionProfilesForBundle(userId, bundle);
    const slot = findProfessionSlot(bundle, slotNumber);
    const { data: existing, error } = await supabaseAdmin
        .from('professional_profession_profiles')
        .select('*')
        .eq('professional_id', userId)
        .eq('slot', Number(slotNumber))
        .maybeSingle();
    if (error) throw error;
    if (existing) return existing;

    if (!slot) return null;
    const requestStatus = String(slot.requestStatus || slot.request?.status || '').toLowerCase();
    const isPending = Boolean(slot.isSuggestion || slot.statusLabel) && requestStatus !== 'approved';
    if (isPending) return null;

    const professionName = slot.displayName || slot.category?.name || slot.request?.requested_name || 'Profissão';
    const professionSlug = slot.category?.slug || slot.request?.requested_slug || slugifyText(professionName);
    const categoryId = slot.category?.id || (Number(slotNumber) === 1 ? bundle?.profissional?.category_id : null);
    if (!professionName) return null;

    const insertRow = {
        professional_id: userId,
        slot: Number(slotNumber),
        category_id: categoryId || null,
        profession_name: professionName,
        profession_slug: professionSlug || null,
        description: Number(slotNumber) === 1 ? (bundle.profissional?.description || null) : null,
        specialties: Number(slotNumber) === 1 ? (bundle.profissional?.specialties || null) : null,
        availability: Number(slotNumber) === 1 ? (bundle.profissional?.availability || null) : null,
        price_info: Number(slotNumber) === 1 ? (bundle.profissional?.price_info || null) : null,
        price_value: Number(slotNumber) === 1 ? (bundle.profissional?.price_value || null) : null,
        status: 'active',
        is_primary: Number(slotNumber) === 1
    };
    const { data: created, error: createError } = await supabaseAdmin
        .from('professional_profession_profiles')
        .insert(insertRow)
        .select('*')
        .maybeSingle();
    if (createError) throw createError;
    return created || null;
}

router.get('/profissional/onboarding', requireProfessional, catchAsync(async (req, res) => {
    const bundle = await getProfessionalBundle(req.session.userId);
    const basicProfileComplete = Boolean(bundle.profissional.phone_number && bundle.profissional.city && bundle.profissional.state);

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

router.get('/profissional/onboarding/salvar', requireProfessional, catchAsync(async (req, res) => {
    return res.redirect('/profissional/onboarding?step=4&error=Não foi possível concluir por este caminho. Revise os dados e finalize novamente.');
}));

router.get('/profissional/onboarding/finalizar', requireProfessional, catchAsync(async (req, res) => {
    return res.redirect('/profissional/onboarding?step=4&error=Finalize o cadastro pelo botão da etapa 4.');
}));

async function handleProfessionalOnboardingSave(req, res) {
    const body = req.body || {};
    const currentBundle = await getProfessionalBundle(req.session.userId);
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

    const selectedCategories = categorySlots.filter((cat, idx, arr) => cat && arr.findIndex(item => item.id === cat.id) === idx);
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
        availability: buildAvailability(body),
        availability_24h_note: compactText(body.availability_24h_note) || null
    };

    if (currentStep >= 1 && (!basicData.phone_number || basicData.phone_number.length < 10 || !basicData.city || !basicData.state)) {
        return res.redirect('/auth/completar-perfil?error=Preencha telefone, cidade e estado antes de continuar');
    }
    if (basicData.cep && basicData.cep.length !== 8) {
        return res.redirect('/auth/completar-perfil?error=Informe um CEP válido com 8 números ou deixe o campo vazio');
    }

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
        plan_name: planConfig.plan.label,
        plan_months: planConfig.months,
        status: 'pending',
        approval_requested: false,
        submitted_at: null,
        status: 'pending',
        profile_status: saveMode === 'final' && isCompleteForSave ? 'completed' : 'draft',
        profile_completed: false
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
        const { data: currentProfessionalForRelations } = await supabaseAdmin
            .from('professionals')
            .select('*')
            .eq('user_id', req.session.userId)
            .maybeSingle();
        await replaceProfessionalCategoryRelations(req.session.userId, currentProfessionalForRelations, selectedCategories);
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
            await registerCategorySuggestion(req.session.userId, req.session.email || currentBundle?.profissional?.users?.email || null, customSuggestions[index], index + 1);
        }
    }

    if (!primaryCategory) {
        return res.redirect('/profissional/onboarding?step=2&error=Selecione pelo menos uma profissão para finalizar');
    }
    if (selectedSlotsCount < planConfig.plan.slots) {
        return res.redirect(`/profissional/onboarding?step=2&error=Complete as ${planConfig.plan.slots} profissões do plano escolhido antes de continuar`);
    }
    const hasAvatar = Boolean(userUpdates.avatar_url || currentBundle?.profissional?.users?.avatar_url || req.body.existing_avatar_url);
    const { data: finalPortfolio } = await supabase.from('professional_portfolio').select('id').eq('professional_id', req.session.userId);
    if (!hasAvatar) {
        return res.redirect('/profissional/onboarding?step=4&error=Adicione uma foto de perfil antes de finalizar');
    }
    if ((finalPortfolio || []).length < 3) {
        return res.redirect('/profissional/onboarding?step=4&error=Adicione 3 imagens iniciais ao portfólio antes de finalizar');
    }

    await supabase.from('professionals').update({
        profile_completed: true,
        profile_status: 'completed',
        status: 'pending',
        approval_requested: false,
        submitted_at: null
    }).eq('user_id', req.session.userId);

    req.session.professionalReady = true;
    return req.session.save(() => res.redirect('/profissional/dashboard?success=Perfil concluído com sucesso'));
}

router.post('/profissional/onboarding/salvar', requireProfessional, upload.any(), catchAsync(handleProfessionalOnboardingSave));
router.post('/profissional/onboarding/finalizar', requireProfessional, upload.any(), catchAsync(handleProfessionalOnboardingSave));

router.post('/profissional/foto/atualizar', requireProfessional, upload.single('profile_photo'), catchAsync(async (req, res) => {
    if (!req.file) {
        return res.redirect('/profissional/dashboard?tab=perfil&error=Selecione uma imagem para trocar sua foto.');
    }
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowed.includes(ext)) {
        return res.redirect('/profissional/dashboard?tab=perfil&error=Use uma imagem JPG, PNG ou WEBP.');
    }
    const path = `public/avatar_${req.session.userId}_${Date.now()}.${ext}`;
    const avatarUrl = await uploadToBucket('avatars', path, req.file);
    const { error } = await supabaseAdmin
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', req.session.userId);
    if (error) throw error;
    return res.redirect('/profissional/dashboard?tab=perfil&success=Foto de perfil atualizada com sucesso');
}));

router.post('/profissional/perfil/atualizar', requireProfessional, catchAsync(async (req, res) => {
    const body = req.body || {};
    const displayName = compactText(body.display_name);
    const professionalPayload = {
        phone_number: String(body.phone_number || '').replace(/\D/g, '').slice(0,11) || null,
        fixed_phone: String(body.fixed_phone || '').replace(/\D/g, '').slice(0,11) || null,
        cep: String(body.cep || '').replace(/\D/g, '').slice(0,8) || null,
        city: compactText(body.city).replace(/[^A-Za-zÀ-ÿ\s]/g, '') || null,
        state: compactText(body.state).replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0,2) || null,
        address_street: compactText(body.address_street).slice(0,160) || null,
        address_number: compactText(body.address_number).replace(/[^0-9A-Za-zÀ-ÿ\-\/]/g, '').slice(0,20) || null,
        address_complement: compactText(body.address_complement).slice(0,120) || null,
        address_neighborhood: compactText(body.address_neighborhood).slice(0,120) || null,
        show_full_address: body.show_full_address === 'on' || body.show_full_address === 'true' || body.show_full_address === '1',
        profile_status: 'completed'
    };

    // v11.3.35: Meu Perfil continua global, mas agora pode guardar contato e endereço profissional opcionais.
    const { error: profileUpdateError } = await supabase.from('professionals').update(professionalPayload).eq('user_id', req.session.userId);
    if (profileUpdateError) {
        const msg = String(profileUpdateError.message || profileUpdateError).toLowerCase();
        if (['fixed_phone','address_street','address_number','address_complement','address_neighborhood','show_full_address'].some(col => msg.includes(col))) {
            return res.redirect('/profissional/dashboard?tab=perfil&error=' + encodeURIComponent('Rode o SQL 11 da v11.3.35 no Supabase antes de salvar endereço e telefone fixo.'));
        }
        throw profileUpdateError;
    }

    if (displayName) {
        await supabase.from('users').update({ full_name: displayName }).eq('id', req.session.userId);
        req.session.fullName = displayName;
    }
    res.redirect('/profissional/dashboard?tab=perfil&success=Perfil atualizado com sucesso');
}));



async function renderProfessionPreview(req, res, slotNumber, previewDraftInput = null) {
    const bundle = await getProfessionalBundle(req.session.userId);
    const professionProfileRows = await ensureProfessionProfilesForBundle(req.session.userId, bundle);
    let professionPortfolioRows = await safeLoadProfessionPortfolio(req.session.userId);
    professionPortfolioRows = await ensurePrimaryProfessionPortfolioSeeded(req.session.userId, bundle, professionProfileRows, professionPortfolioRows);
    const cards = buildProfessionProfileCards(bundle, professionProfileRows, professionPortfolioRows, new Map());
    const card = cards.find(item => Number(item.slot) === Number(slotNumber) && item.canEdit);
    if (!card) return res.redirect('/profissional/dashboard?tab=profissoes&error=Profissão não disponível para pré-visualização.');

    const draft = previewDraftInput || {
        description: card.description || '',
        specialties: card.specialties || '',
        availability_summary: card.availability || '',
        service_fee_enabled: card.priceValue !== '' && card.priceValue !== null && card.priceValue !== undefined,
        price_value: card.priceValue ?? '',
        average_price: card.averagePrice || '',
        portfolio_order: ''
    };
    const serviceFeeEnabled = Boolean(draft.service_fee_enabled);
    const fee = serviceFeeEnabled ? parseCurrencyLike(draft.price_value) : null;
    const averagePrice = parseCurrencyLike(draft.average_price);
    const priceInfo = buildProfessionPriceInfo({ serviceFeeEnabled, fee, averagePrice });
    const availability = compactText(draft.availability_summary) || card.availability || null;

    const { data: bannerRows } = await supabase.from('banners').select('*').eq('is_active', true).order('order', { ascending: true });
    const banners = (bannerRows || []).map(b => {
        const rawOrder = Number(b.order ?? 0); let posicao = 1; let ordem = rawOrder;
        if (rawOrder >= 300) { posicao = 4; ordem = rawOrder - 300; }
        else if (rawOrder >= 200) { posicao = 3; ordem = rawOrder - 200; }
        else if (rawOrder >= 100) { posicao = 2; ordem = rawOrder - 100; }
        return { ...b, titulo:b.title, imagem_url:b.image_url, link_destino:b.link_destination, ativo:b.is_active, posicao, ordem };
    });

    const base = bundle.profissional || {};
    const name = base.users?.full_name || req.session.fullName || 'Profissional Contrataê';
    const avatar = base.users?.avatar_url || '/imagens/equipe_site/Mascote.png';
    const profissional = {
        ...base,
        id: req.session.userId,
        user_id: req.session.userId,
        nome: name,
        full_name: name,
        foto: avatar,
        foto_url: avatar,
        users: { ...(base.users || {}), full_name:name, avatar_url:avatar },
        description: compactText(draft.description) || '',
        specialties: compactText(draft.specialties) || '',
        availability,
        price_info: priceInfo,
        price_value: fee,
        profissao: card.professionName,
        categoria: card.professionName,
        categories: { name: card.professionName, slug: card.professionSlug },
        profession_slots: bundle.selectedProfessionSlots || [],
        selected_profession_slot: card.slot,
        selected_profession_slug: card.professionSlug
    };

    return res.render('perfil-profissional', {
        profissional,
        // Inclui novas imagens, oculta remoções pendentes e respeita a ordem em rascunho somente na prévia.
        portfolio: sortPortfolioByDraftOrder(card.portfolioPreview || card.portfolio || [], draft.portfolio_order),
        reviews: bundle.reviews || [],
        banners,
        userId: req.session.userId,
        currentUser: req.session.user || null,
        currentPage: card.professionSlug || 'perfil',
        previewMode: true,
        previewSlot: Number(slotNumber),
        previewDraft: {
            description: profissional.description,
            specialties: profissional.specialties,
            availability_summary: availability || '',
            service_fee_enabled: serviceFeeEnabled,
            price_value: fee === null ? '' : fee.toFixed(2).replace('.', ','),
            average_price: averagePrice === null ? '' : averagePrice.toFixed(2).replace('.', ','),
            portfolio_order: JSON.stringify(normalizePortfolioOrderInput(draft.portfolio_order))
        }
    });
}

router.post('/profissional/profissoes/:slot/preview', requireProfessional, catchAsync(async (req, res) => {
    const slotNumber = Number(req.params.slot || 0);
    const body = req.body || {};
    const serviceFeeEnabled = Boolean(body.service_fee_enabled);
    const fee = serviceFeeEnabled ? parseCurrencyLike(body.price_value) : null;
    const averagePrice = parseCurrencyLike(body.average_price);
    const previewDraft = {
        description: compactText(body.description) || '',
        specialties: compactText(body.specialties) || '',
        availability_summary: buildAvailability(body) || compactText(body.availability_summary) || '',
        service_fee_enabled: serviceFeeEnabled,
        price_value: fee === null ? '' : fee.toFixed(2).replace('.', ','),
        average_price: averagePrice === null ? '' : averagePrice.toFixed(2).replace('.', ','),
        portfolio_order: JSON.stringify(normalizePortfolioOrderInput(body.portfolio_order))
    };
    req.session.professionPreviewDrafts = req.session.professionPreviewDrafts || {};
    req.session.professionPreviewDrafts[String(slotNumber)] = previewDraft;
    return req.session.save(() => res.redirect(`/profissional/profissoes/${slotNumber}/preview`));
}));

// v11.3.33: GET real da prévia. Assim F5, modo responsivo e rotação do celular não viram 404.
router.get('/profissional/profissoes/:slot/preview', requireProfessional, catchAsync(async (req, res) => {
    const slotNumber = Number(req.params.slot || 0);
    const previewDraft = req.session?.professionPreviewDrafts?.[String(slotNumber)] || null;
    return renderProfessionPreview(req, res, slotNumber, previewDraft);
}));

router.post('/profissional/profissoes/:slot/atualizar', requireProfessional, catchAsync(async (req, res) => {
    const slotNumber = Number(req.params.slot || 0);
    const bundle = await getProfessionalBundle(req.session.userId);
    const slot = findProfessionSlot(bundle, slotNumber);
    const requestStatus = String(slot?.requestStatus || slot?.request?.status || '').toLowerCase();
    const stillPending = !slot || (Boolean(slot.isSuggestion || slot.statusLabel) && requestStatus !== 'approved');
    if (stillPending) {
        return res.redirect('/profissional/dashboard?tab=profissoes&error=Esta profissão ainda não pode ser editada. Aguarde aprovação da categoria pelo ADM.');
    }

    let profile;
    try {
        profile = await getOrCreateProfessionProfileForSlot(req.session.userId, bundle, slotNumber);
    } catch (err) {
        console.warn('Erro ao atualizar perfil por profissão:', err.message || err);
        return res.redirect('/profissional/dashboard?tab=profissoes&slot=' + slotNumber + '&error=Rode o SQL V11.3.29 de correção RLS das profissões e tente novamente.');
    }
    if (!profile) return res.redirect('/profissional/dashboard?tab=profissoes&error=Profissão não encontrada.');

    const serviceFeeEnabled = Boolean(req.body?.service_fee_enabled);
    const fee = serviceFeeEnabled ? parseCurrencyLike(req.body?.price_value) : null;
    const averagePrice = parseCurrencyLike(req.body?.average_price);
    const priceInfo = buildProfessionPriceInfo({ serviceFeeEnabled, fee, averagePrice });
    const updateData = {
        description: compactText(req.body?.description) || null,
        specialties: compactText(req.body?.specialties) || null,
        availability: buildAvailability(req.body || {}) || null,
        price_info: priceInfo || null,
        price_value: fee,
        status: 'active'
    };

    const { error } = await supabaseAdmin
        .from('professional_profession_profiles')
        .update(updateData)
        .eq('id', profile.id)
        .eq('professional_id', req.session.userId);
    if (error) throw error;

    // Mantém compatibilidade: a profissão principal também alimenta os campos antigos usados pelo admin e cards legados.
    if (slotNumber === 1) {
        await supabase.from('professionals').update({
            description: updateData.description,
            specialties: updateData.specialties,
            availability: updateData.availability,
            price_info: updateData.price_info,
            price_value: updateData.price_value,
            approval_requested: false,
            submitted_at: null,
            profile_status: 'completed'
        }).eq('user_id', req.session.userId);
    }

    // A ordem das imagens também é um rascunho: só chega ao perfil público ao publicar.
    const portfolioOrderPublish = await applyProfessionPortfolioOrder(req.session.userId, profile.id, req.body?.portfolio_order);
    // Publicar pela tela/preview da profissão também confirma o rascunho de fotos dessa mesma profissão.
    const portfolioPublish = await publishProfessionPortfolioDraft(req.session.userId, profile.id);
    if (!portfolioPublish.schemaReady && portfolioPublish.error) {
        console.warn('Rascunho do portfólio ainda não está habilitado. Rode SQL 10:', portfolioPublish.error.message || portfolioPublish.error);
    }
    if (req.session?.professionPreviewDrafts) delete req.session.professionPreviewDrafts[String(slotNumber)];

    const successMessage = (portfolioPublish.changed || portfolioOrderPublish.changed)
        ? 'Informações, fotos e ordem do portfólio publicadas com sucesso'
        : 'Alterações publicadas com sucesso';
    return res.redirect('/profissional/dashboard?tab=profissoes&slot=' + slotNumber + '&published=1&success=' + encodeURIComponent(successMessage));
}));

router.post('/profissional/profissoes/:slot/portfolio/adicionar', requireProfessional, upload.single('profession_portfolio_image'), catchAsync(async (req, res) => {
    const slotNumber = Number(req.params.slot || 0);
    if (!req.file) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Selecione uma imagem para adicionar.');

    const bundle = await getProfessionalBundle(req.session.userId);
    let profile;
    try {
        profile = await getOrCreateProfessionProfileForSlot(req.session.userId, bundle, slotNumber);
    } catch (err) {
        console.warn('Erro ao adicionar portfólio por profissão:', err.message || err);
        return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Rode o SQL V11.3.29 de correção RLS das profissões e tente novamente.');
    }
    if (!profile) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Esta profissão ainda não pode receber portfólio.');

    if (slotNumber === 1) {
        const profileRows = await safeLoadProfessionProfiles(req.session.userId);
        const currentRows = await safeLoadProfessionPortfolio(req.session.userId);
        await ensurePrimaryProfessionPortfolioSeeded(req.session.userId, bundle, profileRows, currentRows);
    }

    let existing = [];
    try {
        const { data, error } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .select('id, position, pending_delete')
            .eq('professional_id', req.session.userId)
            .eq('profession_profile_id', profile.id);
        if (error) throw error;
        existing = data || [];
    } catch (err) {
        if (portfolioDraftSchemaUnavailable(err)) {
            return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=' + encodeURIComponent('Antes de testar o novo portfólio, rode sql_scripts/10_portfolio_draft_legendas.sql no Supabase.'));
        }
        throw err;
    }
    const activeCount = existing.filter(item => item.pending_delete !== true).length;
    if (activeCount >= 10) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Esta profissão já tem 10 imagens.');

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const allowed = ['jpg','jpeg','png','webp'];
    if (!allowed.includes(ext)) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Use uma imagem JPG, PNG ou WEBP.');
    const path = `portfolio/profession_${req.session.userId}_${slotNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const imageUrl = await uploadToBucket('avatars', path, req.file);
    const nextPosition = Math.max(0, ...existing.map(item => Number(item.position || 0))) + 1;
    const { error } = await supabaseAdmin.from('professional_profession_portfolio').insert({
        professional_id: req.session.userId,
        profession_profile_id: profile.id,
        slot: slotNumber,
        image_url: imageUrl,
        position: nextPosition,
        is_published: false,
        pending_delete: false
    });
    if (error) {
        if (portfolioDraftSchemaUnavailable(error)) {
            return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=' + encodeURIComponent('Rode sql_scripts/10_portfolio_draft_legendas.sql no Supabase antes de adicionar fotos.'));
        }
        throw error;
    }
    await supabase.from('professionals').update({ approval_requested: false, submitted_at: null, profile_status: 'completed' }).eq('user_id', req.session.userId);
    return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&success=' + encodeURIComponent('Nova imagem salva como rascunho. Visualize antes de publicar.') + '#portfolio-workspace-' + slotNumber);
}));

router.post('/profissional/profissoes/portfolio/remover', requireProfessional, catchAsync(async (req, res) => {
    const id = compactText(req.body?.id);
    const slotNumber = Number(req.body?.slot || 0);
    if (!id) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&error=Imagem inválida.');
    try {
        const { data: item, error: loadError } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .select('id, is_published')
            .eq('id', id)
            .eq('professional_id', req.session.userId)
            .maybeSingle();
        if (loadError) throw loadError;
        if (!item) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&error=Imagem não encontrada.');

        if (item.is_published === false) {
            // Foto recém-adicionada ainda não é pública: remover equivale a descartar o rascunho.
            const { error } = await supabaseAdmin
                .from('professional_profession_portfolio')
                .delete()
                .eq('id', id)
                .eq('professional_id', req.session.userId);
            if (error) throw error;
            return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&success=' + encodeURIComponent('Imagem nova descartada do rascunho.') + '#portfolio-workspace-' + (slotNumber || 1));
        }

        const { error } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .update({ pending_delete: true, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('professional_id', req.session.userId);
        if (error) throw error;
    } catch (err) {
        console.warn('Erro ao marcar remoção de imagem por profissão:', err.message || err);
        const message = portfolioDraftSchemaUnavailable(err)
            ? 'Rode sql_scripts/10_portfolio_draft_legendas.sql no Supabase antes de usar o novo fluxo de fotos.'
            : 'Não foi possível remover a imagem agora.';
        return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&error=' + encodeURIComponent(message));
    }
    return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&success=' + encodeURIComponent('Imagem marcada para remoção. Ela continua pública até você salvar e publicar.') + '#portfolio-workspace-' + (slotNumber || 1));
}));

router.post('/profissional/profissoes/portfolio/desfazer-remocao', requireProfessional, catchAsync(async (req, res) => {
    const id = compactText(req.body?.id);
    const slotNumber = Number(req.body?.slot || 0);
    if (!id) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1));
    const { error } = await supabaseAdmin
        .from('professional_profession_portfolio')
        .update({ pending_delete: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('professional_id', req.session.userId);
    if (error) throw error;
    return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&success=' + encodeURIComponent('Remoção cancelada.') + '#portfolio-workspace-' + (slotNumber || 1));
}));

router.post('/profissional/profissoes/portfolio/legenda', requireProfessional, catchAsync(async (req, res) => {
    const id = compactText(req.body?.id);
    const slotNumber = Number(req.body?.slot || 0);
    const caption = compactText(req.body?.caption).slice(0, 180);
    if (!id) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&error=Imagem inválida.');
    try {
        const { error } = await supabaseAdmin
            .from('professional_profession_portfolio')
            .update({ draft_caption: caption || '', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('professional_id', req.session.userId);
        if (error) throw error;
    } catch (err) {
        const message = portfolioDraftSchemaUnavailable(err)
            ? 'Rode sql_scripts/10_portfolio_draft_legendas.sql no Supabase antes de editar legendas.'
            : 'Não foi possível salvar a legenda agora.';
        return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&error=' + encodeURIComponent(message));
    }
    return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + (slotNumber || 1) + '&success=' + encodeURIComponent('Legenda salva no rascunho. Publique para aparecer aos clientes.') + '#portfolio-workspace-' + (slotNumber || 1));
}));

router.post('/profissional/profissoes/:slot/portfolio/publicar', requireProfessional, catchAsync(async (req, res) => {
    const slotNumber = Number(req.params.slot || 0);
    const bundle = await getProfessionalBundle(req.session.userId);
    let profile;
    try { profile = await getOrCreateProfessionProfileForSlot(req.session.userId, bundle, slotNumber); }
    catch (err) { return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Não foi possível localizar esta profissão.'); }
    if (!profile) return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=Profissão não encontrada.');

    const result = await publishProfessionPortfolioDraft(req.session.userId, profile.id);
    if (!result.schemaReady) {
        return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&error=' + encodeURIComponent('Rode sql_scripts/10_portfolio_draft_legendas.sql no Supabase antes de publicar mudanças do portfólio.'));
    }
    await supabase.from('professionals').update({ approval_requested: false, submitted_at: null, profile_status: 'completed' }).eq('user_id', req.session.userId);
    return res.redirect('/profissional/dashboard?tab=portfolio&slot=' + slotNumber + '&success=' + encodeURIComponent(result.changed ? 'Mudanças do portfólio publicadas com sucesso.' : 'Seu portfólio já estava publicado.'));
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
        plan_name: planConfig.plan.label,
        plan_months: planConfig.months,
        approval_requested: false,
        submitted_at: null,
        profile_status: 'completed'
    }).eq('user_id', req.session.userId);
    const { data: currentProfessionalForRelations } = await supabaseAdmin
        .from('professionals')
        .select('*')
        .eq('user_id', req.session.userId)
        .maybeSingle();
    await replaceProfessionalCategoryRelations(req.session.userId, currentProfessionalForRelations, selected);
    res.redirect('/profissional/dashboard?tab=planos&success=Plano e profissões atualizados');
}));


router.post('/profissional/perfil/excluir', requireProfessional, catchAsync(async (req, res) => {
    const bundle = await getProfessionalBundle(req.session.userId);
    const profissional = bundle.profissional || {};
    const motivo = compactText(req.body.motivo_exclusao) || 'Solicitado pelo profissional na dashboard';

    await supabase.from('admin_logs').insert({
        professional_id: req.session.userId,
        action_type: 'profile_excluded_by_professional',
        old_values: { status: profissional.status || null, profile_status: profissional.profile_status || null },
        new_values: { status: 'excluded', motivo },
        performed_by: 'professional-dashboard'
    });

    await supabase.from('professionals').update({
        status: 'excluded',
        approval_requested: false,
        submitted_at: null,
        profile_status: 'excluded',
        updated_at: new Date().toISOString()
    }).eq('user_id', req.session.userId);

    const sidName = process.env.SESSION_NAME || 'contratae.sid';
    const sessionId = req.sessionID;
    const finalize = () => {
        res.clearCookie(sidName, { path: '/' });
        res.clearCookie('connect.sid', { path: '/' });
        return res.redirect(303, '/?success=Perfil profissional excluído da plataforma');
    };
    req.session.destroy(() => {
        if (req.sessionStore && sessionId) return req.sessionStore.destroy(sessionId, () => finalize());
        finalize();
    });
}));

router.get('/profissional/dashboard', requireProfessional, catchAsync(async (req, res) => {

    const bundle = await getProfessionalBundle(req.session.userId);
    const profissional = bundle.profissional;
    const basicProfileComplete = Boolean(profissional.phone_number && profissional.city && profissional.state);
    if (!basicProfileComplete) return res.redirect('/auth/completar-perfil');
    if (!profissional.profile_completed) return res.redirect('/profissional/onboarding?step=1&error=Conclua as 4 etapas do cadastro antes de acessar sua dashboard');
    let profileReadyForApproval = Boolean(basicProfileComplete && profissional.description && profissional.category_id && bundle.portfolio.length > 0);
    const approvalPending = Boolean(profissional.approval_requested);
    const isApproved = String(profissional.status || '').toLowerCase() === 'active';
    let profileStatus = normalizeProfileStatus(profissional) || (profileReadyForApproval ? 'completed' : 'draft');
    const latestApprovalRequest = (bundle.approvalLogs || []).find(log => log.action_type === 'approval_request') || null;

    const actualSelectedCount = Number(bundle.selectedSlotsCount || [profissional.category_id, ...bundle.selectedAdditionalIds].filter(Boolean).length || 0);
    const inferredPlan = inferPlanTierFromProfessional(profissional);
    const selectedCount = actualSelectedCount || (inferredPlan.slots || 1);
    const currentPlanName = inferredPlan.label || 'Plano Básico';

    const professionProfileRows = await ensureProfessionProfilesForBundle(req.session.userId, bundle);
    let professionPortfolioRows = await safeLoadProfessionPortfolio(req.session.userId);
    professionPortfolioRows = await ensurePrimaryProfessionPortfolioSeeded(req.session.userId, bundle, professionProfileRows, professionPortfolioRows);
    const professionStats = await safeLoadProfessionStats(req.session.userId);
    const professionProfileCards = buildProfessionProfileCards(bundle, professionProfileRows, professionPortfolioRows, professionStats);
    const hasProfessionDescription = professionProfileCards.some(card => card.canEdit && card.description);
    const hasProfessionPortfolio = professionProfileCards.some(card => card.canEdit && Array.isArray(card.portfolio) && card.portfolio.length);
    profileReadyForApproval = Boolean(basicProfileComplete && profissional.category_id && (profissional.description || hasProfessionDescription) && (bundle.portfolio.length > 0 || hasProfessionPortfolio));
    profileStatus = normalizeProfileStatus(profissional) || (profileReadyForApproval ? 'completed' : 'draft');

    const visibleReviews = (bundle.reviews || []).filter(review => String(review.status || 'visible').toLowerCase() === 'visible');
    const avaliacaoMedia = visibleReviews.length > 0
        ? (visibleReviews.reduce((acc, review) => acc + Number(review.rating || 0), 0) / visibleReviews.length).toFixed(1)
        : '0';

    let contatosRecebidos = 0;
    try {
        const { data: leadRows, error: leadRowsError } = await supabaseAdmin.rpc('get_professional_contact_leads', {
            p_professional_id: req.session.userId,
            p_status: null,
            p_limit: 100
        });
        if (leadRowsError) throw leadRowsError;
        contatosRecebidos = Array.isArray(leadRows) ? leadRows.length : 0;
    } catch (_) {
        try {
            const { count, error: leadCountError } = await supabaseAdmin
                .from('contact_leads')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', req.session.userId);
            if (!leadCountError) contatosRecebidos = count || 0;
        } catch (__) {}
    }

    res.render('dashboards/profissional-dashboard', {
        fullName: req.session.fullName,
        profissional,
        portfolio: bundle.portfolio,
        pagamentos: bundle.pagamentos,
        avaliacoes: bundle.reviews,
        currentPrimaryCategory: bundle.currentPrimaryCategory,
        selectedAdditionalCategories: bundle.categorias.filter(cat => bundle.selectedAdditionalIds.includes(cat.id)),
        selectedProfessionSlots: bundle.selectedProfessionSlots || [],
        selectedAdditionalProfessionSlots: bundle.selectedAdditionalProfessionSlots || [],
        professionRequests: bundle.professionRequests || [],
        professionProfileCards,
        basicProfileComplete,
        profileReadyForApproval,
        activeTab: req.query.tab || 'resumo',
        selectedProfessionSlot: Number(req.query.slot || 0) || null,
        flashError: req.query.error || '',
        flashSuccess: req.query.success || '',
        contatosRecebidos,
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
    const basicProfileComplete = Boolean(profissional.phone_number && profissional.city && profissional.state);
    const professionProfileRows = await safeLoadProfessionProfiles(req.session.userId);
    const professionPortfolioRows = await safeLoadProfessionPortfolio(req.session.userId);
    const hasProfessionDescription = (professionProfileRows || []).some(row => row.description);
    const hasProfessionPortfolio = (professionPortfolioRows || []).length > 0;
    const profileReadyForApproval = Boolean(basicProfileComplete && profissional.category_id && (profissional.description || hasProfessionDescription) && (bundle.portfolio.length > 0 || hasProfessionPortfolio));

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
            availability: profissional.availability || null,
            selected_professions: (bundle.selectedProfessionSlots || []).map(item => ({ slot: item.slot, name: item.displayName, status: item.statusLabel || 'cadastrada', slug: item.slug })),
            profession_requests: (bundle.professionRequests || []).map(item => ({ slot: item.related_slot, name: item.requested_name, status: item.status })),
            plan_duration_months: profissional.plan_duration_months || profissional.plan_months || null,
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
