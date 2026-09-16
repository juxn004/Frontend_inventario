/**
 * Dashboard - Sistema de Inventario
 * Consumo de API y renderizado de métricas, gráficos y alertas
 * Actualización en tiempo real via BroadcastChannel + Polling
 */

const API_URL = "https://backendinventario-production-c5ef.up.railway.app/productos";

let chartCategoria = null;
let pollingInterval = null;
const POLLING_INTERVAL_MS = 5000;

const dashboardChannel = new BroadcastChannel('inventario_updates');

document.addEventListener("DOMContentLoaded", async () => {
    console.log("📊 DASHBOARD.JS CARGADO - Tiempo real activado");
    await cargarDashboard();
    iniciarTiempoReal();
});

async function cargarDashboard() {
    try {
        console.log("🔄 Fetching:", API_URL);
        const respuesta = await fetch(API_URL);
        console.log("📡 Response status:", respuesta.status);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        
        const productos = await respuesta.json();
        console.log("📦 Productos recibidos:", productos.length, productos);
        
        if (!Array.isArray(productos)) {
            throw new Error("Respuesta no es un array");
        }
        
        renderDashboard(productos);

    } catch (error) {
        console.error("❌ Error cargando dashboard:", error);
        console.warn("⚠️ Usando datos de respaldo");
        renderDashboard(getMockData());
        mostrarErrorEnDashboard(error.message);
    }
}

function renderDashboard(productos) {
    try { renderKPIs(productos); } catch (e) { console.error("❌ renderKPIs:", e); }
    try { renderChartCategoria(productos); } catch (e) { console.error("❌ renderChartCategoria:", e); }
    try { renderTopProductos(productos); } catch (e) { console.error("❌ renderTopProductos:", e); }
    try { renderAlertas(productos); } catch (e) { console.error("❌ renderAlertas:", e); }
    try { renderUltimos(productos); } catch (e) { console.error("❌ renderUltimos:", e); }
}

function iniciarTiempoReal() {
    dashboardChannel.onmessage = (event) => {
        console.log("📨 BroadcastChannel recibió mensaje:", event.data);
        if (event.data.type === 'dataChanged') {
            console.log("🔄 Cambio detectado via BroadcastChannel:", event.data);
            cargarDashboard();
            mostrarNotificacion("Datos actualizados automáticamente", "info");
        }
    };
    
    console.log("📡 BroadcastChannel 'inventario_updates' escuchando...");

    pollingInterval = setInterval(async () => {
        try {
            const respuesta = await fetch(API_URL);
            if (respuesta.ok) {
                const productos = await respuesta.json();
                if (haHabidoCambios(productos)) {
                    console.log("🔄 Cambio detectado via Polling - hash cambió");
                    renderDashboard(productos);
                    mostrarNotificacion("Datos actualizados automáticamente", "info");
                } else {
                    console.log("📊 Polling: sin cambios detectados");
                }
            }
        } catch (error) {
            console.warn("⚠️ Polling falló:", error.message);
        }
    }, POLLING_INTERVAL_MS);

    console.log("✅ Tiempo real iniciado (BroadcastChannel + Polling 5s)");
}

let lastProductosHash = null;

function haHabidoCambios(productos) {
    const hash = productos
        .map(p => `${p.id}:${p.cantidad}:${p.stockMinimo || 5}`)
        .sort()
        .join('|');
    
    if (lastProductosHash === null) {
        lastProductosHash = hash;
        return false;
    }
    const changed = lastProductosHash !== hash;
    if (changed) {
        console.log("🔍 Hash cambió - anterior:", lastProductosHash.substring(0, 50), "... nuevo:", hash.substring(0, 50), "...");
    }
    lastProductosHash = hash;
    return changed;
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    console.log(`🔔 Mostrando notificación: ${mensaje} (${tipo})`);
    
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.cssText = 'z-index: 10000; pointer-events: none;';
        document.body.appendChild(toastContainer);
    }

    const toastId = 'toast-' + Date.now();
    const icons = {
        success: 'fa-circle-check text-success',
        info: 'fa-circle-info text-primary',
        warning: 'fa-triangle-exclamation text-warning',
        danger: 'fa-circle-exclamation text-danger'
    };
    const bgColors = {
        success: 'bg-success text-white',
        info: 'bg-primary text-white',
        warning: 'bg-warning text-dark',
        danger: 'bg-danger text-white'
    };

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast ${bgColors[tipo] || bgColors.info} align-items-center shadow-lg`;
    toast.style.cssText = 'pointer-events: auto; min-width: 300px;';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fa-solid ${icons[tipo] || icons.info} me-2"></i>${mensaje}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
        </div>
    `;
    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 4000 });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
    console.log(`✅ Toast mostrado: ${toastId}`);
}

