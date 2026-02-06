document.addEventListener('DOMContentLoaded', function() {
    const carouselContainer = document.querySelector('.carousel-container');
    const carousel = document.querySelector('.carousel');
    const prevButton = document.querySelector('.carousel-control.prev');
    const nextButton = document.querySelector('.carousel-control.next');
    const slides = document.querySelectorAll('.carousel-slide');
    let counter = 0;
    let intervalId;

    function goToSlide(slideIndex) {
        if (slideIndex < 0) {
            counter = slides.length - 1;
        } else if (slideIndex >= slides.length) {
            counter = 0;
        } else {
            counter = slideIndex;
        }
        carousel.style.transform = `translateX(-${counter * 100}%)`;
    }

    function nextSlide() {
        goToSlide(counter + 1);
    }

    function prevSlide() {
        goToSlide(counter - 1);
    }

    if (nextButton && prevButton) {
        nextButton.addEventListener('click', nextSlide);
        prevButton.addEventListener('click', prevSlide);
    }

    function startAutoSlide() {
        intervalId = setInterval(nextSlide, 5000); // Troca a cada 5 segundos
    }

    function stopAutoSlide() {
        clearInterval(intervalId);
    }

    if (carouselContainer) {
        startAutoSlide(); // Inicia a rotação automática ao carregar a página

        carouselContainer.addEventListener('mouseenter', stopAutoSlide); // Pausa ao passar o mouse
        carouselContainer.addEventListener('mouseleave', startAutoSlide); // Retoma ao sair o mouse
    }
});