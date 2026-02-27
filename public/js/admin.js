// ============================================
// ADMIN v2.0 - LÓGICA PRECISA E VISUAL
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    setupEventListeners();
    
    // Mantém a aba certa aberta após recarregar (ex: ao buscar ou salvar dados)
    const hash = window.location.hash || '#dashboard';
    ativarAba(hash.replace('#', ''));

    if (document.getElementById('slots-topo')) {
        carregarBannersVisuais();
    }
    if (document.getElementById('tabela-comentarios')) {
        carregarComentarios();
    }
});

// ============================================
// SISTEMA DE ABAS (PÁGINAS OCULTAS)
// ============================================
function setupTabs() {
    const links = document.querySelectorAll('.sidebar nav ul li a');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                ativarAba(href.replace('#', ''));
                window.history.pushState(null, null, href); // Atualiza URL sem recarregar
            }
        });
    });
}

function ativarAba(idAba) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar nav ul li a').forEach(link => link.classList.remove('active'));
    
    const section = document.getElementById(idAba);
    if (section) section.classList.add('active');
    
    const link = document.querySelector(`.sidebar nav ul li a[href="#${idAba}"]`);
    if (link) link.classList.add('active');
}

// ============================================
// EVENTOS E FILTROS
// ============================================
function setupEventListeners() {
    const inputBusca = document.getElementById('busca');
    if(inputBusca) {
        inputBusca.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') aplicarFiltros();
        });
    }
    document.getElementById('filtro-categoria')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-status')?.addEventListener('change', aplicarFiltros);
    document.getElementById('ordenar')?.addEventListener('change', aplicarFiltros);
    
    document.getElementById('form-aprovar')?.addEventListener('submit', submeterAprovar);
    document.getElementById('form-editar')?.addEventListener('submit', submeterEditar);
    document.getElementById('form-reativar')?.addEventListener('submit', submeterReativar);
    document.getElementById('form-excluir')?.addEventListener('submit', submeterExcluir); // Form de exclusão
    document.getElementById('form-banner')?.addEventListener('submit', submeterBannerViaUpload);
}

function aplicarFiltros() {
    const busca = document.getElementById('busca').value.trim();
    const cat = document.getElementById('filtro-categoria').value;
    const st = document.getElementById('filtro-status').value;
    const ord = document.getElementById('ordenar').value;
    
    const url = new URL(window.location.href);
    if (busca) url.searchParams.set('busca', busca); else url.searchParams.delete('busca');
    if (cat) url.searchParams.set('categoria', cat); else url.searchParams.delete('categoria');
    if (st) url.searchParams.set('status', st); else url.searchParams.delete('status');
    if (ord) url.searchParams.set('ordenar', ord); else url.searchParams.delete('ordenar');
    
    url.hash = '#profissionais'; 
    window.location.href = url.toString();
}

function aplicarFiltroDash() {
    const cat = document.getElementById('filtro-categoria-dash').value;
    const url = new URL(window.location.href);
    if (cat) url.searchParams.set('categoria', cat); else url.searchParams.delete('categoria');
    url.hash = '#dashboard'; 
    window.location.href = url.toString();
}

// ============================================
// MODAIS GERAIS
// ============================================
function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// ============================================
// GESTÃO DE PROFISSIONAIS E REATIVAÇÃO
// ============================================
function abrirModalAprovar(id, nome) {
    document.getElementById('id-prof-aprovar').value = id;
    document.getElementById('nome-prof-aprovar').textContent = nome;
    document.getElementById('form-aprovar').reset();
    atualizarCampoPrazo('aprovar'); 
    abrirModal('modal-aprovar');
}

function abrirModalEditar(id, nome, valor, dataVenc) {
    document.getElementById('id-prof-editar').value = id;
    document.getElementById('nome-prof-editar').textContent = nome;
    document.getElementById('valor-editar').value = valor;
    document.getElementById('tipo-prazo-editar').value = ""; 
    document.getElementById('motivo-editar').value = "";
    atualizarCampoPrazo('editar');
    abrirModal('modal-editar');
}

