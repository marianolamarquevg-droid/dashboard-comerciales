// Initialize Lucide icons
lucide.createIcons();

// State
let rawGlobalData = [];
let globalData = [];
let currentView = 'dashboard';

// IndexedDB Persistence
const DB_NAME = 'SalesDB_v4';
const STORE_NAME = 'salesStore';

function saveToDB(data) {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
    request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: 1, data: data });
    };
}

function updateMonthFilter() {
    let allMonthsSet = new Set(rawGlobalData.map(d => d.mes));
    const monthSelect = document.getElementById('monthFilter');
    monthSelect.innerHTML = '<option value="ALL">Todos los Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_2">Últimos 2 Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_3">Últimos 3 Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_6">Últimos 6 Meses</option>';
    Array.from(allMonthsSet).sort().forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${m}</option>`;
    });
    monthSelect.classList.remove('hidden');
}

function loadFromDB() {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
    request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) return;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(1);
        getReq.onsuccess = () => {
            if (getReq.result && getReq.result.data && getReq.result.data.length > 0) {
                rawGlobalData = getReq.result.data;
                globalData = [...rawGlobalData];
                updateMonthFilter();
                dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
                dataStatus.className = 'status-badge loaded';
                document.getElementById('btnClearData').classList.remove('hidden');
                document.getElementById('btnExportRemote').classList.remove('hidden');
                uploadOverlay.classList.add('hidden');
                views[currentView].classList.remove('hidden');
                renderDashboard();
            }
        };
    };
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromDB();
    checkRemoteData(); // Nueva función para buscar datos en la nube
    const btnClear = document.getElementById('btnClearData');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if(confirm('¿Estás seguro de que deseas borrar todos los datos cargados?')) {
                rawGlobalData = [];
                globalData = [];
                const request = indexedDB.open(DB_NAME, 1);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.clear();
                };
                document.getElementById('monthFilter').classList.add('hidden');
                btnClear.classList.add('hidden');
                dataStatus.textContent = 'Esperando datos...';
                dataStatus.className = 'status-badge empty';
                uploadOverlay.classList.remove('hidden');
                document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
                document.querySelector(`[data-view="dashboard"]`).classList.add('active');
                Object.values(views).forEach(v => v.classList.add('hidden'));
            }
        });
    }

    const btnExport = document.getElementById('btnExportRemote');
    if (btnExport) {
        btnExport.addEventListener('click', exportDataForMobile);
    }
});

// Nueva función para buscar datos en el servidor (GitHub Pages)
async function checkRemoteData() {
    try {
        const response = await fetch('./data.json?t=' + new Date().getTime()); // Evitar caché
        if (response.ok) {
            const remoteData = await response.json();
            if (remoteData && remoteData.length > 0) {
                console.log('Datos remotos encontrados:', remoteData.length);
                // Si encontramos datos remotos, los usamos y limpiamos IndexedDB para evitar conflictos
                rawGlobalData = remoteData;
                globalData = [...rawGlobalData];
                updateMonthFilter();
                dataStatus.textContent = `Datos Sincronizados (${globalData.length} filas)`;
                dataStatus.className = 'status-badge loaded';
                uploadOverlay.classList.add('hidden');
                document.getElementById('btnClearData').classList.remove('hidden');
                document.getElementById('btnExportRemote').classList.remove('hidden');
                views[currentView].classList.remove('hidden');
                renderDashboard();
                saveToDB(rawGlobalData);
            }
        }
    } catch (err) {
        console.log('No hay datos remotos o error al cargarlos:', err);
    }
}

// Nueva función para exportar datos procesados a JSON
function exportDataForMobile() {
    if (rawGlobalData.length === 0) return;
    
    const dataStr = JSON.stringify(rawGlobalData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('Archivo data.json descargado. Súbelo a tu repositorio de GitHub para actualizar a los comerciales.');
}

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadOverlay = document.getElementById('uploadOverlay');
const uploadBox = document.querySelector('.upload-box');
const dataStatus = document.getElementById('data-status');
const views = {
    dashboard: document.getElementById('dashboardView'),
    'client-search': document.getElementById('clientSearchView'),
    route: document.getElementById('routeView')
};

// Nav links
document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        switchView(view);
    });
});

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    Object.values(views).forEach(v => v.classList.add('hidden'));
    
    if (globalData.length > 0) {
        uploadOverlay.classList.add('hidden');
        views[viewName].classList.remove('hidden');
    } else {
        uploadOverlay.classList.remove('hidden');
    }
}

// Drag & Drop Handlers
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.remove('dragover'), false);
});

uploadBox.addEventListener('drop', (e) => {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
});

fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        dataStatus.textContent = 'Procesando...';
        dataStatus.className = 'status-badge empty';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            processExcel(data);
        };
        reader.readAsArrayBuffer(file);
    }
}

function normalizeHeader(header) {
    if (!header) return '';
    return header.toString().toLowerCase().trim().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u');
}

function findCol(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        const h = normalizeHeader(headers[i]);
        for (let name of possibleNames) {
            if (h.includes(name)) return i;
        }
    }
    return -1;
}

function processExcel(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length < 2) throw new Error("El archivo está vacío o no tiene encabezados.");

        const headers = jsonData[0];
        
        // Columnas estáticas pedidas por el usuario (0-indexed: A=0, B=1, C=2... O=14, P=15, S=18)
        const colId = 14;      // Columna O: Cod Cliente
        const colCliente = 15; // Columna P: Razón Social
        const colProd = 2;     // Columna C: Descripcion (del producto)
        const colTransporte = 18; // Columna S: Ruta
        
        // Columnas que seguimos buscando por nombre (si no las detecta bien, las pediremos luego)
        const colLoc = findCol(headers, ['localidad', 'ciudad', 'provincia']);
        const colCant = findCol(headers, ['cantidad', 'cant']);
        const colFact = findCol(headers, ['facturacion', 'facturación', 'monto', 'total', 'importe', 'sin iva']);
        const colFecha = findCol(headers, ['fecha', 'emision', 'mes']);
        const colFactura = 8; // Columna I: Nro Comprobante

        let validData = [];
        let monthsSet = new Set();
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const transporteRaw = (row[colTransporte] || '').toString().trim();
            let nombreRuta = '';
            
            // Valores en columna S: 08 (Sur 1), 06 (Sur 2), 11 (Valles)
            if (transporteRaw === '08' || transporteRaw === '8') {
                nombreRuta = 'Sur 1';
            } else if (transporteRaw === '06' || transporteRaw === '6') {
                nombreRuta = 'Sur 2';
            } else if (transporteRaw === '11') {
                nombreRuta = 'Valles';
            }
            
            if (nombreRuta !== '') {
                let fechaRaw = row[colFecha];
                let mes = 'Desconocido';
                if (fechaRaw) {
                    if (typeof fechaRaw === 'number') {
                        const d = new Date((fechaRaw - (25567 + 2)) * 86400 * 1000);
                        mes = d.toISOString().substring(0, 7);
                    } else {
                        mes = String(fechaRaw).substring(0, 7);
                    }
                }

                monthsSet.add(mes);

                validData.push({
                    transporte: nombreRuta,
                    id_cliente: colId >= 0 ? String(row[colId]) : 'S/ID',
                    cliente: colCliente >= 0 ? String(row[colCliente]) : 'Cliente Desconocido',
                    localidad: colLoc >= 0 ? String(row[colLoc]) : 'S/D',
                    producto: colProd >= 0 ? String(row[colProd]) : 'Producto Gral',
                    cantidad: colCant >= 0 ? parseFloat(row[colCant]) || 0 : 1,
                    facturacion: colFact >= 0 ? parseFloat(row[colFact]) || 0 : 0,
                    mes: mes,
                    factura: colFactura >= 0 ? String(row[colFactura]) : 'S/F',
                    fecha_raw: fechaRaw || 'S/F'
                });
            }
        }

        // Merge with existing data
        rawGlobalData = [...rawGlobalData, ...validData];
        globalData = [...rawGlobalData];
        
        saveToDB(rawGlobalData);
        
        if (globalData.length === 0) {
            alert("No se encontraron registros en la Columna S con los valores 08, 06 o 11.");
            dataStatus.textContent = 'Sin datos compatibles';
            return;
        }

        updateMonthFilter();

        dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
        dataStatus.className = 'status-badge loaded';
        document.getElementById('btnClearData').classList.remove('hidden');
        document.getElementById('btnExportRemote').classList.remove('hidden');
        
        uploadOverlay.classList.add('hidden');
        views[currentView].classList.remove('hidden');
        
        renderDashboard();
        
    } catch (e) {
        console.error(e);
        alert("Error al procesar el archivo Excel. Revisa el formato.");
        dataStatus.textContent = 'Error';
        dataStatus.className = 'status-badge empty';
    }
}

// Formatting helpers
const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('es-AR').format(val);

// Chart Instances
let clientHistoryChartInst = null;
let monthlyRevenueChartInst = null;
let routeRevenueChartInst = null;

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

function renderDashboard() {
    let totalRevenue = 0;
    let totalItems = 0;
    let clients = new Set();
    let routeStats = {};
    let clientStats = {};
    let prodStats = {};

    globalData.forEach(row => {
        totalRevenue += row.facturacion;
        totalItems += row.cantidad;
        clients.add(row.id_cliente);

        // Rutas
        let r = row.transporte;
        routeStats[r] = (routeStats[r] || 0) + row.facturacion;

        // Cliente Stats (para mejor cliente)
        if (!clientStats[row.cliente]) clientStats[row.cliente] = 0;
        clientStats[row.cliente] += row.facturacion;

        // Productos Stats (para producto estrella)
        if (!prodStats[row.producto]) prodStats[row.producto] = 0;
        prodStats[row.producto] += row.cantidad;
    });

    // Update KPIs
    document.getElementById('kpiTotalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpiTotalClients').textContent = clients.size;
    document.getElementById('kpiTotalItems').textContent = formatNumber(totalItems);
    
    let topRoute = Object.entries(routeStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopRoute').textContent = topRoute ? topRoute[0] : '-';

    let topClient = Object.entries(clientStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopClient').textContent = topClient ? topClient[0] : '-';

    let topProduct = Object.entries(prodStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopProduct').textContent = topProduct ? topProduct[0] : '-';

    // Main Detailed Table
    const tb = document.querySelector('#mainDetailTable tbody');
    tb.innerHTML = '';
    
    // Group by Client and Product
    let groupedData = {};
    let routeClientStats = {};
    let allProdStats = {}; // para la tabla de tendencia de productos
    
    // Determine current and prev month for product trend
    let allGlobalMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    const globalMonthFilter = document.getElementById('monthFilter').value;
    let currentMonth = globalMonthFilter !== 'ALL' ? globalMonthFilter : allGlobalMonths[allGlobalMonths.length - 1];
    let prevMonth = '';
    const currentIndex = allGlobalMonths.indexOf(currentMonth);
    if (currentIndex > 0) prevMonth = allGlobalMonths[currentIndex - 1];

    rawGlobalData.forEach(row => {
        // Para productos (comparando meses)
        if (!allProdStats[row.producto]) allProdStats[row.producto] = { current: 0, prev: 0, clients: {} };
        
        let clientKey = row.cliente;
        if (!allProdStats[row.producto].clients[clientKey]) {
            allProdStats[row.producto].clients[clientKey] = { current: 0, prev: 0 };
        }
        
        if (row.mes === currentMonth) {
            allProdStats[row.producto].current += row.cantidad;
            allProdStats[row.producto].clients[clientKey].current += row.cantidad;
        }
        if (row.mes === prevMonth) {
            allProdStats[row.producto].prev += row.cantidad;
            allProdStats[row.producto].clients[clientKey].prev += row.cantidad;
        }
    });

    globalData.forEach(row => {
        // Para Main Table
        let key = row.id_cliente + '|' + row.producto;
        if (!groupedData[key]) {
            groupedData[key] = {
                id: row.id_cliente,
                cliente: row.cliente,
                ruta: row.transporte,
                producto: row.producto,
                cantidad: 0,
                total: 0
            };
        }
        groupedData[key].cantidad += row.cantidad;
        groupedData[key].total += row.facturacion;

        // Para Top Clientes por Ruta
        let routeKey = row.transporte;
        if (!routeClientStats[routeKey]) routeClientStats[routeKey] = {};
        if (!routeClientStats[routeKey][row.cliente]) routeClientStats[routeKey][row.cliente] = 0;
        routeClientStats[routeKey][row.cliente] += row.facturacion;
    });

    let tableRows = Object.values(groupedData).sort((a, b) => b.total - a.total);

    tableRows.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background:rgba(59, 130, 246, 0.1); color:var(--primary)">${item.id}</span></td>
            <td style="font-weight:500;">${item.cliente}</td>
            <td>${item.ruta}</td>
            <td>${item.producto}</td>
            <td>${formatNumber(item.cantidad)}</td>
            <td style="font-weight:600; color:var(--success)">${formatCurrency(item.total)}</td>
        `;
        tb.appendChild(tr);
    });

    // Renderizar Top 10 Clientes por Ruta
    const tbRouteClients = document.querySelector('#topClientsRouteTable tbody');
    tbRouteClients.innerHTML = '';
    
    let routeClientList = [];
    for (let route in routeClientStats) {
        let clientsInRoute = Object.entries(routeClientStats[route]).sort((a,b) => b[1]-a[1]).slice(0, 10);
        clientsInRoute.forEach(clientArr => {
             routeClientList.push({ route: route, client: clientArr[0], val: clientArr[1] });
        });
    }
    routeClientList.sort((a,b) => a.route.localeCompare(b.route) || b.val - a.val).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">${item.route}</td>
            <td>${item.client}</td>
            <td style="font-weight: 600; color:var(--primary)">${formatCurrency(item.val)}</td>
        `;
        tbRouteClients.appendChild(tr);
    });

    // Renderizar Productos (Tendencia)
    const tbProd = document.querySelector('#productsTrendTable tbody');
    tbProd.innerHTML = '';
    
    let prodList = Object.entries(allProdStats).map(([p, data]) => {
        return { name: p, current: data.current, prev: data.prev, clients: data.clients };
    }).sort((a,b) => b.current - a.current);

    window.productDropData = {}; // Store for modal

    prodList.forEach(item => {
        const tr = document.createElement('tr');
        let trendHtml = '-';
        if (item.prev > 0) {
            let trend = ((item.current - item.prev) / item.prev) * 100;
            if (trend > 0) trendHtml = `<span style="color:var(--success)">+${trend.toFixed(1)}% <i data-lucide="arrow-up" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
            else if (trend < 0) trendHtml = `<span style="color:var(--danger)">${trend.toFixed(1)}% <i data-lucide="arrow-down" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
        } else if (item.current > 0 && item.prev === 0) {
            trendHtml = `<span style="color:var(--success)">Nuevo <i data-lucide="arrow-up" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
        } else if (item.current === 0 && item.prev > 0) {
            trendHtml = `<span style="color:var(--danger)">Sin ventas <i data-lucide="arrow-down" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
        }

        let droppingClients = [];
        for (let c in item.clients) {
            let cData = item.clients[c];
            if (cData.prev > 0 && cData.current < cData.prev) {
                droppingClients.push({ client: c, prev: cData.prev, current: cData.current, diff: cData.current - cData.prev });
            }
        }
        droppingClients.sort((a,b) => a.diff - b.diff); // largest drop first
        
        let actionHtml = '';
        if (droppingClients.length > 0) {
            window.productDropData[item.name] = droppingClients;
            actionHtml = `<button onclick="showProductDropModal('${item.name.replace(/'/g, "\\'")}')" class="btn-icon" style="background:none; border:none; color:var(--warning); cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Ver clientes que dejaron de comprar"><i data-lucide="users" style="width:16px;height:16px;"></i></button>`;
        }

        tr.innerHTML = `
            <td>${actionHtml}</td>
            <td style="font-weight: 500;">${item.name}</td>
            <td>${formatNumber(item.current)}</td>
            <td>${trendHtml}</td>
        `;
        tbProd.appendChild(tr);
    });

    // Renderizar Gráficos
    renderCharts(routeStats);

    lucide.createIcons();
}

