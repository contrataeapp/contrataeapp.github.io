const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Lista simples de palavras ofensivas para moderação automática
const offensiveWords = ['palavrao1', 'palavrao2', 'ofensa1', 'ofensa2', 'merda', 'porra', 'caralho', 'foda', 'lixo', 'bosta'];

/**
 * Middleware para verificar se o usuário está logado
 */
const checkAuth = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ erro: 'Você precisa estar logado para avaliar.' });
};

/**
 * Rota para criar uma avaliação
 */
router.post('/', checkAuth, async (req, res) => {
    try {
        const { professional_id, rating, comment } = req.body;
        const reviewer_id = req.session.userId;

        if (!professional_id || !rating) {
            return res.status(400).json({ erro: 'Dados incompletos.' });
        }

        // Moderação automática
        let status = 'visible';
        const lowerComment = (comment || '').toLowerCase();
        const hasOffensive = offensiveWords.some(word => lowerComment.includes(word));
        
        if (hasOffensive) {
            status = 'hidden';
        }

        const { data, error } = await supabase
            .from('reviews')
            .insert([{
                professional_id,
                reviewer_id,
                rating: parseInt(rating),
                comment,
                status,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({ 
            sucesso: true, 
            moderated: hasOffensive,
            mensagem: hasOffensive ? 'Sua avaliação foi enviada e está em análise.' : 'Avaliação enviada com sucesso!' 
        });
    } catch (err) {
        console.error('Erro ao criar avaliação:', err);
        res.status(500).json({ erro: 'Erro interno ao processar avaliação.' });
    }
});

module.exports = router;