function abrirModalReativar(id, nome) {
    document.getElementById('id-prof-reativar').value = id;
    document.getElementById('nome-prof-reativar').textContent = nome;
    document.getElementById('form-reativar').reset();
    atualizarCamposReativacao();
    atualizarCampoPrazo('reativar');
    abrirModal('modal-reativar');
}

function abrirModalExcluir(id, nome) {
    document.getElementById('id-prof-excluir').value = id;
    document.getElementById('nome-prof-excluir').textContent = nome;
    document.getElementById('form-excluir').reset();
    abrirModal('modal-excluir');
}

function atualizarCamposReativacao() {
    const tipo = document.getElementById('tipo-reativacao').value;
    const grupo = document.getElementById('grupo-renovacao');
    const valor = document.getElementById('valor-reativar');
    const prazo = document.getElementById('prazo-reativar');

    if (tipo === 'renovar') {
        grupo.style.display = 'block';
        valor.required = true;
        prazo.required = true;
    } else {
        grupo.style.display = 'none';
        valor.required = false;
        prazo.required = false;
    }
}

function atualizarCampoPrazo(tipo) {
    const select = document.getElementById(`tipo-prazo-${tipo}`);
    const input = document.getElementById(`prazo-${tipo}`);
    const label = document.getElementById(`label-prazo-${tipo}`);
    const grupo = document.getElementById(`grupo-prazo-${tipo}`);
    
    const valor = select.value;
    
    if (tipo === 'editar' && !valor) {
        if (grupo) grupo.style.display = 'none';
        return;
    }
    if (tipo === 'editar' && grupo) {
        grupo.style.display = 'block';
    }

    if (input && input._flatpickr) {
        input._flatpickr.destroy();
    }
    if (input) input.readOnly = false; 
    
    if (valor === 'dias' && label && input) {
        label.textContent = 'Quantidade de Dias (Ex: 30)';
        input.type = 'number';
        input.min = '1';
        input.value = '30';
    } else if (valor === 'meses' && label && input) {
        label.textContent = 'Quantidade de Meses (Ex: 1)';
        input.type = 'number';
        input.min = '1';
        input.value = '1';
    } else if (valor === 'data' && label && input) {
        label.textContent = 'Selecione a Data no Calendário';
        input.type = 'text'; 
        input.value = '';
        
        flatpickr(input, {
            mode: 'single',
            dateFormat: 'Y-m-d',
            minDate: 'today'
        });
    }
}

async function submeterAprovar(event) {
    event.preventDefault();
    const id = document.getElementById('id-prof-aprovar').value;
    const valor = document.getElementById('valor-aprovar').value;
    const tipoPrazo = document.getElementById('tipo-prazo-aprovar').value;
    const prazo = document.getElementById('prazo-aprovar').value;
    const motivo = document.getElementById('motivo-aprovar') ? document.getElementById('motivo-aprovar').value : '';
    
    try {
        const response = await fetch(`/api/profissionais/${id}/aprovar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: parseFloat(valor), tipo_prazo: tipoPrazo, prazo: prazo, motivo: motivo })
        });
        const res = await response.json();
        if (res.sucesso) {
            window.location.hash = '#profissionais';
            location.reload();
        }
    } catch (erro) { alert('Erro ao aprovar'); }
}

async function submeterEditar(event) {
    event.preventDefault();
    const id = document.getElementById('id-prof-editar').value;
    const valor = document.getElementById('valor-editar').value;
    const tipoPrazo = document.getElementById('tipo-prazo-editar').value;
    const prazo = document.getElementById('prazo-editar').value;
    const motivo = document.getElementById('motivo-editar') ? document.getElementById('motivo-editar').value : '';
    
    try {
        const response = await fetch(`/api/profissionais/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: valor ? parseFloat(valor) : undefined, tipo_prazo: tipoPrazo, prazo: prazo, motivo: motivo })
        });
        const res = await response.json();
        if (res.sucesso) {
            window.location.hash = '#profissionais';
            location.reload();
        }
    } catch (erro) { alert('Erro ao editar'); }
}

