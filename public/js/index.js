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

        showSlide(slideIndex);

        if(nextBtn) nextBtn.addEventListener('click', () => showSlide(slideIndex + 1));
        if(prevBtn) prevBtn.addEventListener('click', () => showSlide(slideIndex - 1));

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => showSlide(index));
        });

        const time = carouselId === 'carousel-topo' ? 5000 : 6500;
        setInterval(() => showSlide(slideIndex + 1), time);
    }

    initCarousel('carousel-topo');
    initCarousel('carousel-baixo');

    // --- BANNERS & MODAL ---
    const modal = document.getElementById('external-link-modal');
    const confirmBtn = document.getElementById('confirm-link');
    const cancelBtn = document.getElementById('cancel-link');
    const modalLinkDest = document.getElementById('modal-link-dest');
    let targetLink = '';

    const bannersContent = document.querySelectorAll('.banner-content');
    bannersContent.forEach(banner => {
        banner.addEventListener('click', () => {
            targetLink = banner.getAttribute('data-link');
            if(targetLink) {
                modalLinkDest.textContent = targetLink;
                modal.style.display = 'flex';
            }
        });
    });

    if(confirmBtn) confirmBtn.addEventListener('click', () => {
        if(targetLink) window.open(targetLink, '_blank');
        modal.style.display = 'none';
    });

    if(cancelBtn) cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

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