
const SEED_PRODUCTS = [
    {
        id: "seed-1",
        name: "Arroz Diana Premium",
        brand: "Diana",
        qty: 5,
        minQty: 2,
        category: "Mercado",
        purchaseDate: "2026-05-10",
        expiryDate: "2026-11-20",
        imageUrl: "",
        history: [
            { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), qtyChange: -1, actionType: "decrease" },
            { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), qtyChange: -1, actionType: "decrease" }
        ]
    },
    {
        id: "seed-2",
        name: "Shampoo Pro-V Restauración",
        brand: "Pantene",
        qty: 1,
        minQty: 2,
        category: "Productos personales",
        purchaseDate: "2026-04-05",
        expiryDate: "2028-04-05",
        imageUrl: "",
        // Simulación histórica: Consume una botella cada 45 días (15 de Marzo, 30 de Abril)
        history: [
            { date: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(), qtyChange: -1, actionType: "decrease" },
            { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), qtyChange: -1, actionType: "decrease" }
        ]
    },
    {
        id: "seed-3",
        name: "Acetaminofén 500mg",
        brand: "Genfar",
        qty: 8,
        minQty: 3,
        category: "Medicamentos",
        purchaseDate: "2026-04-15",
        // Vence en 3 días para detonar la alerta visual en el Dashboard
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        imageUrl: "",
        history: []
    },
    {
        id: "seed-4",
        name: "Detergente Líquido Concentrado",
        brand: "Ariel",
        qty: 3,
        minQty: 1,
        category: "Limpieza",
        purchaseDate: "2026-05-01",
        expiryDate: "2028-05-01",
        imageUrl: "",
        history: []
    },
    {
        id: "seed-5",
        name: "Labial Matte SuperStay",
        brand: "Maybelline",
        qty: 2,
        minQty: 1,
        category: "Maquillaje",
        purchaseDate: "2026-05-01",
        expiryDate: "2027-05-01",
        imageUrl: "",
        history: []
    },
    {
        id: "seed-6",
        name: "Papel Higiénico Triple Hoja",
        brand: "Familia",
        qty: 0, // Agotado para probar el estado crítico
        minQty: 2,
        category: "Productos de aseo",
        purchaseDate: "2026-05-02",
        expiryDate: "2030-01-01",
        imageUrl: "",
        history: [
            { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), qtyChange: -2, actionType: "decrease" }
        ]
    }
];

// Colores hermosos para las categorías (Usados en los gráficos)
const CATEGORY_COLORS = {
    "Mercado": "#6366f1",            // Indigo
    "Productos de aseo": "#10b981",  // Esmeralda
    "Limpieza": "#0ea5e9",           // Sky blue
    "Maquillaje": "#ec4899",         // Pink
    "Medicamentos": "#f59e0b",       // Amber
    "Productos personales": "#8b5cf6" // Violet
};

// Iconos correspondientes a cada categoría
const CATEGORY_ICONS = {
    "Mercado": "fa-solid fa-cart-shopping",
    "Productos de aseo": "fa-solid fa-soap",
    "Limpieza": "fa-solid fa-broom",
    "Maquillaje": "fa-solid fa-sparkles",
    "Medicamentos": "fa-solid fa-pills",
    "Productos personales": "fa-solid fa-hands-holding-child"
};

// ==========================================================================
// A. ENRUTAMIENTO, SESIÓN Y GUARDIAS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Tema Claro / Oscuro según guardado
    const savedTheme = localStorage.getItem('hogar_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    syncThemeToggleIcons(savedTheme);

    // Detectar página actual e inicializar lógica específica
    if (document.getElementById('register-form')) {
        initRegisterPage();
    } else if (document.getElementById('login-form')) {
        initLoginPage();
    } else if (document.querySelector('.app-layout')) {
        initDashboardPage();
    }
});

// --- FUNCIONES AUXILIARES DE PERSISTENCIA Y UX DE SUPABASE ---
function showLoadingOverlay(show, text = "Sincronizando...") {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.add('active');
        const textEl = overlay.querySelector('.loading-text');
        if (textEl) textEl.textContent = text;
    } else {
        overlay.classList.remove('active');
    }
}

function mapProductFromDB(dbProd) {
    return {
        id: dbProd.id,
        name: dbProd.name || '',
        brand: dbProd.brand || '',
        qty: parseInt(dbProd.qty) || 0,
        minQty: parseInt(dbProd.min_qty !== undefined ? dbProd.min_qty : dbProd.minQty) || 2,
        category: dbProd.category || '',
        purchaseDate: dbProd.purchase_date || dbProd.purchaseDate || '',
        expiryDate: dbProd.expiry_date || dbProd.expiryDate || '',
        imageUrl: dbProd.image_url || dbProd.imageUrl || '',
        history: Array.isArray(dbProd.history) ? dbProd.history : (typeof dbProd.history === 'string' ? JSON.parse(dbProd.history) : [])
    };
}

async function safeSaveToSupabase(table, payload, isInsert = true, matchId = null, matchUserId = null) {
    let currentPayload = { ...payload };
    let attempts = 0;
    const maxAttempts = 12;

    while (attempts < maxAttempts) {
        let result;
        if (isInsert) {
            result = await window.supabaseClient.from(table).insert([currentPayload]);
        } else {
            result = await window.supabaseClient.from(table)
                .update(currentPayload)
                .eq('id', matchId)
                .eq('user_id', matchUserId);
        }

        if (!result.error) {
            return { data: result.data, error: null };
        }

        const errMsg = result.error.message || '';
        console.warn(`Supabase save attempt ${attempts} failed:`, errMsg);

        // Buscar errores de columnas inexistentes
        const match = errMsg.match(/column ["']([^"']+)["'] of relation/i) || errMsg.match(/column ["']([^"']+)["'] does not exist/i);
        if (match && match[1]) {
            const missingColumn = match[1];
            console.log(`Auto-curación: eliminando columna inexistente "${missingColumn}" del payload.`);
            delete currentPayload[missingColumn];
            attempts++;
            continue;
        }

        // Si es otro tipo de error, lo devolvemos
        return { data: null, error: result.error };
    }

    return { data: null, error: { message: "Excedido el número máximo de intentos de curación de columnas." } };
}

// Guardias para el Dashboard: Verificar sesión activa
async function checkAuthSession() {
    if (!window.isSupabaseConfigured) {
        const session = JSON.parse(localStorage.getItem('hogar_sesion'));
        if (!session || !session.currentUser) {
            window.location.href = 'login.html';
            return null;
        }
        return session;
    }

    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error || !session || !session.user) {
            window.location.href = 'login.html';
            return null;
        }
        return session;
    } catch (err) {
        console.error("Error al validar sesión en Supabase:", err);
        window.location.href = 'login.html';
        return null;
    }
}

// Sincronizar iconos del botón de tema
function syncThemeToggleIcons(theme) {
    const icons = document.querySelectorAll('#theme-toggle i, #dashboard-theme-toggle i');
    icons.forEach(icon => {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    });
}

// Alternar entre temas claro y oscuro
function setupThemeToggler(buttonId) {
    const themeBtn = document.getElementById(buttonId);
    if (!themeBtn) return;
    
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('hogar_theme', newTheme);
        syncThemeToggleIcons(newTheme);
        showToast(`Apariencia cambiada a modo ${newTheme === 'dark' ? 'oscuro' : 'claro'}.`, 'info');
    });
}

// ==========================================================================
// B. LÓGICA DE REGISTRO (`register.html`)
// ==========================================================================

