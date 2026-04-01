const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { applyUserSession, clearAdminSession, clearUserSession } = require('../lib/sessionState');

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
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://contrataeapp.onrender.com/auth/google/callback',
        proxy: true,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const fullName = profile.displayName;
            const googleId = profile.id;
            const avatarUrl = profile.photos[0]?.value || null;
            let stateData = {};
            try {
                stateData = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString('utf8'));
            } catch (_) {}
            const requestedType = stateData.userType === 'professional'
                ? 'professional'
                : stateData.userType === 'client'
                    ? 'client'
                    : null;

            const { data: existingUser, error: selectError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (selectError) throw selectError;

            let user;
            if (existingUser) {
                const stableUserType = requestedType || existingUser.user_type || 'client';
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({
                        google_id: googleId,
                        avatar_url: existingUser.avatar_url || avatarUrl,
                        user_type: stableUserType
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
                        user_type: requestedType || 'client'
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
        const signupPhone = String(req.body.phone_number || '').replace(/\D/g, '').slice(0,11);
        const cleanName = String(full_name || '').trim().replace(/\s+/g, ' ');

        if (cleanName.length < 5 || cleanName.split(' ').length < 2 || cleanName.split(' ').some(part => part.length < 2)) {
            return res.render('auth/cadastro', { erro: 'Informe nome e sobrenome válidos para criar a conta', userType: user_type || 'client' });
        }

        if (password !== password_confirm) {
            return res.render('auth/cadastro', { erro: 'As senhas não coincidem', userType: user_type || 'client' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([{ 
                full_name: cleanName, 
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
                phone_number: signupPhone || null,
                status: 'pending',
                profile_completed: false,
                approval_requested: false
            }], { onConflict: 'user_id' });
        }

        req.session.regenerate((sessionErr) => {
            if (sessionErr) {
                console.error('Erro ao regenerar sessão no cadastro:', sessionErr);
                return res.render('auth/cadastro', { erro: 'Erro ao iniciar sessão', userType: req.body.user_type || 'client' });
            }
            applyUserSession(req.session, userData);
            req.session.professionalReady = false;
            req.session.afterLoginRedirect = null;
            req.session.save(() => {
                if (user_type === 'professional') {
                    return res.redirect('/auth/completar-perfil');
                }
                return res.redirect('/cliente/dashboard');
            });
        });
        return;
    } catch (err) {
        console.error(err);
        res.render('auth/cadastro', { erro: 'Erro ao criar conta', userType: req.body.user_type || 'client' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password, next } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error || !user || !user.password) {
            return res.render('auth/login', { erro: 'E-mail ou senha inválidos', next: next || '' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', { erro: 'E-mail ou senha inválidos', next: next || '' });
        }

        const nextUrl = next && String(next).startsWith('/') ? next : null;

        req.session.regenerate(async (sessionErr) => {
            if (sessionErr) {
                console.error('Erro ao regenerar sessão no login:', sessionErr);
                return res.render('auth/login', { erro: 'Erro ao iniciar sessão', next: next || '' });
            }
            applyUserSession(req.session, user);
            req.session.afterLoginRedirect = nextUrl || null;

            const finishRedirect = (target) => req.session.save((saveErr) => {
                if (saveErr) console.error('Erro ao salvar sessão no login:', saveErr);
                return res.redirect(target);
            });

            if (user.user_type === 'professional') {
                const { data: prof } = await supabase.from('professionals').select('*').eq('user_id', user.id).maybeSingle();
                if (!basicProfessionalProfileComplete(prof)) { req.session.professionalReady = false; return finishRedirect('/auth/completar-perfil'); }
                if (!prof?.profile_completed) { req.session.professionalReady = false; return finishRedirect('/profissional/onboarding?step=1'); }
                req.session.professionalReady = true;
                return finishRedirect(nextUrl && nextUrl.startsWith('/profissional') ? nextUrl : '/profissional/dashboard');
            }
            return finishRedirect(nextUrl && nextUrl.startsWith('/cliente') ? nextUrl : '/cliente/dashboard');
        });
    } catch (err) {
        console.error(err);
        res.render('auth/login', { erro: 'Erro ao fazer login', next: req.body.next || '' });
    }
});

// ============================================
// ROTAS DO GOOGLE OAUTH2
// ============================================
function startGoogleAuth(req, res, next, mode = 'signup') {
    const nextUrl = req.query.next && String(req.query.next).startsWith('/') ? req.query.next : '';
    let userType = req.query.type;

    if (!userType && nextUrl.startsWith('/profissional')) userType = 'professional';
    if (!userType && nextUrl.startsWith('/cliente')) userType = 'client';

    if (!userType && mode !== 'login') {
        return res.render('auth/selecionar-tipo', { actionUrl: '/auth/google', next: nextUrl });
    }

    const statePayload = Buffer.from(JSON.stringify({ userType, nextUrl, mode })).toString('base64url');
    if (nextUrl) req.session.afterLoginRedirect = nextUrl;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: statePayload,
        prompt: 'select_account'
    })(req, res, next);
}

router.get('/google', (req, res, next) => startGoogleAuth(req, res, next, 'signup'));
router.get('/google/login', (req, res, next) => startGoogleAuth(req, res, next, 'login'));

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/auth/login'
}), async (req, res) => {
    try {
        const user = req.user;
        let stateData = {};
        try {
            stateData = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString('utf8'));
        } catch (_) {}
        const nextUrl = req.session.afterLoginRedirect && String(req.session.afterLoginRedirect).startsWith('/')
            ? req.session.afterLoginRedirect
            : (stateData.nextUrl && String(stateData.nextUrl).startsWith('/') ? stateData.nextUrl : null);

        req.session.regenerate(async (sessionErr) => {
            if (sessionErr) {
                console.error('Erro ao regenerar sessão no callback Google:', sessionErr);
                return res.redirect('/auth/login');
            }

            applyUserSession(req.session, user);
            req.session.afterLoginRedirect = nextUrl || null;
            const finishRedirect = (target) => req.session.save((saveErr) => {
                if (saveErr) console.error('Erro ao salvar sessão no callback Google:', saveErr);
                return res.redirect(target);
            });

            if (user.user_type === 'professional') {
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

                if (user._wasNew || !basicProfessionalProfileComplete(prof)) { req.session.professionalReady = false; return finishRedirect('/auth/completar-perfil'); }
                if (!prof?.profile_completed) { req.session.professionalReady = false; return finishRedirect('/profissional/onboarding?step=1'); }
                req.session.professionalReady = true;
                return finishRedirect(nextUrl && nextUrl.startsWith('/profissional') ? nextUrl : '/profissional/dashboard');
            }

            return finishRedirect(nextUrl && nextUrl.startsWith('/cliente') ? nextUrl : '/cliente/dashboard');
        });
    } catch (err) {
        console.error('Erro no callback do Google:', err);
        res.redirect('/auth/login');
    }
});

// ============================================
// LOGOUT GERAL
// ============================================
function logoutHandler(req, res) {
    const sidName = process.env.SESSION_NAME || 'contratae.sid';
    const finalize = () => {
        res.clearCookie(sidName, { path: '/' });
        res.clearCookie('connect.sid', { path: '/' });
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
        return res.redirect('/');
    };

    if (!req.session) {
        return finalize();
    }

    clearUserSession(req.session);
    clearAdminSession(req.session);

    const destroySession = () => {
        const sessionId = req.sessionID;
        req.session.destroy(() => {
            if (req.sessionStore && sessionId) {
                req.sessionStore.destroy(sessionId, () => finalize());
                return;
            }
            finalize();
        });
    };

    if (typeof req.logout === 'function') {
        return req.logout(() => destroySession());
    }
    return destroySession();
}

router.get('/logout', logoutHandler);
router.post('/logout', logoutHandler);

module.exports = router;
