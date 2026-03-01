const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware para verificar se o usuário está logado
const checkAuth = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/auth/login');
};

// Dashboard do Profissional
router.get('/profissional/dashboard', checkAuth, async (req, res) => {
    try {
        if (req.session.userType !== 'professional') {
            return res.redirect('/cliente/dashboard');
        }
        
        const { data: profissional } = await supabase
            .from('professionals')
            .select('*')
            .eq('id', req.session.userId)
            .single();
        
        const { data: servicos } = await supabase
            .from('services')
            .select('*')
            .eq('professional_id', req.session.userId);
        
        const { data: categorias } = await supabase
            .from('categories')
            .select('*');
        
        res.render('profissional-dashboard', {
            fullName: req.session.fullName,
            profissional: profissional || {},
            servicos: servicos || [],
            categorias: categorias || [],
            contatosRecebidos: servicos ? servicos.length : 0,
            servicosConcluidos: servicos ? servicos.filter(s => s.status === 'completed').length : 0,
            faturamentoMes: '0,00',
            avaliacaoMedia: '0'
        });
    } catch (err) {
        console.error(err);
        res.render('profissional-dashboard', { 
            fullName: req.session.fullName,
            profissional: {},
            servicos: [],
            categorias: [],
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
        
        const { data: profissionaisRecomendados } = await supabase
            .from('professionals')
            .select('*')
            .eq('status', 'active')
            .limit(5);
        
        const { data: favoritos } = await supabase
            .from('favorites')
            .select('*')
            .eq('client_id', req.session.userId);
        
        res.render('cliente-dashboard', {
            fullName: req.session.fullName,
            profissionaisRecomendados: profissionaisRecomendados || [],
            favoritos: favoritos || [],
            favoritosCont: favoritos ? favoritos.length : 0,
            servicosContratados: 0,
            avaliacoesFeiras: 0,
            historico: []
        });
    } catch (err) {
        console.error(err);
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

// Registrar novo serviço
router.post('/profissional/novo-servico', checkAuth, async (req, res) => {
    try {
        const { client_name, service_description, value } = req.body;
        
        const { data, error } = await supabase
            .from('services')
            .insert([{
                professional_id: req.session.userId,
                client_name,
                service_description,
                value,
                status: 'pending'
            }]);
        
        if (error) throw error;
        
        res.json({ sucesso: true, mensagem: 'Serviço registrado com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar serviço' });
    }
});

// Marcar serviço como concluído
router.post('/profissional/servico/:id/concluir', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services')
            .update({ status: 'completed' })
            .eq('id', req.params.id)
            .eq('professional_id', req.session.userId);
        
        if (error) throw error;
        
        res.json({ sucesso: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao atualizar serviço' });
    }
});

// Favoritar profissional
router.post('/cliente/favoritar/:profissionalId', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .insert([{
                client_id: req.session.userId,
                professional_id: req.params.profissionalId
            }]);
        
        if (error) throw error;
        
        res.json({ sucesso: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao favoritar' });
    }
});

// Remover favorito
router.post('/cliente/remover-favorito/:profissionalId', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .delete()
            .eq('client_id', req.session.userId)
            .eq('professional_id', req.params.profissionalId);
        
        if (error) throw error;
        
        res.json({ sucesso: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao remover favorito' });
    }
});

// Atualizar perfil do profissional
router.post('/profissional/atualizar-perfil', checkAuth, async (req, res) => {
    try {
        const { category_id, description, price_info, availability } = req.body;
        
        const { data, error } = await supabase
            .from('professionals')
            .update({
                category_id,
                description,
                price_info,
                availability
            })
            .eq('id', req.session.userId);
        
        if (error) throw error;
        
        res.redirect('/profissional/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/profissional/dashboard');
    }
});

module.exports = router;