function initRegisterPage() {
    setupThemeToggler('theme-toggle');
    const form = document.getElementById('register-form');
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');

    // Escuchar eventos de validación interactiva "input"
    nameInput.addEventListener('input', () => validateField(nameInput, nameInput.value.trim().length >= 3, 'feedback-name'));
    emailInput.addEventListener('input', () => validateField(emailInput, validateEmail(emailInput.value), 'feedback-email'));
    passwordInput.addEventListener('input', () => validateField(passwordInput, passwordInput.value.length >= 6, 'feedback-password'));
    confirmInput.addEventListener('input', () => validateField(confirmInput, confirmInput.value === passwordInput.value, 'feedback-confirm'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Realizar validaciones finales
        const isNameValid = nameInput.value.trim().length >= 3;
        const isEmailValid = validateEmail(emailInput.value);
        const isPasswordValid = passwordInput.value.length >= 6;
        const isConfirmValid = confirmInput.value === passwordInput.value;

        validateField(nameInput, isNameValid, 'feedback-name');
        validateField(emailInput, isEmailValid, 'feedback-email');
        validateField(passwordInput, isPasswordValid, 'feedback-password');
        validateField(confirmInput, isConfirmValid, 'feedback-confirm');

        if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
            showToast('Por favor, corrige los errores en el formulario.', 'danger');
            return;
        }

        // Registrar usuario en LocalStorage
        const users = JSON.parse(localStorage.getItem('hogar_usuarios')) || [];
        const emailExists = users.some(u => u.email.toLowerCase() === emailInput.value.toLowerCase());

        if (emailExists) {
            showToast('Este correo ya se encuentra registrado.', 'danger');
            validateField(emailInput, false, 'feedback-email');
            document.getElementById('feedback-email').textContent = 'El correo ya está registrado.';
            return;
        }

        const newUser = {
            name: nameInput.value.trim(),
            email: emailInput.value.toLowerCase(),
            password: passwordInput.value
        };

        users.push(newUser);
        localStorage.setItem('hogar_usuarios', JSON.stringify(users));

        showToast('¡Cuenta creada con éxito! Redirigiendo...', 'success');
        
        // Redirigir al Login después de 1.5 segundos
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    });
}

// ==========================================================================
// C. LÓGICA DE INICIO DE SESIÓN (`login.html`)
// ==========================================================================

function initLoginPage() {
    setupThemeToggler('theme-toggle');
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberCheckbox = document.getElementById('login-remember');

    if (window.isSupabaseConfigured) {
        window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) {
                window.location.href = 'dashboard.html';
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isEmailValid = validateEmail(emailInput.value);
        const isPasswordValid = passwordInput.value.length > 0;

        validateField(emailInput, isEmailValid, 'feedback-login-email');
        validateField(passwordInput, isPasswordValid, 'feedback-login-password');

        if (!isEmailValid || !isPasswordValid) {
            showToast('Por favor llena los campos obligatorios.', 'danger');
            return;
        }

        if (window.isSupabaseConfigured) {
            try {
                showLoadingOverlay(true, "Iniciando sesión segura...");
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email: emailInput.value.trim(),
                    password: passwordInput.value
                });
                showLoadingOverlay(false);

                if (error) {
                    showToast(error.message, 'danger');
                    return;
                }

                const user = data.user;
                const name = user.user_metadata?.full_name || user.email.split('@')[0];
                showToast(`¡Hola de nuevo, ${name}! Iniciando sesión...`, 'success');

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);

            } catch (err) {
                showLoadingOverlay(false);
                console.error(err);
                showToast('Error de conexión con la base de datos.', 'danger');
            }
        } else {
            const users = JSON.parse(localStorage.getItem('hogar_usuarios')) || [];
            const user = users.find(u => u.email.toLowerCase() === emailInput.value.toLowerCase() && u.password === passwordInput.value);

            if (!user) {
                showToast('Credenciales incorrectas. Intenta de nuevo.', 'danger');
                return;
            }

            const sessionData = {
                currentUser: user.email,
                name: user.name,
                remember: rememberCheckbox.checked
            };
            localStorage.setItem('hogar_sesion', JSON.stringify(sessionData));

            showToast(`¡Hola de nuevo, ${user.name}! Iniciando sesión...`, 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1200);
        }
    });
}

// ==========================================================================
// D. LÓGICA DEL PANEL DE CONTROL (SPA - `dashboard.html`)
// ==========================================================================

// Variables de Estado de la Aplicación en Ejecución
let currentUserEmail = '';
let currentUserName = '';
let currentUserId = '';
let allProducts = [];
let activityLogs = [];
let currentCategoryFilter = 'all';
let currentSearchQuery = '';
let currentStatusFilter = 'all';

async function initDashboardPage() {
    // 1. Validar Seguridad de Sesión
    showLoadingOverlay(true, "Iniciando sesión segura...");
    const session = await checkAuthSession();
    if (!session) {
        showLoadingOverlay(false);
        return;
    }
    
    if (window.isSupabaseConfigured && session.user) {
        currentUserEmail = session.user.email;
        currentUserName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        currentUserId = session.user.id;
    } else {
        currentUserEmail = session.currentUser;
        currentUserName = session.name;
        currentUserId = null;
    }

    // Cargar Nombre de Usuario en Sidebar y Avatar
    document.getElementById('sidebar-username').textContent = currentUserName;
    const avatarLetter = currentUserName ? currentUserName.charAt(0).toUpperCase() : 'U';
    document.getElementById('sidebar-avatar').textContent = avatarLetter;


    // Saludo Dinámico según la hora
    const hours = new Date().getHours();
    let greeting = 'Buenos días';
    if (hours >= 12 && hours < 19) greeting = 'Buenas tardes';
    else if (hours >= 19 || hours < 6) greeting = 'Buenas noches';
    document.getElementById('navbar-greeting').textContent = `¡${greeting}, ${currentUserName}!`;

    // Fecha actual
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('navbar-date').textContent = new Date().toLocaleDateString('es-ES', options);

    // 2. Configurar Alternancia de Tema y Botón de Cerrar Sesión
    setupThemeToggler('dashboard-theme-toggle');
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // 3. Cargar Base de Datos de Productos del usuario
    showLoadingOverlay(true, "Cargando inventario...");
    await loadUserData();
    showLoadingOverlay(false);

    // 4. Inicializar Navegación SPA (Toggles de Sidebar)
    setupSPANavigation();

    // 5. Configurar Componentes de Inventario y Notificaciones
    setupInventoryActions();
    setupNotificationSystem();

    // 6. Renderizar Todo por Primera Vez
    renderApp();
}

// Cargar y sembrar datos del usuario
async function loadUserData() {
    if (!window.isSupabaseConfigured) {
        const userProductsKey = `hogar_productos_${currentUserEmail}`;
        const userLogsKey = `hogar_logs_${currentUserEmail}`;
        
        const storedProducts = localStorage.getItem(userProductsKey);
        const storedLogs = localStorage.getItem(userLogsKey);

        if (storedProducts) {
            allProducts = JSON.parse(storedProducts);
        } else {
            allProducts = [];
        }

        if (storedLogs) {
            activityLogs = JSON.parse(storedLogs);
        } else {
            activityLogs = [];
        }
        return;
    }

    try {
        const { data: dbProducts, error: prodError } = await window.supabaseClient
            .from('productos')
            .select('*')
            .eq('user_id', currentUserId);

        if (prodError) {
            console.error("Error cargando productos de Supabase:", prodError);
            showToast("Error al cargar inventario de la nube. Usando copia local.", "warning");
            return;
        }

        if (dbProducts && dbProducts.length > 0) {
            allProducts = dbProducts.map(mapProductFromDB);
        } else {
            allProducts = [];
        }

        const { data: dbLogs, error: logsError } = await window.supabaseClient
            .from('logs_actividad')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!logsError && dbLogs && dbLogs.length > 0) {
            activityLogs = dbLogs.map(l => ({
                id: l.id,
                productName: l.product_name || l.productName,
                qtyChange: l.qty_change || l.qtyChange,
                date: l.date || l.created_at,
                actionType: l.action_type || l.actionType
            }));
        } else {
            const userLogsKey = `hogar_logs_${currentUserEmail}`;
            const storedLogs = localStorage.getItem(userLogsKey);
            if (storedLogs) {
                activityLogs = JSON.parse(storedLogs);
            } else {
                activityLogs = [];
            }
        }

    } catch (err) {
        console.error("Error en loadUserData:", err);
    }
}

