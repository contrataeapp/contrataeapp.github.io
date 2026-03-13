const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ============================================
// CONFIGURAÇÃO DO PASSPORT - GOOGLE OAUTH2
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://contrataeapp.onrender.com/auth/google/callback",
        proxy: true 
    }, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const fullName = profile.displayName;
        const googleId = profile.id;
        const avatarUrl = profile.photos[0]?.value || null;

        // 1. Procurar usuário pelo email
        const { data: existingUser, error: selectError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        let user;
        if (existingUser) {
            // 2. Se existir → atualizar google_id e avatar se necessário
            const { data: updatedUser, error: updateError } = await supabase
                .from("users")
                .update({
                    google_id: googleId,
                    avatar_url: existingUser.avatar_url || avatarUrl
                })
                .eq("email", email)
                .select()
                .single();
            
            if (updateError) throw updateError;
            user = updatedUser;
        } else {
            // 3. Se não existir → criar novo usuário
            // O tipo de usuário será definido no callback baseado no parâmetro 'state' ou 'prompt'
            const { data: newUser, error: insertError } = await supabase
                .from("users")
                .insert({
                    email: email,
                    full_name: fullName,
                    google_id: googleId,
                    avatar_url: avatarUrl,
                    user_type: 'client' // Padrão inicial
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            user = newUser;
        }

        return done(null, user);
    } catch (err) {
        console.error('Erro no Google Strategy:', err);
        return done(err, null);
    }
    }));
} else {
    console.warn("⚠️ Google OAuth desativado: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados.");
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error) throw error;
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ============================================
// ROTAS TRADICIONAIS (E-MAIL E SENHA)
// ============================================
router.post('/cadastro', async (req, res) => {
    try {
        const { full_name, email, password, password_confirm, user_type } = req.body;
        
        if (password !== password_confirm) {
            return res.render('auth/cadastro', { erro: 'As senhas não coincidem' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. Criar usuário na tabela users
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([{ 
                full_name, 
                email, 
                password: hashedPassword, 
                user_type: user_type || 'client' 
            }])
            .select()
            .single();

        if (userError) {
            console.error("Erro no insert do cadastro:", userError);
            if (userError.code === '23505') {
                return res.render('auth/cadastro', { erro: 'E-mail já cadastrado' });
            }
            return res.render('auth/cadastro', { erro: 'Erro ao criar conta: ' + userError.message });
        }

        // 2. Se for profissional, criar entrada na tabela professionals
        if (user_type === 'professional') {
            const { error: profError } = await supabase
                .from('professionals')
                .insert([{ 
                    id: userData.id, // UUID do usuário
                    status: 'pending'
                }]);
            
            if (profError) {
                console.error("Erro ao criar perfil profissional:", profError);
                // Opcional: deletar o usuário se falhar aqui, ou apenas logar
            }
        }

        req.session.userId = userData.id;
        req.session.userType = userData.user_type;
        req.session.fullName = userData.full_name;

        if (user_type === 'professional') {
            res.redirect('/profissional/dashboard');
        } else {
            res.redirect('/cliente/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('auth/cadastro', { erro: 'Erro ao criar conta' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error || !user || !user.password) {
            return res.render('auth/login', { erro: 'E-mail ou senha inválidos' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', { erro: 'E-mail ou senha inválidos' });
        }

        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.fullName = user.full_name;

        if (user.user_type === 'professional') {
            res.redirect('/profissional/dashboard');
        } else {
            res.redirect('/cliente/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('auth/login', { erro: 'Erro ao fazer login' });
    }
});

// ============================================
// ROTAS DO GOOGLE OAUTH2
// ============================================
router.get('/google', (req, res, next) => {
    const userType = req.query.type || 'client';
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: userType // Passamos o tipo de usuário no state do OAuth
    })(req, res, next);
});

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/login'
}), async (req, res) => {
    try {
        const userTypeRequested = req.query.state || 'client';
        const user = req.user;

        // Atualizar o tipo de usuário se for um novo cadastro e ele escolheu ser profissional
        if (user.user_type === 'client' && userTypeRequested === 'professional') {
            const { data: updatedUser } = await supabase
                .from('users')
                .update({ user_type: 'professional' })
                .eq('id', user.id)
                .select()
                .single();
            
            if (updatedUser) {
                req.user.user_type = 'professional';
            }
        }

        // Sincronizar sessão
        req.session.userId = req.user.id;
        req.session.userType = req.user.user_type;
        req.session.fullName = req.user.full_name;

        // Se for profissional, verificar se já tem perfil na tabela professionals
        if (req.user.user_type === 'professional') {
            const { data: prof } = await supabase
                .from('professionals')
                .select('category_id')
                .eq('id', req.user.id)
                .maybeSingle();
            
            if (!prof) {
                // Criar entrada pendente se não existir
                await supabase.from('professionals').insert([{ id: req.user.id, status: 'pending' }]);
                return res.redirect('/profissional/dashboard#perfil'); // Redirecionar para completar perfil
            } else if (!prof.category_id) {
                // Se existe mas não tem categoria, forçar completar perfil
                return res.redirect('/profissional/dashboard#perfil');
            }
            return res.redirect('/profissional/dashboard');
        }

        res.redirect('/cliente/dashboard');
    } catch (err) {
        console.error("Erro no callback do Google:", err);
        res.redirect('/auth/login');
    }
});

// ============================================
// LOGOUT GERAL
// ============================================
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
