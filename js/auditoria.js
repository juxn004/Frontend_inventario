/**
 * Auditoría - Sistema de Inventario
 * Carga y muestra el historial de auditoría con paginación y filtros
 */

const API_URL = "https://backendinventario-production-c5ef.up.railway.app/productos";

let paginaActual = 0;
let tamanoPagina = 20;

document.addEventListener("DOMContentLoaded", () => {
    console.log("📋 AUDITORIA.JS CARGADO");
    cargarAuditoria();
});

async function cargarAuditoria() {
    const tbody = document.getElementById("tbodyAuditoria");
    const filtroEntidad = document.getElementById("filtroEntidad").value;
    const filtroAccion = document.getElementById("filtroAccion").value;
    const filtroUsuario = document.getElementById("filtroUsuario").value;
    tamanoPagina = parseInt(document.getElementById("pageSize").value);

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center text-muted py-5">
                <div class="spinner-border text-primary me-2" role="status"></div>
                Cargando auditoría...
            </td>
        </tr>
    `;

    try {
        let url = `${API_URL}?page=${paginaActual}&size=${tamanoPagina}&sortBy=fecha&sortDir=desc`;
        
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        
        const data = await respuesta.json();
        renderTabla(data.content);
        renderPaginacion(data.totalPages, data.totalElements);
        
    } catch (error) {
        console.error("❌ Error cargando auditoría:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-5">
                    <i class="fa-solid fa-circle-exclamation fa-2x mb-2"></i>
                    <p class="mb-0">Error al cargar auditoría: ${error.message}</p>
                    <button class="btn btn-primary btn-sm mt-2" onclick="cargarAuditoria()">
                        <i class="fa-solid fa-arrows-rotate me-1"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

function renderTabla(auditorias) {
    const tbody = document.getElementById("tbodyAuditoria");
    
    if (!auditorias || auditorias.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    <i class="fa-solid fa-magnifying-glass fa-2x mb-2 text-muted"></i>
                    <p class="mb-0">No se encontraron registros de auditoría</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = auditorias.map(a => `
        <tr>
            <td class="text-nowrap">${formatearFecha(a.fecha)}</td>
            <td><span class="badge ${getBadgeClass(a.accion)}">${getIconAccion(a.accion)} ${a.accion}</span></td>
            <td><code>${a.usuario}</code></td>
            <td>${a.entidad} #${a.entidadId}</td>
            <td>${a.campoModificado || '<span class="text-muted">-</span>'}</td>
            <td>${a.valorAnterior ? `<code class="text-danger">${escapeHtml(a.valorAnterior)}</code>` : '<span class="text-muted">-</span>'}</td>
            <td>${a.valorNuevo ? `<code class="text-success">${escapeHtml(a.valorNuevo)}</code>` : '<span class="text-muted">-</span>'}</td>
        </tr>
    `).join('');
}

function renderPaginacion(totalPaginas, totalElementos) {
    const container = document.getElementById("paginacionContainer");
    const paginacion = document.getElementById("paginacion");
    const totalRegistros = document.getElementById("totalRegistros");
    
    if (!container || !paginacion) return;

    totalRegistros.textContent = `${totalElementos} registros`;
    container.style.display = "flex";

    if (totalPaginas <= 1) {
        paginacion.innerHTML = "";
        return;
    }

    let html = "";
    
    // Anterior
    html += `
        <li class="page-item ${paginaActual === 0 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual - 1})" aria-label="Anterior">
                <i class="fa-solid fa-chevron-left"></i>
            </a>
        </li>
    `;

    // Páginas
    const inicio = Math.max(0, paginaActual - 2);
    const fin = Math.min(totalPaginas - 1, paginaActual + 2);

    if (inicio > 0) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="cambiarPagina(0)">1</a></li>`;
        if (inicio > 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = inicio; i <= fin; i++) {
        html += `
            <li class="page-item ${i === paginaActual ? 'active' : ''}">
                <a class="page-link" href="#" onclick="cambiarPagina(${i})">${i + 1}</a>
            </li>
        `;
    }

    if (fin < totalPaginas - 1) {
        if (fin < totalPaginas - 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" onclick="cambiarPagina(${totalPaginas - 1})">${totalPaginas}</a></li>`;
    }

    // Siguiente
    html += `
        <li class="page-item ${paginaActual === totalPaginas - 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual + 1})" aria-label="Siguiente">
                <i class="fa-solid fa-chevron-right"></i>
            </a>
        </li>
    `;

    paginacion.innerHTML = html;
}

function cambiarPagina(nuevaPagina) {
    if (nuevaPagina < 0) return;
    paginaActual = nuevaPagina;
    cargarAuditoria();
}

function getBadgeClass(accion) {
    switch (accion) {
        case 'CREAR': return 'bg-success';
        case 'ACTUALIZAR': return 'bg-warning text-dark';
        case 'ELIMINAR': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function getIconAccion(accion) {
    switch (accion) {
        case 'CREAR': return '<i class="fa-solid fa-plus me-1"></i>';
        case 'ACTUALIZAR': return '<i class="fa-solid fa-pen me-1"></i>';
        case 'ELIMINAR': return '<i class="fa-solid fa-trash me-1"></i>';
        default: return '';
    }
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    try {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return fechaStr;
    }
}

function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Enter en filtros para buscar
document.getElementById("filtroUsuario")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        paginaActual = 0;
        cargarAuditoria();
    }
});