// Guardar los productos actuales en LocalStorage
function saveProducts() {
    const userProductsKey = `hogar_productos_${currentUserEmail}`;
    localStorage.setItem(userProductsKey, JSON.stringify(allProducts));
}

// Guardar los logs de actividad en LocalStorage
function saveLogs() {
    const userLogsKey = `hogar_logs_${currentUserEmail}`;
    localStorage.setItem(userLogsKey, JSON.stringify(activityLogs));
}

// Registrar Log de Actividad
async function addActivityLog(productName, qtyChange, actionType) {
    const newLog = {
        id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        productName,
        qtyChange,
        date: new Date().toISOString(),
        actionType // 'increase', 'decrease', 'create', 'update', 'delete', 'finished'
    };
    activityLogs.unshift(newLog); // Al inicio
    saveLogs();

    if (window.isSupabaseConfigured) {
        try {
            const logPayload = {
                id: newLog.id,
                user_id: currentUserId,
                product_name: productName,
                productName: productName,
                qty_change: qtyChange,
                qtyChange: qtyChange,
                action_type: actionType,
                actionType: actionType
            };
            
            await window.supabaseClient
                .from('logs_actividad')
                .insert([logPayload]);
        } catch (e) {
            console.warn("La tabla logs_actividad no existe o no tiene permisos. Se usará el respaldo local de logs.");
        }
    }
}

// Navegación SPA entre secciones
function setupSPANavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu .sidebar-item');
    const views = document.querySelectorAll('.dashboard-view-pane');
    const sidebar = document.getElementById('app-sidebar');
    const sidebarMobileToggle = document.getElementById('sidebar-toggle-mobile');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const link = item.querySelector('a');
            if (link && link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
                return;
            }
            e.preventDefault();
            
            // Activar botón de menú
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Mostrar vista correspondiente
            const targetViewId = item.getAttribute('data-target');
            views.forEach(v => {
                if (v.id === targetViewId) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });

            // En móvil, colapsar sidebar tras hacer clic
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                sidebarMobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }

            // Volver a renderizar componentes si es necesario
            renderApp();
        });
    });

    // Toggle de Sidebar Móvil (Botón Flotante)
    if (sidebarMobileToggle) {
        sidebarMobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            if (sidebar.classList.contains('active')) {
                sidebarMobileToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            } else {
                sidebarMobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });
    }
}

// Cerrar sesión
async function handleLogout() {
    if (window.isSupabaseConfigured) {
        try {
            await window.supabaseClient.auth.signOut();
        } catch (e) {
            console.error(e);
        }
    }
    localStorage.removeItem('hogar_sesion');
    showToast('Sesión cerrada con éxito. Redirigiendo...', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ==========================================================================
// E. CONTROLADORES DEL INVENTARIO (CRUD)
// ==========================================================================

function setupInventoryActions() {
    const addProductBtn = document.getElementById('add-product-btn');
    const modal = document.getElementById('product-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const form = document.getElementById('product-form');
    
    // Inputs de búsqueda y filtros
    const searchInput = document.getElementById('inventory-search');
    const globalSearch = document.getElementById('global-search');
    const filterStatusSelect = document.getElementById('filter-status');
    const categoryTabs = document.querySelectorAll('#category-tabs .tab-btn');

    // 1. Abrir Modal de creación
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            openProductModal();
        });
    }

    // 2. Cerrar Modal
    const closeModalFn = () => {
        modal.classList.remove('active');
        form.reset();
        document.getElementById('prod-id').value = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModalFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalFn);

    // 3. Procesar formulario del producto
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleProductFormSubmit(closeModalFn);
        });
    }

    // 4. Buscador Local (Festa del Inventario)
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderProductsGrid();
        });
    }

    // 5. Buscador Global Navbar (SPA redirect)
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            
            // Forzar redirección al panel de inventario
            const invTab = document.querySelector('[data-target="view-inventory"]');
            if (invTab && !invTab.classList.contains('active')) {
                invTab.click();
            }
            
            // Pasar la consulta de búsqueda a la barra del inventario y filtrar
            const localSearch = document.getElementById('inventory-search');
            if (localSearch) localSearch.value = currentSearchQuery;
            
            renderProductsGrid();
        });
    }

    // 6. Filtrar por Estado
    if (filterStatusSelect) {
        filterStatusSelect.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            renderProductsGrid();
        });
    }

    // 7. Filtrar por Categoría (Tabs)
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentCategoryFilter = tab.getAttribute('data-category');
            renderProductsGrid();
        });
    });
}

// Abrir el modal de productos (para agregar o editar)
function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    const prodId = document.getElementById('prod-id');
    const prodName = document.getElementById('prod-name');
    const prodBrand = document.getElementById('prod-brand');
    const prodCategory = document.getElementById('prod-category');
    const prodQty = document.getElementById('prod-qty');
    const prodMinQty = document.getElementById('prod-min-qty');
    const prodPurchaseDate = document.getElementById('prod-purchase-date');
    const prodExpiryDate = document.getElementById('prod-expiry-date');
    const prodImageUrl = document.getElementById('prod-image-url');

    // Hoy por defecto para las fechas
    const today = new Date().toISOString().split('T')[0];

    if (product) {
        // Modo Edición
        modalTitle.textContent = "Editar Producto";
        submitBtn.innerHTML = 'Actualizar Producto <i class="fa-solid fa-rotate"></i>';
        
        prodId.value = product.id;
        prodName.value = product.name;
        prodBrand.value = product.brand;
        prodCategory.value = product.category;
        prodQty.value = product.qty;
        prodMinQty.value = product.minQty || 2;
        prodPurchaseDate.value = product.purchaseDate;
        prodExpiryDate.value = product.expiryDate;
        prodImageUrl.value = product.imageUrl || '';
    } else {
        // Modo Creación
        modalTitle.textContent = "Agregar Nuevo Producto";
        submitBtn.innerHTML = 'Guardar Producto <i class="fa-solid fa-save"></i>';
        
        prodId.value = '';
        prodName.value = '';
        prodBrand.value = '';
        prodCategory.value = '';
        prodQty.value = '';
        prodMinQty.value = '2';
        prodPurchaseDate.value = today;
        prodExpiryDate.value = '';
        prodImageUrl.value = '';
    }

    modal.classList.add('active');
}

