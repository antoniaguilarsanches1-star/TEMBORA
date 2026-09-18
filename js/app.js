/* ============================================
   TAVIKU - Marketplace Peruano de Plantillas Web
   JavaScript Principal
   ============================================ */

// Configuración global
const CONFIG = {
    whatsappNumber: '51993498739', // Soporte confirmado por el propietario.
    currency: 'S/',
    siteName: 'TAVIKU'
};

// Datos de demostración
const DEMO_DATA = {
    templates: [
        {
            id: 1,
            name: 'Restaurante Gourmet',
            seller: 'CarlosWeb',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Carlos+Web&background=2563eb&color=fff',
            category: 'Restaurantes',
            price: 89,
            rating: 4.8,
            sales: 45,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
            description: 'Plantilla elegante para restaurantes con menú interactivo, reservaciones y galería de fotos.',
            featured: true,
            isNew: false
        },
        {
            id: 2,
            name: 'Tienda Online Moda',
            seller: 'MariaDesign',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Maria+Design&background=10b981&color=fff',
            category: 'Tiendas',
            price: 120,
            rating: 4.9,
            sales: 78,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600',
            description: 'Plantilla completa para tiendas online con carrito de compras y pasarela de pagos.',
            featured: true,
            isNew: false
        },
        {
            id: 3,
            name: 'Portafolio Creativo',
            seller: 'DevStudio',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Dev+Studio&background=f59e0b&color=fff',
            category: 'Portafolios',
            price: 45,
            rating: 4.7,
            sales: 32,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600',
            description: 'Portafolio minimalista para diseñadores y creativos con animaciones suaves.',
            featured: false,
            isNew: true
        },
        {
            id: 4,
            name: 'Landing Page Startup',
            seller: 'TechMaster',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Tech+Master&background=8b5cf6&color=fff',
            category: 'Landing Pages',
            price: 65,
            rating: 4.6,
            sales: 56,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600',
            description: 'Landing page moderna para startups con secciones de características y testimonios.',
            featured: true,
            isNew: false
        },
        {
            id: 5,
            name: 'Clínica Dental',
            seller: 'MediWeb',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Medi+Web&background=ec4899&color=fff',
            category: 'Salud',
            price: 95,
            rating: 4.8,
            sales: 28,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600',
            description: 'Plantilla profesional para clínicas y servicios de salud con agenda de citas.',
            featured: false,
            isNew: true
        },
        {
            id: 6,
            name: 'Hotel Boutique',
            seller: 'TravelDev',
            sellerAvatar: 'https://ui-avatars.com/api/?name=Travel+Dev&background=06b6d4&color=fff',
            category: 'Hoteles',
            price: 150,
            rating: 4.9,
            sales: 41,
            technologies: ['HTML5', 'CSS3', 'JavaScript'],
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600',
            description: 'Plantilla elegante para hoteles y alojamiento con sistema de reservas.',
            featured: true,
            isNew: false
        }
    ],
    categories: [
        { name: 'Negocios', icon: 'fa-briefcase', count: 45 },
        { name: 'Restaurantes', icon: 'fa-utensils', count: 32 },
        { name: 'Barberías', icon: 'fa-cut', count: 18 },
        { name: 'Tiendas', icon: 'fa-shopping-cart', count: 56 },
        { name: 'Portafolios', icon: 'fa-user', count: 28 },
        { name: 'Hoteles', icon: 'fa-hotel', count: 15 },
        { name: 'Turismo', icon: 'fa-plane', count: 22 },
        { name: 'Servicios Profesionales', icon: 'fa-briefcase', count: 38 },
        { name: 'Landing Pages', icon: 'fa-rocket', count: 41 },
        { name: 'Educación', icon: 'fa-graduation-cap', count: 25 },
        { name: 'Salud', icon: 'fa-heartbeat', count: 19 },
        { name: 'Tecnología', icon: 'fa-laptop-code', count: 35 }
    ],
    sellers: [
        {
            name: 'CarlosWeb',
            avatar: 'https://ui-avatars.com/api/?name=Carlos+Web&background=2563eb&color=fff',
            rating: 4.8,
            templates: 18,
            sales: 126,
            description: 'Desarrollador web con 5 años de experiencia especializado en plantillas para negocios.'
        },
        {
            name: 'MariaDesign',
            avatar: 'https://ui-avatars.com/api/?name=Maria+Design&background=10b981&color=fff',
            rating: 4.9,
            templates: 12,
            sales: 89,
            description: 'Diseñadora UI/UX apasionada por crear experiencias web únicas y memorables.'
        },
        {
            name: 'DevStudio',
            avatar: 'https://ui-avatars.com/api/?name=Dev+Studio&background=f59e0b&color=fff',
            rating: 4.7,
            templates: 8,
            sales: 45,
            description: 'Estudio de desarrollo web enfocado en soluciones modernas y eficientes.'
        }
    ]
};

