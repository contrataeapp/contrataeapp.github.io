// public/js/theme-toggle.js

document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Função para atualizar o ícone
    const updateIcon = (isLight) => {
        const icon = themeBtn ? themeBtn.querySelector('i') : null;
        if (icon) {
            if (isLight) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        }
    };

    // Verificar preferência salva
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        updateIcon(true);
    } else {
        body.classList.remove('light-mode');
        updateIcon(false);
    }

    // Clique no botão
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isLight = body.classList.toggle('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateIcon(isLight);
        });
    }
});
