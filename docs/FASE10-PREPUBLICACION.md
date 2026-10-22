# TAVIKU — Fase 10: revisión y publicación controlada
Fecha: 22-10-2026. **Estado: preparación, no lanzamiento.**

## Punto de partida verificado
- Rama de trabajo `desarrollo-arquitectura-taviku`. La versión pública usa `main`; **no fusionar ni publicar automáticamente**.
- GitHub Actions `Verificar desarrollo TAVIKU` finalizó **success** en run [39845606909](https://github.com/antoniaguilarsanches1-star/TEMBORA/actions/runs/39845606909), commit `15e2fe68c24d1893e1f94edf13393866fb36d04c`.
- Staging separado de producción; el proyecto `barberia-black-crown` continúa pausado temporalmente.
- Fase 9: pruebas Node y negativas verificadas. **Aún NO están validadas las compras positivas, carga de comprobantes, descargas, retiros y flujos end-to-end de «Creamos tu página».**

## Revisión conjunta antes de autorizar publicación
- [ ] PC: portada, encabezado compartido, navegación Marketplace y Creamos tu página
- [ ] Móvil: cabecera, menús, formularios, botones y ausencia de desbordamiento horizontal
- [ ] Catálogo: listado, filtros, detalle, favoritos, compra
- [ ] Vendedor: subir plantilla y archivos, enviar a revisión, estado y edición
- [ ] Admin: revisión de plantilla, roles, comprobantes y pagos simulados
- [ ] Comprador: compra ficticia, comprobante de prueba, verificación y descarga de ZIP de prueba
- [ ] Vendedor: comisión 20 %, saldo y retiro mínimo S/50 simulado, verificación de estados
- [ ] Servicio web a medida: demostraciones, formulario de contacto, WhatsApp y reserva
- [ ] Privacidad/legal: TAVIKU como emprendimiento aún no formalizado; textos y consentimiento
- [ ] Rendimiento y accesibilidad: Lighthouse en móvil y escritorio, teclado y contraste

## Condiciones para publicar
1. Terminar pruebas pendientes de fase 9 con **cuentas y archivos de prueba**, nunca cobros reales.
2. No exponer secretos, `service_role`, credenciales ni datos privados en archivos publicados.
3. Realizar inspección visual conjunta en PC/celular y corregir defectos encontrados.
4. Revisar el diff de desarrollo vs `main`, validar CI en commit definitivo y preparar reversión.
5. Solicitar **autorización explícita del usuario** antes de fusionar `main` o alterar GitHub Pages de producción.
6. Finalizado Staging, decidir exportación/retirada del entorno temporal y restauración de la barbería, sin pérdida de datos.

## Resultado actual
Fase 10 **iniciada**. La compilación automatizada está verde, pero no se certifica publicación ni se afirma que todas las rutas de negocio se hayan probado.