// Estado de la aplicación
let appState = {
    currentUser: null,
    cart: [],
    favorites: [],
    filters: {
        category: '',
        priceMin: 0,
        priceMax: 1000,
        sortBy: 'featured'
    }
};

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function formatPrice(price) {
    return `${CONFIG.currency} ${price}`;
}

// Función reutilizable para mostrar/ocultar contraseña
function initPasswordToggle() {
    const passwordContainers = document.querySelectorAll('.password-container');
    
    passwordContainers.forEach(container => {
        const input = container.querySelector('input[type="password"], input[type="text"]');
        const toggle = container.querySelector('.password-toggle');
        
        if (input && toggle) {
            toggle.addEventListener('click', function() {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                // Cambiar icono
                if (type === 'text') {
                    toggle.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    toggle.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        }
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function generateWhatsAppMessage(text) {
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedText}`;
}

function openWhatsApp(message) {
    if (!CONFIG.whatsappNumber) {
        showNotification('El contacto de soporte por WhatsApp todavía no está configurado.', 'warning');
        return;
    }
    const url = generateWhatsAppMessage(message);
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================
// NAVEGACIÓN Y MENÚ
// ============================================

function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Cerrar menú al hacer clic en un enlace
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
}

// ============================================
// BUSCADOR
// ============================================

function initSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

function performSearch() {
    const searchInput = document.querySelector('.search-input');
    const query = searchInput.value.trim();
    
    if (query) {
        window.location.href = `catalogo.html?search=${encodeURIComponent(query)}`;
    }
}

// ============================================
// FILTROS
// ============================================

function initFilters() {
    if (document.body.dataset.market) return;
    const categorySelect = document.getElementById('category-filter');
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    const sortSelect = document.getElementById('sort-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
}

function applyFilters() {
    const categorySelect = document.getElementById('category-filter');
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    const sortSelect = document.getElementById('sort-filter');
    
    appState.filters.category = categorySelect ? categorySelect.value : '';
    appState.filters.priceMin = priceMinInput ? parseFloat(priceMinInput.value) || 0 : 0;
    appState.filters.priceMax = priceMaxInput ? parseFloat(priceMaxInput.value) || 1000 : 1000;
    appState.filters.sortBy = sortSelect ? sortSelect.value : 'featured';
    
    renderTemplates();
}

function filterTemplates(templates) {
    let filtered = [...templates];
    
    // Filtrar por categoría
    if (appState.filters.category) {
        filtered = filtered.filter(t => t.category === appState.filters.category);
    }
    
    // Filtrar por precio
    filtered = filtered.filter(t => 
        t.price >= appState.filters.priceMin && 
        t.price <= appState.filters.priceMax
    );
    
    // Ordenar
    switch (appState.filters.sortBy) {
        case 'price-low':
            filtered.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filtered.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            filtered.sort((a, b) => b.rating - a.rating);
            break;
        case 'sales':
            filtered.sort((a, b) => b.sales - a.sales);
            break;
        case 'newest':
            filtered.sort((a, b) => b.isNew - a.isNew);
            break;
        default: // featured
            filtered.sort((a, b) => b.featured - a.featured);
    }
    
    return filtered;
}

// ============================================
// RENDERIZADO DE PLANTILLAS
// ============================================

function renderTemplates() {
    if (document.body.dataset.market || document.getElementById('sell-form')) return;
    const container = document.querySelector('.templates-grid');
    if (!container) return;
    
    const filtered = filterTemplates(DEMO_DATA.templates);
    
    container.innerHTML = filtered.map(template => `
        <div class="template-card fade-in">
            <div class="template-image">
                <img src="${template.image}" alt="${template.name}">
                ${template.featured ? '<span class="template-badge">Destacado</span>' : ''}
                ${template.isNew ? '<span class="template-badge" style="background-color: var(--secondary-color);">Nuevo</span>' : ''}
            </div>
            <div class="template-content">
                <h3 class="template-title">${template.name}</h3>
                <div class="template-seller">
                    <img src="${template.sellerAvatar}" alt="${template.seller}">
                    <span>${template.seller}</span>
                </div>
                <span class="template-category">${template.category}</span>
                <div class="template-technologies">
                    ${template.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                </div>
                <div class="template-footer">
                    <span class="template-price">${formatPrice(template.price)}</span>
                    <div class="template-rating">
                        <i class="fas fa-star"></i>
                        <span>${template.rating}</span>
                        <span>(${template.sales} ventas)</span>
                    </div>
                </div>
                <div class="template-actions">
                    <button class="btn btn-outline btn-sm" onclick="viewDemo(${template.id})">
                        <i class="fas fa-eye"></i> Ver demo
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="viewTemplate(${template.id})">
                        <i class="fas fa-info-circle"></i> Ver detalles
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFeaturedTemplates() {
    if (document.body.dataset.market) return;
    const container = document.querySelector('.featured-templates');
    if (!container) return;
    
    const featured = DEMO_DATA.templates.filter(t => t.featured).slice(0, 4);
    
    container.innerHTML = featured.map(template => `
        <div class="template-card">
            <div class="template-image">
                <img src="${template.image}" alt="${template.name}">
                <span class="template-badge">Destacado</span>
            </div>
            <div class="template-content">
                <h3 class="template-title">${template.name}</h3>
                <div class="template-seller">
                    <img src="${template.sellerAvatar}" alt="${template.seller}">
                    <span>${template.seller}</span>
                </div>
                <div class="template-footer">
                    <span class="template-price">${formatPrice(template.price)}</span>
                    <div class="template-rating">
                        <i class="fas fa-star"></i>
                        <span>${template.rating}</span>
                    </div>
                </div>
                <div class="template-actions">
                    <button class="btn btn-outline btn-sm" onclick="viewDemo(${template.id})">Ver demo</button>
                    <button class="btn btn-primary btn-sm" onclick="viewTemplate(${template.id})">Ver detalles</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategories() {
    if (document.body.dataset.market) return;
    const container = document.querySelector('.categories-grid');
    if (!container) return;
    
    container.innerHTML = DEMO_DATA.categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.name}')">
            <i class="fas ${category.icon}"></i>
            <h3>${category.name}</h3>
            <span class="category-count">${category.count} plantillas</span>
        </div>
    `).join('');
}

function renderSellers() {
    if (document.body.dataset.market) return;
    const container = document.querySelector('.sellers-grid');
    if (!container) return;
    
    container.innerHTML = DEMO_DATA.sellers.map(seller => `
        <div class="seller-card">
            <img src="${seller.avatar}" alt="${seller.name}" class="seller-avatar">
            <h3>${seller.name}</h3>
            <div class="seller-rating">
                <i class="fas fa-star"></i>
                <span>${seller.rating}</span>
            </div>
            <p>${seller.templates} plantillas</p>
            <p>${seller.sales} ventas</p>
            <button class="btn btn-outline btn-sm mt-2" onclick="viewSeller('${seller.name}')">
                Ver perfil
            </button>
        </div>
    `).join('');
}

// ============================================
// ACCIONES DE PLANTILLAS
// ============================================

function viewTemplate(id) {
    window.location.href = `plantilla.html?id=${id}`;
}

function viewDemo(id) {
    const template = DEMO_DATA.templates.find(t => t.id === id);
    if (template) {
        showNotification('Abriendo demo de ' + template.name, 'success');
        // Aquí se abriría la demo real
        setTimeout(() => {
            window.open('#', '_blank');
        }, 1000);
    }
}

function filterByCategory(category) {
    window.location.href = `catalogo.html?category=${encodeURIComponent(category)}`;
}

function viewSeller(name) {
    window.location.href = `vendedor.html?name=${encodeURIComponent(name)}`;
}

function addToFavorites(id) {
    if (!appState.favorites.includes(id)) {
        appState.favorites.push(id);
        showNotification('Agregado a favoritos', 'success');
    } else {
        appState.favorites = appState.favorites.filter(f => f !== id);
        showNotification('Eliminado de favoritos', 'warning');
    }
}

// ============================================
// FORMULARIOS
// ============================================

function initForms() {
    // NOTA: Los formularios de login y registro ahora se manejan en Supabase
    // Los event listeners se agregan directamente en los archivos HTML correspondientes
    const contactForm = document.getElementById('contact-form');
    const customPageForm = document.getElementById('custom-page-form');
    const sellForm = document.getElementById('sell-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', handleContact);
    }
    
    if (customPageForm) {
        customPageForm.addEventListener('submit', handleCustomPage);
    }
    
    if (sellForm) {
        sellForm.addEventListener('submit', handleSell);
    }
}

function handleContact(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    const subject = document.getElementById('subject').value;
    const whatsappMessage = `Hola, soy ${name}. Correo: ${email}. Asunto: ${subject}. ${message}`;
    openWhatsApp(whatsappMessage);
}

function handleCustomPage(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const whatsapp = document.getElementById('whatsapp').value;
    const businessType = document.getElementById('business-type').value;
    const pageType = document.getElementById('page-type').value;
    const sections = document.getElementById('sections').value;
    const needsCatalog = document.getElementById('needs-catalog').checked;
    const needsWhatsapp = document.getElementById('needs-whatsapp').checked;
    const needsForm = document.getElementById('needs-form').checked;
    const budget = document.getElementById('budget').value;
    const description = document.getElementById('description').value;
    
    const whatsappMessage = `
Hola, quiero solicitar una cotización para una página web personalizada.

👤 Nombre: ${name}
📱 WhatsApp: ${whatsapp}
🏢 Tipo de negocio: ${businessType}
🌐 Tipo de página: ${pageType}
📊 Secciones: ${sections}
📦 Necesita catálogo: ${needsCatalog ? 'Sí' : 'No'}
💬 Necesita WhatsApp: ${needsWhatsapp ? 'Sí' : 'No'}
📝 Necesita formulario: ${needsForm ? 'Sí' : 'No'}
💰 Presupuesto: ${budget}
📝 Descripción: ${description}
    `.trim();
    
    openWhatsApp(whatsappMessage);
}

async function handleSell(e) {
    e.preventDefault();
    if (window.TemboraVenta) await window.TemboraVenta.enviar(e.currentTarget);
}

// ============================================
// PAGOS
// ============================================

function initPayment() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    const confirmPaymentBtn = document.getElementById('confirm-payment');
    const sendReceiptBtn = document.getElementById('send-receipt');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            paymentMethods.forEach(m => m.classList.remove('selected'));
            method.classList.add('selected');
        });
    });
    
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', handleConfirmPayment);
    }
    
    if (sendReceiptBtn) {
        sendReceiptBtn.addEventListener('click', handleSendReceipt);
    }
}

