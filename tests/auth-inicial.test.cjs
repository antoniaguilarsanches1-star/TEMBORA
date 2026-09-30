const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

// Navegador real, Auth simulado: no crea cuentas ni modifica el proyecto remoto.
test('revisión final de carga, navegación y sesión compartida', async t => {
    const root = path.resolve(__dirname, '..');
    const server = http.createServer((req, res) => {
        const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
        res.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sdk = `(() => {
        const callbacks = [];
        const user = { id: 'test-user', app_metadata: { provider: 'google' } };
        const session = () => localStorage.getItem('test-session') ? { user, access_token: 'test-token' } : null;
        window.testAuthEvent = event => callbacks.forEach(fn => fn(event, session()));
        const query = new Proxy(() => {}, { get: (_, key) => key === 'then' ? resolve => resolve({data: [], error: null}) :
            key === 'maybeSingle' ? async () => ({ data: { rol: 'comprador' }, error: null }) : () => query });
        window.supabase = { createClient: () => ({ from: () => query, auth: {
            getSession: async () => { await new Promise(r => setTimeout(r, 150)); return {data: {session: session()}, error: null}; },
            getUser: async () => ({data: {user}, error: null}),
            onAuthStateChange: fn => {callbacks.push(fn); return {data: {subscription: {unsubscribe(){}}}};},
            signInWithPassword: async () => ({error: {message: 'Credenciales inválidas'}}),
            signOut: async () => {localStorage.removeItem('test-session'); window.testAuthEvent('SIGNED_OUT'); return {error: null};},
            signInWithOAuth: async args => { window.testOAuth = args; return {error: null}; }
        }}) };
    })();`;
    await context.route('https://**/*', async route => {
        const url = route.request().url();
        if (url.includes('supabase-js')) return route.fulfill({contentType:'text/javascript', body:sdk});
        if (url.endsWith('/auth/v1/settings')) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return route.fulfill({json:{external:{google:true,facebook:false}}});
        }
        return route.fulfill({body:''});
    });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const ready = () => page.waitForFunction(() => document.documentElement.dataset.sessionState !== 'loading' && !document.documentElement.hasAttribute('data-auth-form-pending'));
    const anonymous = async () => {
        assert.equal(await page.locator('.auth-buttons').innerText(), 'Iniciar sesión\nRegistrarse');
        assert.equal(await page.locator('[data-auth-logout]:visible, #user-panel-btn:visible').count(), 0);
    };
    for (const [label, target] of [['Iniciar sesión','login.html'], ['Registrarse','registro.html']]) {
        await t.test('principal → ' + label + ': ningún formulario parcial', async () => {
            await page.goto(base + 'index.html'); await ready(); await anonymous();
            await page.locator('.auth-buttons').getByText(label, {exact:true}).click();
            assert.ok(page.url().endsWith(target));
            assert.equal(await page.locator('.form-container').isVisible(), false);
            assert.equal(await page.locator('#auth-loading').isVisible(), true);
            await ready(); await anonymous();
            assert.equal(await page.locator('[data-oauth-provider="google"]').isVisible(), true);
            const width = await page.locator('.form-container').evaluate(el => el.getBoundingClientRect().width);
            await page.waitForTimeout(250);
            assert.equal(await page.locator('.form-container').evaluate(el => el.getBoundingClientRect().width), width);
        });
    }
    await t.test('login fallido no añade cierre de sesión', async () => {
        await page.goto(base + 'login.html'); await ready();
        await page.locator('#email').fill('invalido@example.test');
        await page.locator('#password').fill('incorrecta123');
        await page.locator('#login-form button[type="submit"]').click();
        await page.getByText('Credenciales inválidas').waitFor(); await anonymous();
    });
    await t.test('recarga sin sesión', async () => {
        await page.reload({waitUntil:'domcontentloaded'}); await ready(); await anonymous();
    });
    await t.test('recarga con sesión y logout', async () => {
        await page.evaluate(() => localStorage.setItem('test-session', '1'));
        await page.reload({waitUntil:'domcontentloaded'}); await ready();
        assert.equal(await page.locator('#user-panel-btn').isVisible(), true);
        await page.locator('.auth-buttons [data-auth-logout]').click();
        await page.waitForURL('**/index.html'); await ready(); await anonymous();
    });
    await t.test('Google conserva proveedor y retorno; callback conserva rol', async () => {
        await page.goto(base + 'login.html'); await ready();
        await page.locator('[data-oauth-provider="google"]').click();
        await page.waitForFunction(() => window.testOAuth);
        const oauth = await page.evaluate(() => window.testOAuth);
        assert.equal(oauth.provider, 'google');
        assert.equal(oauth.options.redirectTo, 'https://antoniaguilarsanches1-star.github.io/TEMBORA/login.html?oauth=1');
        await page.evaluate(() => localStorage.setItem('test-session', '1'));
        await page.goto(base + 'login.html?oauth=1');
        await page.waitForURL('**/panel-comprador.html');
        await page.waitForFunction(() => !document.documentElement.hasAttribute('data-auth-pending'));
    });
    await t.test('protegida sin sesión bloquea y redirige; cambio entre pestañas limpia navegación', async () => {
        await page.evaluate(() => {localStorage.removeItem('test-session'); window.testAuthEvent('SIGNED_OUT');});
        await page.waitForURL('**/login.html'); await ready(); await anonymous();
        await page.evaluate(() => {localStorage.setItem('test-session','1'); window.testAuthEvent('SIGNED_IN');});
        await ready(); assert.equal(await page.locator('#user-panel-btn').isVisible(), true);
        await page.evaluate(() => {localStorage.removeItem('test-session'); window.testAuthEvent('SIGNED_OUT');});
        await ready(); await anonymous();
        await page.goto(base + 'panel-comprador.html');
        await page.waitForURL('**/login.html'); await ready(); await anonymous();
    });
    assert.deepEqual(errors, []);
});
