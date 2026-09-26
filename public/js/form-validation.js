/**
 * Contrataê - Validação de Formulários e Máscaras
 */

document.addEventListener('DOMContentLoaded', () => {
    // Máscaras para inputs
    const phoneInputs = document.querySelectorAll('input[type="tel"], .mask-phone');
    const cepInputs = document.querySelectorAll('.mask-cep');
    const numericInputs = document.querySelectorAll('.mask-number');

    // Máscara de Telefone: (00) 00000-0000
    phoneInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            
            if (value.length > 10) {
                value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
            } else if (value.length > 6) {
                value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
            } else if (value.length > 0) {
                value = value.replace(/^(\d{0,2}).*/, '($1');
            }
            e.target.value = value;
        });
    });

    // Máscara de CEP: 00000-000
    cepInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 8) value = value.slice(0, 8);
            
            if (value.length > 5) {
                value = value.replace(/^(\d{5})(\d{0,3}).*/, '$1-$2');
            }
            e.target.value = value;

            // Busca automática de CEP quando completo
            if (value.length === 9) {
                fetchAddress(value.replace('-', ''));
            }
        });
    });

    // Apenas números (mask-number)
    const maskNumberInputs = document.querySelectorAll('.mask-number');
    maskNumberInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    });

    // Apenas números (numericInputs genérico)
    numericInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    });

    // Função para buscar endereço via API ViaCEP
    async function fetchAddress(cep) {
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                const cityInput = document.querySelector('input[name="city"]');
                const stateInput = document.querySelector('input[name="state"]');
                const addressInput = document.querySelector('input[name="address"]');
                const neighborhoodInput = document.querySelector('input[name="neighborhood"]');

                if (cityInput) cityInput.value = data.localidade;
                if (stateInput) stateInput.value = data.uf;
                if (addressInput && data.logradouro) addressInput.value = data.logradouro;
                if (neighborhoodInput && data.bairro) neighborhoodInput.value = data.bairro;
                
                // Trigger change events for validation if needed
                [cityInput, stateInput].forEach(el => {
                    if (el) el.dispatchEvent(new Event('input'));
                });
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        }
    }
});

/**
 * Preview de Imagem
 * @param {HTMLInputElement} input - O elemento input file
 * @param {string} previewId - O ID do elemento de preview
 */
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (preview.tagName === 'IMG') {
                preview.src = e.target.result;
            } else {
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * Validação de tamanho de arquivo
 * @param {HTMLInputElement} input - O elemento input file
 * @param {number} maxSizeMB - Tamanho máximo em MB
 * @returns {boolean}
 */
function validateFileSize(input, maxSizeMB = 3) {
    const files = input.files;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSizeBytes) {
            alert(`O arquivo ${files[i].name} excede o limite de ${maxSizeMB}MB.`);
            input.value = '';
            return false;
        }
    }
    return true;
}

// Validação de formulário antes do envio (SaaS UX)
document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.tagName === 'FORM') {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = 'red';
            } else {
                field.style.borderColor = '#444';
            }
        });

        if (!isValid) {
            e.preventDefault();
            alert('Por favor, preencha todos os campos obrigatórios.');
        } else {
            // Feedback visual de carregamento
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.classList.contains('no-loader')) {
                // Prevenir múltiplos cliques
                if (submitBtn.disabled) return;
                
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.setAttribute('data-original-text', originalText);
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            }
        }
    }
});
