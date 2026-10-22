# Entorno aislado para pruebas TAVIKU

## Estado al 22 de octubre de 2026
Proyecto de producción: PlantillaPE (`fhowcuxyokkrbttgyrwy`). **No escribir pruebas en él.**
Existen proyectos independientes para otras aplicaciones; ninguno se reutiliza o sobrescribe.
No se ha creado un proyecto de staging, ni una URL de pruebas aislada; no afirmar que existe.

## Requisitos para habilitar staging
1. Comprobar límites del plan y coste antes de crear un proyecto nuevo, porque podría haber cargos.
2. Crear un proyecto Supabase separado y exclusivo para TAVIKU, con el consentimiento del propietario si hay coste.
3. Reproducir estructura, RLS, políticas, funciones RPC y almacenamiento desde migraciones revisadas; no copiar usuarios, teléfonos, documentos ni compras reales.
4. Crear identidades ficticias por rol, plantillas de muestra y pedidos simulados; deshabilitar o aislar canales de pago.
5. Usar claves publicables de staging exclusivamente en la versión de pruebas. Jamás usar claves service-role en HTML/JS.
6. Habilitar la vista previa solo tras verificar aislamiento, permisos RLS y operaciones de prueba.
7. Antes de fusionar a producción, ensayar cambios SQL reversibles, tomar respaldo y obtener aprobación explícita.

## Pruebas automatizadas sin servicios externos
`node --test tests/pagos.test.cjs` verifica la lógica de balance en memoria (ingresos, retiros reservados y pagados y precisión de centavos). No llama a Supabase, no crea pedidos y no confirma operaciones financieras reales.

La publicación continúa bloqueada hasta completar la matriz funcional y las pruebas visuales acordadas.
