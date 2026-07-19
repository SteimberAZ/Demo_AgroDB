const mockData = {
    alerts: [
        { type: "critical", title: "🔴 CRÍTICO: Déficit de pH en el suelo", message: "Sensor SN-001 (Sector Norte). pH actual 4.8. Riesgo de marchitez en Cacao.", time: "Hace 5 min" }
    ],
    lecturasGlobales: [
        { label: "Temperatura", value: "28", unit: "°C", status: "optimal", icon: "ph-thermometer" },
        { label: "Hum. Ambiente", value: "65", unit: "%", status: "optimal", icon: "ph-cloud-rain" },
        { label: "Hum. Suelo", value: "32", unit: "%", status: "warning", icon: "ph-drop" },
        { label: "pH Suelo", value: "5.8", unit: "", status: "warning", icon: "ph-flask" },
        { label: "Luminosidad", value: "850", unit: "lx", status: "info", icon: "ph-sun" } 
    ],
    sensoresRed: [
        { codigo: "SN-001", tipo: "Sonda de pH", zona: "Sector Norte", bateria: "85%", status: "critical", metric: "pH", baseVal: 4.8, maxFluctuation: 0.2, lat: -1.0530, lng: -80.4005, desc: "Suelo muy ácido. Se requiere Cal Agrícola urgente." },
        { codigo: "SN-002", tipo: "Humedad Suelo", zona: "Sector Sur", bateria: "92%", status: "optimal", metric: "%", baseVal: 45, maxFluctuation: 5, lat: -1.0558, lng: -80.4010, desc: "Niveles de humedad estables en zona de Plátano." },
        { codigo: "SN-003", tipo: "Estación Metereológica", zona: "Central", bateria: "45%", status: "optimal", metric: "°C", baseVal: 27, maxFluctuation: 2, lat: -1.0544, lng: -80.4000, desc: "Condiciones atmosféricas normales." },
        { codigo: "SN-004", tipo: "Sonda de Humedad", zona: "Invernadero", bateria: "10%", status: "warning", metric: "%", baseVal: 32, maxFluctuation: 5, lat: -1.0542, lng: -80.3985, desc: "Déficit hídrico detectado. Batería baja (10%)." }
    ],
    charts: {
        labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Hoy"],
        ndviData: [0.85, 0.84, 0.86, 0.82, 0.79, 0.75, 0.71],
        humSueloData: [60, 58, 50, 45, 40, 35, 32],
        humAmbienteData: [70, 72, 68, 65, 66, 64, 65]
    },
    cultivos: [
        { 
            id: 'cacao_01', name: "Cacao Fino de Aroma", zone: "Sector Norte", ndvi: "0.68", status: "sick", healthDesc: "Estrés hídrico detectado", icon: "ph-plant", rendimiento: "850.50", 
            ciclo: { porcentaje: 75, diasRestantes: 45, fase: "Maduración" },
            condiciones: [
                { metrica: "pH", ideal: "6.0", actual: "4.8", unit: "", isCritical: true },
                { metrica: "Temperatura", ideal: "25", actual: "28", unit: "°C", isCritical: false },
                { metrica: "Hum. Suelo", ideal: "60", actual: "32", unit: "%", isCritical: true }
            ]
        },
        { 
            id: 'platano_01', name: "Plátano Barraganete", zone: "Sector Sur", ndvi: "0.89", status: "healthy", healthDesc: "Crecimiento óptimo", icon: "ph-tree-palm", rendimiento: "2400.00", 
            ciclo: { porcentaje: 40, diasRestantes: 120, fase: "Vegetativo" },
            condiciones: [
                { metrica: "pH", ideal: "6.5", actual: "6.5", unit: "", isCritical: false },
                { metrica: "Temperatura", ideal: "28", actual: "27", unit: "°C", isCritical: false },
                { metrica: "Hum. Suelo", ideal: "40", actual: "45", unit: "%", isCritical: false }
            ]
        }
    ],
    aplicaciones: [
        { fert: "NPK 15-15-15", cantidad: "50", granja: "Sector Sur", fecha: "Ayer, 14:30" },
        { fert: "Urea 46%", cantidad: "120", granja: "Sector Norte", fecha: "Hace 3 días" }
    ]
};

