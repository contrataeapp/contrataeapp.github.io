require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// =================================================
// 1. CONEXÃO COM BANCO DE DADOS (SUPABASE)
// =================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// =================================================
// 2. CONFIGURAÇÕES DO SERVIDOR
// =================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

// =================================================
// 3. ROTAS DO SITE
// =================================================

// --- HOME ---
app.get('/', (req, res) => {
    res.render('index');
});
// Caso acesse /index.html direto
app.get('/index.html', (req, res) => {
    res.render('index');
});

// --- PINTORES ---
app.get('/pintores.html', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('profissionais')
        .select('*')
        .eq('profissao', 'Pintor')
        .eq('status', 'ATIVO')
        .limit(20);

    if (error) { console.log(error); return res.render('pintores', { pintores: [] }); }
    res.render('pintores', { pintores: lista });
});

// --- PEDREIROS (A ROTA QUE FALTAVA) ---
app.get('/pedreiros.html', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('profissionais')
        .select('*')
        .eq('profissao', 'Pedreiro') // Busca apenas Pedreiros
        .eq('status', 'ATIVO')
        .limit(20);

    // Se der erro ou não tiver ninguém, carrega lista vazia para não quebrar
    if (error) { console.log(error); return res.render('pedreiros', { pedreiros: [] }); }
    
    // Renderiza o arquivo views/pedreiros.ejs enviando a lista
    res.render('pedreiros', { pedreiros: lista });
});

// --- ELETRICISTAS ---
app.get('/eletricistas.html', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('profissionais')
        .select('*')
        .eq('profissao', 'Eletricista')
        .eq('status', 'ATIVO')
        .limit(20);

    if (error) return res.render('eletricistas', { eletricistas: [] });
    res.render('eletricistas', { eletricistas: lista });
});

// --- ENCANADORES ---
app.get('/encanadores.html', async (req, res) => {
    const { data: lista, error } = await supabase
        .from('profissionais')
        .select('*')
        .eq('profissao', 'Encanador')
        .eq('status', 'ATIVO')
        .limit(20);

    if (error) return res.render('encanadores', { encanadores: [] });
    res.render('encanadores', { encanadores: lista });
});

// --- PÁGINAS ESTÁTICAS (Login, Cadastro, etc) ---
app.get('/login.html', (req, res) => { res.render('login'); });
app.get('/cadastro.html', (req, res) => { res.render('cadastro'); });
app.get('/contato.html', (req, res) => { res.render('contato'); });
app.get('/sobre_nos.html', (req, res) => { res.render('sobre_nos'); });
app.get('/servicos_categorias.html', (req, res) => { res.render('servicos_categorias'); });

// =================================================
// 4. INICIALIZAR SERVIDOR
// =================================================
app.listen(port, () => {
    console.log(`🚀 Sistema Contrataê rodando em http://localhost:${port}`);
});