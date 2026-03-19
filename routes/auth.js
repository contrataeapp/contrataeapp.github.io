const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function basicProfessionalProfileComplete(prof) {
    return Boolean(prof && prof.phone_number && prof.cep && prof.city && prof.state);
}

// ============================================
// CONFIGURAÇÃO DO PASSPORT - GOOGLE OAUTH2
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://contrataeapp.onrender.com/auth/google/callback",
        proxy: true,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const fullName = profile.displayName;
            const googleId = profile.id;
            const avatarUrl = profile.photos[0]?.value || null;
            const requestedType = req.query.state === 'professional' ? 'professional' : 'client';

            const { data: existingUser, error: selectError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (selectError) throw selectError;

            let user;
            if (existingUser) {
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({
                        google_id: googleId,
                        avatar_url: existingUser.avatar_url || avatarUrl
                    })
                    .eq('email', email)
                    .select()
                    .single();

                if (updateError) throw updateError;
                user = { ...updatedUser, _wasNew: false };
            } else {
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        email,
                        full_name: fullName,
                        google_id: googleId,
                        avatar_url: avatarUrl,
                        user_type: requestedType
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                user = { ...newUser, _wasNew: true };
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
            return res.render('auth/cadastro', { erro: 'As senhas não coincidem', userType: user_type || 'client' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

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
                return res.render('auth/cadastro', { erro: 'E-mail já cadastrado', userType: user_type || 'client' });
            }
            return res.render('auth/cadastro', { erro: 'Erro ao criar conta: ' + userError.message, userType: user_type || 'client' });
        }

        if (user_type === 'professional') {
            await supabase.from('professionals').upsert([{ 
                user_id: userData.id, 
                status: 'pending',
                profile_completed: false,
                approval_requested: false
            }], { onConflict: 'user_id' });
        }

        req.session.userId = userData.id;
        req.session.userType = userData.user_type;
        req.session.fullName = userData.full_name;

        if (user_type === 'professional') {
            return res.redirect('/auth/completar-perfil');
        }
        return res.redirect('/cliente/dashboard');
    } catch (err) {
        console.error(err);
        res.render('auth/cadastro', { erro: 'Erro ao criar conta', userType: req.body.user_type || 'client' });
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
            const { data: prof } = await supabase.from('professionals').select('*').eq('user_id', user.id).maybeSingle();
            if (!basicProfessionalProfileComplete(prof)) {
                return res.redirect('/auth/completar-perfil');
            }
            if (!prof?.profile_completed) {
                return res.redirect('/profissional/onboarding?step=1');
            }
            return res.redirect('/profissional/dashboard');
        }
        return res.redirect('/cliente/dashboard');
    } catch (err) {
        console.error(err);
        res.render('auth/login', { erro: 'Erro ao fazer login' });
    }
});

// ============================================
// ROTAS DO GOOGLE OAUTH2
// ============================================
router.get('/google', (req, res, next) => {
    const userType = req.query.type;
    if (!userType) {
        return res.render('auth/selecionar-tipo', { actionUrl: '/auth/google' });
    }
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: userType,
        prompt: 'select_account'
    })(req, res, next);
});

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/login'
}), async (req, res) => {
    try {
        const user = req.user;
        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.fullName = user.full_name;

        if (user.user_type === 'professional') {
            console.log('Usuário Google é profissional. Verificando perfil...');
            let { data: prof, error: profError } = await supabase
                .from('professionals')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
            if (profError) throw profError;

            if (!prof) {
                const { data: createdProf, error: createProfError } = await supabase
                    .from('professionals')
                    .upsert({
                        user_id: user.id,
                        status: 'pending',
                        profile_completed: false,
                        approval_requested: false
                    }, { onConflict: 'user_id' })
                    .select()
                    .single();
                if (createProfError) throw createProfError;
                prof = createdProf;
            }

            if (user._wasNew || !basicProfessionalProfileComplete(prof)) {
                return res.redirect('/auth/completar-perfil');
            }
            if (!prof?.profile_completed) {
                return res.redirect('/profissional/onboarding?step=1');
            }
            return res.redirect('/profissional/dashboard');
        }

        return res.redirect('/cliente/dashboard');
    } catch (err) {
        console.error('Erro no callback do Google:', err);
        res.redirect('/auth/login');
    }
});

// ============================================
// LOGOUT GERAL
// ============================================
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;
