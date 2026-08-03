// index.js

document.addEventListener('DOMContentLoaded', function() {
    // 1. Lógica do Formulário de Cadastro Rápido (Header)
    const botaoCadastroRapido = document.getElementById('botao-cadastro-rapido');
    const formularioCadastro = document.getElementById('formulario-cadastro');
    
    if (botaoCadastroRapido && formularioCadastro) {
        botaoCadastroRapido.addEventListener('click', function(event) {
            event.stopPropagation(); // Impede o fechamento imediato
            formularioCadastro.style.display = formularioCadastro.style.display === 'none' ? 'flex' : 'none';
        });

        // Fechar o formulário ao clicar fora
        document.addEventListener('click', function(event) {
            if (!formularioCadastro.contains(event.target) && event.target !== botaoCadastroRapido) {
                formularioCadastro.style.display = 'none';
            }
        });
    }

    // 2. Lógica do Floating Banner (se existir na página)
    const closeBannerButton = document.getElementById('close-floating-banner');
    const floatingBanner = document.getElementById('floating-banner');
    
    if (closeBannerButton && floatingBanner) {
        closeBannerButton.addEventListener('click', () => {
            floatingBanner.style.display = 'none';
        });
    }
    
    // 3. Lógica para Ativar o Link do Menu de Navegação (para que a navegação interna funcione)
    const currentPath = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.main-nav ul li a');

    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        const linkFileName = linkHref.split('/').pop();

        link.classList.remove('active'); 

        if (linkFileName === currentPath) {
            link.classList.add('active');
        }
        if ((currentPath === '' || currentPath === 'index.html') && linkFileName === 'index.html') {
            link.classList.add('active');
        }
        if (linkHref.includes('#') && linkFileName === 'index.html') {
             // Lógica para Contato (âncora)
             link.addEventListener('click', (event) => {
                const targetId = linkHref.split('#')[1];
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    event.preventDefault(); // Impede o salto brusco
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
             });
        }
    });
});