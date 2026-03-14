const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireProfessional } = require('../middlewares/authMiddleware');
const { catchAsync } = require('../middlewares/errorHandler');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Dashboard do Profissional (SaaS - Protegido)
router.get('/profissional/dashboard', requireProfessional, catchAsync(async (req, res) => {
    // Buscar dados do profissional com join em users e categories
    // Padronizado para usar user_id (PK da tabela professionals)
    const { data: profissional, error } = await supabase
        .from('professionals')
        .select('*, users(full_name, email, avatar_url), categories(name)')
        .eq('user_id', req.session.userId)
        .maybeSingle();
    
    if (error) throw error;

    // Se não existir perfil profissional, criar um básico
    if (!profissional) {
        await supabase.from('professionals').insert([{ user_id: req.session.userId, status: 'pending' }]);
        return res.redirect('/auth/completar-perfil');
    }

    // VERIFICAÇÃO DE PERFIL COMPLETO (OBRIGATÓRIO)
    if (!profissional.profile_completed) {
        return res.redirect('/auth/completar-perfil');
    }
    
    const { data: categorias } = await supabase.from('categories').select('*');
    
    // Buscar avaliações (reviews)
    const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('professional_id', req.session.userId);
    
    const avaliacaoMedia = reviews && reviews.length > 0 
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : '0';

    // Buscar Planos, Pagamentos e Portfólio
    const { data: planos } = await supabase.from('plans').select('*').eq('active', true);
    const { data: pagamentos } = await supabase.from('payment_history').select('*, plans(name)').eq('professional_id', req.session.userId).order('payment_date', { ascending: false });
    const { data: portfolio } = await supabase.from('professional_portfolio').select('*').eq('professional_id', req.session.userId).order('created_at', { ascending: false });
    
    res.render('profissional-dashboard', {
        fullName: req.session.fullName,
        profissional: profissional || {},
        categorias: categorias || [],
        servicos: [], 
        avaliacoes: reviews || [],
        planos: planos || [],
        pagamentos: pagamentos || [],
        portfolio: portfolio || [],
        contatosRecebidos: 0, 
        servicosConcluidos: 0,
        faturamentoMes: profissional?.valor_pago || '0,00',
        avaliacaoMedia: avaliacaoMedia
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
    
    res.render('cliente-dashboard', {
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
    const { category_id, description, phone_number } = req.body;
    
    // Atualizar tabela professionals
    // Padronizado para usar user_id
    const updateData = {
        category_id: category_id || null,
        description: description || ''
    };
    if (phone_number) updateData.phone_number = phone_number;

    const { error: profError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('user_id', req.session.userId);
    
    if (profError) throw profError;
    
    res.redirect('/profissional/dashboard');
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
router.post('/profissional/portfolio/adicionar', requireProfessional, catchAsync(async (req, res) => {
    const { image_url } = req.body;
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
