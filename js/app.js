/* ============================================
   TAVIKU - Marketplace Peruano de Plantillas Web
   JavaScript Principal
   ============================================ */

// Configuración global
const CONFIG = {
    whatsappNumber: '51993498739' // Soporte confirmado por el propietario.
};

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

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
    if (searchInput) {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `catalogo.html?search=${encodeURIComponent(query)}`;
        }
    }
}

// ============================================
// FORMULARIOS
// ============================================

function initForms() {
    // Login y registro se manejan en js/supabase.js.
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
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSearch();
    initPasswordToggle();
    initForms();
    
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
