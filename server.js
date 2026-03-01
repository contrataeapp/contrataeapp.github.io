require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboards'); 

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER || 'seu-email@gmail.com', pass: process.env.EMAIL_PASS || 'sua-senha-app' }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_seguranca_contratae_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } 
}));

// Rotas de Autenticação
app.use('/auth', authRoutes);

// Rotas de Dashboards
app.use('/', dashboardRoutes);

const checkAdmin = (req, res, next) => {
    if (req.session.adminLogado) return next();
    res.redirect('/login-adm'); 
};

const checkAdminAPI = (req, res, next) => {
    if (req.session.adminLogado) return next();
    res.status(401).json({ erro: 'Acesso negado. Faça login.' });
};

app.get('/login-adm', (req, res) => {
    if (req.session.adminLogado) return res.redirect('/admin');
    res.render('login_admin', { erro: null });
});

app.post('/login-adm', (req, res) => {
    const { usuario, senha } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || '#Relaxsempre153143';

    if (usuario === adminUser && senha === adminPass) {
        req.session.adminLogado = true;
        res.redirect('/admin');
    } else {
        res.render('login_admin', { erro: 'Usuário ou senha inválidos!' });
    }
});

app.get('/logout-adm', (req, res) => {
    req.session.destroy(); 
    res.redirect('/login-adm');
});

// ============================================
// DASHBOARD ADM
// ============================================
app.get("/admin", checkAdmin, async (req, res) => {
    try {
        const { categoria, status, busca, ordenar } = req.query;
        let query = supabase.from("profissionais").select("*");
        if (categoria) query = query.eq('profissao', categoria);
        if (status) query = query.eq('status', status);
        
        const { data: profissionais, error } = await query.order("data_cadastro", { ascending: false });
        if (error) throw error;

        let filtrados = profissionais || [];
        
        // NOVO: Esconde as contas excluídas da visão padrão para não poluir a tela
        if (!status) {
            filtrados = filtrados.filter(p => p.status !== 'EXCLUIDO');
        }

        if (busca) filtrados = filtrados.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.profissao.toLowerCase().includes(busca.toLowerCase()));
        if (ordenar === 'vencimento') filtrados.sort((a, b) => {
            const dataA = a.data_vencimento ? new Date(a.data_vencimento) : new Date('2099-12-31');
            const dataB = b.data_vencimento ? new Date(b.data_vencimento) : new Date('2099-12-31');
            return dataA - dataB;
        });

        const totais = {
            ativos: profissionais.filter(p => p.status === 'ATIVO').length,
            pendentes: profissionais.filter(p => p.status === 'PENDENTE').length,
            pausados: profissionais.filter(p => p.status === 'PAUSADO').length,
            receitaTotal: profissionais.reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0),
            receitaMes: profissionais.filter(p => {
                const dataRef = p.data_ultima_edicao || p.data_cadastro;
                if (!dataRef) return false;
                const data = new Date(dataRef);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (parseFloat(p.valor_pago) || 0), 0)
        };

        filtrados = filtrados.map(p => {
            if (p.status === 'ATIVO' && p.data_vencimento) {
                const dataVenc = new Date(p.data_vencimento);
                const hoje = new Date();
                const diasRestantes = Math.floor((dataVenc - hoje) / (1000 * 60 * 60 * 24));
                if (diasRestantes < 0) p.alerta_status = 'vencido';
                else if (diasRestantes <= 7) p.alerta_status = 'critico';
                else p.alerta_status = 'normal';
            }
            return p;
        });

        res.render("admin", { profissionais: filtrados, totais, filtroAtivo: { categoria, status, busca, ordenar } });
    } catch (err) { res.render("admin", { profissionais: [], totais: { ativos: 0, pendentes: 0, pausados: 0, receitaTotal: 0, receitaMes: 0 }, filtroAtivo: {} }); }
});