window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval);
    dashboardChannel.close();
});

function renderKPIs(productos) {
    const total = productos.length;
    const disponibles = productos.filter(p => p.cantidad > 0).length;
    const agotados = productos.filter(p => p.cantidad === 0).length;
    
    // Debug: log cada producto para ver stockBajo
    const stockBajoItems = productos.filter(p => p.cantidad > 0 && p.cantidad <= (p.stockMinimo || 5));
    console.log("🔍 Stock bajo items:", stockBajoItems.map(p => ({ 
        id: p.id, 
        nombre: p.nombre, 
        cantidad: p.cantidad, 
        stockMinimo: p.stockMinimo,
        esBajo: p.cantidad <= (p.stockMinimo || 5)
    })));
    
    const stockBajo = stockBajoItems.length;
    const valorTotal = productos.reduce((sum, p) => sum + (Number(p.precio) * Number(p.cantidad)), 0);
    
    const categoriasUnicas = new Set(productos.map(p => p.categoria || 'Sin categoría')).size;
    const proveedoresUnicos = new Set(productos.map(p => p.proveedor || 'Sin proveedor')).size;

    animateValue('kpi-total', 0, total, 800);
    animateValue('kpi-disponibles', 0, disponibles, 800);
    animateValue('kpi-stock-bajo', 0, stockBajo, 800);
    animateValue('kpi-agotados', 0, agotados, 800);
    animateValue('kpi-valor-total', 0, valorTotal, 800, true);
    animateValue('kpi-categorias', 0, categoriasUnicas, 800);
    animateValue('kpi-proveedores', 0, proveedoresUnicos, 800);
}

function animateValue(id, start, end, duration, isCurrency = false) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * eased;
        
        if (isCurrency) {
            element.textContent = '$' + Math.floor(current).toLocaleString('es-CO');
        } else {
            element.textContent = Math.floor(current).toLocaleString('es-CO');
        }
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function renderChartCategoria(productos) {
    if (typeof Chart === 'undefined') {
        console.warn("⚠️ Chart.js no cargado aún, reintentando en 500ms...");
        setTimeout(() => renderChartCategoria(productos), 500);
        return;
    }
    
    const ctx = document.getElementById('chartCategoria');
    if (!ctx) return;

    const categorias = {};
    productos.forEach(p => {
        const cat = p.categoria || 'Sin categoría';
        categorias[cat] = (categorias[cat] || 0) + Number(p.cantidad);
    });

    const labels = Object.keys(categorias);
    const data = Object.values(categorias);
    const colors = [
        'rgba(13, 110, 253, 0.8)',
        'rgba(25, 135, 84, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(220, 53, 69, 0.8)',
        'rgba(13, 202, 240, 0.8)',
        'rgba(108, 117, 125, 0.8)',
        'rgba(111, 66, 193, 0.8)',
        'rgba(253, 126, 20, 0.8)'
    ];

    if (chartCategoria) {
        chartCategoria.destroy();
    }

    chartCategoria = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });

    const legendContainer = document.getElementById('categoria-legend');
    if (legendContainer) {
        legendContainer.innerHTML = labels.map((label, i) => `
            <span class="badge me-2 mb-2" style="background-color: ${colors[i]}; font-size: 0.85rem;">
                <i class="fa-solid fa-circle me-1"></i> ${label}: ${data[i].toLocaleString()}
            </span>
        `).join(' ');
    }
}

function renderTopProductos(productos) {
    const tbody = document.getElementById('topProductosBody');
    if (!tbody) return;

    const top5 = productos
        .map(p => ({ ...p, valorTotal: Number(p.precio) * Number(p.cantidad) }))
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, 5);

    if (top5.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Sin productos</td></tr>';
        return;
    }

    tbody.innerHTML = top5.map((p, i) => `
        <tr>
            <td><span class="badge bg-primary">${i + 1}</span></td>
            <td><strong>${p.nombre}</strong><br><small class="text-muted">${p.codigo}</small></td>
            <td class="text-end fw-bold text-success">$${p.valorTotal.toLocaleString('es-CO')}</td>
        </tr>
    `).join('');
}