async function submeterReativar(event) {
    event.preventDefault();
    const id = document.getElementById('id-prof-reativar').value;
    const tipoReativacao = document.getElementById('tipo-reativacao').value;
    const motivo = document.getElementById('motivo-reativar').value;
    
    let bodyData = { novoStatus: 'ATIVO', motivo: motivo, renovar: false };

    if (tipoReativacao === 'renovar') {
        bodyData.renovar = true;
        bodyData.valor = document.getElementById('valor-reativar').value;
        bodyData.tipo_prazo = document.getElementById('tipo-prazo-reativar').value;
        bodyData.prazo = document.getElementById('prazo-reativar').value;
    }

    try {
        const response = await fetch(`/api/profissionais/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const res = await response.json();
        if (res.sucesso) {
            window.location.hash = '#profissionais';
            location.reload();
        }
    } catch (erro) { alert('Erro ao reativar'); }
}

async function alterarStatusPausar(id) {
    const motivo = prompt(`Motivo para PAUSAR este profissional:`);
    if(motivo === null) return;
    try {
        const response = await fetch(`/api/profissionais/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: 'PAUSADO', motivo: motivo, renovar: false })
        });
        const res = await response.json();
        if (res.sucesso) {
            window.location.hash = '#profissionais';
            location.reload();
        }
    } catch (erro) { alert('Erro ao alterar status'); }
}

