/* Interacciones públicas; autenticación y permisos siguen en su módulo compartido. */
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const page = document.body.dataset.publicPage;
        if (!page) return;
        if (page === 'contacto' && new URLSearchParams(location.search).get('asunto') === 'soporte') document.getElementById('subject').value = 'Otra consulta';
        document.querySelectorAll('.footer a[href="contacto.html"]').forEach(link => {
            if (link.textContent.trim() === 'Soporte') link.href = 'contacto.html?asunto=soporte';
        });
        const params = new URLSearchParams(location.search);
        if (page === 'login') {
            const messages = { favoritos: 'Inicia sesión para guardar plantillas en favoritos.', comprar: 'Inicia sesión para comprar esta plantilla.' };
            const message = Object.hasOwn(messages, params.get('motivo')) ? messages[params.get('motivo')] : null;
            if (message) {
                const notice = document.createElement('p'); notice.id = 'login-intent'; notice.setAttribute('role', 'status'); notice.textContent = message;
                const container = document.querySelector('.form-container'); container.prepend(notice);
                const id = params.get('plantilla');
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) {
                    const back = document.createElement('a'); back.href = 'plantilla.html?id=' + encodeURIComponent(id); back.textContent = 'Volver a la plantilla';
                    notice.append(document.createElement('br'), back);
                }
            }
        }
        if (page === 'plantilla') {
            const syncPanel = () => document.querySelectorAll('[data-detail-panel]').forEach(button => {
                button.hidden = document.documentElement.getAttribute('data-session-state') !== 'authenticated';
            });
            new MutationObserver(syncPanel).observe(document.documentElement, { attributes: true, attributeFilter: ['data-session-state'] });
            syncPanel();
        }
        function markActive() {
            const current = ['plantilla', 'vendedor'].includes(page) ? 'catalogo' : page;
            document.querySelectorAll('.nav-menu a, .auth-buttons a').forEach(link => {
                if (link.getAttribute('href') === current + '.html') link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        }
        markActive();
        if (page === 'index') {
            const status = document.getElementById('market-status'), retry = document.getElementById('market-reload');
            new MutationObserver(() => { retry.hidden = !/No se pudo|No se pudieron|Error/i.test(status.textContent); }).observe(status, { childList: true, characterData: true, subtree: true });
        }
        const auth = document.querySelector('.auth-buttons');
        if (auth) new MutationObserver(markActive).observe(auth, { childList: true });
        document.querySelectorAll('.faq-section').forEach(section => {
            section.addEventListener('click', event => {
                const button = event.target.closest('.faq-question');
                if (!button) return;
                const open = button.getAttribute('aria-expanded') !== 'true';
                section.querySelectorAll('.faq-question').forEach(question => {
                    const expanded = question === button && open;
                    question.setAttribute('aria-expanded', String(expanded));
                    question.closest('.faq-item').classList.toggle('active', expanded);
                    document.getElementById(question.getAttribute('aria-controls')).hidden = !expanded;
                });
            });
        });
        const menu = document.querySelector('.hamburger');
        if (menu) {
            menu.setAttribute('role', 'button'); menu.setAttribute('tabindex', '0');
            menu.setAttribute('aria-label', 'Abrir menú'); menu.setAttribute('aria-expanded', 'false');
            menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(document.querySelector('.nav-menu').classList.contains('active'))));
            menu.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); menu.click(); } });
        }
        document.querySelectorAll('[data-service]').forEach(card => card.addEventListener('click', event => {
            event.preventDefault();
            const select = document.getElementById('page-type');
            select.value = card.dataset.service;
            document.querySelectorAll('[data-service]').forEach(item => item.setAttribute('aria-current', String(item === card)));
            document.getElementById('custom-page-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
            select.focus({ preventScroll: true });
        }));
        const deadline = document.getElementById('deadline');
        function todayPeru() {
            const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
            return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
        }
        function validateDate() {
            if (!deadline) return;
            const today = todayPeru(), tomorrow = new Date(today + 'T12:00:00Z');
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            deadline.min = tomorrow.toISOString().slice(0, 10);
            deadline.setCustomValidity(deadline.value && deadline.value <= today ? 'Elige una fecha futura.' : '');
        }
        validateDate();
        deadline?.addEventListener('input', validateDate);
        deadline?.addEventListener('focus', validateDate);
        for (const id of ['contact-form', 'custom-page-form']) {
            const form = document.getElementById(id);
            if (!form) continue;
            form.addEventListener('input', event => event.target.setCustomValidity?.(''));
            form.addEventListener('submit', event => {
                const name = form.querySelector('#name');
                name.setCustomValidity(!name.value.trim() || (id === 'contact-form' && !/^[\p{L} ]+$/u.test(name.value.normalize('NFC').trim())) ? 'Escribe tu nombre usando letras y espacios.' : '');
                const text = form.querySelector('textarea[required]');
                text.setCustomValidity(text.value.trim() ? '' : 'Escribe un mensaje.');
                validateDate();
                if (!form.reportValidity()) { event.preventDefault(); event.stopImmediatePropagation(); }
            }, true);
        }
        if (page === 'registro' && new URLSearchParams(location.search).get('tipo') === 'vendedor') {
            document.querySelector('input[name="account-type"][value="seller"]').checked = true;
        }
        if (page === 'vender-publico') showSellerLanding();
    });
    async function showSellerLanding() {
        const status = document.getElementById('seller-session');
        const actions = document.getElementById('seller-actions');
        const session = await window.sesionInicial;
        if (session?.success && session.rol === 'vendedor') { irAlPanelVerificado(session.rol); return; }
        status.textContent = '';
        if (session?.success) {
            status.textContent = 'Tu cuenta tiene el rol de ' + (session.rol === 'admin' ? 'administrador' : 'comprador') + '. Esta página no cambia tu rol. Puedes continuar en tu panel.';
            actions.replaceChildren();
            const panel = document.createElement('button'); panel.type = 'button'; panel.className = 'btn btn-primary'; panel.textContent = 'Ir a mi panel';
            panel.addEventListener('click', () => redirigirSegunRol()); actions.append(panel);
        } else if (session?.code === 'NEEDS_ROLE') {
            status.textContent = 'Completa la selección inicial de tu tipo de cuenta para continuar.';
            actions.replaceChildren();
            const link = document.createElement('a'); link.href = 'elegir-rol.html'; link.className = 'btn btn-primary'; link.textContent = 'Elegir tipo de cuenta'; actions.append(link);
        } else if (session?.code !== 'NO_SESSION') {
            status.textContent = session?.error || 'No se pudo comprobar tu sesión. Recarga para reintentar.';
        }
        actions.hidden = false;
    }
})();
