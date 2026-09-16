let idEditando = null;
const API_URL = "https://backendinventario-production-c5ef.up.railway.app/productos";

// Canal para notificar cambios a otras pestañas (dashboard)
const appChannel = new BroadcastChannel('inventario_updates');

function notificarCambioDatos() {
    appChannel.postMessage({ type: 'dataChanged', source: 'app', timestamp: Date.now() });
    console.log("📡 Notificación enviada: dataChanged (app)");
}

document.addEventListener("DOMContentLoaded", function () {
    const formulario = document.getElementById("formProducto");

    // 1. Obtener productos desde la API (GET) en el puerto 8080
    window.obtenerProductos = async function() {
        try {
            const respuesta = await fetch(API_URL);
            if (!respuesta.ok) {
                throw new Error("Error al conectar con la API en el puerto 8080");
            }
            return await respuesta.json();
        } catch (error) {
            console.error("No se pudo conectar al backend:", error);
            // Datos de respaldo por si el servidor no está encendido aún
            return [
                { codigo: "P001", nombre: "Teclado", categoria: "Tecnología", proveedor: "Tech Colombia", precio: 120000, cantidad: 10, stockMinimo: 3 },
                { codigo: "P002", nombre: "Mouse", categoria: "Tecnología", proveedor: "LogiTech", precio: 60000, cantidad: 2, stockMinimo: 5 }
            ];
        }
    };

    // 2. Función para renderizar la tabla y calcular totales
    window.mostrarProductos = async function() {
        const tabla = document.getElementById("tablaProductos");
        if (!tabla) return; 

        // Detectar si estamos en registrar.html (tiene formulario)
        const esRegistrar = document.getElementById("formProducto") !== null;

        let productos = await window.obtenerProductos();
        tabla.innerHTML = "";

        productos.forEach(function (producto) {
            let estadoHTML = "";
            if (producto.cantidad > 0) {
                estadoHTML = `<span class="badge bg-success">Disponible</span>`;
            } else {
                estadoHTML = `<span class="badge bg-danger">Agotado</span>`;
            }

            let alertaStock = "";
            if (producto.cantidad < producto.stockMinimo) {
                alertaStock = `<br><small class="text-danger fw-bold">⚠ Stock bajo (${producto.cantidad}/${producto.stockMinimo})</small>`;
            }

            const valorTotal = Number(producto.precio) * Number(producto.cantidad);

            const fila = `
                <tr>
                    <td>${producto.codigo}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.categoria || "General"}</td>
                    <td>${producto.proveedor || "N/A"}</td>
                    <td>$${Number(producto.precio).toLocaleString()}</td>
                    <td>${producto.cantidad} ${alertaStock}</td>
                    <td>${estadoHTML}</td>
                    <td>$${valorTotal.toLocaleString()}</td>
                    ${esRegistrar ? `
                    <td>
                        <button type="button" class="btn btn-warning btn-sm" onclick="editarProducto(${producto.id})">Editar</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                    </td>
                    ` : ''}
                </tr>
            `;
            tabla.innerHTML += fila;
        });

        // Total General usando reduce()
        const totalInventario = productos.reduce(function(total, producto) {
            return total + (Number(producto.precio) * Number(producto.cantidad));
        }, 0);

        const contenedorTotal = document.getElementById("contenedorTotalInventario");
        if (contenedorTotal) {
            contenedorTotal.textContent = `Valor total del inventario: $${totalInventario.toLocaleString()}`;
        }
    }

    // Cargar productos al iniciar la página
    window.mostrarProductos();

    // 3. Evento al enviar el formulario (Crear o Actualizar mediante API)
    if (formulario) {
        formulario.addEventListener("submit", async function (event) {
            event.preventDefault();

            const codigo = document.getElementById("codigo").value.trim();
            const nombre = document.getElementById("nombre").value.trim();
            const categoria = document.getElementById("categoria").value.trim();
            const proveedor = document.getElementById("proveedor").value.trim();
            const precio = parseFloat(document.getElementById("precio").value);
            const cantidad = parseInt(document.getElementById("cantidad").value);
            const stockMinimo = parseInt(document.getElementById("stockMinimo").value);
            // Validaciones locales
            if (codigo === "") { alert("Debe ingresar el código"); return; }
            if (!nombre) { alert("El nombre es obligatorio."); return; }
            if (!proveedor) { alert("El proveedor es obligatorio."); return; }
            if (precio <= 0 || isNaN(precio)) { alert("El precio debe ser mayor que cero"); return; }
            if (cantidad < 0 || isNaN(cantidad)) { alert("La cantidad no puede ser negativa"); return; }
            if (isNaN(stockMinimo) || stockMinimo < 0) { alert("El stock mínimo debe ser un número válido"); return; }

            const producto = { codigo, nombre, categoria, proveedor, precio, cantidad, stockMinimo };
            const botonGuardar = document.querySelector("#formProducto button[type='submit']");

            try {
                let url = API_URL;
                let metodo = "POST";

                // Si estamos editando, ajustamos la ruta y el método
                if (idEditando !== null) {
                    url = `${API_URL}/${idEditando}`;
                    metodo = "PUT";
                } else {
                    // Validar códigos repetidos si es nuevo
                    let productosActuales = await window.obtenerProductos();
                    const existe = productosActuales.some(p => p.codigo === codigo);
                    if (existe) {
                        alert("Ya existe un producto con ese código en el servidor");
                        return;
                    }
                }

                const respuesta = await fetch(url, {
                    method: metodo,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(producto)
                });

                if (!respuesta.ok) {
                    throw new Error("Error al guardar el producto en el servidor");
                }

                // Reiniciar estado de edición
                if (idEditando !== null) {
                    idEditando = null;
                    if (botonGuardar) {
                        botonGuardar.textContent = "Guardar Producto";
                    }
                }

                await window.mostrarProductos();
                formulario.reset();

                const mensajeExito = document.getElementById("mensajeExito");
                if (mensajeExito) {
                    mensajeExito.style.display = "block";
                    setTimeout(() => { mensajeExito.style.display = "none"; }, 3000);
                }

                // Notificar a otras pestañas (dashboard) que hay cambios
                notificarCambioDatos();

            } catch (error) {
                console.error("Error al enviar los datos:", error);
                alert("No se pudo conectar con el servidor (puerto 8080) para guardar el producto.");
            }
        });
    }
});

