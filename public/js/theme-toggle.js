// js/theme-toggle.js

document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;
    const icon = themeBtn ? themeBtn.querySelector('i') : null;

    // Função para verificar preferência salva
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        if(icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    // Clique no botão
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            
            if (body.classList.contains('light-mode')) {
                // Modo Claro Ativo
                localStorage.setItem('theme', 'light');
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                // Modo Escuro Ativo
                localStorage.setItem('theme', 'dark');
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        });
    }
});