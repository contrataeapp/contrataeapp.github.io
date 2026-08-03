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
 * Rota para listar avaliações (Admin)
 * GET /api/comentarios
 */
router.get('/admin/list', async (req, res) => {
    console.log("--- INÍCIO GET /api/comentarios (Reviews Admin) ---");
    if (!req.session || !req.session.adminLogado) {
        return res.status(401).json({ erro: 'Acesso negado.' });
    }

    try {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('id, professional_id, client_id, rating, comment, status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const clientIds = [...new Set((reviews || []).map(r => r.client_id).filter(Boolean))];
        const professionalIds = [...new Set((reviews || []).map(r => r.professional_id).filter(Boolean))];

        const { data: clients } = clientIds.length
            ? await supabase.from('users').select('id, full_name').in('id', clientIds)
            : { data: [] };

        const { data: professionals } = professionalIds.length
            ? await supabase.from('professionals').select('user_id').in('user_id', professionalIds)
            : { data: [] };

        const { data: professionalUsers } = professionalIds.length
            ? await supabase.from('users').select('id, full_name').in('id', professionalIds)
            : { data: [] };

        const clientsMap = Object.fromEntries((clients || []).map(u => [u.id, u.full_name]));
        const prosMap = Object.fromEntries((professionalUsers || []).map(u => [u.id, u.full_name]));

        const comentarios = (reviews || []).map(r => {
            let statusTraduzido = 'PENDENTE';
            if (r.status === 'visible') statusTraduzido = 'APROVADO';
            if (r.status === 'hidden') statusTraduzido = 'OCULTO';
            return {
                id: r.id,
                cliente_nome: clientsMap[r.client_id] || 'Cliente Anônimo',
                profissional_nome: prosMap[r.professional_id] || 'Profissional',
                nota: r.rating,
                comentario: r.comment,
                status: statusTraduzido,
                data: r.created_at
            };
        });

        console.log(`Retornando ${comentarios.length} comentários para o admin.`);
        res.json(comentarios);
    } catch (err) {
        console.error('Erro ao listar comentários:', err);
        res.status(500).json({ erro: err.message });
    }
});

/**
 * Rota para alterar status da avaliação (Admin)
 * POST /api/comentarios/:id/status
 */
router.post('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`--- INÍCIO POST /api/comentarios/${id}/status ---`);
    console.log("Novo status recebido:", status);

    if (!req.session || !req.session.adminLogado) {
        return res.status(401).json({ erro: 'Acesso negado.' });
    }

    try {
        // Mapear status do frontend para o banco
        let statusBanco = 'pending';
        if (status === 'APROVADO') statusBanco = 'visible';
        if (status === 'OCULTO') statusBanco = 'hidden';

        const { error } = await supabase
            .from('reviews')
            .update({ status: statusBanco })
            .eq('id', id);

        if (error) throw error;

        console.log(`Status do comentário ${id} atualizado para ${statusBanco} com sucesso.`);
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao atualizar status do comentário:', err);
        res.status(500).json({ erro: err.message });
    }
});

/**
 * Rota para criar uma avaliação
 */
router.post('/', checkAuth, async (req, res) => {
    try {
        const { professional_id, rating, comment } = req.body;
        const client_id = req.session.userId;

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
                client_id,
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