async function submeterExcluir(event) {
    event.preventDefault();
    const id = document.getElementById('id-prof-excluir').value;
    const motivo = document.getElementById('motivo-excluir').value;
    const senha = document.getElementById('senha-excluir').value;

    try {
        const response = await fetch(`/api/profissionais/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senha: senha, motivo: motivo })
        });
        
        const res = await response.json();
        if (res.sucesso) {
            window.location.hash = '#profissionais';
            location.reload();
        } else {
            alert('Atenção: ' + res.erro); 
        }
    } catch (erro) { 
        alert('Erro de conexão ao tentar excluir.'); 
    }
}

function abrirWhatsApp(whatsapp, nome, statusAlerta) {
    let msg = `Olá ${nome}, tudo bem? Aqui é da equipe Contrataê.`;
    
    if (statusAlerta === 'critico') {
        msg += ` Notamos que sua assinatura está próxima do vencimento. Vamos renovar para continuar recebendo clientes?`;
    } else if (statusAlerta === 'vencido') {
        msg += ` Sua assinatura na plataforma venceu. Vamos regularizar para seu perfil não sair do ar?`;
    }

    const url = `https://wa.me/55${whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ============================================
// HISTÓRICO E DOWNLOAD DE RELATÓRIOS (EXCEL E PDF)
// ============================================
let logsAtuais = [];
let nomeProfAtual = "";

async function abrirModalLogs(id, nome) {
    nomeProfAtual = nome;
    document.getElementById('nome-prof-logs').textContent = nome;
    document.getElementById('logs-container').innerHTML = 'Carregando histórico...';
    document.getElementById('btn-baixar-relatorio').style.display = 'none';
    document.getElementById('btn-baixar-pdf').style.display = 'none';
    
    try {
        const response = await fetch(`/api/profissionais/${id}/logs`);
        logsAtuais = await response.json();
        
        if (!logsAtuais || logsAtuais.length === 0) {
            document.getElementById('logs-container').innerHTML = '<p style="color:#666; text-align:center;">Nenhum registro encontrado para este profissional.</p>';
        } else {
            let html = '<table style="width: 100%; text-align: left; border-collapse: collapse;"><thead><tr><th style="border-bottom: 1px solid #ddd; padding: 8px;">Data</th><th style="border-bottom: 1px solid #ddd; padding: 8px;">Ação</th><th style="border-bottom: 1px solid #ddd; padding: 8px;">Valor</th><th style="border-bottom: 1px solid #ddd; padding: 8px;">Motivo</th></tr></thead><tbody>';
            
            logsAtuais.forEach(l => {
                const dataFormatada = new Date(l.data_acao).toLocaleString('pt-BR');
                let valorPago = '---';
                if (l.valores_novos && l.valores_novos.valor_pago !== undefined && l.valores_novos.valor_pago !== null) {
                    valorPago = 'R$ ' + Number(l.valores_novos.valor_pago).toFixed(2).replace('.', ',');
                }

                html += `<tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 0.85rem;">${dataFormatada}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 0.85rem; color: var(--primary);">${l.tipo_acao}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 0.85rem; color: #28a745; font-weight: bold;">${valorPago}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 0.85rem;">${l.motivo_edicao || '<span style="color:#999;">Sem motivo</span>'}</td>
                         </tr>`;
            });
            html += '</tbody></table>';
            document.getElementById('logs-container').innerHTML = html;
            
            document.getElementById('btn-baixar-relatorio').style.display = 'block';
            document.getElementById('btn-baixar-pdf').style.display = 'block'; 
        }
        abrirModal('modal-logs');
    } catch (erro) { 
        alert('Erro ao carregar histórico do servidor.'); 
    }
}

function baixarRelatorioProfissional() {
    if (!logsAtuais || logsAtuais.length === 0) return;
    let csvContent = "\uFEFFData;Ação;Valor Pago;Motivo\n";
    logsAtuais.forEach(l => {
        const dataFormatada = new Date(l.data_acao).toLocaleString('pt-BR');
        let valorPago = '0,00';
        if (l.valores_novos && l.valores_novos.valor_pago !== undefined && l.valores_novos.valor_pago !== null) {
            valorPago = Number(l.valores_novos.valor_pago).toFixed(2).replace('.', ',');
        }
        let motivo = l.motivo_edicao || 'Sem motivo';
        motivo = motivo.replace(/"/g, '""'); 
        csvContent += `"${dataFormatada}";"${l.tipo_acao}";"R$ ${valorPago}";"${motivo}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Historico_${nomeProfAtual.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function baixarRelatorioProfissionalPDF() {
    if (!logsAtuais || logsAtuais.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`Histórico Financeiro - ${nomeProfAtual}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
    const tableData = logsAtuais.map(l => {
        const dataF = new Date(l.data_acao).toLocaleDateString('pt-BR');
        let valor = '---';
        if (l.valores_novos && l.valores_novos.valor_pago !== undefined && l.valores_novos.valor_pago !== null) {
            valor = 'R$ ' + Number(l.valores_novos.valor_pago).toFixed(2).replace('.', ',');
        }
        const motivo = l.motivo_edicao || '-';
        return [dataF, l.tipo_acao, valor, motivo];
    });

    doc.autoTable({
        startY: 35,
        head: [['Data', 'Ação', 'Valor', 'Motivo']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 33, 71] } 
    });
    
    doc.save(`Historico_${nomeProfAtual.replace(/\s+/g, '_')}.pdf`);
}

async function baixarRelatorioGeralExcel() {
    try {
        const logs = await fetch('/api/relatorios/geral').then(r => r.json());
        if (!logs || logs.length === 0) { alert('Sem dados de faturamento.'); return; }
        
        let csvContent = "\uFEFFData;Profissional;Ação;Valor Pago;Motivo\n";
        logs.forEach(l => {
            const dataF = new Date(l.data_acao).toLocaleString('pt-BR');
            const nome = l.profissionais ? l.profissionais.nome : 'Desconhecido';
            let valor = '0,00';
            if (l.valores_novos && l.valores_novos.valor_pago !== undefined && l.valores_novos.valor_pago !== null) {
                valor = Number(l.valores_novos.valor_pago).toFixed(2).replace('.', ',');
            }
            let motivo = l.motivo_edicao || '-';
            motivo = motivo.replace(/"/g, '""');
            csvContent += `"${dataF}";"${nome}";"${l.tipo_acao}";"R$ ${valor}";"${motivo}"\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `Faturamento_Geral_Contratae.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch(e) { alert('Erro ao gerar relatório geral.'); }
}

async function baixarRelatorioGeralPDF() {
    try {
        const logs = await fetch('/api/relatorios/geral').then(r => r.json());
        if (!logs || logs.length === 0) { alert('Sem dados de faturamento.'); return; }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Faturamento Geral da Plataforma - Contrataê`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
        
        let totalSoma = 0;

        const tableData = logs.map(l => {
            const dataF = new Date(l.data_acao).toLocaleDateString('pt-BR');
            const nome = l.profissionais ? l.profissionais.nome : 'Desconhecido';
            const valorNum = (l.valores_novos && l.valores_novos.valor_pago) ? Number(l.valores_novos.valor_pago) : 0;
            totalSoma += valorNum;
            const valorStr = 'R$ ' + valorNum.toFixed(2).replace('.', ',');
            return [dataF, nome, l.tipo_acao, valorStr];
        });

        doc.autoTable({
            startY: 35,
            head: [['Data', 'Profissional', 'Ação', 'Valor']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [0, 33, 71] }
        });
        
        const finalY = doc.lastAutoTable.finalY || 35;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Soma Total Histórica: R$ ${totalSoma.toFixed(2).replace('.', ',')}`, 14, finalY + 10);
        
        doc.save(`Faturamento_Geral_Contratae.pdf`);
    } catch(e) { alert('Erro ao gerar PDF.'); }
}


// ============================================
// GESTÃO DE BANNERS E COMENTÁRIOS
// ============================================
async function carregarBannersVisuais() {
    try {
        const response = await fetch('/api/banners');
        const banners = await response.json();
        desenharGavetas('slots-topo', 1, 5, banners, 'Banner Topo');
        desenharGavetas('slots-rodape', 2, 5, banners, 'Banner Rodapé');
        desenharGavetasLaterais('slots-laterais', banners);
    } catch (erro) { console.error("Erro ao carregar banners", erro); }
}

function desenharGavetas(containerId, posicaoID, quantidade, bannersData, tituloPrefixo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    for(let ordem = 1; ordem <= quantidade; ordem++) {
        const bannerSalvo = bannersData.find(b => b.posicao === posicaoID && b.ordem === ordem);
        const div = document.createElement('div');
        div.className = `banner-slot ${bannerSalvo ? 'filled' : 'empty'}`;
        const nomeSlot = `${tituloPrefixo} ${ordem}`;
        
        if (bannerSalvo && bannerSalvo.imagem_url) {
            div.innerHTML = `
                <img src="${bannerSalvo.imagem_url}" alt="${nomeSlot}">
                <div class="slot-overlay">
                    <span>${nomeSlot}</span>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn-action edit" onclick='abrirModalGaveta(${posicaoID}, ${ordem}, ${JSON.stringify(bannerSalvo)})'><i class="fas fa-edit"></i></button>
                        <button class="btn-action suspend" onclick="deletarBanner(${bannerSalvo.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div class="slot-overlay">
                    <span>${nomeSlot}</span>
                    <button class="btn-add" onclick='abrirModalGaveta(${posicaoID}, ${ordem}, null)'><i class="fas fa-upload"></i> Adicionar</button>
                </div>
            `;
        }
        container.appendChild(div);
    }
}

function desenharGavetasLaterais(containerId, bannersData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const bannerEsq = bannersData.find(b => b.posicao === 3);
    container.appendChild(criarSlotLateral(3, 'Fixo Esquerda', bannerEsq));
    
    const bannerDir = bannersData.find(b => b.posicao === 4);
    container.appendChild(criarSlotLateral(4, 'Fixo Direita', bannerDir));
}

function criarSlotLateral(posicaoID, titulo, bannerSalvo) {
    const div = document.createElement('div');
    div.className = `banner-slot ${bannerSalvo ? 'filled' : 'empty'}`;
    
    if (bannerSalvo && bannerSalvo.imagem_url) {
        div.innerHTML = `
            <img src="${bannerSalvo.imagem_url}" alt="${titulo}">
            <div class="slot-overlay">
                <span>${titulo}</span>
                <div style="display:flex; gap: 5px;">
                    <button class="btn-action edit" onclick='abrirModalGaveta(${posicaoID}, 1, ${JSON.stringify(bannerSalvo)})'><i class="fas fa-edit"></i></button>
                    <button class="btn-action suspend" onclick="deletarBanner(${bannerSalvo.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="slot-overlay">
                <span>${titulo}</span>
                <button class="btn-add" onclick='abrirModalGaveta(${posicaoID}, 1, null)'><i class="fas fa-upload"></i> Adicionar</button>
            </div>
        `;
    }
    return div;
}

function abrirModalGaveta(posicao, ordem, bannerData) {
    document.getElementById('form-banner').reset();
    document.getElementById('posicao-banner').value = posicao;
    document.getElementById('ordem-banner').value = ordem;
    
    if (bannerData) {
        document.getElementById('id-banner').value = bannerData.id;
        document.getElementById('titulo-banner').value = bannerData.titulo || '';
        document.getElementById('link-banner').value = bannerData.link_destino || '';
        document.getElementById('ativo-banner').checked = bannerData.ativo;
        document.getElementById('arquivo-banner').required = false; 
        document.getElementById('titulo-modal-banner').textContent = 'Editar Parceiro';
    } else {
        document.getElementById('id-banner').value = '';
        document.getElementById('arquivo-banner').required = true; 
        document.getElementById('titulo-modal-banner').textContent = 'Fazer Upload do Parceiro';
    }
    abrirModal('modal-banner');
}

async function submeterBannerViaUpload(e) {
    e.preventDefault();
    
    let linkDestinoOriginal = document.getElementById('link-banner').value.trim();
    if (/^\d{10,13}$/.test(linkDestinoOriginal)) {
        linkDestinoOriginal = `https://wa.me/55${linkDestinoOriginal}`;
    }

    const arquivoInput = document.getElementById('arquivo-banner');
    const formData = new FormData();
    formData.append('id', document.getElementById('id-banner').value);
    formData.append('titulo', document.getElementById('titulo-banner').value);
    formData.append('link_destino', linkDestinoOriginal); 
    formData.append('posicao', document.getElementById('posicao-banner').value);
    formData.append('ordem', document.getElementById('ordem-banner').value);
    formData.append('ativo', document.getElementById('ativo-banner').checked);

    if (arquivoInput.files.length > 0) {
        formData.append('imagem', arquivoInput.files[0]);
    }

    try {
        const response = await fetch('/api/banners', { method: 'POST', body: formData });
        const res = await response.json();
        if (res.sucesso) { 
            fecharModal('modal-banner'); carregarBannersVisuais(); 
        } else { alert('Erro no Servidor: ' + res.erro); }
    } catch (erro) { alert('Erro de conexão ao enviar o banner.'); }
}

async function deletarBanner(id) {
    if (!confirm('Deseja excluir permanentemente este banner do site?')) return;
    try {
        await fetch(`/api/banners/${id}`, { method: 'DELETE' });
        carregarBannersVisuais();
    } catch (erro) { alert('Erro ao deletar'); }
}

async function carregarComentarios() {
    try {
        const response = await fetch('/api/comentarios');
        const comentarios = await response.json();
        const tbody = document.getElementById('tabela-comentarios');
        if(!tbody) return;
        tbody.innerHTML = '';
        
        if(comentarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">Nenhum comentário cadastrado ainda.</td></tr>';
            return;
        }
        
        comentarios.forEach(c => {
            const badgeCor = c.status === 'APROVADO' ? 'ativo' : (c.status === 'OCULTO' ? 'pausado' : 'pendente');
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.cliente_nome || 'Anônimo'}</strong></td>
                    <td>${c.profissional_nome || 'Profissional Desconhecido'}</td>
                    <td><i class="fas fa-star" style="color:gold;"></i> ${c.nota || 5}</td>
                    <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.comentario}">${c.comentario || '---'}</td>
                    <td><span class="badge ${badgeCor}">${c.status}</span></td>
                    <td class="acoes-cell">
                        <button class="btn-action approve" onclick="moderarComentario(${c.id}, 'APROVADO')" title="Aprovar e Mostrar no Site">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-action suspend" onclick="moderarComentario(${c.id}, 'OCULTO')" title="Ocultar do Site">
                            <i class="fas fa-eye-slash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error('Erro ao carregar comentários', e); }
}

async function moderarComentario(id, status) {
    if(!confirm(`Deseja alterar este comentário para ${status}?`)) return;
    try {
        const response = await fetch(`/api/comentarios/${id}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status})
        });
        const res = await response.json();
        if(res.sucesso) carregarComentarios();
    } catch(e) { alert('Erro ao moderar comentário'); }
}