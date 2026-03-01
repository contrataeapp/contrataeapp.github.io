const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
        user: process.env.EMAIL_USER || 'seu-email@gmail.com', 
        pass: process.env.EMAIL_PASS || 'sua-senha-app' 
    }
});

// Middleware para verificar se o usuário está logado
const checkAuth = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/auth/login');
};

// Página de Login
router.get('/login', (req, res) => {
    res.render('login', { erro: null, sucesso: null });
});

// Login com E-mail/Senha
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.render('login', { erro: 'E-mail e senha são obrigatórios', sucesso: null });
        }
        
        // Buscar usuário no banco
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.render('login', { erro: 'E-mail ou senha inválidos', sucesso: null });
        }
        
        // Verificar senha
        const senhaValida = await bcrypt.compare(password, user.password);
        if (!senhaValida) {
            return res.render('login', { erro: 'E-mail ou senha inválidos', sucesso: null });
        }
        
        // Criar sessão
        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.fullName = user.full_name;
        
        // Redirecionar conforme o tipo de usuário
        if (user.user_type === 'professional') {
            res.redirect('/profissional/dashboard');
        } else {
            res.redirect('/cliente/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('login', { erro: 'Erro ao fazer login', sucesso: null });
    }
});

// Registro de Novo Usuário
router.post('/registro', async (req, res) => {
    try {
        const { full_name, email, phone_number, user_type, password, password_confirm } = req.body;
        
        // Validações
        if (!full_name || !email || !user_type || !password) {
            return res.render('login', { erro: 'Preencha todos os campos obrigatórios', sucesso: null });
        }
        
        if (password !== password_confirm) {
            return res.render('login', { erro: 'As senhas não conferem', sucesso: null });
        }
        
        if (password.length < 6) {
            return res.render('login', { erro: 'A senha deve ter no mínimo 6 caracteres', sucesso: null });
        }
        
        // Verificar se e-mail já existe
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            return res.render('login', { erro: 'Este e-mail já está cadastrado', sucesso: null });
        }
        
        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Inserir novo usuário
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                full_name,
                phone_number,
                user_type
            }])
            .select()
            .single();
        
        if (insertError) {
            console.error(insertError);
            return res.render('login', { erro: 'Erro ao criar conta', sucesso: null });
        }
        
        // Se for profissional, criar registro na tabela professionals
        if (user_type === 'professional') {
            await supabase
                .from('professionals')
                .insert([{
                    id: newUser.id,
                    status: 'pending'
                }]);
        }
        
        // Criar sessão
        req.session.userId = newUser.id;
        req.session.userType = newUser.user_type;
        req.session.fullName = newUser.full_name;
        
        // Redirecionar conforme o tipo de usuário
        if (user_type === 'professional') {
            res.redirect('/profissional/dashboard');
        } else {
            res.redirect('/cliente/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('login', { erro: 'Erro ao criar conta', sucesso: null });
    }
});

// Página de Recuperação de Senha
router.get('/esqueci-senha', (req, res) => {
    res.render('esqueci-senha', { erro: null, sucesso: null });
});

// Enviar Link de Recuperação
router.post('/recuperar-senha', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.render('esqueci-senha', { erro: 'E-mail é obrigatório', sucesso: null });
        }
        
        // Buscar usuário
        const { data: user } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('email', email)
            .single();
        
        if (!user) {
            // Por segurança, não informamos se o e-mail existe ou não
            return res.render('esqueci-senha', { erro: null, sucesso: 'Se o e-mail existir, você receberá um link de recuperação em breve.' });
        }
        
        // Gerar token de recuperação (simples, em produção use JWT)
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Salvar token no banco (você precisará criar uma tabela para isso)
        // Por enquanto, vamos apenas enviar o e-mail
        
        const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/resetar-senha?token=${token}&email=${email}`;
        
        // Enviar e-mail
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Recuperação de Senha - Contrataê',
            html: `
                <h2>Olá ${user.full_name}!</h2>
                <p>Recebemos uma solicitação para recuperar sua senha.</p>
                <p><a href="${resetLink}" style="background: #ffa500; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Recuperar Senha</a></p>
                <p>Se você não solicitou isso, ignore este e-mail.</p>
                <p>Atenciosamente,<br>Equipe Contrataê</p>
            `
        });
        
        res.render('esqueci-senha', { erro: null, sucesso: 'Link de recuperação enviado para seu e-mail!' });
    } catch (err) {
        console.error(err);
        res.render('esqueci-senha', { erro: 'Erro ao enviar link de recuperação', sucesso: null });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
