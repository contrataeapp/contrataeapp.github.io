require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const port = process.env.PORT || 3000;

// CONFIGURAÇÃO SUPABASE
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// MIDDLEWARES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CONFIGURAÇÃO DE SESSÃO
app.use(session({
    secret: process.env.SESSION_SECRET || 'contratae_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// CONFIGURAÇÃO PASSPORT
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ESTRATÉGIA GOOGLE OAUTH
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://contrataeapp.onrender.com/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (user) {
                return done(null, user);
            } else {
                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{
                        email: email,
                        full_name: profile.displayName,
                        google_id: profile.id,
                        avatar_url: profile.photos[0].value,
                        user_type: 'client'
                    }])
                    .select()
                    .single();
                
                if (createError) throw createError;
                return done(null, newUser);
            }
        } catch (err) {
            return done(err, null);
        }
    }));
}

// FUNÇÃO AUXILIAR PARA BANNERS
async function obterBannersAtivos() {
    try {
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('ativo', true)
            .order('ordem', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Erro ao obter banners:', err);
        return [];
    }
}

// ROTAS PRINCIPAIS
app.get('/', async (req, res) => {
    try {
        const banners = await obterBannersAtivos();
        res.render('index', { banners, currentPage: 'index' });
    } catch (err) {
        res.render('index', { banners: [], currentPage: 'index' });
    }
});

app.get('/contato', async (req, res) => {
    try {
        const banners = await obterBannersAtivos();
        res.render('contato', { banners, currentPage: 'contato' });
    } catch (err) {
        res.render('contato', { banners: [], currentPage: 'contato' });
    }
});

app.get('/outros', async (req, res) => {
    try {
        const { data: categorias, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        const banners = await obterBannersAtivos();
        res.render('outros', { categorias: categorias || [], banners, currentPage: 'outros' });
    } catch (err) {
        console.error('Erro ao carregar categorias:', err);
        res.render('outros', { categorias: [], banners: [], currentPage: 'outros' });
    }
});

// ROTAS DE AUTENTICAÇÃO
app.get('/auth/login', (req, res) => {
    res.render('auth/login', { currentPage: 'login' });
});

app.get('/auth/cadastro', (req, res) => {
    res.render('auth/cadastro', { currentPage: 'cadastro' });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// ROTAS DE CATEGORIAS FIXAS (LEGADO)
const categoriasFixas = [
    { rota: 'pintores', profissao: 'Pintor' },
    { rota: 'pedreiros', profissao: 'Pedreiro' },
    { rota: 'eletricistas', profissao: 'Eletricista' },
    { rota: 'encanadores', profissao: 'Encanador' }
];

categoriasFixas.forEach(({ rota, profissao }) => {
    app.get(`/${rota}`, async (req, res) => {
        try {
            const { data, error } = await supabase.from('professionals').select('*, users(*)').eq('status', 'active');
            // Nota: Aqui idealmente filtraríamos pela categoria correta no banco novo
            const banners = await obterBannersAtivos();
            res.render(rota, { [rota]: data || [], banners, currentPage: rota });
        } catch (err) { 
            res.render(rota, { [rota]: [], banners: [], currentPage: rota }); 
        }
    });
});

// ROTA DINÂMICA PARA CATEGORIAS
app.get('/categoria/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: categoriaData, error: catError } = await supabase.from('categories').select('*').eq('slug', slug).single();
        
        if (catError || !categoriaData) {
            return res.status(404).render('categoria-vazia', { banners: [], currentPage: 'outros' });
        }

        const { data: profissionais, error: profError } = await supabase
            .from('professionals')
            .select('*, users(*)')
            .eq('category_id', categoriaData.id)
            .eq('status', 'active');

        if (profError) throw profError;

        const banners = await obterBannersAtivos();

        if (!profissionais || profissionais.length === 0) {
            return res.render('categoria-vazia', { categoria: categoriaData, banners, currentPage: 'outros' });
        }

        res.render('categoria-dinamica', { categoria: categoriaData, profissionais, banners, currentPage: 'outros' });
    } catch (err) {
        console.error('Erro ao carregar categoria:', err);
        res.status(500).send('Erro interno do servidor');
    }
});

app.listen(port, () => {
    console.log(`🚀 Contrataê v2.0.2 rodando em http://localhost:${port}`);
    console.log('✅ Deploy bem-sucedido - Estrutura MVP aplicada');
});
