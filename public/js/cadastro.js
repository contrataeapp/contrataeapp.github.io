document.addEventListener('DOMContentLoaded', function() {
    const servicoSelect = document.getElementById('servico');
    const outrosServicoDiv = document.getElementById('outros-servico');
    const outrosServicoInput = document.getElementById('outros');
    const cadastroForm = document.getElementById('cadastro-form');

    servicoSelect.addEventListener('change', function() {
        if (this.value === 'outros') {
            outrosServicoDiv.style.display = 'block';
            outrosServicoInput.setAttribute('required', '');
        } else {
            outrosServicoDiv.style.display = 'none';
            outrosServicoInput.removeAttribute('required');
            outrosServicoInput.value = ''; // Limpa o campo se "Outros" não estiver selecionado
        }
    });

    cadastroForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Impede o envio padrão do formulário
        alert('Cadastro realizado com sucesso! Em breve entraremos em contato.');
        // Aqui você pode adicionar a lógica para enviar os dados do formulário para um servidor
        this.reset(); // Limpa o formulário após o envio (simulado)
        outrosServicoDiv.style.display = 'none'; // Esconde novamente o campo "Outros"
        outrosServicoInput.removeAttribute('required');
    });
});