// Guardar o Actualizar Producto
async function handleProductFormSubmit(closeCallback) {
    const prodId = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const brand = document.getElementById('prod-brand').value.trim();
    const category = document.getElementById('prod-category').value;
    const qty = parseInt(document.getElementById('prod-qty').value);
    const minQty = parseInt(document.getElementById('prod-min-qty').value) || 2;
    const purchaseDate = document.getElementById('prod-purchase-date').value;
    const expiryDate = document.getElementById('prod-expiry-date').value;
    const imageUrl = document.getElementById('prod-image-url').value.trim();

    // Validaciones
    if (!name || !brand || !category || isNaN(qty) || qty < 0 || !purchaseDate || !expiryDate) {
        showToast('Por favor, completa todos los campos marcados con (*).', 'danger');
        return;
    }

    showLoadingOverlay(true, "Guardando producto...");

    if (prodId) {
        // EDITAR
        const index = allProducts.findIndex(p => p.id === prodId);
        if (index !== -1) {
            const oldQty = allProducts[index].qty;
            const diff = qty - oldQty;

            // Conservar el historial existente del producto
            const currentHistory = allProducts[index].history || [];
            
            // Si cambió la cantidad, registrar evento de cambio en su historial
            if (diff !== 0) {
                currentHistory.unshift({
                    date: new Date().toISOString(),
                    qtyChange: diff,
                    actionType: diff > 0 ? "increase" : "decrease"
                });
                await addActivityLog(name, diff, diff > 0 ? "increase" : "decrease");
            }

            const updatedProduct = {
                ...allProducts[index],
                name, brand, category, qty, minQty, purchaseDate, expiryDate, imageUrl,
                history: currentHistory
            };

            if (window.isSupabaseConfigured) {
                const dbPayload = {
                    name,
                    brand,
                    category,
                    qty,
                    min_qty: minQty,
                    purchase_date: purchaseDate,
                    expiry_date: expiryDate,
                    image_url: imageUrl,
                    history: currentHistory
                };

                const { error } = await safeSaveToSupabase('productos', dbPayload, false, prodId, currentUserId);

                if (error) {
                    console.error("Error al actualizar en Supabase:", error);
                    showToast("Error al guardar en la base de datos: " + error.message, "danger");
                    showLoadingOverlay(false);
                    return;
                }
            }

            allProducts[index] = updatedProduct;
            showToast('Producto actualizado exitosamente.', 'success');
        }
    } else {
        // AGREGAR
        const newId = "prod-" + Date.now();
        const newProduct = {
            id: newId,
            name, brand, category, qty, minQty, purchaseDate, expiryDate, imageUrl,
            history: []
        };

        if (window.isSupabaseConfigured) {
            const dbPayload = {
                id: newId,
                user_id: currentUserId,
                name,
                brand,
                category,
                qty,
                min_qty: minQty,
                purchase_date: purchaseDate,
                expiry_date: expiryDate,
                image_url: imageUrl,
                history: []
            };

            const { error } = await safeSaveToSupabase('productos', dbPayload, true);

            if (error) {
                console.error("Error al guardar nuevo producto en Supabase:", error);
                showToast("Error al insertar en la base de datos: " + error.message, "danger");
                showLoadingOverlay(false);
                return;
            }
        }

        allProducts.push(newProduct);
        await addActivityLog(name, qty, "create");
        showToast('Producto agregado al inventario.', 'success');
    }

    saveProducts();
    showLoadingOverlay(false);
    closeCallback();
    renderApp();
}

// Eliminar un producto
async function deleteProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    if (confirm(`¿Estás seguro de que deseas eliminar "${product.name}" del inventario?`)) {
        showLoadingOverlay(true, "Eliminando producto...");
        
        if (window.isSupabaseConfigured) {
            const { error } = await window.supabaseClient
                .from('productos')
                .delete()
                .eq('id', id)
                .eq('user_id', currentUserId);

            if (error) {
                console.error("Error eliminando producto de Supabase:", error);
                showToast("Error al eliminar el producto de la nube.", "danger");
                showLoadingOverlay(false);
                return;
            }
        }

        allProducts = allProducts.filter(p => p.id !== id);
        saveProducts();
        await addActivityLog(product.name, -product.qty, "delete");
        showLoadingOverlay(false);
        showToast('Producto eliminado.', 'warning');
        renderApp();
    }
}

// Control Rápido de Stock (+ y - en las tarjetas)
async function modifyStock(id, amount) {
    const index = allProducts.findIndex(p => p.id === id);
    if (index === -1) return;

    const prod = allProducts[index];
    const newQty = prod.qty + amount;

    if (newQty < 0) {
        showToast('La cantidad no puede ser menor a cero.', 'warning');
        return;
    }

    showLoadingOverlay(true, "Actualizando stock...");

    const amountLabel = amount > 0 ? 'increase' : 'decrease';
    const currentHistory = prod.history || [];
    currentHistory.unshift({
        date: new Date().toISOString(),
        qtyChange: amount,
        actionType: amountLabel
    });

    if (window.isSupabaseConfigured) {
        const { error } = await window.supabaseClient
            .from('productos')
            .update({ 
                qty: newQty,
                history: currentHistory
            })
            .eq('id', id)
            .eq('user_id', currentUserId);

        if (error) {
            console.error("Error al modificar stock en Supabase:", error);
            showToast("Error al guardar cambios de stock en la nube.", "danger");
            showLoadingOverlay(false);
            return;
        }
    }

    prod.qty = newQty;
    prod.history = currentHistory;

    saveProducts();
    await addActivityLog(prod.name, amount, amountLabel);
    showLoadingOverlay(false);

    if (newQty === 0) {
        showToast(`¡Agotado! "${prod.name}" se ha quedado sin stock.`, 'danger');
    } else if (newQty <= prod.minQty) {
        showToast(`Bajo stock: Te quedan ${newQty} u. de "${prod.name}".`, 'warning');
    } else {
        showToast(`Cantidad de "${prod.name}" actualizada a ${newQty}.`, 'success');
    }

    renderApp();
}

async function markAsFinished(id) {
    const index = allProducts.findIndex(p => p.id === id);
    if (index === -1) return;

    const prod = allProducts[index];
    if (prod.qty === 0) {
        showToast('El producto ya se encuentra agotado.', 'info');
        return;
    }

    const currentQty = prod.qty;
    showLoadingOverlay(true, "Marcando como terminado...");
    
    const currentHistory = prod.history || [];
    currentHistory.unshift({
        date: new Date().toISOString(),
        qtyChange: -currentQty,
        actionType: 'finished'
    });

    if (window.isSupabaseConfigured) {
        const { error } = await window.supabaseClient
            .from('productos')
            .update({ 
                qty: 0,
                history: currentHistory
            })
            .eq('id', id)
            .eq('user_id', currentUserId);

        if (error) {
            console.error("Error al terminar producto en Supabase:", error);
            showToast("Error al actualizar estado en la nube.", "danger");
            showLoadingOverlay(false);
            return;
        }
    }

    prod.qty = 0;
    prod.history = currentHistory;

    saveProducts();
    await addActivityLog(prod.name, -currentQty, 'finished');
    showLoadingOverlay(false);
    showToast(`"${prod.name}" marcado como terminado.`, 'danger');
    renderApp();
}

// ==========================================================================
// F. MOTOR INTELIGENTE (Patrones de consumo y sugerencias)
// ==========================================================================

function getConfidenceLabel(count) {
    if (count >= 6) return { label: 'Alta', color: 'var(--color-success)' };
    if (count >= 3) return { label: 'Media', color: 'var(--color-warning)' };
    return { label: 'Baja', color: 'var(--color-text-muted)' };
}

