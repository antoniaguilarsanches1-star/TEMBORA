/* Navegación visual de vendedor; no decide acceso ni roles. */
(() => {
    let selected = document.body.hasAttribute('data-seller-add') ? 'agregar' : new URLSearchParams(location.search).get('vista') || 'plantillas';
    function select(section) {
        selected = section;
        document.querySelectorAll('[data-seller-section]').forEach(link => {
            if (link.dataset.sellerSection === selected) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }
    window.TavikuSellerShell = { select };
    document.addEventListener('DOMContentLoaded', () => {
        select(selected);
        const mark = () => document.querySelectorAll('.auth-buttons #user-panel-btn, .auth-buttons a[href="panel-vendedor.html"]').forEach(link => link.setAttribute('aria-current', 'page'));
        const auth = document.querySelector('.auth-buttons');
        if (auth) new MutationObserver(mark).observe(auth, { childList: true });
        mark();
        const menu = document.querySelector('.hamburger');
        if (menu) {
            menu.setAttribute('role', 'button'); menu.tabIndex = 0; menu.setAttribute('aria-label', 'Abrir menú'); menu.setAttribute('aria-expanded', 'false');
            menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(document.querySelector('.nav-menu').classList.contains('active'))));
            menu.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); menu.click(); } });
        }
    });
})();
