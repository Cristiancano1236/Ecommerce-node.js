/* app.js
   Propósito: Lógica de frontend (catálogo, carrito, checkout).
   Relación: Consume endpoints de `backend/server.js` (/api/productos y /api/ordenes) y renderiza en `public/index.html`.
*/

(function () {
	'use strict';

	// ---- Configuración ----
	const API_BASE = ''; // mismo host (servido por Express)
	const PLACEHOLDER_IMG = 'https://via.placeholder.com/600x400?text=Sin+imagen';
	const CURRENCY = 'COP';
	const CART_KEY = 'ecommerce_lab_cart';
	const AUTH_TOKEN_KEY = 'ecommerce_lab_auth_token';
	const AUTH_USER_KEY = 'ecommerce_lab_auth_user';

	// ---- Estado en memoria ----
	let productos = [];
	let categorias = [];
	let selectedCategoryId = null;
	let cart = loadCart();
	let afterAuthAction = null; // callback para ejecutar tras login/registro exitoso

	// ---- Utilidades ----
	function formatCurrency(value) {
		try {
			return new Intl.NumberFormat('es-CO', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).format(value);
		} catch {
			return `$${value}`;
		}
	}

	function loadCart() {
		try {
			const raw = localStorage.getItem(CART_KEY);
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	}

	function saveCart() {
		localStorage.setItem(CART_KEY, JSON.stringify(cart));
		updateCartBadge();
	}

	function getAuthToken() {
		return localStorage.getItem(AUTH_TOKEN_KEY) || '';
	}

	function setAuth(token, user) {
		if (token) {
			localStorage.setItem(AUTH_TOKEN_KEY, token);
		}
		if (user) {
			localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
		}
	}

	function clearAuth() {
		localStorage.removeItem(AUTH_TOKEN_KEY);
		localStorage.removeItem(AUTH_USER_KEY);
	}

	function isAuthenticated() {
		return Boolean(getAuthToken());
	}

	function getAuthUser() {
		try {
			const raw = localStorage.getItem(AUTH_USER_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	function openAuthModal() {
		const el = document.getElementById('authModal');
		if (!el) return;
		const modal = new bootstrap.Modal(el);
		modal.show();
	}

	function updateCartBadge() {
		// Cuenta solo ítems cuyo producto existe (evita mostrar 1 por residuos antiguos)
		const count = cart.reduce((sum, it) => {
			const exists = productos.some((p) => p.id === it.producto_id);
			return sum + (exists ? it.cantidad : 0);
		}, 0);
		const badge = document.getElementById('cartCountBadge');
		if (badge) badge.textContent = String(count);
		updateCartUI();
	}

	function getCartTotal() {
		return cart.reduce((sum, it) => {
			const p = productos.find((x) => x.id === it.producto_id);
			const unit = p ? Number(p.precio_final ?? p.precio) : 0;
			return sum + unit * it.cantidad;
		}, 0);
	}

	// ---- Render de filtros de categoría ----
	function renderCategoryFilters() {
		const ul = document.getElementById('categoryFilters');
		if (!ul) return;
		ul.innerHTML = '';
		const makeLi = (id, label, active) => {
			const li = document.createElement('li');
			li.className = 'nav-item';
			li.innerHTML = `<button class="nav-link ${active ? 'active' : ''}" data-role="cat-filter" data-id="${id ?? ''}">${escapeHtml(label)}</button>`;
			return li;
		};
		ul.appendChild(makeLi('', 'Todos', !selectedCategoryId));
		for (const c of categorias) {
			ul.appendChild(makeLi(String(c.id), c.nombre || `Cat ${c.id}`, selectedCategoryId === c.id));
		}

		// Sincronizar dropdown
		const dd = document.getElementById('categoryDropdownMenu');
		const btn = document.getElementById('categoryDropdownBtn');
		if (dd) {
			dd.innerHTML = `
				<li><a class="dropdown-item ${!selectedCategoryId ? 'active' : ''}" href="#" data-role="cat-dd" data-id="">Todas</a></li>
				<li><hr class="dropdown-divider"></li>
				${categorias.map(c => `<li><a class="dropdown-item ${selectedCategoryId === c.id ? 'active':''}" href="#" data-role="cat-dd" data-id="${c.id}">${escapeHtml(c.nombre || ('Cat ' + c.id))}</a></li>`).join('')}
			`;
		}
		if (btn) {
			const label = !selectedCategoryId ? 'Categorías' : (categorias.find(c => c.id === selectedCategoryId)?.nombre || 'Categorías');
			btn.textContent = label;
		}
	}

	// ---- Render de productos ----
	function renderProducts(list) {
		const grid = document.getElementById('productsGrid');
		if (!grid) return;
		grid.innerHTML = '';

		if (!list.length) {
			grid.innerHTML = `
				<div class="col-12">
					<div class="alert alert-light border text-secondary">No hay productos.</div>
				</div>
			`;
			return;
		}

		for (const p of list) {
			const col = document.createElement('div');
			col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
			col.innerHTML = `
				<div class="card h-100 shadow-sm">
					<img src="${p.imagen_url || PLACEHOLDER_IMG}" class="card-img-top" alt="${escapeHtml(p.nombre)}">
					<div class="card-body d-flex flex-column">
						<h5 class="card-title mb-1">${escapeHtml(p.nombre)}</h5>
						<p class="text-secondary small mb-2">${escapeHtml(p.descripcion || '')}</p>
						<div class="d-flex align-items-center justify-content-between mb-2">
							<span class="price">
								${
									(p.precio_final !== undefined && p.precio_final !== null && Number(p.precio_final) < Number(p.precio))
									? `<span class="text-decoration-line-through text-secondary me-2">${formatCurrency(p.precio)}</span><span class="text-danger fw-bold">${formatCurrency(p.precio_final)}</span>`
									: `${formatCurrency(p.precio)}`
								}
							</span>
							<span class="badge rounded-pill badge-stock">Stock: ${p.existencias}</span>
						</div>
						<div class="discount-row mb-2">
							${
								(p.descuento_aplicado_pct && Number(p.descuento_aplicado_pct) > 0 && Number(p.precio_final) < Number(p.precio))
								? `<span class="badge text-bg-danger"><i class="bi bi-percent me-1"></i>-${Number(p.descuento_aplicado_pct)}%</span>`
								: ''
							}
						</div>
						<div class="input-group mb-3">
							<span class="input-group-text bg-white">Cant.</span>
							<input type="number" min="1" max="${p.existencias}" value="1" class="form-control" aria-label="Cantidad">
						</div>
						<button class="btn btn-primary w-100 mt-auto" data-action="add" data-id="${p.id}">
							<i class="bi bi-cart-plus me-2"></i>Agregar al carrito
						</button>
					</div>
				</div>
			`;
			grid.appendChild(col);
		}
	}

	// Clic en filtros
	document.addEventListener('click', async (ev) => {
		const btn = ev.target.closest('button[data-role="cat-filter"]');
		const dd = ev.target.closest('a[data-role="cat-dd"]');
		if (!btn && !dd) return;
		// Evita que el anchor '#' mueva la página al inicio
		if (dd) {
			ev.preventDefault();
			ev.stopPropagation();
		}
		const idAttr = (btn || dd).getAttribute('data-id');
		selectedCategoryId = idAttr ? Number(idAttr) : null;
		renderCategoryFilters();
		await loadAndRenderProducts();
	});

	// ---- Interacción productos ----
	document.addEventListener('click', (ev) => {
		const btn = ev.target.closest('button[data-action="add"]');
		if (!btn) return;
		const id = Number(btn.getAttribute('data-id'));
		const card = btn.closest('.card');
		const qtyInput = card ? card.querySelector('input[type="number"]') : null;
		const qty = qtyInput ? Number(qtyInput.value) : 1;
		addToCart(id, qty);
	});

	function addToCart(productoId, cantidad) {
		const prod = productos.find((p) => p.id === productoId);
		if (!prod) return;
		const existing = cart.find((it) => it.producto_id === productoId);
		const newQty = (existing ? existing.cantidad : 0) + cantidad;
		if (newQty > prod.existencias) {
			showToast('No hay stock suficiente para este producto.');
			return;
		}
		if (existing) {
			existing.cantidad = newQty;
		} else {
			cart.push({ producto_id: productoId, cantidad });
		}
		saveCart();
		showToast('Producto agregado al carrito.');
	}

	// ---- Carrito UI ----
	function updateCartUI() {
		const container = document.getElementById('cartItems');
		const totalEl = document.getElementById('cartTotal');
		if (!container || !totalEl) return;
		container.innerHTML = '';

		if (cart.length === 0) {
			container.innerHTML = `<div class="text-secondary small">Tu carrito está vacío.</div>`;
			totalEl.textContent = formatCurrency(0);
			return;
		}

		let rendered = 0;
		for (const it of cart) {
			const p = productos.find((x) => x.id === it.producto_id);
			if (!p) continue;
			rendered++;
			const item = document.createElement('div');
			item.className = 'list-group-item py-3';
			const unitPrice = Number(p.precio_final ?? p.precio);
			item.innerHTML = `
				<div class="d-flex align-items-center gap-3">
					<img src="${p.imagen_url || PLACEHOLDER_IMG}" alt="${escapeHtml(p.nombre)}" style="width:64px; height:48px; object-fit:cover; border-radius:.5rem;">
					<div class="flex-grow-1">
						<div class="d-flex justify-content-between align-items-center">
							<strong>${escapeHtml(p.nombre)}</strong>
							<span class="text-nowrap">
								${
									(p.precio_final !== undefined && p.precio_final !== null && Number(p.precio_final) < Number(p.precio))
									? `<span class="text-decoration-line-through text-secondary me-1 small">${formatCurrency(p.precio)}</span><span class="fw-semibold text-danger">${formatCurrency(unitPrice)}</span>`
									: `${formatCurrency(unitPrice)}`
								}
							</span>
						</div>
						<div class="d-flex align-items-center mt-2 gap-2">
							<input data-id="${p.id}" data-role="qty" type="number" min="1" max="${p.existencias}" value="${it.cantidad}" class="form-control form-control-sm" style="max-width: 96px;">
							<button class="btn btn-outline-danger btn-sm" data-role="remove" data-id="${p.id}">
								<i class="bi bi-trash"></i>
							</button>
						</div>
					</div>
				</div>
			`;
			container.appendChild(item);
		}

		// Si ningún ítem se pudo renderizar (productos inexistentes), mostrar vacío
		if (rendered === 0) {
			container.innerHTML = `<div class="text-secondary small">Tu carrito está vacío.</div>`;
		}
		totalEl.textContent = formatCurrency(getCartTotal());
	}

	document.addEventListener('input', (ev) => {
		const qty = ev.target.closest('input[data-role="qty"]');
		if (!qty) return;
		const id = Number(qty.getAttribute('data-id'));
		const value = Math.max(1, Number(qty.value || 1));
		const prod = productos.find((p) => p.id === id);
		if (!prod) return;
		if (value > prod.existencias) {
			qty.value = prod.existencias;
		}
		const it = cart.find((i) => i.producto_id === id);
		if (it) {
			it.cantidad = Math.min(Math.max(1, value), prod.existencias);
			saveCart();
		}
	});

	document.addEventListener('click', (ev) => {
		const btn = ev.target.closest('button[data-role="remove"]');
		if (!btn) return;
		const id = Number(btn.getAttribute('data-id'));
		cart = cart.filter((i) => i.producto_id !== id);
		saveCart();
		updateCartUI();
	});

	// ---- Checkout ----
	document.addEventListener('click', async (ev) => {
		const btn = ev.target.closest('#checkoutBtn');
		if (!btn) return;
		if (cart.length === 0) {
			showToast('Tu carrito está vacío.');
			return;
		}

		// Requiere autenticación
		if (!isAuthenticated()) {
			afterAuthAction = () => document.getElementById('checkoutBtn')?.click();
			openAuthModal();
			return;
		}

		btn.disabled = true;
		try {
			const res = await fetch(`${API_BASE}/api/ordenes`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${getAuthToken()}`
				},
				body: JSON.stringify({ items: cart })
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.detail || data?.message || 'Error en checkout');
			}
			// Limpia carrito y notifica
			cart = [];
			saveCart();
			updateCartUI();
			showToast(`Orden creada #${data.ordenId} por ${formatCurrency(data.total)}.`);
		} catch (err) {
			showToast(err.message || 'No fue posible crear la orden.');
		} finally {
			btn.disabled = false;
		}
	});

	// ---- Búsqueda ----
	document.getElementById('searchInput')?.addEventListener('input', (ev) => {
		const q = (ev.target.value || '').toLowerCase().trim();
		const filtered = !q
			? productos
			: productos.filter((p) => [p.nombre, p.descripcion, p.sku].filter(Boolean).join(' ').toLowerCase().includes(q));
		renderProducts(filtered);
	});

	// ---- Toast minimalista ----
	let toastEl;
	function showToast(message) {
		if (!toastEl) {
			toastEl = document.createElement('div');
			toastEl.className = 'position-fixed bottom-0 end-0 p-3';
			toastEl.style.zIndex = '1080';
			toastEl.innerHTML = `
				<div id="liveToast" class="toast align-items-center text-bg-primary border-0" role="alert" aria-live="assertive" aria-atomic="true">
					<div class="d-flex">
						<div class="toast-body"></div>
						<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
					</div>
				</div>
			`;
			document.body.appendChild(toastEl);
		}
		const toastBody = toastEl.querySelector('.toast-body');
		if (toastBody) toastBody.textContent = message;
		const toast = new bootstrap.Toast(toastEl.querySelector('.toast'), { delay: 2200 });
		toast.show();
	}

	// ---- Escapar HTML básico ----
	function escapeHtml(str) {
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// ---- UI de navegación (auth) ----
	function renderAuthNav() {
		const loginBtn = document.getElementById('navLoginBtn');
		const userDropdown = document.getElementById('navUserDropdown');
		const userName = document.getElementById('navUserName');
		if (!loginBtn || !userDropdown || !userName) return;
		if (isAuthenticated()) {
			const u = getAuthUser();
			userName.textContent = u?.nombre || u?.correo || 'Usuario';
			loginBtn.classList.add('d-none');
			userDropdown.classList.remove('d-none');
		} else {
			loginBtn.classList.remove('d-none');
			userDropdown.classList.add('d-none');
		}
	}

	// ---- Perfil: Mis compras ----
	async function fetchMyOrdersAndRender() {
		const container = document.getElementById('myOrdersContainer');
		if (!container) return;
		if (!isAuthenticated()) {
			container.innerHTML = `<div class="alert alert-light border">Inicia sesión para ver tus compras.</div>`;
			return;
		}
		container.innerHTML = `<div class="text-secondary">Cargando tus compras...</div>`;
		try {
			const res = await fetch(`${API_BASE}/api/ordenes/mias?detalles=1`, {
				headers: { 'Authorization': `Bearer ${getAuthToken()}` }
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'No fue posible obtener tus órdenes');
			renderOrdersList(container, Array.isArray(data) ? data : []);
		} catch (err) {
			container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message || 'Error al cargar')}</div>`;
		}
	}

	function renderOrdersList(container, orders) {
		container.innerHTML = '';
		if (!orders.length) {
			container.innerHTML = `<div class="alert alert-light border">Aún no tienes compras.</div>`;
			return;
		}
		for (const o of orders) {
			const card = document.createElement('div');
			card.className = 'card shadow-sm';
			const date = o.realizada_en ? new Date(o.realizada_en) : null;
			const fecha = date ? date.toLocaleString('es-CO') : '';
			const itemsHtml = Array.isArray(o.items) && o.items.length
				? o.items.map(it => `
						<tr>
							<td class="text-nowrap">${escapeHtml(it.sku || String(it.producto_id))}</td>
							<td>${escapeHtml(it.nombre_producto || '')}</td>
							<td class="text-end">${formatCurrency(it.precio_unitario || 0)}</td>
							<td class="text-end">${it.cantidad}</td>
							<td class="text-end fw-semibold">${formatCurrency(it.total_renglon || 0)}</td>
						</tr>
					`).join('')
				: `<tr><td colspan="5" class="text-secondary">Sin ítems</td></tr>`;
			card.innerHTML = `
				<div class="card-body">
					<div class="d-flex justify-content-between align-items-center mb-2">
						<div class="d-flex flex-column">
							<div class="fw-semibold">Orden #${o.id}</div>
							<small class="text-secondary">${escapeHtml(o.estado || '')} · ${escapeHtml(fecha)}</small>
						</div>
						<div class="h5 m-0">${formatCurrency(o.total_calculado || 0)}</div>
					</div>
					<div class="table-responsive">
						<table class="table table-sm align-middle">
							<thead>
								<tr>
									<th>SKU</th>
									<th>Producto</th>
									<th class="text-end">Precio</th>
									<th class="text-end">Cant.</th>
									<th class="text-end">Total</th>
								</tr>
							</thead>
							<tbody>
								${itemsHtml}
							</tbody>
						</table>
					</div>
				</div>
			`;
			container.appendChild(card);
		}
	}

	// ---- Perfil: Datos de cuenta ----
	async function fetchMeAndPrefillProfile() {
		const nombreEl = document.getElementById('profileNombre');
		const telEl = document.getElementById('profileTelefono');
		if (!nombreEl || !telEl) return;
		if (!isAuthenticated()) {
			nombreEl.value = '';
			telEl.value = '';
			return;
		}
		try {
			const res = await fetch(`${API_BASE}/api/auth/me`, {
				headers: { 'Authorization': `Bearer ${getAuthToken()}` }
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'No fue posible cargar el perfil');
			nombreEl.value = data?.nombre || '';
			telEl.value = data?.telefono || '';
		} catch {
			// Si falla, intentar con el localStorage
			const u = getAuthUser();
			nombreEl.value = u?.nombre || '';
			telEl.value = u?.telefono || '';
		}
	}

	// ---- Eventos globales Perfil ----
	function wireProfileUI() {
		// Abrir perfil: cargar datos y compras
		const offcanvasEl = document.getElementById('offcanvasProfile');
		if (offcanvasEl) {
			offcanvasEl.addEventListener('shown.bs.offcanvas', () => {
				fetchMeAndPrefillProfile();
				fetchMyOrdersAndRender();
			});
		}

		// Guardar cambios de perfil
		const profileForm = document.getElementById('profileForm');
		profileForm?.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (!isAuthenticated()) {
				openAuthModal();
				return;
			}
			const form = e.currentTarget;
			const submit = form.querySelector('button[type="submit"]');
			submit.disabled = true;
			try {
				const fd = new FormData(form);
				const payload = {
					nombre: String(fd.get('nombre') || '').trim(),
					telefono: String(fd.get('telefono') || '').trim()
				};
				const res = await fetch(`${API_BASE}/api/auth/profile`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${getAuthToken()}`
					},
					body: JSON.stringify(payload)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data?.message || 'No fue posible actualizar el perfil');
				// Refrescar auth local (token + user)
				setAuth(data.token, data.user);
				renderAuthNav();
				showToast('Perfil actualizado');
			} catch (err) {
				showToast(err.message || 'Error al actualizar perfil');
			} finally {
				submit.disabled = false;
			}
		});

		// Cambiar contraseña
		const pwdForm = document.getElementById('passwordForm');
		pwdForm?.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (!isAuthenticated()) {
				openAuthModal();
				return;
			}
			const form = e.currentTarget;
			const submit = form.querySelector('button[type="submit"]');
			submit.disabled = true;
			try {
				const fd = new FormData(form);
				const payload = {
					actual: String(fd.get('actual') || ''),
					nueva: String(fd.get('nueva') || '')
				};
				const res = await fetch(`${API_BASE}/api/auth/password`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${getAuthToken()}`
					},
					body: JSON.stringify(payload)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data?.message || 'No fue posible cambiar la contraseña');
				// Limpiar campos por seguridad
				form.reset();
				showToast('Contraseña actualizada');
			} catch (err) {
				showToast(err.message || 'Error al cambiar contraseña');
			} finally {
				submit.disabled = false;
			}
		});

		// Logout
		const logoutBtn = document.getElementById('navLogoutBtn');
		logoutBtn?.addEventListener('click', () => {
			clearAuth();
			renderAuthNav();
			showToast('Sesión cerrada');
		});
	}

	async function loadAndRenderProducts() {
		const params = new URLSearchParams();
		if (selectedCategoryId) params.set('categoria_id', String(selectedCategoryId));
		const grid = document.getElementById('productsGrid');
		if (grid) grid.innerHTML = `<div class="col-12"><div class="alert alert-light border">Cargando productos...</div></div>`;
		const res = await fetch(`${API_BASE}/api/productos${params.toString() ? `?${params.toString()}` : ''}`);
		const data = await res.json();
		productos = Array.isArray(data) ? data : [];
		const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
		const filtered = !q
			? productos
			: productos.filter((p) => [p.nombre, p.descripcion, p.sku].filter(Boolean).join(' ').toLowerCase().includes(q));
		renderProducts(filtered);
	}

	// ---- Init ----
	async function init() {
		// Año footer
		const y = document.getElementById('year');
		if (y) y.textContent = String(new Date().getFullYear());

		try {
			// Cargar categorías y filtros
			const catRes = await fetch(`${API_BASE}/api/categorias`);
			const catData = await catRes.json();
			categorias = Array.isArray(catData) ? catData.filter(c => c.activo) : [];
			renderCategoryFilters();

			// Cargar productos
			await loadAndRenderProducts();

			// Sanea carrito contra catálogo actual (elimina productos inexistentes o cantidades inválidas)
			let changed = false;
			const valid = [];
			for (const it of cart) {
				const pid = Number(it?.producto_id);
				const qty = Number(it?.cantidad);
				const prod = productos.find((p) => p.id === pid);
				if (!prod) {
					changed = true;
					continue;
				}
				const safeQty = Math.max(1, Math.min(qty || 0, prod.existencias));
				if (!Number.isInteger(safeQty)) {
					changed = true;
					continue;
				}
				valid.push({ producto_id: pid, cantidad: safeQty });
				if (safeQty !== qty) changed = true;
			}
			if (changed) {
				cart = valid;
				saveCart();
			}

			updateCartBadge();
		} catch {
			const grid = document.getElementById('productsGrid');
			if (grid) {
				grid.innerHTML = `
					<div class="col-12">
						<div class="alert alert-danger">No se pudieron cargar los productos.</div>
					</div>
				`;
			}
		}

		// Manejo de formularios de autenticación
		const loginForm = document.getElementById('authLoginForm');
		const registerForm = document.getElementById('authRegisterForm');

		loginForm?.addEventListener('submit', async (e) => {
			e.preventDefault();
			const form = e.currentTarget;
			const submit = form.querySelector('button[type="submit"]');
			submit.disabled = true;
			try {
				const payload = Object.fromEntries(new FormData(form).entries());
				const res = await fetch(`${API_BASE}/api/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data?.message || 'No fue posible iniciar sesión');
				setAuth(data.token, data.user);
				showToast(`Bienvenido, ${data?.user?.nombre || 'Cliente'}.`);
				document.querySelector('#authModal .btn-close')?.click();
				renderAuthNav();
				if (typeof afterAuthAction === 'function') {
					const fn = afterAuthAction;
					afterAuthAction = null;
					setTimeout(fn, 150); // ejecutar después de cerrar el modal
				}
			} catch (err) {
				showToast(err.message || 'Error al iniciar sesión');
			} finally {
				submit.disabled = false;
			}
		});

		registerForm?.addEventListener('submit', async (e) => {
			e.preventDefault();
			const form = e.currentTarget;
			const submit = form.querySelector('button[type="submit"]');
			submit.disabled = true;
			try {
				const entries = Object.fromEntries(new FormData(form).entries());
				const payload = {
					nombre: entries.nombre,
					apellido: entries.apellido,
					correo: entries.correo,
					telefono: entries.telefono || null,
					password: entries.password
				};
				const res = await fetch(`${API_BASE}/api/auth/register`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data?.message || 'No fue posible registrar');
				setAuth(data.token, data.user);
				showToast(`Cuenta creada. Hola, ${data?.user?.nombre || 'Cliente'}.`);
				document.querySelector('#authModal .btn-close')?.click();
				renderAuthNav();
				if (typeof afterAuthAction === 'function') {
					const fn = afterAuthAction;
					afterAuthAction = null;
					setTimeout(fn, 150);
				}
			} catch (err) {
				showToast(err.message || 'Error al registrarse');
			} finally {
				submit.disabled = false;
			}
		});

		// Inicializar UI auth y perfil
		renderAuthNav();
		wireProfileUI();
	}

	document.addEventListener('DOMContentLoaded', init);
})();