function calcWeightedAvgIntervals(dates) {
    let totalWeight = 0;
    let weightedSum = 0;
    const n = dates.length;
    for (let i = 1; i < n; i++) {
        const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        const weight = i / (n - 1);
        weightedSum += diff * weight;
        totalWeight += weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function calcTrend(dates) {
    if (dates.length < 4) return 'estable';
    const mid = Math.floor(dates.length / 2);
    const firstHalf = dates.slice(0, mid);
    const secondHalf = dates.slice(mid);
    let firstSum = 0, secondSum = 0;
    for (let i = 1; i < firstHalf.length; i++) firstSum += (firstHalf[i] - firstHalf[i - 1]) / (1000 * 60 * 60 * 24);
    for (let i = 1; i < secondHalf.length; i++) secondSum += (secondHalf[i] - secondHalf[i - 1]) / (1000 * 60 * 60 * 24);
    const firstAvg = firstSum / (firstHalf.length - 1);
    const secondAvg = secondSum / (secondHalf.length - 1);
    if (secondAvg < firstAvg * 0.7) return 'acelerando';
    if (secondAvg > firstAvg * 1.3) return 'desacelerando';
    return 'estable';
}

function runIntelligentAnalyzer() {
    const insights = [];
    const shoppingList = [];
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    allProducts.forEach(prod => {
        const expiry = new Date(prod.expiryDate);
        const daysToExpiry = Math.ceil((expiry - todayMidnight) / (1000 * 60 * 60 * 24));

        // --- 1. Alerta de Vencimiento ---
        if (daysToExpiry < 0) {
            insights.push({
                type: 'danger', productName: prod.name,
                text: `Tu <span class="rec-product">${prod.name}</span> vencio el ${prod.expiryDate}. Deberias desecharlo.`,
                actionLabel: 'Comprar', actionParam: prod.id
            });
            shoppingList.push({ name: prod.name, reason: 'Vencido' });
        } else if (daysToExpiry <= 7) {
            insights.push({
                type: 'warning', productName: prod.name,
                text: `Tu <span class="rec-product">${prod.name}</span> vence en ${daysToExpiry} dias (${prod.expiryDate}).`,
                actionLabel: 'Revisar', actionParam: prod.id
            });
        }

        // --- 2. Alerta de Stock ---
        if (prod.qty === 0) {
            insights.push({
                type: 'danger', productName: prod.name,
                text: `Te has quedado sin <span class="rec-product">${prod.name}</span>. Agregalo a tu lista de compras.`,
                actionLabel: 'Abastecer', actionParam: prod.id
            });
            shoppingList.push({ name: prod.name, reason: 'Agotado' });
        } else if (prod.qty <= prod.minQty) {
            insights.push({
                type: 'warning', productName: prod.name,
                text: `Te queda poco <span class="rec-product">${prod.name}</span> (${prod.qty} u.). Minimo recomendado: ${prod.minQty} u.`,
                actionLabel: 'Añadir', actionParam: prod.id
            });
            shoppingList.push({ name: prod.name, reason: 'Bajo Stock' });
        }

        // --- 3. Analisis de Frecuencia de Consumo ---
        const decreaseHistory = (prod.history || []).filter(h => h.actionType === 'decrease' || h.actionType === 'finished');
        if (decreaseHistory.length < 2) return;

        const sortedDates = decreaseHistory
            .map(h => new Date(h.date))
            .sort((a, b) => a - b);

        const avgInterval = Math.round(calcWeightedAvgIntervals(sortedDates));
        if (avgInterval <= 0) return;

        const conf = getConfidenceLabel(decreaseHistory.length);
        const trend = calcTrend(sortedDates);

        const lastConsumptionDate = sortedDates[sortedDates.length - 1];
        const msPerDay = 24 * 60 * 60 * 1000;
        const nextRunoutDate = new Date(lastConsumptionDate.getTime() + avgInterval * prod.qty * msPerDay);
        const daysToRunout = Math.ceil((nextRunoutDate - todayMidnight) / msPerDay);

        const dailyRate = avgInterval > 0 ? (1 / avgInterval) : 0;
        let buySuggestion = '';
        if (prod.qty <= prod.minQty && dailyRate > 0) {
            const daysUntilRestock = Math.max(daysToRunout, 1);
            const suggestedQty = Math.ceil(daysUntilRestock * dailyRate * 1.2);
            buySuggestion = ` Te sugerimos comprar <strong>${suggestedQty} u.</strong> para cubrir el periodo.`;
        }

        let trendIcon = '';
        let trendText = '';
        if (trend === 'acelerando') { trendIcon = '<i class="fa-solid fa-arrow-trend-down"></i>'; trendText = 'consumo acelerado'; }
        else if (trend === 'desacelerando') { trendIcon = '<i class="fa-solid fa-arrow-trend-up"></i>'; trendText = 'consumo mas lento'; }
        else { trendIcon = '<i class="fa-solid fa-minus"></i>'; trendText = 'consumo estable'; }

        insights.push({
            type: 'info', productName: prod.name,
            text: `<span class="rec-product">${prod.name}</span>: consumes cada <strong>${avgInterval} dias</strong> (confianza ${conf.label}) ${trendIcon} ${trendText}. Stock actual: ${prod.qty} u. dura ~${daysToRunout > 0 ? daysToRunout : 0} dias.${buySuggestion}`,
            actionLabel: 'Saber mas', actionParam: prod.id,
            isPrediction: true, predictionVal: avgInterval
        });

        if (daysToRunout <= 5 && prod.qty > 0) {
            shoppingList.push({ name: prod.name, reason: 'Por agotarse (~' + daysToRunout + ' dias)' });
        }
    });

    return { insights, shoppingList };
}

// Renderiza la lista de recomendaciones en el Dashboard e Inteligencia
function renderIntelligenceViews(insights, shoppingList) {
    const dashInsightList = document.getElementById('dashboard-insights-list');
    const deepInsightList = document.getElementById('deep-intelligence-list');
    const shoppingListUl = document.getElementById('shopping-list-ul');
    const alertsCountBadge = document.getElementById('asistente-alerts-count');

    // 1. Burbuja de alertas en el Dashboard
    if (alertsCountBadge) alertsCountBadge.textContent = `${insights.length} sugerencias`;

    // 2. Renderizar Insights del Dashboard General
    if (dashInsightList) {
        if (insights.length === 0) {
            dashInsightList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--color-success); margin-bottom: 1rem; display:block;"></i>
                    ¡Excelente! No hay alertas de consumo críticas en este momento.
                </div>`;
        } else {
            dashInsightList.innerHTML = insights.slice(0, 5).map(ins => {
                let icon = 'fa-brain';
                let colorClass = 'icon-primary';
                if (ins.type === 'danger') { icon = 'fa-triangle-exclamation'; colorClass = 'icon-danger'; }
                if (ins.type === 'warning') { icon = 'fa-clock'; colorClass = 'icon-warning'; }

                return `
                    <div class="rec-item">
                        <div class="rec-avatar ${colorClass}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="rec-body">
                            <p class="rec-text">${ins.text}</p>
                        </div>
                        <button class="rec-action-btn" onclick="quickViewProduct('${ins.actionParam}')">${ins.actionLabel}</button>
                    </div>`;
            }).join('');
        }
    }

    // 3. Renderizar vista detallada en la sección "Análisis Inteligente"
    if (deepInsightList) {
        if (insights.length === 0) {
            deepInsightList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--color-text-muted);">
                    <i class="fa-solid fa-chart-line" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1.5rem; display:block;"></i>
                    <strong style="color:var(--color-text-main);">Recolectando información histórica...</strong>
                    <p style="font-size:0.8rem; margin-top:0.5rem;">Cuando realices cambios constantes de stock en tus productos, nuestro algoritmo de IA mostrará aquí los cálculos de tasa de consumo.</p>
                </div>`;
        } else {
            deepInsightList.innerHTML = insights.map(ins => {
                let iconClass = 'fa-brain';
                let badgeClass = 'badge-info';
                let headerTitle = 'Patrón de Consumo';

                if (ins.type === 'danger') { iconClass = 'fa-triangle-exclamation'; badgeClass = 'badge-danger'; headerTitle = 'Acción Urgente'; }
                else if (ins.type === 'warning') { iconClass = 'fa-circle-exclamation'; badgeClass = 'badge-warning'; headerTitle = 'Alerta Temprana'; }
                else if (ins.isPrediction) { iconClass = 'fa-chart-line'; badgeClass = 'badge-success'; headerTitle = 'Predicción IA'; }

                return `
                    <div class="rec-item" style="padding:1.25rem;">
                        <div class="rec-avatar" style="background:var(--bg-card); border: 1px solid var(--color-border); font-size:1.2rem;">
                            <i class="fa-solid ${iconClass}" style="color:var(--color-primary)"></i>
                        </div>
                        <div class="rec-body">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                                <strong style="font-size:0.95rem;">${headerTitle}</strong>
                                <span class="badge ${badgeClass}">${ins.type === 'danger' ? 'Critico' : ins.type === 'warning' ? 'Alerta' : ins.type === 'info' ? 'Informacion' : ins.type}</span>
                            </div>
                            <p class="rec-text" style="font-size:0.875rem; color:var(--color-text-main);">${ins.text}</p>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // 4. Renderizar Lista de Compras organizada
    if (shoppingListUl) {
        const today = new Date();
        const agotados = [];
        const porAgotarse = [];
        const seen = new Set();

        shoppingList.forEach(item => {
            if (seen.has(item.name)) return;
            seen.add(item.name);
            const prod = allProducts.find(p => p.name === item.name);
            const entry = { name: item.name, reason: item.reason, sortDate: prod ? prod.expiryDate : '' };
            if (prod && prod.qty === 0) {
                agotados.push(entry);
            } else {
                porAgotarse.push(entry);
            }
        });

        porAgotarse.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));

        if (agotados.length === 0 && porAgotarse.length === 0) {
            shoppingListUl.innerHTML = `
                <li style="text-align:center; padding: 2rem; color:var(--color-text-muted); font-size:0.875rem;">
                    <i class="fa-solid fa-square-check" style="font-size: 2rem; color: var(--color-success); margin-bottom: 0.5rem; display:block;"></i>
                    Tu despensa esta completamente al dia
                </li>`;
        } else {
            let html = '';
            if (agotados.length > 0) {
                html += `<li style="font-size:0.8rem; font-weight:700; color:var(--color-danger); padding:0.25rem 0;"><i class="fa-solid fa-circle-exclamation"></i> AGOTADOS (${agotados.length})</li>`;
                html += agotados.map(item => `
                    <li style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.8rem; background:var(--bg-input); border-radius:8px; border-left: 3px solid var(--color-danger); font-size:0.825rem;">
                        <span style="font-weight:700;"><i class="fa-solid fa-square"></i> ${item.name}</span>
                        <span class="badge badge-danger" style="font-size:0.65rem;">${item.reason}</span>
                    </li>`).join('');
            }
            if (porAgotarse.length > 0) {
                html += `<li style="font-size:0.8rem; font-weight:700; color:var(--color-warning); padding:0.25rem 0; margin-top:0.5rem;"><i class="fa-solid fa-clock"></i> POR AGOTARSE (${porAgotarse.length})</li>`;
                html += porAgotarse.map(item => `
                    <li style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.8rem; background:var(--bg-input); border-radius:8px; border-left: 3px solid var(--color-warning); font-size:0.825rem;">
                        <span style="font-weight:700;"><i class="fa-solid fa-square"></i> ${item.name}</span>
                        <span class="badge badge-warning" style="font-size:0.65rem;">${item.reason}</span>
                    </li>`).join('');
            }
            shoppingListUl.innerHTML = html;
        }

        const copyBtn = document.getElementById('btn-copy-shopping-list');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const lines = [];
                if (agotados.length) { lines.push('--- AGOTADOS ---'); agotados.forEach(i => lines.push('- ' + i.name)); }
                if (porAgotarse.length) { lines.push('--- POR AGOTARSE ---'); porAgotarse.forEach(i => lines.push('- ' + i.name)); }
                navigator.clipboard.writeText(lines.join('\n'));
                showToast('Lista de compras copiada al portapapeles.', 'success');
            };
        }
    }
}

// Acción del botón inteligente: Redirige y enfoca un producto
window.quickViewProduct = function(id) {
    // Redirigir a pestaña de inventario
    const invTab = document.querySelector('[data-target="view-inventory"]');
    if (invTab) invTab.click();

    // Filtros por defecto
    const localSearch = document.getElementById('inventory-search');
    if (localSearch) localSearch.value = '';
    currentSearchQuery = '';

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.value = 'all';
    currentStatusFilter = 'all';

    const allCatTab = document.querySelector('#category-tabs [data-category="all"]');
    if (allCatTab) allCatTab.click();

    renderProductsGrid();

    // Hacer scroll al elemento
    setTimeout(() => {
        const element = document.getElementById(`prod-card-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.borderColor = 'var(--color-primary)';
            element.style.boxShadow = '0 0 15px rgba(var(--color-primary-rgb), 0.4)';
            setTimeout(() => {
                element.style.borderColor = '';
                element.style.boxShadow = '';
            }, 3000);
        }
    }, 300);
};

// ==========================================================================
// G. GRÁFICOS INTERACTIVOS EN TIEMPO REAL (SVG)
// ==========================================================================

function drawCategoryDistributionChart() {
    const svg = document.getElementById('categories-chart');
    const legend = document.getElementById('chart-legend');
    if (!svg) return;

    // Reiniciar
    svg.innerHTML = '';
    if (legend) legend.innerHTML = '';

    if (allProducts.length === 0) {
        svg.innerHTML = `<text x="110" y="110" text-anchor="middle" dominant-baseline="middle" fill="var(--color-text-muted)" font-size="12">Sin productos</text>`;
        return;
    }

    // 1. Contar productos por categoría
    const counts = {};
    allProducts.forEach(p => {
        counts[p.category] = (counts[p.category] || 0) + 1;
    });

    const total = allProducts.length;

    // 2. Dibujar Dona SVG
    let accumulatedAngle = 0;
    const cx = 110;
    const cy = 110;
    const r = 70; // Radio del círculo
    const strokeWidth = 24;

    Object.keys(counts).forEach(cat => {
        const count = counts[cat];
        const pct = count / total;
        const angle = pct * 360;

        // Coordenadas del arco
        const x1 = cx + r * Math.cos((accumulatedAngle * Math.PI) / 180);
        const y1 = cy + r * Math.sin((accumulatedAngle * Math.PI) / 180);

        accumulatedAngle += angle;

        const x2 = cx + r * Math.cos((accumulatedAngle * Math.PI) / 180);
        const y2 = cy + r * Math.sin((accumulatedAngle * Math.PI) / 180);

        // Bandera de arco grande
        const largeArc = angle > 180 ? 1 : 0;

        const pathData = `
            M ${x1} ${y1}
            A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
        `;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", CATEGORY_COLORS[cat] || "#ccc");
        path.setAttribute("stroke-width", strokeWidth);
        path.setAttribute("style", "transition: stroke-width 0.2s; cursor: pointer;");

        // Tooltip simple
        path.innerHTML = `<title>${cat}: ${count} (${Math.round(pct * 100)}%)</title>`;

        // Efecto hover
        path.addEventListener('mouseenter', () => path.setAttribute("stroke-width", strokeWidth + 4));
        path.addEventListener('mouseleave', () => path.setAttribute("stroke-width", strokeWidth));

        svg.appendChild(path);

        // Añadir a leyenda
        if (legend) {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.gap = '0.35rem';
            legendItem.innerHTML = `
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${CATEGORY_COLORS[cat]}"></span>
                <strong>${cat}</strong> (${count})
            `;
            legend.appendChild(legendItem);
        }
    });

    // Círculo central transparente para el efecto de dona
    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerCircle.setAttribute("cx", cx);
    centerCircle.setAttribute("cy", cy);
    centerCircle.setAttribute("r", r - strokeWidth / 2 - 2);
    centerCircle.setAttribute("fill", "var(--bg-card)");
    svg.appendChild(centerCircle);

    // Texto central
    const centerTextVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerTextVal.setAttribute("x", cx);
    centerTextVal.setAttribute("y", cy - 2);
    centerTextVal.setAttribute("text-anchor", "middle");
    centerTextVal.setAttribute("dominant-baseline", "middle");
    centerTextVal.setAttribute("fill", "var(--color-text-main)");
    centerTextVal.setAttribute("font-size", "22");
    centerTextVal.setAttribute("font-weight", "800");
    centerTextVal.setAttribute("style", "transform: rotate(90deg); transform-origin: 110px 110px;");
    centerTextVal.textContent = total;
    svg.appendChild(centerTextVal);

    const centerTextLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerTextLbl.setAttribute("x", cx);
    centerTextLbl.setAttribute("y", cy + 18);
    centerTextLbl.setAttribute("text-anchor", "middle");
    centerTextLbl.setAttribute("dominant-baseline", "middle");
    centerTextLbl.setAttribute("fill", "var(--color-text-muted)");
    centerTextLbl.setAttribute("font-size", "10");
    centerTextLbl.setAttribute("font-weight", "600");
    centerTextLbl.setAttribute("style", "transform: rotate(90deg); transform-origin: 110px 110px; text-transform: uppercase; letter-spacing:0.05em;");
    centerTextLbl.textContent = total === 1 ? "Producto" : "Productos";
    svg.appendChild(centerTextLbl);
}

// ==========================================================================
// H. SISTEMA DE ALERTAS Y NOTIFICACIONES (Navbar campana)
// ==========================================================================

let activeNotifications = [];

function setupNotificationSystem() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const clearBtn = document.getElementById('notif-clear-btn');

    if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Cerrar al hacer clic afuera
        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar cerrar al hacer clic dentro
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            activeNotifications = [];
            renderNotificationBell();
            showToast('Notificaciones despejadas.', 'info');
        });
    }
}