function handleConfirmPayment() {
    showNotification('La verificación real del pago todavía no está habilitada.', 'warning');
}

function handleSendReceipt() {
    const message = 'Hola, ya realicé el pago. Envío el comprobante de la compra.';
    openWhatsApp(message);
}

// ============================================
// FAQ
// ============================================

function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            faqItems.forEach(i => {
                if (i !== item) i.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });
}

// ============================================
// DASHBOARD
// ============================================

function initDashboard() {
    const dashboardNav = document.querySelectorAll('.dashboard-nav a');
    
    dashboardNav.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardNav.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Aquí se cargaría el contenido correspondiente
            const section = link.textContent.trim().toLowerCase();
            showDashboardSection(section);
        });
    });
}

function showDashboardSection(section) {
    // Implementación básica para cambiar secciones del dashboard
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(s => s.classList.add('hidden'));
    
    const targetSection = document.querySelector(`.dashboard-section.${section}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
}

// ============================================
// MODALES
// ============================================

function initModals() {
    const modalTriggers = document.querySelectorAll('[data-modal]');
    const modalCloses = document.querySelectorAll('.modal-close');
    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const modalId = trigger.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
            }
        });
    });
    
    modalCloses.forEach(close => {
        close.addEventListener('click', () => {
            const modal = close.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initFilters();
    initForms();
    initPayment();
    initFAQ();
    initDashboard();
    initModals();
    initPasswordToggle();
    
    // Renderizar componentes según la página
    renderTemplates();
    renderFeaturedTemplates();
    renderCategories();
    renderSellers();
    
    // Inicializar botón de WhatsApp flotante
    initWhatsAppButton();
});

function initWhatsAppButton() {
    const whatsappBtn = document.querySelector('.whatsapp-float');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const message = 'Hola, quiero información sobre TAVIKU';
            openWhatsApp(message);
        });
    }
}

// ============================================
// FUNCIONES PARA PÁGINAS ESPECÍFICAS
// ============================================

// Cargar detalle de plantilla
function loadTemplateDetail() {
    if (document.body.dataset.market) return;
    const urlParams = new URLSearchParams(window.location.search);
    const templateId = parseInt(urlParams.get('id'));
    
    if (templateId) {
        const template = DEMO_DATA.templates.find(t => t.id === templateId);
        if (template) {
            // Actualizar el DOM con los datos de la plantilla
            const titleEl = document.querySelector('.template-info h1');
            const priceEl = document.querySelector('.template-price-large');
            const descEl = document.querySelector('.template-description');
            
            if (titleEl) titleEl.textContent = template.name;
            if (priceEl) priceEl.textContent = formatPrice(template.price);
            if (descEl) descEl.textContent = template.description;
        }
    }
}

// Cargar perfil de vendedor
function loadSellerProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerName = urlParams.get('name');
    
    if (sellerName) {
        const seller = DEMO_DATA.sellers.find(s => s.name === sellerName);
        if (seller) {
            // Actualizar el DOM con los datos del vendedor
            const nameEl = document.querySelector('.seller-info h1');
            const descEl = document.querySelector('.seller-description');
            
            if (nameEl) nameEl.textContent = seller.name;
            if (descEl) descEl.textContent = seller.description;
        }
    }
}

// Cargar filtros desde URL
function loadFiltersFromURL() {
    if (document.body.dataset.market) return;
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const search = urlParams.get('search');
    
    if (category) {
        const categorySelect = document.getElementById('category-filter');
        if (categorySelect) {
            categorySelect.value = category;
            appState.filters.category = category;
        }
    }
    
    if (search) {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = search;
        }
    }
    
    applyFilters();
}

// Exportar funciones para uso global
window.viewTemplate = viewTemplate;
window.viewDemo = viewDemo;
window.filterByCategory = filterByCategory;
window.viewSeller = viewSeller;
window.addToFavorites = addToFavorites;