class FarmApp {
    constructor() {
        this.irrigationActive = false;
        this.chartsInitialized = false;
        this.isDarkMode = false;
        this.liveChart = null;
        this.liveInterval = null;
        this.currentSensor = null;
        this.map = null;
        this.markers = []; // Guardar referencias a los marcadores para CRUD
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    init() {
        this.setupNavigation();
        this.renderDashboard();
        this.initLeafletMap();
        this.renderCultivos();
        this.renderOperaciones();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                const targetId = item.getAttribute('data-target');
                views.forEach(v => v.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
                
                if (targetId === 'view-metricas' && !this.chartsInitialized) {
                    this.initCharts();
                    this.chartsInitialized = true;
                }
                if (targetId === 'view-dashboard' && this.map) {
                    setTimeout(() => this.map.invalidateSize(), 100);
                }
            });
        });
    }

    renderDashboard() {
        document.getElementById('alerts-container').innerHTML = mockData.alerts.map(a => `
            <div class="alert-card">
                <div class="alert-icon"><i class="ph ph-warning-circle"></i></div>
                <div class="alert-content"><p>${a.title}</p><span>${a.message} &bull; ${a.time}</span></div>
            </div>`).join('');
            
        document.getElementById('stats-container').innerHTML = mockData.lecturasGlobales.map(s => `
            <div class="stat-card ${s.status}"><div class="stat-icon"><i class="ph ${s.icon}"></i></div><span class="stat-label">${s.label}</span><div><span class="stat-value">${s.value}</span><span class="stat-unit">${s.unit}</span></div></div>`).join('');
    }

    initLeafletMap() {
        const farmCenter = [-1.0544, -80.4000];
        if(!this.map) {
            this.map = L.map('farm-map', { zoomControl: true, keyboard: true }).setView(farmCenter, 15);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }).addTo(this.map);
            
            const zoomContainer = this.map.zoomControl.getContainer();
            if (zoomContainer) {
                zoomContainer.setAttribute('aria-label', 'Controles de acercamiento y alejamiento del mapa');
                zoomContainer.querySelectorAll('a').forEach(link => link.setAttribute('role', 'button'));
            }
        }
        
        this.renderMapMarkers();
    }

    renderMapMarkers() {
        // Limpiar marcadores viejos si existen
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        const colors = { 'optimal': '#10B981', 'warning': '#F59E0B', 'critical': '#E11D48' };

        mockData.sensoresRed.forEach(s => {
            const circleColor = colors[s.status] || colors.optimal;
            const estadoTexto = s.status === 'optimal' ? 'Óptimo' : (s.status === 'warning' ? 'Advertencia' : 'Crítico');
            const iconHtml = `
                <div class="a11y-marker marker-${s.status}" 
                     role="button" tabindex="0" 
                     aria-label="Sensor ${s.codigo}. Estado: ${estadoTexto}. ${s.desc}">
                </div>
            `;
            const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12] });

            const marker = L.marker([s.lat, s.lng], { icon: customIcon, keyboard: true, title: s.codigo }).addTo(this.map);
            this.markers.push(marker);

            const popupContent = `
                <div class="map-popup-custom">
                    <strong style="display:block; font-size:1rem; margin-bottom:5px; color:var(--text-main)">${s.codigo}</strong>
                    <p style="margin:0; font-size:0.8rem; color:var(--text-muted)">${s.tipo} (${s.zona})</p>
                    <p style="margin:4px 0; font-size:0.85rem; font-weight:bold; color:${circleColor}">${s.desc}</p>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.8rem;">
                        <button class="btn-primary-small" style="flex: 1.5; padding: 0.6rem 0.5rem;" onclick="app.openTelemetryModal('${s.codigo}')">
                            <i class="ph ph-chart-line-up"></i> Ver Telemetría
                        </button>
                        <button class="btn-outline" style="flex: 1; padding: 0.6rem 0.5rem;" onclick="app.map.closePopup()">
                            <i class="ph ph-x"></i> Salir
                        </button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent, { className: 'custom-leaflet-popup' });
        });
    }

    initCharts() {
        const textColor = this.isDarkMode ? '#94A3B8' : '#64748B';
        const gridColor = this.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        Chart.defaults.font.family = 'Inter';
        Chart.defaults.color = textColor;
        
        if(this.ndviChart) this.ndviChart.destroy();
        if(this.humidityChart) this.humidityChart.destroy();

        this.ndviChart = new Chart(document.getElementById('ndviChart').getContext('2d'), {
            type: 'line',
            data: { labels: mockData.charts.labels, datasets: [{ label: 'NDVI', data: mockData.charts.ndviData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0.5, max: 1.0, grid: { color: gridColor } }, x: { grid: { display: false } } } }
        });

        this.humidityChart = new Chart(document.getElementById('humidityChart').getContext('2d'), {
            type: 'line',
            data: { labels: mockData.charts.labels, datasets: [
                { label: 'H. Suelo (%)', data: mockData.charts.humSueloData, borderColor: '#F59E0B', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, pointRadius: 0 },
                { label: 'H. Ambiente (%)', data: mockData.charts.humAmbienteData, borderColor: '#0284C7', borderDash: [5, 5], backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, pointRadius: 0 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, color: textColor } } }, scales: { y: { min: 20, max: 100, grid: { color: gridColor } }, x: { grid: { display: false } } } }
        });
    }

    /* ====== CRUD CULTIVOS ====== */
    renderCultivos() {
        if(mockData.cultivos.length === 0) {
            document.getElementById('cultivos-container').innerHTML = `<p class="text-muted text-center py-4">No hay cultivos activos. Añade uno nuevo.</p>`;
            return;
        }

        document.getElementById('cultivos-container').innerHTML = mockData.cultivos.map(c => `
            <div class="cultivo-card ${c.status}" id="crop-${c.id}">
                <div class="card-header">
                    <div class="cultivo-avatar"><i class="ph ${c.icon}"></i></div>
                    <div class="cultivo-info"><h3>${c.name}</h3><p>${c.zone} &bull; ${c.healthDesc}</p></div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end;">
                        <button class="icon-button" style="width:30px; height:30px;" onclick="app.deleteCrop('${c.id}')"><i class="ph ph-trash" style="color:var(--danger)"></i></button>
                        <div class="ndvi-badge mt-1">NDVI: ${c.ndvi}</div>
                    </div>
                </div>
                <div class="rendimiento-text"><i class="ph ph-scales"></i> Rendimiento est.: ${c.rendimiento} kg/ha</div>
                <div class="progress-container"><div class="progress-header"><span>${c.ciclo.fase}</span><span>Faltan ${c.ciclo.diasRestantes} días</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 0%" data-target-width="${c.ciclo.porcentaje}%"></div></div></div>
                <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color); width: 100%; margin-top: 1rem;">
                    <button class="btn-text-small" onclick="app.openAnalysisModal('${c.id}')"><i class="ph ph-target"></i> Analizar Condiciones (Ideal vs Actual)</button>
                </div>
            </div>`).join('');
        setTimeout(() => { document.querySelectorAll('.progress-bar-fill').forEach(bar => { bar.style.width = bar.getAttribute('data-target-width'); }); }, 300);
    }

    showAddCropModal() {
        document.getElementById('crud-title').textContent = "Nuevo Cultivo";
        document.getElementById('crud-body').innerHTML = `
            <input type="text" id="newCropName" class="form-input mb-2" placeholder="Nombre (ej. Maíz, Soya)">
            <select id="newCropZone" class="form-input mb-2">
                <option value="Sector Norte">Sector Norte</option>
                <option value="Sector Sur">Sector Sur</option>
                <option value="Sector Este">Sector Este</option>
            </select>
            <input type="number" id="newCropYield" class="form-input mb-3" placeholder="Rendimiento esperado (kg/ha)">
            <button class="btn-primary" onclick="app.submitNewCrop()">Guardar Cultivo</button>
        `;
        document.getElementById('crud-modal').classList.add('active');
    }

    submitNewCrop() {
        const name = document.getElementById('newCropName').value;
        const zone = document.getElementById('newCropZone').value;
        const yieldKg = document.getElementById('newCropYield').value;

        if(!name || !yieldKg) { alert("Completa todos los campos"); return; }

        const newId = 'crop_' + Date.now();
        mockData.cultivos.push({
            id: newId, name: name, zone: zone, ndvi: "0.90", status: "healthy", healthDesc: "Recién sembrado", icon: "ph-plant", rendimiento: yieldKg,
            ciclo: { porcentaje: 5, diasRestantes: 180, fase: "Germinación" },
            condiciones: [
                { metrica: "pH", ideal: "6.5", actual: "6.4", unit: "", isCritical: false },
                { metrica: "Temperatura", ideal: "25", actual: "26", unit: "°C", isCritical: false }
            ]
        });

        document.getElementById('crud-modal').classList.remove('active');
        this.renderCultivos();
        this.showModal('Cultivo Añadido', `El cultivo de ${name} ha sido registrado en la base de datos.`);
    }

    deleteCrop(id) {
        if(confirm("¿Estás seguro de eliminar este registro de cultivo de la base de datos?")) {
            mockData.cultivos = mockData.cultivos.filter(c => c.id !== id);
            this.renderCultivos();
            this.showSyncToast();
        }
    }

    /* ====== CRUD SENSORES ====== */
    renderOperaciones() {
        if(mockData.sensoresRed.length === 0) {
            document.getElementById('sensores-container').innerHTML = `<p class="text-muted" style="grid-column: 1/-1">No hay sensores instalados.</p>`;
        } else {
            document.getElementById('sensores-container').innerHTML = mockData.sensoresRed.map(s => `
                <div class="stat-card ${s.status === 'critical' ? 'warning' : (s.status === 'warning' ? 'warning' : 'optimal')}">
                    <div class="stat-icon" style="margin-bottom:0.5rem;"><i class="ph ph-broadcast"></i></div>
                    <span class="stat-value" style="font-size:1rem;">${s.codigo}</span>
                    <span class="stat-label" style="font-size:0.7rem;">${s.tipo}<br>${s.zona}</span>
                    <span class="stat-unit" style="position:absolute; top:1rem; right:1rem; font-size:0.7rem;"><i class="ph ph-battery-${s.bateria === '10%' ? 'warning' : 'full'}"></i> ${s.bateria}</span>
                    
                    <div style="margin-top: auto; padding-top: 0.8rem; border-top: 1px solid var(--border-color); width: 100%;">
                        <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                            <button class="btn-text-small" style="flex:1" onclick="app.openTelemetryModal('${s.codigo}')"><i class="ph ph-chart-line-up"></i> Info</button>
                            <button class="btn-text-small" style="flex:1; color:var(--danger)" onclick="app.deleteSensor('${s.codigo}')"><i class="ph ph-trash"></i> Eliminar</button>
                        </div>
                    </div>
                </div>`).join('');
        }
        this.renderFertilizantesList();
    }

    showAddSensorModal() {
        document.getElementById('crud-title').textContent = "Nuevo Sensor IoT";
        document.getElementById('crud-body').innerHTML = `
            <input type="text" id="newSensorCode" class="form-input mb-2" placeholder="Código (ej. SN-009)">
            <select id="newSensorType" class="form-input mb-2">
                <option value="Sonda de pH">Sonda de pH</option>
                <option value="Humedad Suelo">Sensor Humedad Suelo</option>
                <option value="Luminosidad">Sensor de Luz</option>
            </select>
            <select id="newSensorZone" class="form-input mb-3">
                <option value="Sector Norte">Sector Norte</option>
                <option value="Sector Sur">Sector Sur</option>
                <option value="Central">Central</option>
            </select>
            <button class="btn-primary" onclick="app.submitNewSensor()">Instalar en Red</button>
        `;
        document.getElementById('crud-modal').classList.add('active');
    }

    submitNewSensor() {
        const code = document.getElementById('newSensorCode').value;
        const type = document.getElementById('newSensorType').value;
        const zone = document.getElementById('newSensorZone').value;

        if(!code) { alert("Completa el código del sensor"); return; }

        // Coordenadas aleatorias cercanas al centro
        const lat = -1.0544 + (Math.random() * 0.006 - 0.003);
        const lng = -80.4000 + (Math.random() * 0.006 - 0.003);

        mockData.sensoresRed.push({
            codigo: code, tipo: type, zona: zone, bateria: "100%", status: "optimal", metric: type.includes("pH") ? "pH" : (type.includes("Humedad") ? "%" : "lx"), 
            baseVal: type.includes("pH") ? 6.0 : 50, maxFluctuation: 2, lat: lat, lng: lng, desc: "Sensor instalado correctamente."
        });

        document.getElementById('crud-modal').classList.remove('active');
        this.renderOperaciones();
        this.renderMapMarkers(); // Actualizar mapa de inmediato!
        this.showModal('Sensor Instalado', `El sensor ${code} se conectó a la red exitosamente.`);
    }

    deleteSensor(codigo) {
        if(confirm(`¿Deseas desvincular el sensor ${codigo} de la red y eliminarlo de la DB?`)) {
            mockData.sensoresRed = mockData.sensoresRed.filter(s => s.codigo !== codigo);
            this.renderOperaciones();
            this.renderMapMarkers(); // Actualizar mapa de inmediato!
            this.showSyncToast();
        }
    }

    // Modal de Análisis Cultivos
    openAnalysisModal(cultivoId) {
        const cultivo = mockData.cultivos.find(c => c.id === cultivoId);
        document.getElementById('analysis-title').textContent = cultivo.name;
        let html = '';
        cultivo.condiciones.forEach(cond => {
            let statusIcon = cond.isCritical ? '<i class="ph-fill ph-warning-circle" style="color: var(--danger)"></i>' : '<i class="ph-fill ph-check-circle" style="color: var(--success)"></i>';
            let barColor = cond.isCritical ? 'var(--danger)' : 'var(--success)';
            let barWidth = (parseFloat(cond.actual) / (parseFloat(cond.ideal) * 1.5)) * 100;
            if(barWidth > 100) barWidth = 100;

            html += `
            <div class="analysis-item">
                <div class="analysis-header"><strong>${cond.metrica}</strong>${statusIcon}</div>
                <div class="analysis-stats text-xs text-muted"><span>Actual: <span style="color: var(--text-main); font-weight:bold">${cond.actual}${cond.unit}</span></span><span>Ideal: ${cond.ideal}${cond.unit}</span></div>
                <div class="progress-bar-bg mt-1" style="height:4px; opacity:0.8"><div class="progress-bar-fill" style="width: ${barWidth}%; background: ${barColor}"></div></div>
            </div>`;
        });
        document.getElementById('analysis-container').innerHTML = html;
        document.getElementById('analysis-modal').classList.add('active');
    }

    // Modal de Telemetría (Sensores)
    openTelemetryModal(sensorCodigo) {
        if(this.map) this.map.closePopup();
        this.currentSensor = mockData.sensoresRed.find(s => s.codigo === sensorCodigo);
        document.getElementById('telemetry-title').textContent = `${this.currentSensor.codigo} - ${this.currentSensor.tipo}`;
        document.getElementById('telemetry-modal').classList.add('active');
        this.switchTelemetryTime('live'); 
    }

    closeTelemetryModal() {
        document.getElementById('telemetry-modal').classList.remove('active');
        if (this.liveInterval) clearInterval(this.liveInterval);
        if (this.liveChart) this.liveChart.destroy();
    }

    switchTelemetryTime(timeRange) {
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.time-btn[data-time="${timeRange}"]`).classList.add('active');
        
        const subtitle = document.getElementById('telemetry-subtitle');
        if (this.liveInterval) clearInterval(this.liveInterval);
        
        let labels = []; let data = [];
        let borderColor = '#0284C7'; 
        if(this.currentSensor.status === 'warning' || this.currentSensor.status === 'critical') borderColor = '#E11D48';

        if (timeRange === 'live') {
            subtitle.innerHTML = 'Transmitiendo en vivo <span class="live-dot"></span>';
            let now = new Date();
            for(let i=20; i>=0; i--) { labels.push(new Date(now.getTime() - i*1000).toLocaleTimeString('es-ES', { second: '2-digit' })); data.push(this.getSimulatedValue()); }
            this.renderTelemetryChart(labels, data, borderColor);
            
            this.liveInterval = setInterval(() => {
                let newVal = this.getSimulatedValue();
                this.liveChart.data.labels.push(new Date().toLocaleTimeString('es-ES', { second: '2-digit' }));
                this.liveChart.data.labels.shift();
                this.liveChart.data.datasets[0].data.push(newVal);
                this.liveChart.data.datasets[0].data.shift();
                this.liveChart.update();
                this.updateTelemetryStats(newVal, data);
            }, 1000);
        } else {
            subtitle.innerHTML = `Histórico promediado (${timeRange})`;
            let count = timeRange === '5m' ? 12 : (timeRange === '1h' ? 24 : 10);
            for(let i=count; i>0; i--) { labels.push(`-${i}`); data.push(this.getSimulatedValue()); }
            this.renderTelemetryChart(labels, data, borderColor);
            this.updateTelemetryStats(data[data.length-1], data);
        }
    }

    getSimulatedValue() {
        return +(this.currentSensor.baseVal + (Math.random() * this.currentSensor.maxFluctuation - this.currentSensor.maxFluctuation/2)).toFixed(2);
    }

    renderTelemetryChart(labels, data, color) {
        if (this.liveChart) this.liveChart.destroy();
        const ctx = document.getElementById('liveSensorChart').getContext('2d');
        const textColor = this.isDarkMode ? '#94A3B8' : '#64748B';
        const gridColor = this.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

        this.liveChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: this.currentSensor.metric, data: data, borderColor: color, backgroundColor: color + '20', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0 }] },
            options: { animation: { duration: 0 }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: gridColor } }, x: { grid: { display: false } } } }
        });
        this.updateTelemetryStats(data[data.length-1], data);
    }

    updateTelemetryStats(latest, array) {
        let avg = (array.reduce((a, b) => a + b, 0) / array.length).toFixed(2);
        document.getElementById('telemetry-last-val').textContent = latest + ' ' + this.currentSensor.metric;
        document.getElementById('telemetry-avg-val').textContent = avg + ' ' + this.currentSensor.metric;
    }

    // Funciones Generales
    renderFertilizantesList() { document.getElementById('fert-list-container').innerHTML = mockData.aplicaciones.map(a => `<div class="fert-card"><div class="card-header"><div class="fert-avatar"><i class="ph ph-flask"></i></div><div class="fert-info"><h3>${a.fert}</h3><p>Dosis: ${a.cantidad} Kg &bull; Destino: ${a.granja}</p></div><div class="text-xs text-muted">${a.fecha}</div></div></div>`).join(''); }
    showFertilizerForm() { document.getElementById('fertilizer-form').style.display = 'block'; }
    hideFertilizerForm() { document.getElementById('fertilizer-form').style.display = 'none'; }
    submitFertilizer() {
        const cant = document.getElementById('fert-cantidad').value;
        if (!cant) { alert('Ingrese cantidad.'); return; }
        mockData.aplicaciones.unshift({ fert: document.getElementById('fert-tipo').value, cantidad: cant, granja: document.getElementById('fert-granja').value, fecha: "Justo ahora" });
        this.renderFertilizantesList(); this.hideFertilizerForm();
        this.showModal('Aplicación Registrada', 'El registro de fertilizante ha sido guardado exitosamente.');
        document.getElementById('fert-cantidad').value = '';
    }

    activateIrrigation() {
        const module = document.getElementById('irrigation-module');
        const btn = document.getElementById('btn-activate-irrigation');
        if (!this.irrigationActive) {
            module.classList.add('active');
            document.getElementById('irrigation-status-text').textContent = 'Estado: ACTIVO (Regando...)';
            btn.innerHTML = '<i class="ph ph-stop"></i> Detener Riego'; btn.style.background = 'var(--danger)';
            this.irrigationActive = true; this.showModal('Sistema Activado', 'El sistema de goteo general está operando.');
        } else {
            module.classList.remove('active');
            document.getElementById('irrigation-status-text').textContent = 'Estado: INACTIVO';
            btn.innerHTML = 'Activar Riego General'; btn.style.background = 'var(--primary)';
            this.irrigationActive = false;
        }
    }

    toggleDarkMode(e) {
        e.preventDefault();
        this.isDarkMode = !this.isDarkMode;
        if (this.isDarkMode) { document.documentElement.setAttribute('data-theme', 'dark'); document.getElementById('theme-icon').classList.replace('ph-moon', 'ph-sun'); document.getElementById('theme-text').textContent = 'Modo Claro';
        } else { document.documentElement.removeAttribute('data-theme'); document.getElementById('theme-icon').classList.replace('ph-sun', 'ph-moon'); document.getElementById('theme-text').textContent = 'Modo Oscuro'; }
        if (this.chartsInitialized) { this.initCharts(); }
        document.getElementById('user-dropdown').classList.remove('active');
    }
    showSyncToast() {
        document.querySelector('.notification-btn i').style.transform = "rotate(360deg)";
        document.getElementById('sync-toast').classList.add('show');
        setTimeout(() => { document.getElementById('sync-toast').classList.remove('show'); document.querySelector('.notification-btn i').style.transform = "rotate(0deg)"; }, 3000);
    }
    showModal(title, desc) { document.getElementById('modal-title').textContent = title; document.getElementById('modal-desc').textContent = desc; document.getElementById('action-modal').classList.add('active'); }
    closeModal() { document.getElementById('action-modal').classList.remove('active'); }
}

window.app = new FarmApp();