function renderCharts(routeStats) {
    // Evolución de Facturación Mensual (Líneas)
    let revByMonth = {};
    rawGlobalData.forEach(r => {
        revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion;
    });
    
    let months = Object.keys(revByMonth).sort();
    let revData = months.map(m => revByMonth[m]);

    if (monthlyRevenueChartInst) monthlyRevenueChartInst.destroy();
    monthlyRevenueChartInst = new Chart(document.getElementById('monthlyRevenueChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Facturación ($)',
                data: revData,
                borderColor: '#10b981', // success color
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Facturación por Ruta (Anillos)
    let routeLabels = Object.keys(routeStats);
    let routeData = Object.values(routeStats);

    if (routeRevenueChartInst) routeRevenueChartInst.destroy();
    routeRevenueChartInst = new Chart(document.getElementById('routeRevenueChart'), {
        type: 'doughnut',
        data: {
            labels: routeLabels,
            datasets: [{
                data: routeData,
                backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: { color: '#f8fafc' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                let total = context.dataset.data.reduce((a, b) => a + b, 0);
                                let percentage = ((context.parsed * 100) / total).toFixed(1) + '%';
                                label += formatCurrency(context.parsed) + ' (' + percentage + ')';
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}



// Client Search View
document.getElementById('btnSearchClient').addEventListener('click', searchClient);
document.getElementById('clientSearchInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') searchClient();
});

function searchClient() {
    const term = document.getElementById('clientSearchInput').value.toLowerCase().trim();
    if (!term) return;

    const clientRows = globalData.filter(r => String(r.id_cliente).toLowerCase().includes(term) || r.cliente.toLowerCase().includes(term));
    
    if (clientRows.length === 0) {
        document.getElementById('clientEmptyState').classList.remove('hidden');
        document.getElementById('clientDetails').classList.add('hidden');
        document.getElementById('clientEmptyState').innerHTML = `<i data-lucide="search-x"></i><p>No se encontraron compras para el cliente: <b>${term}</b></p>`;
        lucide.createIcons();
        return;
    }

    document.getElementById('clientEmptyState').classList.add('hidden');
    document.getElementById('clientDetails').classList.remove('hidden');

    // Aggregate client data
    const info = clientRows[0];
    document.getElementById('cdName').textContent = info.cliente;
    document.getElementById('cdId').textContent = info.id_cliente;
    document.getElementById('cdLocation').innerHTML = `<i data-lucide="map-pin"></i> ${info.localidad}`;

    let totalRev = 0;
    let monthStats = {};
    let prodStats = {};
    let invoices = new Set();

    clientRows.forEach(r => {
        totalRev += r.facturacion;
        monthStats[r.mes] = (monthStats[r.mes] || 0) + r.facturacion;
        
        let invoiceKey = '';
        if (r.factura && r.factura !== 'S/F' && r.factura.trim() !== '') {
            invoiceKey = r.factura;
        } else if (r.fecha_raw && r.fecha_raw !== 'S/F') {
            invoiceKey = r.fecha_raw;
        } else {
            invoiceKey = 'row_' + Math.random();
        }
        invoices.add(invoiceKey);
        
        if (!prodStats[r.producto]) prodStats[r.producto] = { qty: 0, byMonth: {}, lastMonth: '' };
        prodStats[r.producto].qty += r.cantidad;
        if (!prodStats[r.producto].byMonth[r.mes]) prodStats[r.producto].byMonth[r.mes] = 0;
        prodStats[r.producto].byMonth[r.mes] += r.cantidad;
        
        if (r.mes > prodStats[r.producto].lastMonth) prodStats[r.producto].lastMonth = r.mes;
    });

    document.getElementById('cdTotal').textContent = formatCurrency(totalRev);
    let avgTicket = invoices.size > 0 ? totalRev / invoices.size : 0;
    document.getElementById('cdAverageTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('cdMixProductos').textContent = Object.keys(prodStats).length;

    // Chart
    const months = Object.keys(monthStats).sort();
    const revData = months.map(m => monthStats[m]);

    if (clientHistoryChartInst) clientHistoryChartInst.destroy();
    clientHistoryChartInst = new Chart(document.getElementById('clientHistoryChart'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Compras',
                data: revData,
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Extract last 6 months globally
    let allGlobalMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    let last6Months = allGlobalMonths.slice(-6);

    // Update table header
    const thd = document.getElementById('clientProductsTableHead');
    let thHtml = '<tr><th>Producto</th>';
    last6Months.forEach(m => {
        thHtml += `<th>${m}</th>`;
    });
    thHtml += '<th>Total 6 Meses</th></tr>';
    thd.innerHTML = thHtml;

    // Products table
    const tb = document.querySelector('#clientProductsTable tbody');
    tb.innerHTML = '';
    
    Object.keys(prodStats).sort((a,b) => prodStats[b].qty - prodStats[a].qty).forEach(p => {
        const tr = document.createElement('tr');
        
        let total6m = 0;
        let lastMonthInRecord = last6Months[last6Months.length - 1];
        let boughtInLastMonth = (prodStats[p].byMonth[lastMonthInRecord] || 0) > 0;
        let boughtBefore = false;

        let cellsHtml = '';
        last6Months.forEach(m => {
            let q = prodStats[p].byMonth[m] || 0;
            total6m += q;
            if (m !== lastMonthInRecord && q > 0) boughtBefore = true;
            if (q === 0) {
                 cellsHtml += `<td style="color: var(--text-muted); opacity: 0.5;">-</td>`;
            } else {
                 cellsHtml += `<td>${formatNumber(q)}</td>`;
            }
        });

        let alertHtml = '';
        if (boughtBefore && !boughtInLastMonth) {
            alertHtml = ` <span title="Dejó de comprar este producto en el último mes" class="badge" style="background:rgba(245, 158, 11, 0.2); color:var(--warning); padding: 0.1rem 0.3rem;"><i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
        }

        tr.innerHTML = `<td style="font-weight: 500;">${p}${alertHtml}</td>${cellsHtml}<td style="font-weight:600; color:var(--primary)">${formatNumber(total6m)}</td>`;
        tb.appendChild(tr);
    });

    lucide.createIcons();
}

// Add event listener for the month filter
document.getElementById('monthFilter').addEventListener('change', (e) => {
    const selectedMonth = e.target.value;
    if (selectedMonth === 'ALL') {
        globalData = [...rawGlobalData];
    } else if (selectedMonth.startsWith('LAST_')) {
        const count = parseInt(selectedMonth.split('_')[1]);
        let allMonths = Array.from(new Set(rawGlobalData.map(r => r.mes))).sort();
        let targetMonths = allMonths.slice(-count);
        globalData = rawGlobalData.filter(r => targetMonths.includes(r.mes));
    } else {
        globalData = rawGlobalData.filter(r => r.mes === selectedMonth);
    }
    renderDashboard();
    
    // Also update client search view if it's currently open and a client was searched
    if (currentView === 'client-search' && document.getElementById('clientSearchInput').value.trim() !== '') {
        searchClient();
    }
    
    if (currentView === 'route') {
        renderRouteAnalysis();
    }
});

// Override switchView to render Route Analysis when clicking the nav link
const originalSwitchView = switchView;
switchView = function(viewName) {
    originalSwitchView(viewName);
    if (viewName === 'route') {
        renderRouteAnalysis();
    }
};

// Route Analysis View
document.getElementById('routeSelector').addEventListener('change', renderRouteAnalysis);

function renderRouteAnalysis() {
    if (rawGlobalData.length === 0) return;
    
    const selectedRoute = document.getElementById('routeSelector').value;
    
    // Determine the "Current Month" to analyze.
    // If a specific month is selected in the global filter, use that.
    // Otherwise, use the latest month available in the dataset.
    const globalMonthFilter = document.getElementById('monthFilter').value;
    let allGlobalMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    
    let currentMonth = globalMonthFilter !== 'ALL' ? globalMonthFilter : allGlobalMonths[allGlobalMonths.length - 1];
    
    // Find the previous month in the dataset
    let prevMonth = '';
    const currentIndex = allGlobalMonths.indexOf(currentMonth);
    if (currentIndex > 0) {
        prevMonth = allGlobalMonths[currentIndex - 1];
    }
    
    // Group client revenue by month for the selected route
    let clientRev = {};
    
    rawGlobalData.forEach(r => {
        if (r.transporte === selectedRoute && (r.mes === currentMonth || r.mes === prevMonth)) {
            if (!clientRev[r.cliente]) {
                clientRev[r.cliente] = { current: 0, prev: 0 };
            }
            if (r.mes === currentMonth) clientRev[r.cliente].current += r.facturacion;
            if (r.mes === prevMonth) clientRev[r.cliente].prev += r.facturacion;
        }
    });
    
    // Convert to array and sort by current month revenue (Ranking)
    let ranking = Object.keys(clientRev).map(clientName => {
        return {
            name: clientName,
            current: clientRev[clientName].current,
            prev: clientRev[clientName].prev
        };
    }).sort((a, b) => b.current - a.current);
    
    const tb = document.querySelector('#routeClientsTable tbody');
    tb.innerHTML = '';
    
    ranking.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        let trend = 0;
        let trendHtml = '-';
        let statusHtml = '<span class="badge" style="background:rgba(148, 163, 184, 0.2); color:var(--text-muted)">Sin cambios</span>';
        
        if (item.prev > 0) {
            trend = ((item.current - item.prev) / item.prev) * 100;
            if (trend > 0) {
                trendHtml = `<span style="color:var(--success)">+${trend.toFixed(1)}%</span>`;
                statusHtml = '<span class="badge" style="background:rgba(16, 185, 129, 0.2); color:var(--success)">En alza <i data-lucide="trending-up" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>';
            } else if (trend < 0) {
                trendHtml = `<span style="color:var(--danger)">${trend.toFixed(1)}%</span>`;
                statusHtml = '<span class="badge" style="background:rgba(239, 68, 68, 0.2); color:var(--danger)">En baja <i data-lucide="trending-down" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>';
            }
        } else if (item.current > 0 && item.prev === 0) {
            trendHtml = `<span style="color:var(--success)">Nuevo/Recuperado</span>`;
            statusHtml = '<span class="badge" style="background:rgba(16, 185, 129, 0.2); color:var(--success)">En alza <i data-lucide="trending-up" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>';
        }
        
        tr.innerHTML = `
            <td><strong>#${index + 1}</strong></td>
            <td style="font-weight: 500;">${item.name}</td>
            <td style="font-weight: 600; color:var(--text-main)">${formatCurrency(item.current)}</td>
            <td style="color:var(--text-muted)">${formatCurrency(item.prev)}</td>
            <td>${trendHtml}</td>
            <td>${statusHtml}</td>
        `;
        tb.appendChild(tr);
    });
    
    lucide.createIcons();
}

// Modal Handlers
window.showProductDropModal = function(productName) {
    const data = window.productDropData[productName] || [];
    document.getElementById('modalProductTitle').textContent = `Bajas: ${productName}`;
    const tb = document.querySelector('#productDropTable tbody');
    tb.innerHTML = '';
    
    data.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">${d.client}</td>
            <td>${formatNumber(d.prev)}</td>
            <td>${formatNumber(d.current)}</td>
            <td style="color: var(--danger); font-weight: 600;">${formatNumber(d.diff)}</td>
        `;
        tb.appendChild(tr);
    });
    
    document.getElementById('productDropModal').classList.remove('hidden');
    lucide.createIcons();
};

document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('productDropModal').classList.add('hidden');
});

// Presentation Modal Handlers
document.getElementById('btnClosePresentation').addEventListener('click', () => {
    document.getElementById('clientDetails').classList.add('hidden');
    document.getElementById('clientEmptyState').classList.remove('hidden');
});