// ============================================
// API - PROFISSIONAIS
// ============================================
app.post("/api/profissionais/:id/aprovar", checkAdminAPI, async (req, res) => {
    try {
        const { valor, tipo_prazo, prazo, motivo } = req.body;
        const id = req.params.id;
        let dataVencimento = new Date();

        if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
        else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
        else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);

        const { error: errorAtualizar } = await supabase.from("profissionais")
            .update({ status: "ATIVO", data_vencimento: dataVencimento.toISOString(), valor_pago: parseFloat(valor), data_ultima_edicao: new Date().toISOString() })
            .eq("id", id);
        if (errorAtualizar) throw errorAtualizar;

        await supabase.from("logs_adm").insert({
            id_profissional: id, tipo_acao: "APROVAÇÃO",
            valores_novos: { status: "ATIVO", valor_pago: parseFloat(valor), data_vencimento: dataVencimento.toISOString() },
            motivo_edicao: motivo || 'Aprovação inicial',
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const { valor, tipo_prazo, prazo, motivo } = req.body;
        const id = req.params.id;
        let updateData = { data_ultima_edicao: new Date().toISOString() };
        let tipoAcaoText = "EDIÇÃO";

        if (valor !== undefined && prazo) tipoAcaoText = "VALOR E VENCIMENTO";
        else if (valor !== undefined) tipoAcaoText = "APENAS VALOR";
        else if (prazo) tipoAcaoText = "APENAS VENCIMENTO";

        if (valor !== undefined) updateData.valor_pago = parseFloat(valor);
        if (prazo) {
            let dataVencimento = new Date();
            if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
            else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
            else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);
            updateData.data_vencimento = dataVencimento.toISOString();
        }

        await supabase.from("profissionais").update(updateData).eq("id", id);

        await supabase.from("logs_adm").insert({
            id_profissional: id, tipo_acao: tipoAcaoText,
            valores_novos: updateData,
            motivo_edicao: motivo || 'Sem motivo registrado',
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/profissionais/:id/status", checkAdminAPI, async (req, res) => {
    try {
        const { novoStatus, motivo, renovar, valor, tipo_prazo, prazo } = req.body;
        const id = req.params.id;

        const { data: profAtual } = await supabase.from("profissionais").select("*").eq("id", id).single();
        
        let updateData = { status: novoStatus, data_ultima_edicao: new Date().toISOString() };
        let tipoAcao = novoStatus === 'PAUSADO' ? 'CONTA PAUSADA' : 'CONTA REATIVADA';
        
        if (novoStatus === 'ATIVO' && renovar) {
            updateData.valor_pago = parseFloat(valor);
            let dataVencimento = new Date();
            if (tipo_prazo === 'dias') dataVencimento.setDate(dataVencimento.getDate() + parseInt(prazo));
            else if (tipo_prazo === 'meses') dataVencimento.setDate(dataVencimento.getDate() + (parseInt(prazo) * 30));
            else if (tipo_prazo === 'data') dataVencimento = new Date(prazo);
            updateData.data_vencimento = dataVencimento.toISOString();
            tipoAcao = 'REATIVADA COM RENOVAÇÃO';
        }

        const { error } = await supabase.from("profissionais").update(updateData).eq("id", id);
        if (error) throw error;
        
        await supabase.from("logs_adm").insert({
            id_profissional: id, 
            tipo_acao: tipoAcao,
            valores_anteriores: { status: profAtual.status },
            valores_novos: updateData,
            motivo_edicao: motivo || 'Ação de status', 
            realizado_por: 'Admin'
        });
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// NOVO: SOFT DELETE (Exclusão Lógica)
app.delete("/api/profissionais/:id", checkAdminAPI, async (req, res) => {
    try {
        const { senha, motivo } = req.body;
        const adminPass = process.env.ADMIN_PASS || '#Relaxsempre153143';

        if (senha !== adminPass) {
            return res.status(401).json({ erro: 'Senha de administrador incorreta!' });
        }

        const id = req.params.id;
        const { data: profAtual } = await supabase.from("profissionais").select("*").eq("id", id).single();

        // Apenas oculta o perfil mudando o status para 'EXCLUIDO'
        const { error } = await supabase.from("profissionais").update({ status: 'EXCLUIDO', data_ultima_edicao: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        
        // Registra o motivo no histórico geral para o ADM saber porque ele saiu
        await supabase.from("logs_adm").insert({
            id_profissional: id, 
            tipo_acao: 'EXCLUSÃO DE CONTA',
            valores_anteriores: { status: profAtual.status },
            valores_novos: { status: 'EXCLUIDO' },
            motivo_edicao: motivo || 'Excluído pelo Administrador', 
            realizado_por: 'Admin'
        });
        
        res.json({ sucesso: true });
    } catch (err) { 
        res.status(500).json({ erro: err.message }); 
    }
});

app.get("/api/profissionais/:id/logs", checkAdminAPI, async (req, res) => {
    try {
        const { data: logs, error } = await supabase.from("logs_adm").select("*").eq("id_profissional", req.params.id).order("data_acao", { ascending: false });
        if (error) throw error;
        res.json(logs);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get("/api/relatorios/geral", checkAdminAPI, async (req, res) => {
    try {
        const { data, error } = await supabase.from("logs_adm").select(`*, profissionais (nome, profissao)`).order("data_acao", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================
// API - MODERAÇÃO DE COMENTÁRIOS E BANNERS (INTACTOS)
// ============================================
app.get("/api/comentarios", checkAdminAPI, async (req, res) => {
    try {
        const { data, error } = await supabase.from("avaliacoes").select(`id, cliente_nome, comentario, nota, status, profissionais (nome)`).order("criado_em", { ascending: false });
        if(error) throw error;
        const formatado = data.map(c => ({ id: c.id, cliente_nome: c.cliente_nome, comentario: c.comentario, nota: c.nota, status: c.status || 'PENDENTE', profissional_nome: c.profissionais ? c.profissionais.nome : 'Excluído' }));
        res.json(formatado);
    } catch(err) { res.status(500).json({erro: err.message}); }
});

app.post("/api/comentarios/:id/status", checkAdminAPI, async (req, res) => {
    try {
        await supabase.from("avaliacoes").update({ status: req.body.status }).eq("id", req.params.id);
        res.json({ sucesso: true });
    } catch(err) { res.status(500).json({erro: err.message}); }
});

app.get("/api/banners", checkAdminAPI, async (req, res) => {
    try {
        const { data: banners } = await supabase.from("banners").select("*").order("ordem", { ascending: true });
        res.json(banners);
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/banners", checkAdminAPI, upload.single('imagem'), async (req, res) => {
    try {
        const { id, link_destino, ordem, ativo, titulo, posicao } = req.body;
        const bannerData = { link_destino: link_destino || null, ordem: parseInt(ordem) || 0, ativo: String(ativo) === 'true', titulo: titulo || '', posicao: parseInt(posicao) || 1 };
        
        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
            const { data, error: uploadError } = await supabase.storage.from('contratae-imagens').upload(`banners/${fileName}`, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('contratae-imagens').getPublicUrl(`banners/${fileName}`);
            bannerData.imagem_url = publicUrlData.publicUrl;
        }

        if (id) await supabase.from("banners").update(bannerData).eq("id", id);
        else await supabase.from("banners").insert(bannerData);
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete("/api/banners/:id", checkAdminAPI, async (req, res) => {
    try {
        await supabase.from("banners").delete().eq("id", req.params.id);
        res.json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ROTAS PÚBLICAS
async function obterBannersAtivos() {
    try {
        const { data } = await supabase.from('banners').select('*').eq('ativo', true).order('ordem', { ascending: true });
        return data || [];
    } catch (e) { return []; }
}
app.get('/', async (req, res) => { const banners = await obterBannersAtivos(); res.render('index', { banners }); });
const categoriasMap = [ { profissao: 'Pintor', rota: 'pintores' }, { profissao: 'Pedreiro', rota: 'pedreiros' }, { profissao: 'Eletricista', rota: 'eletricistas' }, { profissao: 'Encanador', rota: 'encanadores' } ];
categoriasMap.forEach(({ profissao, rota }) => {
    app.get(`/${rota}`, async (req, res) => {
        try {
            const { data, error } = await supabase.from('profissionais').select('*').eq('profissao', profissao).eq('status', 'ATIVO');
            if (error) throw error;
            const banners = await obterBannersAtivos();
            res.render(rota, { [rota]: data || [], banners });
        } catch (err) { res.render(rota, { [rota]: [], banners: [] }); }
    });
    app.get(`/${rota}.html`, async (req, res) => {
        try {
            const { data, error } = await supabase.from('profissionais').select('*').eq('profissao', profissao).eq('status', 'ATIVO');
            if (error) throw error;
            const banners = await obterBannersAtivos();
            res.render(rota, { [rota]: data || [], banners });
        } catch (err) { res.render(rota, { [rota]: [], banners: [] }); }
    });
});
// ROTA DE CONTATO
app.get('/contato', (req, res) => {
    res.render('contato');
});

app.post('/api/contato', async (req, res) => {
    try {
        const { nome, email, telefone, assunto, mensagem } = req.body;
        if (!nome || !email || !assunto || !mensagem) {
            return res.status(400).json({ erro: 'Campos obrigatorios nao preenchidos' });
        }
        await transporter.sendMail({
            from: process.env.EMAIL_USER || 'noreply@contratae.com',
            to: 'time.contratae@gmail.com',
            subject: `Novo contato: ${assunto}`,
            html: `<h2>Novo Contato</h2><p><strong>Nome:</strong> ${nome}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Telefone:</strong> ${telefone || 'Nao informado'}</p><p><strong>Assunto:</strong> ${assunto}</p><p><strong>Mensagem:</strong></p><p>${mensagem}</p>`
        });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao enviar contato:', err);
        res.status(500).json({ erro: 'Erro ao enviar mensagem. Tente novamente.' });
    }
});

// ROTA DINAMICA PARA CATEGORIAS
app.get('/categoria/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: categoriaData, error: catError } = await supabase.from('categories').select('*').eq('slug', slug).single();
        if (catError || !categoriaData) {
            return res.status(404).send('Categoria nao encontrada');
        }
        const { data: profissionaisData, error: profError } = await supabase.from('professionals').select('*').eq('category_id', categoriaData.id).eq('status', 'active');
        if (profError) throw profError;
        const banners = await obterBannersAtivos();
        res.render('categoria-dinamica', { categoria: categoriaData, profissionais: profissionaisData || [], banners });
    } catch (err) {
        console.error('Erro ao carregar categoria:', err);
        res.status(500).send('Erro ao carregar categoria');
    }
});

app.get('/outros', (req, res) => {
    res.render('outros');
});

app.listen(port, () => console.log(`🚀 Contrataê rodando em http://localhost:${port}`));