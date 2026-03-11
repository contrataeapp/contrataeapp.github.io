const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ============================================
// CONFIGURAÇÃO DO PASSPORT - GOOGLE OAUTH2
// ============================================
passport.use(new GoogleStrategy({
	    clientID: process.env.GOOGLE_CLIENT_ID,
	    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	    callbackURL: process.env.NODE_ENV === 'production' 
            ? 'https://contrataeapp.onrender.com/auth/google/callback' 
            : 'http://localhost:3000/auth/google/callback',
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
            .single();

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
            // 3. Se não existir → criar novo usuário como cliente por padrão
            const { data: newUser, error: insertError } = await supabase
                .from("users")
                .insert({
                    email: email,
                    full_name: fullName,
                    google_id: googleId,
                    avatar_url: avatarUrl,
                    user_type: 'client'
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
            return res.render('cadastro', { erro: 'As senhas não coincidem' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{ full_name, email, password: hashedPassword, user_type }])
            .select()
            .single();

        if (error) {
            console.error("Erro no insert do cadastro:", error);
            if (error.code === '23505') {
                return res.render('cadastro', { erro: 'E-mail já cadastrado' });
            }
            return res.render('cadastro', { erro: 'Erro ao criar conta no banco de dados: ' + error.message });
        }

        req.session.userId = data.id;
        req.session.userType = data.user_type;
        req.session.fullName = data.full_name;

        if (user_type === 'professional') {
            res.redirect('/profissional/dashboard');
        } else {
            res.redirect('/cliente/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('cadastro', { erro: 'Erro ao criar conta' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user || !user.password) {
            return res.render('login', { erro: 'E-mail ou senha inválidos' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { erro: 'E-mail ou senha inválidos' });
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
        res.render('login', { erro: 'Erro ao fazer login' });
    }
});

// ============================================
// ROTAS DO GOOGLE OAUTH2
// ============================================
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/login'
}), (req, res) => {
    req.session.userId = req.user.id;
    req.session.userType = req.user.user_type;
    req.session.fullName = req.user.full_name;

    if (req.user.user_type === 'professional') {
        res.redirect('/profissional/dashboard');
    } else {
        res.redirect('/cliente/dashboard');
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