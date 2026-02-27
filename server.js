require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 1. CONEXÃO SUPABASE
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. CONFIGURAÇÕES (IMPORTANTE: Static primeiro!)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ROTAS DE ADMINISTRAÇÃO
app.get("/admin", async (req, res) => {
    try {
        const { data: profissionais, error } = await supabase.from("profissionais").select("*").order("data_cadastro", { ascending: false });
        if (error) throw error;

        const totais = {
            ativos: profissionais.filter(p => p.status === 'ATIVO').length,
            pendentes: profissionais.filter(p => p.status === 'PENDENTE').length,
            receitaTotal: profissionais.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0),
            receitaMes: profissionais.filter(p => {
                const data = new Date(p.data_vencimento);
                const hoje = new Date();
                return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
            }).reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0)
        };

        res.render("admin", { profissionais: profissionais || [], totais });
    } catch (err) {
        res.render("admin", { profissionais: [], totais: { ativos: 0, pendentes: 0, receitaTotal: 0, receitaMes: 0 } });
    }
});

// APROVAR COM TEMPO E VALOR
app.post("/admin/aprovar/:id", async (req, res) => {
    const { meses, valor } = req.body;
    const dataVencimento = new Date();
    dataVencimento.setMonth(dataVencimento.getMonth() + parseInt(meses));
    
    await supabase.from("profissionais").update({ 
        status: "ATIVO", 
        data_vencimento: dataVencimento.toISOString(),
        valor_pago: parseFloat(valor),
        plano_tipo: meses === "12" ? "ANUAL" : "MENSAL"
    }).eq("id", req.params.id);
    res.redirect("/admin");
});

// ALTERAR STATUS (PAUSAR/ATIVAR)
app.post("/admin/status/:id", async (req, res) => {
    const { novoStatus } = req.body;
    await supabase.from("profissionais").update({ status: novoStatus }).eq("id", req.params.id);
    res.redirect("/admin");
});

// 4. ROTAS DO SITE
app.get('/', (req, res) => res.render('index'));
app.get('/index.html', (req, res) => res.render('index'));

// Rotas de categorias (Pintores, Pedreiros, etc)
const categorias = ['Pintor', 'Pedreiro', 'Eletricista', 'Encanador'];
categorias.forEach(cat => {
    const rota = cat.toLowerCase() === 'pintor' ? 'pintores' : cat.toLowerCase() + 's';
    app.get(`/${rota}.html`, async (req, res) => {
        const { data } = await supabase.from('profissionais').select('*').eq('profissao', cat).eq('status', 'ATIVO').limit(20);
        res.render(rota, { [rota]: data || [] });
    });
});

app.get('/login.html', (req, res) => res.render('login'));
app.get('/cadastro.html', (req, res) => res.render('cadastro'));
app.get('/contato.html', (req, res) => res.render('contato'));
app.get('/sobre_nos.html', (req, res) => res.render('sobre_nos'));
app.get('/servicos_categorias.html', (req, res) => res.render('servicos_categorias'));

app.listen(port, () => console.log(`🚀 Contrataê rodando em http://localhost:${port}`));
