const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware para verificar se o usuário está logado
const checkAuth = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    res.redirect('/auth/login');
};

// Dashboard do Profissional
router.get('/profissional/dashboard', checkAuth, async (req, res) => {
    try {
        if (req.session.userType !== 'professional') {
            return res.redirect('/cliente/dashboard');
        }
        
        // Buscar dados do profissional com join em users e categories
        const { data: profissional, error } = await supabase
            .from('professionals')
            .select('*, users(full_name, email, avatar_url), categories(name)')
            .eq('id', req.session.userId)
            .maybeSingle();
        
        if (error) throw error;

        // Se não existir perfil profissional, criar um básico
        if (!profissional) {
            await supabase.from('professionals').insert([{ id: req.session.userId, status: 'pending' }]);
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

        res.render('profissional-dashboard', {
            fullName: req.session.fullName,
            profissional: profissional || {},
            categorias: categorias || [],
            servicos: [], // Variável faltante corrigida
            contatosRecebidos: 0, // Ajustar conforme tabela de contatos se existir
            servicosConcluidos: 0,
            faturamentoMes: profissional?.valor_pago || '0,00',
            avaliacaoMedia: avaliacaoMedia
        });
    } catch (err) {
        console.error("Erro no dashboard profissional:", err);
        res.render('profissional-dashboard', { 
            fullName: req.session.fullName,
            profissional: {},
            categorias: [],
            servicos: [], // Variável faltante corrigida no catch
            contatosRecebidos: 0,
            servicosConcluidos: 0,
            faturamentoMes: '0,00',
            avaliacaoMedia: '0'
        });
    }
});

// Dashboard do Cliente
router.get('/cliente/dashboard', checkAuth, async (req, res) => {
    try {
        if (req.session.userType !== 'client') {
            return res.redirect('/profissional/dashboard');
        }
        
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
    } catch (err) {
        console.error("Erro no dashboard cliente:", err);
        res.render('cliente-dashboard', {
            fullName: req.session.fullName,
            profissionaisRecomendados: [],
            favoritos: [],
            favoritosCont: 0,
            servicosContratados: 0,
            avaliacoesFeiras: 0,
            historico: []
        });
    }
});

// Atualizar perfil do profissional
router.post('/profissional/atualizar-perfil', checkAuth, async (req, res) => {
    try {
        const { category_id, description, phone_number } = req.body;
        
        // Atualizar tabela professionals
        const { error: profError } = await supabase
            .from('professionals')
            .update({
                category_id: category_id || null,
                description: description || ''
            })
            .eq('id', req.session.userId);
        
        if (profError) throw profError;

        // Atualizar telefone na tabela professionals (onde a coluna realmente existe)
        if (phone_number) {
            await supabase.from('professionals').update({ phone_number }).eq('id', req.session.userId);
        }
        
        res.redirect('/profissional/dashboard');
    } catch (err) {
        console.error("Erro ao atualizar perfil:", err);
        res.redirect('/profissional/dashboard');
    }
});

module.exports = router;