// 4. Función Eliminar (Global mediante API DELETE)
window.eliminarProducto = async function(id) {
    const confirmar = confirm("¿Está seguro de eliminar este producto?");
    if (!confirmar) return;

    try {
        const respuesta = await fetch(`http://localhost:8080/productos/${id}`, {
            method: "DELETE"
        });

        if (!respuesta.ok) {
            throw new Error("Error al eliminar el producto en el servidor");
        }

        if (typeof window.mostrarProductos === "function") {
            await window.mostrarProductos();
        }

        // Notificar a otras pestañas (dashboard) que hay cambios
        notificarCambioDatos();

    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo eliminar el producto del servidor en el puerto 8080.");
    }
}

// 5. Función Editar (Global para cargar datos en el formulario)
window.editarProducto = async function(id) {
    let productos = await window.obtenerProductos();
    const producto = productos.find(function(prod) {
        return prod.id === id;
    });

    if (!producto) return;

    idEditando = id;

    document.getElementById("codigo").value = producto.codigo;
    document.getElementById("nombre").value = producto.nombre;
    document.getElementById("categoria").value = producto.categoria;
    document.getElementById("proveedor").value = producto.proveedor || "";
    document.getElementById("precio").value = producto.precio;
    document.getElementById("cantidad").value = producto.cantidad;
    document.getElementById("stockMinimo").value = producto.stockMinimo || 0;

    const botonGuardar = document.querySelector("#formProducto button[type='submit']");
    if (botonGuardar) {
        botonGuardar.textContent = "Actualizar Producto";
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================================================
// BUSCAR PRODUCTO POR ID (GET /productos/{id})
// =========================================================================
window.buscarProductoPorId = async function() {
    const inputId = document.getElementById("buscarId");
    const id = inputId.value.trim();

    if (!id) {
        alert("Por favor ingresa un ID para buscar.");
        return;
    }

    try {
        // Hace la petición al endpoint con PathVariable de Spring Boot
        const respuesta = await fetch(`${API_URL}/${id}`);

        if (!respuesta.ok) {
            alert(`No se encontró ningún producto con el ID ${id}`);
            return;
        }

        const producto = await respuesta.json();
        const tabla = document.getElementById("tablaProductos");
        if (!tabla) return;

        // Si el endpoint devuelve null o un objeto vacío
        if (!producto || !producto.id) {
            alert(`No se encontró ningún producto con el ID ${id}`);
            return;
        }

        // Renderiza únicamente el producto encontrado en la tabla (misma estructura que la lista principal)
        const estadoHTML = producto.cantidad > 0
            ? `<span class="badge bg-success">Disponible</span>`
            : `<span class="badge bg-danger">Agotado</span>`;

        const valorTotal = Number(producto.precio) * Number(producto.cantidad);

        tabla.innerHTML = `
            <tr>
                <td class="fw-bold">${producto.codigo}</td>
                <td>${producto.nombre}</td>
                <td><span class="badge bg-secondary">${producto.categoria || 'N/A'}</span></td>
                <td>${producto.proveedor || 'N/A'}</td>
                <td class="text-success fw-bold">$${Number(producto.precio).toLocaleString()}</td>
                <td class="text-center">${producto.cantidad}</td>
                <td class="text-center">${estadoHTML}</td>
                <td class="text-end fw-bold">$${valorTotal.toLocaleString()}</td>
            </tr>
        `;
    } catch (error) {
        console.error("Error al buscar producto:", error);
        alert("Ocurrió un error al consultar el producto.");
    }
}

window.limpiarBusqueda = function() {
    const inputId = document.getElementById("buscarId");
    if (inputId) inputId.value = "";
    window.mostrarProductos(); // Vuelve a listar todos los productos de MySQL
}