// Genera las notificaciones basadas en estados críticos de stock y vencimiento
function updateNotificationsState(insights) {
    activeNotifications = [];

    insights.forEach(ins => {
        if (ins.type === 'danger' || ins.type === 'warning') {
            activeNotifications.push({
                id: "notif-" + Math.random().toString(36).substr(2, 5),
                type: ins.type,
                text: ins.text.replace(/<\/?[^>]+(>|$)/g, ""), // Limpiar HTML
                time: "Ahora mismo",
                actionParam: ins.actionParam
            });
        }
    });

    renderNotificationBell();
}

// Dibuja la burbuja y el listado de notificaciones en la navbar
function renderNotificationBell() {
    const countBadge = document.getElementById('notif-count');
    const container = document.getElementById('notif-items-container');
    const bellIcon = document.querySelector('#notif-bell-btn i');

    if (!countBadge || !container) return;

    const count = activeNotifications.length;

    if (count === 0) {
        countBadge.style.display = 'none';
        container.innerHTML = `<div class="notif-empty">No tienes notificaciones pendientes.</div>`;
        if (bellIcon) bellIcon.classList.remove('fa-bounce');
    } else {
        countBadge.style.display = 'flex';
        countBadge.textContent = count;
        
        // Efecto animado en la campana si hay alertas críticas
        if (bellIcon) bellIcon.classList.add('fa-bounce');

        container.innerHTML = activeNotifications.map(notif => {
            let color = 'var(--color-danger)';
            let icon = 'fa-circle-exclamation';
            if (notif.type === 'warning') {
                color = 'var(--color-warning)';
                icon = 'fa-triangle-exclamation';
            }

            return `
                <div class="notif-item" onclick="quickViewProduct('${notif.actionParam}'); document.getElementById('notif-dropdown').classList.remove('active');" style="cursor:pointer;">
                    <div class="notif-icon" style="background: rgba(255,255,255,0.1); border: 1px solid var(--color-border);">
                        <i class="fa-solid ${icon}" style="color:${color};"></i>
                    </div>
                    <div class="notif-content">
                        <p style="margin: 0; line-height: 1.3;">${notif.text}</p>
                        <div class="notif-time">${notif.time}</div>
                    </div>
                </div>`;
        }).join('');
    }
}

