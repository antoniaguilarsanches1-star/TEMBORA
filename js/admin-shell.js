/* Presentación exclusiva de Admin. Conserva la autenticación centralizada. */
(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const mark=()=>document.querySelectorAll('.auth-buttons #user-panel-btn, .auth-buttons a[href="admin.html"]').forEach(a=>a.setAttribute('aria-current','page'));
        const auth=document.querySelector('.auth-buttons');
        if(auth)new MutationObserver(mark).observe(auth,{childList:true});mark();
        const menu=document.querySelector('.hamburger');
        if(menu){menu.setAttribute('role','button');menu.tabIndex=0;menu.setAttribute('aria-label','Abrir menú');menu.setAttribute('aria-expanded','false');
            menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(document.querySelector('.nav-menu').classList.contains('active'))));
            menu.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();menu.click();}});
        }
    });
})();