function renderAlertas(productos) {
    const container = document.getElementById('alertas-container');
    const countEl = document.getElementById('alertas-count');
    if (!container) return;

    const alertas = productos
        .filter(p => p.cantidad > 0 && p.cantidad <= (p.stockMinimo || 5))
        .sort((a, b) => a.cantidad - b.cantidad);

    console.log("🔍 Alertas stock bajo:", alertas.map(p => ({ 
        id: p.id, 
        nombre: p.nombre, 
        cantidad: p.cantidad, 
        stockMinimo: p.stockMinimo 
    })));

    if (countEl) {
        countEl.textContent = alertas.length;
        countEl.className = alertas.length > 0 ? 'badge bg-warning text-dark' : 'badge bg-success';
    }

    if (alertas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fa-solid fa-check-circle fa-3x text-success mb-2"></i>
                <p class="mb-0">No hay alertas de stock bajo</p>
            </div>
        `;
        return;
    }

    container.innerHTML = alertas.map(p => `
        <div class="alert alert-warning alert-dismissible fade show py-2 mb-2" role="alert">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${p.nombre}</strong> (${p.codigo})
                    <br><small class="text-muted">${p.categoria || 'Sin categoría'}</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-danger fs-6">${p.cantidad} und</span>
                    <br><small class="text-muted">Mín: ${p.stockMinimo || 5}</small>
                </div>
            </div>
        </div>
    `).join('');
}

function renderUltimos(productos) {
    const tbody = document.getElementById('ultimosBody');
    if (!tbody) return;

    const ultimos = [...productos]
        .sort((a, b) => (b.id || 0) - (a.id || 0))
        .slice(0, 5);

    if (ultimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin productos</td></tr>';
        return;
    }

    tbody.innerHTML = ultimos.map(p => `
        <tr>
            <td><code>${p.codigo}</code></td>
            <td>${p.nombre}</td>
            <td class="text-end">$${Number(p.precio).toLocaleString('es-CO')}</td>
            <td class="text-center">
                <span class="badge ${p.cantidad > 5 ? 'bg-success' : (p.cantidad > 0 ? 'bg-warning text-dark' : 'bg-danger')}">
                    ${p.cantidad}
                </span>
            </td>
        </tr>
    `).join('');
}

function mostrarErrorEnDashboard(mensaje) {
    const sections = ['kpi-cards', 'kpi-economicos'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<div class="alert alert-danger">Error: ${mensaje}</div>`;
    });
}

function getMockData() {
    return [
        { id: 1, codigo: "P001", nombre: "Teclado Mecánico", categoria: "Tecnología", proveedor: "Tecno SAS", precio: 120000, cantidad: 10, stockMinimo: 5 },
        { id: 2, codigo: "P002", nombre: "Mouse Ergonómico", categoria: "Tecnología", proveedor: "Tecno SAS", precio: 60000, cantidad: 15, stockMinimo: 5 },
        { id: 3, codigo: "P003", nombre: "Monitor 24 IPS", categoria: "Tecnología", proveedor: "Global Tech", precio: 850000, cantidad: 4, stockMinimo: 5 },
        { id: 4, codigo: "P004", nombre: "Impresora Láser", categoria: "Tecnología", proveedor: "Distribuidora ABC", precio: 650000, cantidad: 0, stockMinimo: 2 },
        { id: 5, codigo: "P005", nombre: "Memoria USB 64GB", categoria: "Accesorios", proveedor: "Tecno SAS", precio: 45000, cantidad: 20, stockMinimo: 10 },
        { id: 6, codigo: "P006", nombre: "Silla Gamer", categoria: "Muebles", proveedor: "ErgoDesign", precio: 450000, cantidad: 3, stockMinimo: 2 },
        { id: 7, codigo: "P007", nombre: "Webcam HD", categoria: "Tecnología", proveedor: "Logitech", precio: 180000, cantidad: 8, stockMinimo: 5 }
    ];
}