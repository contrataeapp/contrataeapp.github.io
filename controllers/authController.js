/**
 * Controlador de Autenticação
 */
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.login = async (req, res) => {
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

        // Configurar sessão
        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.fullName = user.full_name;

        // Redirecionamento baseado no tipo
        if (user.user_type === 'professional') {
            const { data: prof } = await supabase.from('professionals').select('profile_completed').eq('user_id', user.id).single();
            if (prof && !prof.profile_completed) {
                return res.redirect('/auth/completar-perfil');
            }
            return res.redirect('/profissional/dashboard');
        }
        
        res.redirect('/cliente/dashboard');
    } catch (err) {
        console.error("❌ [AUTH ERROR]:", err);
        res.render('auth/login', { erro: 'Erro ao fazer login. Tente novamente.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("❌ [LOGOUT ERROR]:", err);
        res.redirect('/');
    });
};