// ==========================================================================
// I. RENDERIZACIÓN GLOBAL DE COMPONENTES
// ==========================================================================

function renderApp() {
    // 1. Correr el motor inteligente
    const { insights, shoppingList } = runIntelligentAnalyzer();

    // 2. Actualizar sistema de notificaciones de la campana
    updateNotificationsState(insights);

    // 3. Renderizar las pestañas generales del Dashboard
    const totalProdEl = document.getElementById('stat-total-products');
    const lowStockEl = document.getElementById('stat-low-stock');
    const expiredEl = document.getElementById('stat-expired');
    const efficiencyEl = document.getElementById('stat-efficiency');

    if (totalProdEl && lowStockEl && expiredEl && efficiencyEl) {
        const total = allProducts.length;
        const low = allProducts.filter(p => p.qty <= p.minQty).length;
        
        const today = new Date();
        const expired = allProducts.filter(p => new Date(p.expiryDate) < today).length;

        // Eficiencia: Porcentaje de productos saludables respecto al total
        let efficiency = 100;
        if (total > 0) {
            efficiency = Math.round(((total - (low + expired)) / total) * 100);
            if (efficiency < 0) efficiency = 0;
        }

        totalProdEl.textContent = total;
        lowStockEl.textContent = low;
        expiredEl.textContent = expired;
        efficiencyEl.textContent = `${efficiency}%`;
    }

    // 4. Renderizar Tabla Crítica de Vencimiento en Dashboard
    renderCriticalExpiryTable();

    // 5. Renderizar Rejilla de Inventario (Con buscador y filtros activos)
    renderProductsGrid();

    // 6. Renderizar Paneles del Asistente Inteligente e IA
    renderIntelligenceViews(insights, shoppingList);

    // 7. Renderizar Gráfico de Dona de Categorías
    drawCategoryDistributionChart();


}

// Renderiza los logs de actividad en la pestaña Perfil
function renderActivityLogs() {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    if (activityLogs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">Aún no has realizado acciones de consumo.</div>`;
        return;
    }

    container.innerHTML = activityLogs.slice(0, 10).map(log => {
        let actionMsg = '';
        let dotColor = 'var(--color-primary)';
        const dateStr = new Date(log.date).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        if (log.actionType === 'create') {
            actionMsg = `Agregaste un nuevo producto: <strong>${log.productName}</strong> con <strong>${log.qtyChange} u.</strong>`;
            dotColor = 'var(--color-success)';
        } else if (log.actionType === 'increase') {
            actionMsg = `Aumentaste stock de <strong>${log.productName}</strong> en <strong>+${log.qtyChange} u.</strong>`;
            dotColor = 'var(--color-info)';
        } else if (log.actionType === 'decrease') {
            actionMsg = `Consumiste <strong>${Math.abs(log.qtyChange)} u.</strong> de <strong>${log.productName}</strong>`;
            dotColor = 'var(--color-warning)';
        } else if (log.actionType === 'finished') {
            actionMsg = `Marcaste <strong>${log.productName}</strong> como terminado.`;
            dotColor = 'var(--color-danger)';
        } else if (log.actionType === 'delete') {
            actionMsg = `Eliminaste el producto <strong>${log.productName}</strong> de tu inventario.`;
            dotColor = 'var(--color-danger)';
        } else {
            actionMsg = `Actualizaste información de <strong>${log.productName}</strong>`;
            dotColor = 'var(--color-text-muted)';
        }

        return `
            <div class="history-item">
                <div class="history-item-left">
                    <span class="history-dot" style="background-color:${dotColor}"></span>
                    <span>${actionMsg}</span>
                </div>
                <span class="history-time">${dateStr}</span>
            </div>`;
    }).join('');
}

