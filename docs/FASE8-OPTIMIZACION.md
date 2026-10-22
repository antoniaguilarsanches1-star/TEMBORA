# Fase 8 — Rendimiento, accesibilidad y SEO

Fecha: 22-10-2026. Trabajo en rama `desarrollo-arquitectura-taviku`; **no** se modifica producción.

## Implementado y confirmado en GitHub
- `index.html`: enlace visible al usar teclado «Saltar al contenido principal» que apunta al título H1 con `tabindex="-1"`.
- `css/styles.css`: estilo del enlace de salto, contorno visible al recibir foco por teclado y reducción de transiciones/animaciones según `prefers-reduced-motion`.
- `index.html`: enlace flotante de WhatsApp con `aria-label` descriptivo.
- `index.html`: `preconnect` para la API Supabase y `dns-prefetch` para jsDelivr.
- Inspeccionados `index.html`, `robots.txt` y `sitemap.xml`: la página principal ya incluía título, descripción, canonical, Open Graph y JSON-LD; robots.txt enlaza al sitemap. Los ajustes no cambiaron esas URLs.

## Comprobaciones
Se volvieron a descargar `index.html` y `css/styles.css` del branch de desarrollo y se comprobó que contienen cada cambio mencionado. Esto es una validación estática, **no** Lighthouse ni auditoría visual/en navegador.

## Pendiente para completar fase 8
1. Auditoría de todas las páginas HTML (headings, etiquetas, enlaces, alt, canonicals, meta description, formularios y contraste).
2. Auditoría de carga real con Lighthouse/Core Web Vitals, optimización de imágenes y dependencias en móvil.
3. Revisión de sitemap frente a rutas existentes, robots y exclusión de páginas privadas/no indexables.
4. Pruebas de teclado, lector de pantalla y reducción de movimiento de punta a punta.
5. Verificar CI actual antes de aprobación final. No fusionar con `main` por ahora.
