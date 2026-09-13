document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(event) {
            event.preventDefault(); 
            
            // Futuramente, adicionaremos aqui a validação de campos vazios e e-mail.
            
            const nome = document.getElementById('nome').value;
            const email = document.getElementById('email').value;
            const assunto = document.getElementById('assunto').value;
            const mensagem = document.getElementById('mensagem').value;

            // Simulação de envio
            console.log("Dados de Contato Enviados:");
            console.log(`Nome: ${nome}`);
            console.log(`E-mail: ${email}`);
            console.log(`Assunto: ${assunto}`);
            console.log(`Mensagem: ${mensagem}`);

            alert("Mensagem enviada com sucesso! Em breve, entraremos em contato.");
            contactForm.reset();
        });
    }
});