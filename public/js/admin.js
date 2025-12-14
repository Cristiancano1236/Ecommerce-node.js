/* admin.js
   Propósito: Lógica de administración: listar órdenes con ítems y crear productos.
   Relación: Interactúa con `/api/ordenes` y `/api/productos`. HTML en `public/admin.html`.
*/
(function () {
	'use strict';

	const API_BASE = '';
	const ADMIN_TOKEN_KEY = 'ecommerce_lab_admin_token';
	const toastEl = document.getElementById('adminToast');
	const toast = toastEl ? new bootstrap.Toast(toastEl, { delay: 2200 }) : null;

	function showToast(msg, isError = false) {
		if (!toastEl) return;
		const body = toastEl.querySelector('.toast-body');
		toastEl.classList.remove('text-bg-primary', 'text-bg-danger');
		toastEl.classList.add(isError ? 'text-bg-danger' : 'text-bg-primary');
		if (body) body.textContent = msg;
		toast?.show();
	}

	function getAdminToken() {
		return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
	}
	function setAdminToken(token) {
		if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
		renderAdminAuthUI();
		// Recargar datos cuando se inicia sesión
		if (token) {
			loadOrders();
			loadProducts();
			loadCategories();
			loadUsers();
		}
	}
	function clearAdminToken() {
		localStorage.removeItem(ADMIN_TOKEN_KEY);
		renderAdminAuthUI();
		// Limpiar caches
		productsCache = [];
		categoriesCache = [];
	}
	function renderAdminAuthUI() {
		const loginBtn = document.getElementById('adminLoginBtn');
		const logoutBtn = document.getElementById('adminLogoutBtn');
		if (!loginBtn || !logoutBtn) return;
		if (getAdminToken()) {
			loginBtn.classList.add('d-none');
			logoutBtn.classList.remove('d-none');
			unlockAdminUI();
		} else {
			loginBtn.classList.remove('d-none');
			logoutBtn.classList.add('d-none');
			lockAdminUI();
		}
	}

	// Bloquear todas las acciones administrativas cuando no hay sesión
	function lockAdminUI() {
		// Deshabilitar formularios
		const forms = ['productForm', 'bulkProductDiscountForm', 'categoryForm', 'bulkCategoryDiscountForm', 'createUserForm', 'editProductForm'];
		forms.forEach(id => {
			const form = document.getElementById(id);
			if (form) {
				form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => {
					el.disabled = true;
				});
			}
		});

		// Deshabilitar botones de acción
		const actionButtons = ['refreshOrdersBtn', 'saveEditBtn', 'resetCategoryFormBtn'];
		actionButtons.forEach(id => {
			const btn = document.getElementById(id);
			if (btn) btn.disabled = true;
		});

		// Deshabilitar filtros y búsquedas
		document.querySelectorAll('[data-role="orders-filter"]').forEach(btn => btn.disabled = true);
		document.querySelectorAll('[data-role="edit-product"], [data-role="delete-product"], [data-role="edit-category"], [data-role="order-status"], [data-role="toggle"]').forEach(btn => {
			if (btn.tagName === 'BUTTON') btn.disabled = true;
			if (btn.tagName === 'SELECT') btn.disabled = true;
		});
		const searchInputs = ['ordersSearchInput', 'searchProductsInput'];
		searchInputs.forEach(id => {
			const input = document.getElementById(id);
			if (input) input.disabled = true;
		});

		// Limpiar tablas y mostrar mensaje de "requiere login"
		const tables = {
			'ordersTableBody': 'Inicia sesión como administrador para ver las órdenes',
			'productsTableBody': 'Inicia sesión como administrador para ver los productos',
			'categoriesTableBody': 'Inicia sesión como administrador para ver las categorías',
			'usersTableBody': 'Inicia sesión como administrador para ver los usuarios'
		};
		Object.entries(tables).forEach(([id, msg]) => {
			const tbody = document.getElementById(id);
			if (tbody) {
				tbody.innerHTML = `<tr><td colspan="10" class="text-center text-secondary py-4"><i class="bi bi-lock me-2"></i>${msg}</td></tr>`;
			}
		});
	}

	// Desbloquear todas las acciones administrativas cuando hay sesión
	function unlockAdminUI() {
		// Habilitar formularios
		const forms = ['productForm', 'bulkProductDiscountForm', 'categoryForm', 'bulkCategoryDiscountForm', 'createUserForm', 'editProductForm'];
		forms.forEach(id => {
			const form = document.getElementById(id);
			if (form) {
				form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => {
					el.disabled = false;
				});
			}
		});

		// Habilitar botones de acción
		const actionButtons = ['refreshOrdersBtn', 'saveEditBtn', 'resetCategoryFormBtn'];
		actionButtons.forEach(id => {
			const btn = document.getElementById(id);
			if (btn) btn.disabled = false;
		});

		// Habilitar filtros y búsquedas
		document.querySelectorAll('[data-role="orders-filter"]').forEach(btn => btn.disabled = false);
		document.querySelectorAll('[data-role="edit-product"], [data-role="delete-product"], [data-role="edit-category"], [data-role="order-status"], [data-role="toggle"]').forEach(btn => {
			if (btn.tagName === 'BUTTON') btn.disabled = false;
			if (btn.tagName === 'SELECT') btn.disabled = false;
		});
		const searchInputs = ['ordersSearchInput', 'searchProductsInput'];
		searchInputs.forEach(id => {
			const input = document.getElementById(id);
			if (input) input.disabled = false;
		});
	}

	function formatCurrencyCOP(v) {
		try {
			return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
		} catch {
			return `$${v}`;
		}
	}

	// ---- Productos (listado y edición) ----
	let productsCache = [];
	let categoriesCache = [];

	async function loadProducts() {
		const tbody = document.getElementById('productsTableBody');
		if (!tbody) return;
		if (!getAdminToken()) {
			tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-4"><i class="bi bi-lock me-2"></i>Inicia sesión como administrador para ver los productos</td></tr>`;
			return;
		}
		tbody.innerHTML = `<tr><td colspan="7" class="text-secondary">Cargando...</td></tr>`;
		try {
			const res = await fetch(`${API_BASE}/api/productos?all=1`);
			const data = await res.json();
			if (!Array.isArray(data)) throw new Error('Respuesta inválida');
			productsCache = data;
			renderProductsTable(data);
		} catch {
			tbody.innerHTML = `<tr><td colspan="7" class="text-danger">No fue posible cargar los productos.</td></tr>`;
		}
	}

	function renderProductsTable(list) {
		const tbody = document.getElementById('productsTableBody');
		if (!tbody) return;
		tbody.innerHTML = '';
		if (!list.length) {
			tbody.innerHTML = `<tr><td colspan="7" class="text-secondary">Sin productos.</td></tr>`;
			return;
		}
		for (const p of list) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${p.id}</td>
				<td>${escapeHtml(p.sku)}</td>
				<td>${escapeHtml(p.nombre)}</td>
				<td class="text-end">${formatCurrencyCOP(p.precio)}</td>
				<td class="text-end">${p.existencias}</td>
				<td>${p.activo ? '<span class="badge text-bg-success">Sí</span>' : '<span class="badge text-bg-secondary">No</span>'}</td>
				<td class="text-end">
					<button class="btn btn-sm btn-outline-primary me-1" data-role="edit-product" data-id="${p.id}">
						<i class="bi bi-pencil"></i>
					</button>
					<button class="btn btn-sm btn-outline-danger" data-role="delete-product" data-id="${p.id}">
						<i class="bi bi-trash"></i>
					</button>
				</td>
			`;
			tbody.appendChild(tr);
		}
	}

	function escapeHtml(str) {
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	document.getElementById('searchProductsInput')?.addEventListener('input', (ev) => {
		const q = (ev.target.value || '').toLowerCase().trim();
		const filtered = !q
			? productsCache
			: productsCache.filter((p) => [p.nombre, p.sku].filter(Boolean).join(' ').toLowerCase().includes(q));
		renderProductsTable(filtered);
	});

	// ---- Descuento masivo de productos ----
	document.getElementById('bulkProductDiscountForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!getAdminToken()) {
			showToast('Inicia sesión como admin para aplicar descuentos', true);
			document.getElementById('adminLoginBtn')?.click();
			return;
		}
		const form = e.currentTarget;
		const fd = new FormData(form);
		const activar = Number(fd.get('activar') || 0);
		const porcentajeRaw = fd.get('porcentaje');
		const porcentaje = porcentajeRaw === null || porcentajeRaw === '' ? null : Number(porcentajeRaw);
		try {
			const res = await fetch(`${API_BASE}/api/productos/descuento-masivo`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify({ activar, porcentaje })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible aplicar el descuento masivo');
			showToast('Descuento masivo aplicado a productos');
			loadProducts();
		} catch (err) {
			showToast(err.message || 'Error aplicando descuento masivo', true);
		}
	});

	// ---- Categorías (CRUD y descuentos) ----
	async function loadCategories() {
		const tbody = document.getElementById('categoriesTableBody');
		if (!tbody) return;
		if (!getAdminToken()) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-4"><i class="bi bi-lock me-2"></i>Inicia sesión como administrador para ver las categorías</td></tr>`;
			return;
		}
		tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">Cargando...</td></tr>`;
		try {
			const res = await fetch(`${API_BASE}/api/categorias`);
			const data = await res.json();
			if (!Array.isArray(data)) throw new Error('Respuesta inválida');
			categoriesCache = data;
			renderCategoriesTable(data);
			populateCategorySelects();
		} catch {
			tbody.innerHTML = `<tr><td colspan="6" class="text-danger">No fue posible cargar las categorías.</td></tr>`;
		}
	}

	function renderCategoriesTable(list) {
		const tbody = document.getElementById('categoriesTableBody');
		if (!tbody) return;
		tbody.innerHTML = '';
		if (!list.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">Sin categorías.</td></tr>`;
			return;
		}
		for (const c of list) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${c.id}</td>
				<td>${escapeHtml(c.nombre)}</td>
				<td>${escapeHtml(c.slug)}</td>
				<td>${c.activo ? '<span class="badge text-bg-success">Sí</span>' : '<span class="badge text-bg-secondary">No</span>'}</td>
				<td>${c.descuento_activo ? (c.descuento_pct ?? 0) : '-'}</td>
				<td class="text-end">
					<button class="btn btn-sm btn-outline-primary" data-role="edit-category" data-id="${c.id}">
						<i class="bi bi-pencil"></i>
					</button>
				</td>
			`;
			tbody.appendChild(tr);
		}
	}

	function populateCategorySelects() {
		const options = ['<option value="">(Sin categoría)</option>']
			.concat(categoriesCache.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`))
			.join('');
		const createSel = document.getElementById('createCategoriaSelect');
		const editSel = document.getElementById('editCategoriaSelect');
		if (createSel) createSel.innerHTML = options;
		if (editSel) editSel.innerHTML = options;
	}

	// Editar categoría (cargar en formulario derecha)
	document.addEventListener('click', (ev) => {
		const btn = ev.target.closest('button[data-role="edit-category"]');
		if (!btn) return;
		const id = Number(btn.getAttribute('data-id'));
		const c = categoriesCache.find(x => x.id === id);
		const form = document.getElementById('categoryForm');
		if (!c || !form) return;
		form.id.value = c.id;
		form.nombre.value = c.nombre || '';
		form.slug.value = c.slug || '';
		form.descripcion.value = c.descripcion || '';
		form.activo.value = c.activo ? '1' : '0';
		form.descuento_pct.value = c.descuento_pct ?? '';
		form.descuento_activo.value = c.descuento_activo ? '1' : '0';
	});

	// Guardar categoría (crear/actualizar)
	document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!getAdminToken()) {
			showToast('Inicia sesión como admin para guardar categorías', true);
			document.getElementById('adminLoginBtn')?.click();
			return;
		}
		const form = e.currentTarget;
		const fd = new FormData(form);
		const payload = Object.fromEntries(fd.entries());
		const id = payload.id ? Number(payload.id) : null;
		payload.activo = Number(payload.activo || 1);
		payload.descuento_pct = payload.descuento_pct === '' ? null : Number(payload.descuento_pct);
		payload.descuento_activo = Number(payload.descuento_activo || 0);
		try {
			const url = id ? `${API_BASE}/api/categorias/${id}` : `${API_BASE}/api/categorias`;
			const method = id ? 'PUT' : 'POST';
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible guardar la categoría');
			showToast(`Categoría ${id ? 'actualizada' : 'creada'}`);
			if (!id) form.reset();
			loadCategories();
		} catch (err) {
			showToast(err.message || 'Error guardando categoría', true);
		}
	});

	document.getElementById('resetCategoryFormBtn')?.addEventListener('click', () => {
		const form = document.getElementById('categoryForm');
		form?.reset();
		form?.querySelector('input[name="id"]')?.setAttribute('value', '');
	});

	// Descuento masivo categorías
	document.getElementById('bulkCategoryDiscountForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!getAdminToken()) {
			showToast('Inicia sesión como admin para aplicar descuentos a categorías', true);
			document.getElementById('adminLoginBtn')?.click();
			return;
		}
		const fd = new FormData(e.currentTarget);
		const activar = Number(fd.get('activar') || 0);
		const porcentajeRaw = fd.get('porcentaje');
		const porcentaje = porcentajeRaw === null || porcentajeRaw === '' ? null : Number(porcentajeRaw);
		try {
			const res = await fetch(`${API_BASE}/api/categorias/descuento-masivo`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify({ activar, porcentaje })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible aplicar el descuento masivo a categorías');
			showToast('Descuento masivo aplicado a categorías');
			loadCategories();
		} catch (err) {
			showToast(err.message || 'Error aplicando descuento masivo a categorías', true);
		}
	});

	// Abrir editor
	document.addEventListener('click', async (ev) => {
		const btn = ev.target.closest('button[data-role="edit-product"]');
		if (!btn) return;
		const id = Number(btn.getAttribute('data-id'));
		try {
			const res = await fetch(`${API_BASE}/api/productos/${id}`);
			const p = await res.json();
			if (!res.ok) throw new Error(p?.message || 'No se pudo cargar el producto');
			const modalEl = document.getElementById('editProductModal');
			const form = document.getElementById('editProductForm');
			if (!modalEl || !form) return;
			form.id.value = p.id;
			form.sku.value = p.sku || '';
			form.nombre.value = p.nombre || '';
			form.descripcion.value = p.descripcion || '';
			form.precio.value = p.precio ?? 0;
			form.existencias.value = p.existencias ?? 0;
			form.moneda.value = p.moneda || 'COP';
			form.activo.value = p.activo ? '1' : '0';
			form.imagen_url.value = p.imagen_url || '';
			// Campos de categoría y descuento (prefill con valores reales)
			if (form.categoria_id) form.categoria_id.value = p.categoria_id || '';
			if (form.descuento_pct) form.descuento_pct.value = (p.producto_descuento_pct === null || p.producto_descuento_pct === undefined) ? '' : Number(p.producto_descuento_pct);
			if (form.descuento_activo) form.descuento_activo.value = p.producto_descuento_activo ? '1' : '0';
			const modal = new bootstrap.Modal(modalEl);
			modal.show();
		} catch (err) {
			showToast(err.message || 'No se pudo abrir el editor', true);
		}
	});

	// Guardar edición
	document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
		const form = document.getElementById('editProductForm');
		const id = Number(form.id.value);
		const payload = {
			sku: form.sku.value,
			nombre: form.nombre.value,
			descripcion: form.descripcion.value,
			precio: Number(form.precio.value),
			moneda: form.moneda.value || 'COP',
			existencias: Number(form.existencias.value),
			activo: Number(form.activo.value),
			imagen_url: form.imagen_url.value || undefined,
			categoria_id: form.categoria_id?.value ? Number(form.categoria_id.value) : null,
			descuento_pct: form.descuento_pct?.value === '' ? null : Number(form.descuento_pct.value),
			descuento_activo: Number(form.descuento_activo?.value || 0)
		};
		try {
			if (!getAdminToken()) {
				showToast('Inicia sesión como admin para guardar', true);
				document.getElementById('adminLoginBtn')?.click();
				return;
			}
			const res = await fetch(`${API_BASE}/api/productos/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible actualizar');
			showToast('Producto actualizado');
			loadProducts();
			document.querySelector('#editProductModal .btn-close')?.click();
		} catch (err) {
			showToast(err.message || 'Error actualizando', true);
		}
	});

	// Eliminar (borrado lógico)
	document.addEventListener('click', async (ev) => {
		const btn = ev.target.closest('button[data-role="delete-product"]');
		if (!btn) return;
		if (!getAdminToken()) {
			showToast('Inicia sesión como admin para eliminar', true);
			document.getElementById('adminLoginBtn')?.click();
			return;
		}
		const id = Number(btn.getAttribute('data-id'));
		if (!confirm('¿Deseas desactivar este producto?')) return;
		try {
			const res = await fetch(`${API_BASE}/api/productos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getAdminToken()}` } });
			if (!res.ok && res.status !== 204) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.message || 'No fue posible eliminar');
			}
			showToast('Producto desactivado');
			loadProducts();
		} catch (err) {
			showToast(err.message || 'Error eliminando', true);
		}
	});

	// ---- Órdenes ----
	let ordersStatusFilter = 'pendiente'; // por defecto pendientes

	async function loadOrders() {
		const tbody = document.getElementById('ordersTableBody');
		if (!tbody) return;
		if (!getAdminToken()) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-4"><i class="bi bi-lock me-2"></i>Inicia sesión como administrador para ver las órdenes</td></tr>`;
			return;
		}
		tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">Cargando...</td></tr>`;
		try {
			const estadoParam = (() => {
				if (ordersStatusFilter === 'pendiente') return 'pendiente';
				if (ordersStatusFilter === 'procesando') return 'pagada,enviada';
				if (ordersStatusFilter === 'terminada') return 'entregada';
				return '';
			})();
			const q = (document.getElementById('ordersSearchInput')?.value || '').trim();
			const url = `${API_BASE}/api/ordenes?detalles=1${estadoParam ? `&estado=${encodeURIComponent(estadoParam)}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
			const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getAdminToken()}` } });
			const data = await res.json();
			if (!Array.isArray(data)) throw new Error('Respuesta inválida');
			if (data.length === 0) {
				tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">No hay órdenes.</td></tr>`;
				return;
			}
			tbody.innerHTML = '';
			for (const o of data) {
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>${o.id}</td>
					<td>
						<div>${(o.cliente_nombre || '')} ${(o.cliente_apellido || '')}</div>
						<div class="small text-secondary">${o.cliente_correo || ''}</div>
					</td>
					<td>
						<select class="form-select form-select-sm" data-role="order-status" data-id="${o.id}">
							<option value="pendiente" ${o.estado==='pendiente'?'selected':''}>pendiente</option>
							<option value="pagada" ${o.estado==='pagada'?'selected':''}>pagada</option>
							<option value="enviada" ${o.estado==='enviada'?'selected':''}>enviada</option>
							<option value="entregada" ${o.estado==='entregada'?'selected':''}>entregada</option>
							<option value="cancelada" ${o.estado==='cancelada'?'selected':''}>cancelada</option>
							<option value="reembolsada" ${o.estado==='reembolsada'?'selected':''}>reembolsada</option>
						</select>
					</td>
					<td>${new Date(o.realizada_en).toLocaleString('es-CO')}</td>
					<td>${formatCurrencyCOP(o.total_calculado || 0)}</td>
					<td class="text-end">
						<button class="btn btn-sm btn-outline-secondary" data-role="toggle" data-id="${o.id}">
							<i class="bi bi-chevron-down"></i>
						</button>
					</td>
				`;
				tbody.appendChild(tr);

				const trItems = document.createElement('tr');
				trItems.className = 'd-none';
				const itemsHtml = (o.items || [])
					.map(
						(it) => `
						<tr>
							<td>${it.sku}</td>
							<td>${it.nombre_producto}</td>
							<td class="text-end">${it.cantidad}</td>
							<td class="text-end">${formatCurrencyCOP(it.precio_unitario)}</td>
							<td class="text-end">${formatCurrencyCOP(it.total_renglon)}</td>
						</tr>`
					)
					.join('');
				trItems.innerHTML = `
					<td colspan="6">
						<div class="card card-body">
							<h6 class="mb-3">Ítems</h6>
							<div class="table-responsive">
								<table class="table table-sm">
									<thead>
										<tr>
											<th>SKU</th>
											<th>Producto</th>
											<th class="text-end">Cant.</th>
											<th class="text-end">Precio</th>
											<th class="text-end">Total</th>
										</tr>
									</thead>
									<tbody>
										${itemsHtml || `<tr><td colspan="5" class="text-secondary">Sin ítems</td></tr>`}
									</tbody>
								</table>
							</div>
						</div>
					</td>
				`;
				tbody.appendChild(trItems);
			}
		} catch {
			tbody.innerHTML = `<tr><td colspan="6" class="text-danger">No fue posible cargar las órdenes.</td></tr>`;
		}
	}

	document.addEventListener('click', (ev) => {
		const btn = ev.target.closest('button[data-role="toggle"]');
		if (!btn) return;
		const tr = btn.closest('tr');
		const detailsTr = tr?.nextElementSibling;
		if (!detailsTr) return;
		detailsTr.classList.toggle('d-none');
		btn.innerHTML = detailsTr.classList.contains('d-none') ? '<i class="bi bi-chevron-down"></i>' : '<i class="bi bi-chevron-up"></i>';
	});

	document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);
	// Buscar por cliente (nombre/correo)
	document.getElementById('ordersSearchInput')?.addEventListener('input', () => {
		loadOrders();
	});

	// Filtros de estado (pendiente/ procesando/ terminadas / todas)
	document.getElementById('ordersStatusFilters')?.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-role="orders-filter"]');
		if (!btn) return;
		ordersStatusFilter = String(btn.getAttribute('data-val') || 'pendiente');
		// Activar visual
		const links = e.currentTarget.querySelectorAll('.nav-link');
		links.forEach(l => l.classList.remove('active'));
		btn.classList.add('active');
		loadOrders();
	});

	// Cambio de estado por fila
	document.addEventListener('change', async (e) => {
		const sel = e.target.closest('select[data-role="order-status"]');
		if (!sel) return;
		const id = Number(sel.getAttribute('data-id'));
		const estado = sel.value;
		try {
			if (!getAdminToken()) {
				showToast('Inicia sesión como admin para cambiar estado', true);
				document.getElementById('adminLoginBtn')?.click();
				return;
			}
			const res = await fetch(`${API_BASE}/api/ordenes/${id}/estado`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify({ estado })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible cambiar el estado');
			showToast(`Orden #${id} → ${estado}`);
			loadOrders();
		} catch (err) {
			showToast(err.message || 'Error al cambiar estado', true);
		}
	});

	// ---- Crear Producto ----
	document.getElementById('productForm')?.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		const form = ev.currentTarget;
		const submitBtn = form.querySelector('button[type="submit"]');
		const formData = new FormData(form);
		const payload = Object.fromEntries(formData.entries());
		payload.precio = Number(payload.precio);
		payload.existencias = Number(payload.existencias || 0);
		payload.activo = Number(payload.activo || 1);
		payload.categoria_id = payload.categoria_id ? Number(payload.categoria_id) : null;
		payload.descuento_pct = payload.descuento_pct === '' ? null : Number(payload.descuento_pct);
		payload.descuento_activo = Number(payload.descuento_activo || 0);
		if (!payload.moneda) payload.moneda = 'COP';
		submitBtn.disabled = true;
		try {
			if (!getAdminToken()) {
				showToast('Inicia sesión como admin para crear', true);
				document.getElementById('adminLoginBtn')?.click();
				return;
			}
			const res = await fetch(`${API_BASE}/api/productos`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.message || 'No fue posible crear el producto');
			}
			form.reset();
			showToast(`Producto creado #${data.id || ''}`);
			loadProducts();
		} catch (err) {
			showToast(err.message || 'Error al crear producto', true);
		} finally {
			submitBtn.disabled = false;
		}
	});

	// ---- Usuarios (admin) ----
	async function loadUsers() {
		const tbody = document.getElementById('usersTableBody');
		if (!tbody) return;
		if (!getAdminToken()) {
			tbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-4"><i class="bi bi-lock me-2"></i>Inicia sesión como administrador para ver los usuarios</td></tr>`;
			return;
		}
		tbody.innerHTML = `<tr><td colspan="4" class="text-secondary">Cargando...</td></tr>`;
		try {
			const res = await fetch(`${API_BASE}/api/admin/users`, {
				headers: { 'Authorization': `Bearer ${getAdminToken()}` }
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'No fue posible cargar usuarios');
			tbody.innerHTML = '';
			for (const u of data) {
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>${u.id}</td>
					<td>${escapeHtml([u.nombre, u.apellido].filter(Boolean).join(' '))}</td>
					<td>${escapeHtml(u.correo)}</td>
					<td>${escapeHtml(u.rol)}</td>
				`;
				tbody.appendChild(tr);
			}
		} catch (err) {
			tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${escapeHtml(err.message || 'Error')}</td></tr>`;
		}
	}

	document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const payload = Object.fromEntries(fd.entries());
		try {
			const res = await fetch(`${API_BASE}/api/admin/users`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${getAdminToken()}`
				},
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || 'No fue posible crear el usuario');
			showToast(`Usuario creado #${data.id}`);
			form.reset();
			loadUsers();
		} catch (err) {
			showToast(err.message || 'Error creando usuario', true);
		}
	});

	// Login admin
	document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const payload = Object.fromEntries(fd.entries());
		try {
			const res = await fetch(`${API_BASE}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'No fue posible iniciar sesión');
			setAdminToken(data.token);
			document.querySelector('#adminLoginModal .btn-close')?.click();
			showToast('Sesión admin iniciada');
			loadUsers();
		} catch (err) {
			showToast(err.message || 'Error al iniciar sesión', true);
		}
	});

	document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
		clearAdminToken();
		showToast('Sesión admin cerrada');
		// Cerrar modales abiertos
		document.querySelectorAll('.modal.show').forEach(modalEl => {
			const modal = bootstrap.Modal.getInstance(modalEl);
			if (modal) modal.hide();
		});
	});

	// ---- Init ----
	document.addEventListener('DOMContentLoaded', () => {
		renderAdminAuthUI();
		// Solo cargar datos si hay token
		if (getAdminToken()) {
			loadOrders();
			loadProducts();
			loadCategories();
			loadUsers();
		}
	});
})();


