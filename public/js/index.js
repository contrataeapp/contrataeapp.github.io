document.addEventListener('DOMContentLoaded', () => {

    // --- FUNÇÃO GENÉRICA PARA CARROSSEL ---
    function initCarousel(carouselId) {
        const section = document.getElementById(carouselId);
        if (!section) return;

        const slides = section.querySelectorAll('.carousel-item');
        const dots = section.querySelectorAll('.dot');
        const nextBtn = section.querySelector('.next-btn');
        const prevBtn = section.querySelector('.prev-btn');
        let slideIndex = 0;
        let intervalId;

        function showSlide(n) {
            if (n >= slides.length) slideIndex = 0;
            else if (n < 0) slideIndex = slides.length - 1;
            else slideIndex = n;

            slides.forEach(slide => {
                slide.style.display = 'none';
                slide.classList.remove('active');
            });
            dots.forEach(dot => dot.classList.remove('active'));

            slides[slideIndex].style.display = 'block';
            slides[slideIndex].classList.add('active');
            if(dots[slideIndex]) dots[slideIndex].classList.add('active');
        }

        function nextSlide() { showSlide(slideIndex + 1); }
        function prevSlide() { showSlide(slideIndex - 1); }

        if(nextBtn) nextBtn.addEventListener('click', nextSlide);
        if(prevBtn) prevBtn.addEventListener('click', prevSlide);

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => showSlide(index));
        });

        // Rotação Automática
        function startAuto() { intervalId = setInterval(nextSlide, 5000); }
        function stopAuto() { clearInterval(intervalId); }

        startAuto();
        section.addEventListener('mouseenter', stopAuto);
        section.addEventListener('mouseleave', startAuto);

        showSlide(slideIndex);
    }

    initCarousel('carousel-topo');
    initCarousel('carousel-baixo');

    // --- MODAL INTELIGENTE (CORRIGIDO) ---
    const modal = document.getElementById('external-link-modal');
    const modalLinkDest = document.getElementById('modal-link-dest');
    const modalMsg = document.getElementById('modal-msg'); // Certifique-se que o <p> tem este ID
    const confirmBtn = document.getElementById('confirm-link');
    const cancelBtn = document.getElementById('cancel-link');
    let targetLink = '';

    function openModal(link) {
        if (!link) return;
        targetLink = link;
        
        // Atualiza o link visível (opcional, pode esconder com CSS se preferir)
        if (modalLinkDest) modalLinkDest.textContent = targetLink;
        
        // LÓGICA DE DETECÇÃO DE LINK
        if (modalMsg) {
            if (link.includes('instagram.com')) {
                modalMsg.textContent = "Você será redirecionado para o Instagram de nosso parceiro.";
            } else if (link.includes('wa.me') || link.includes('whatsapp.com')) {
                modalMsg.textContent = "Você será redirecionado para o WhatsApp.";
            } else {
                modalMsg.textContent = "Você será redirecionado para um site externo.";
            }
        } else {
            console.warn('Elemento #modal-msg não encontrado no HTML.');
        }

        if (modal) modal.style.display = 'flex';
    }

    // A) Banners Flutuantes
    const bannersContent = document.querySelectorAll('.banner-content');
    bannersContent.forEach(banner => {
        banner.addEventListener('click', () => {
            const link = banner.getAttribute('data-link');
            openModal(link);
        });
    });

    // B) Links do Carrossel e Botões "Contatar"
    const triggerLinks = document.querySelectorAll('.trigger-modal');
    triggerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 
            const url = link.getAttribute('data-link');
            openModal(url);
        });
    });

    // Botões de Ação do Modal
    if(confirmBtn) confirmBtn.addEventListener('click', () => {
        if(targetLink) window.open(targetLink, '_blank');
        if(modal) modal.style.display = 'none';
    });

    if(cancelBtn) cancelBtn.addEventListener('click', () => {
        if(modal) modal.style.display = 'none';
    });

    // Fechar Banner Lateral
    const closeBannerBtns = document.querySelectorAll('.close-banner');
    closeBannerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentBanner = btn.closest('.banner-lateral');
            if(parentBanner) parentBanner.style.display = 'none';
        });
    });

    // --- MENU MOBILE ---
    const mobileMenuTrigger = document.getElementById('mobile-menu-trigger');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const nav = document.getElementById('main-nav');
    
    if (mobileMenuTrigger && nav) {
        mobileMenuTrigger.addEventListener('click', (e) => {
            e.preventDefault(); 
            nav.classList.add('active');
        });
    }
    if (closeMenuBtn && nav) {
        closeMenuBtn.addEventListener('click', () => {
            nav.classList.remove('active');
        });
    }
});