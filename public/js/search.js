document.addEventListener('DOMContentLoaded', () => {
    // Busca na barra do header (desktop)
    const searchInputPill = document.querySelector('.search-input-pill');
    const searchBtnRound = document.querySelector('.search-btn-round');

    if (searchInputPill && searchBtnRound) {
        const performSearch = () => {
            const query = searchInputPill.value.trim();
            if (query) {
                // Redirecionar para a página de busca ou categorias
                window.location.href = `/outros?busca=${encodeURIComponent(query)}`;
            }
        };

        searchBtnRound.addEventListener('click', performSearch);
        searchInputPill.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Busca na seção hero (homepage)
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');

    if (searchInput && searchBtn) {
        const performSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/outros?busca=${encodeURIComponent(query)}`;
            }
        };

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});