// Renderiza la tabla de alertas de vencimiento urgentes en Dashboard
function renderCriticalExpiryTable() {
    const tbody = document.getElementById('critical-expiry-tbody');
    if (!tbody) return;

    const today = new Date();
    // Filtrar vencidos o por vencer en 7 días
    const criticalList = allProducts.filter(p => {
        const exp = new Date(p.expiryDate);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    });

    if (criticalList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-face-smile" style="font-size: 1.5rem; color: var(--color-success); margin-right: 0.5rem; vertical-align: middle;"></i>
                    ¡Genial! No tienes productos vencidos o próximos a vencer en los siguientes 7 días.
                </td>
            </tr>`;
        return;
    }

    // Ordenar: primero los vencidos, luego próximos a vencer
    criticalList.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    tbody.innerHTML = criticalList.map(prod => {
        const exp = new Date(prod.expiryDate);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        let badge = '';

        if (diffDays < 0) {
            badge = `<span class="badge badge-danger">Vencido hace ${Math.abs(diffDays)} d</span>`;
        } else if (diffDays === 0) {
            badge = `<span class="badge badge-danger">Vence Hoy</span>`;
        } else {
            badge = `<span class="badge badge-warning">En ${diffDays} días</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: 0.75rem 1rem; font-weight:700;">${prod.name}</td>
                <td style="padding: 0.75rem 1rem; color:var(--color-text-muted);"><i class="${CATEGORY_ICONS[prod.category]}"></i> ${prod.category}</td>
                <td style="padding: 0.75rem 1rem;">${prod.expiryDate}</td>
                <td style="padding: 0.75rem 1rem;">${badge}</td>
                <td style="padding: 0.75rem 1rem;">
                    <button class="btn-primary" onclick="quickViewProduct('${prod.id}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: 6px;">
                        Ver
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// Renderiza las tarjetas del inventario (con paginado automático si fuera necesario)
function renderProductsGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    // Filtrar productos
    let filtered = allProducts.filter(prod => {
        // Filtro de categoría
        const matchCategory = currentCategoryFilter === 'all' || prod.category === currentCategoryFilter;

        // Filtro de búsqueda
        const q = currentSearchQuery.toLowerCase();
        const matchSearch = prod.name.toLowerCase().includes(q) || prod.brand.toLowerCase().includes(q);

        // Filtro de estado
        let matchStatus = true;
        const exp = new Date(prod.expiryDate);
        const today = new Date();
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

        if (currentStatusFilter === 'ok') {
            matchStatus = prod.qty > prod.minQty && diffDays > 7;
        } else if (currentStatusFilter === 'low') {
            matchStatus = prod.qty <= prod.minQty;
        } else if (currentStatusFilter === 'expired') {
            matchStatus = diffDays < 0;
        } else if (currentStatusFilter === 'expiring') {
            matchStatus = diffDays >= 0 && diffDays <= 7;
        }

        return matchCategory && matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="inventory-empty" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-box-open"></i>
                <h3>No se encontraron productos</h3>
                <p>Prueba ajustando los filtros de búsqueda o categoría.</p>
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const today = new Date();
        const exp = new Date(prod.expiryDate);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        
        let statusBadge = '';
        let qtyClass = '';

        // Definir etiqueta de estado
        if (diffDays < 0) {
            statusBadge = `<span class="badge badge-danger product-status-tag">Vencido</span>`;
        } else if (diffDays <= 7) {
            statusBadge = `<span class="badge badge-warning product-status-tag">Por vencer</span>`;
        } else if (prod.qty === 0) {
            statusBadge = `<span class="badge badge-danger product-status-tag">Sin stock</span>`;
            qtyClass = 'out-of-stock';
        } else if (prod.qty <= prod.minQty) {
            statusBadge = `<span class="badge badge-warning product-status-tag">Bajo stock</span>`;
            qtyClass = 'low-stock';
        } else {
            statusBadge = `<span class="badge badge-success product-status-tag">Estable</span>`;
        }

        // Si no tiene imagen de URL, poner un fallback decorativo basado en la categoría
        let imageHTML = `<div class="product-fallback-icon"><i class="${CATEGORY_ICONS[prod.category] || 'fa-solid fa-box'}"></i></div>`;
        if (prod.imageUrl && prod.imageUrl.startsWith('http')) {
            imageHTML = `<img src="${prod.imageUrl}" alt="${prod.name}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div class="product-fallback-icon" style="display:none;"><i class="${CATEGORY_ICONS[prod.category] || 'fa-solid fa-box'}"></i></div>`;
        }

        return `
            <div class="product-card glass-effect" id="prod-card-${prod.id}">
                <div class="product-header-img">
                    ${imageHTML}
                    <span class="badge badge-info product-cat-badge"><i class="${CATEGORY_ICONS[prod.category]}"></i> ${prod.category}</span>
                    ${statusBadge}
                </div>
                
                <div class="product-body">
                    <h3 class="product-title">${prod.name}</h3>
                    <div class="product-brand">${prod.brand}</div>
                    
                    <div class="product-dates">
                        <span><i class="fa-solid fa-calendar-plus"></i> Compra: ${prod.purchaseDate}</span>
                        <span><i class="fa-solid fa-calendar-xmark"></i> Vence: ${prod.expiryDate}</span>
                    </div>

                    <!-- Controles rápidos de stock -->
                    <div class="stock-control">
                        <button class="qty-btn" onclick="modifyStock('${prod.id}', -1)" aria-label="Restar 1">-</button>
                        <span class="qty-number ${qtyClass}">${prod.qty} u.</span>
                        <button class="qty-btn" onclick="modifyStock('${prod.id}', 1)" aria-label="Sumar 1">+</button>
                    </div>

                    <!-- Acciones -->
                    <div class="product-actions">
                        <button class="prod-btn prod-btn-edit" onclick="openProductModalForId('${prod.id}')"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                        <button class="prod-btn prod-btn-delete" onclick="deleteProduct('${prod.id}')"><i class="fa-solid fa-trash"></i> Quitar</button>
                    </div>
                    
                    <button class="btn-secondary" onclick="markAsFinished('${prod.id}')" style="margin-top: 0.5rem; padding: 0.35rem 0.5rem; font-size: 0.75rem; border-color: rgba(239,68,68,0.15); color: var(--color-danger); background: rgba(239, 68, 68, 0.01);">
                        <i class="fa-solid fa-circle-check"></i> Terminado
                    </button>
                </div>
            </div>`;
    }).join('');
}

// Llamador global desde tarjetas para abrir modal de edición
window.openProductModalForId = function(id) {
    const prod = allProducts.find(p => p.id === id);
    if (prod) openProductModal(prod);
};

// ==========================================================================
// J. SISTEMA DE TOASTS FLOTANTES PERSONALIZADOS (Feedback UX)
// ==========================================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'danger') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div style="font-size:0.875rem; font-weight:600;">${message}</div>
    `;

    container.appendChild(toast);

    // Animación de salida y remoción
    setTimeout(() => {
        toast.style.animation = 'toastIn var(--transition-normal) reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// ==========================================================================
// K. FUNCIONES DE VALIDACIÓN DE CAMPOS Y UTILIDADES
// ==========================================================================

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function validateField(inputElement, isValid, feedbackId) {
    const feedback = document.getElementById(feedbackId);
    if (!feedback) return;

    if (isValid) {
        inputElement.classList.remove('invalid');
        inputElement.classList.add('valid');
        feedback.classList.remove('error');
        feedback.classList.add('success');
        feedback.style.display = 'none';
    } else {
        inputElement.classList.remove('valid');
        inputElement.classList.add('invalid');
        feedback.classList.remove('success');
        feedback.classList.add('error');
        feedback.style.display = 'block';
    }
}
