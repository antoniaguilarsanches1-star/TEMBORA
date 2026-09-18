# PlantillaPE

Marketplace peruano de plantillas web donde las personas pueden comprar y vender plantillas, y además solicitar páginas web personalizadas.

## 📋 Descripción

PlantillaPE es una plataforma completa que permite:

- **Marketplace de Plantillas**: Compra y venta de plantillas web profesionales
- **Creación Personalizada**: Servicio de desarrollo web a medida
- **Sistema de Usuarios**: Paneles para compradores, vendedores y administradores
- **Pagos**: Integración con Yape y otros métodos de pago peruanos

## 🚀 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Estilos modernos y responsive
- **JavaScript**: Funcionalidades interactivas
- **Font Awesome**: Iconos
- **Google Fonts**: Tipografía (Inter)

## 📁 Estructura del Proyecto

```
plantillaspe/
│
├── index.html                    # Página de inicio
├── catalogo.html                 # Catálogo de plantillas
├── plantilla.html                # Detalle de plantilla
├── vendedor.html                 # Perfil de vendedor
├── vender.html                   # Página para vender
├── login.html                    # Iniciar sesión
├── registro.html                 # Registro de usuarios
├── panel-comprador.html          # Panel del comprador
├── panel-vendedor.html           # Panel del vendedor
├── admin.html                    # Panel administrador
├── compra.html                   # Página de compra
├── pagina-personalizada.html     # Solicitud de página personalizada
├── como-funciona.html            # Cómo funciona la plataforma
├── contacto.html                 # Página de contacto
│
├── css/
│   └── styles.css                # Estilos principales
│
├── js/
│   └── app.js                    # JavaScript principal
│
├── img/                          # Imágenes (vacío por ahora)
│
└── README.md                     # Este archivo
```

## 🎯 Características Principales

### Marketplace de Plantillas
- Buscador de plantillas
- Filtros por categoría, precio y ordenamiento
- Tarjetas de productos con vista previa
- Sistema de calificaciones y ventas
- Demo en vivo de plantillas

### Sistema de Usuarios
- Registro de compradores y vendedores
- Panel de control para compradores (compras, descargas, favoritos)
- Panel de control para vendedores (plantillas, ventas, ganancias, retiros)
- Panel administrador (gestión de usuarios, plantillas, pagos)

### Pagos
- Integración con Yape (QR y número)
- Opción de Plin
- Transferencias bancarias
- Sistema de confirmación de pagos

### Servicios Personalizados
- Formulario de solicitud de cotización
- Integración con WhatsApp para envío de solicitudes
- Diferentes tipos de páginas web disponibles

### WhatsApp
- Botón flotante de WhatsApp
- Integración en formularios de contacto
- Envío de comprobantes de pago

## 🔧 Instalación y Uso

### Requisitos Previos
- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Servidor web local (opcional, para desarrollo)

### Pasos para Ejecutar

1. **Clonar o descargar el proyecto**
   ```bash
   # Si usas git
   git clone <repository-url>
   cd plantillaspe
   ```

2. **Abrir la página principal**
   - Opción 1: Doble clic en `index.html`
   - Opción 2: Usar un servidor local
     ```bash
     # Con Python 3
     python -m http.server 8000
     
     # Con Node.js (http-server)
     npx http-server
     ```
   - Opción 3: Usar VS Code Live Server

3. **Explorar la plataforma**
   - Navega por las diferentes secciones
   - Prueba el buscador y filtros
   - Explora los paneles de usuario

## 🎨 Personalización

### Cambiar el Número de WhatsApp

Edita el archivo `js/app.js`:
```javascript
const CONFIG = {
    whatsappNumber: '51987654321', // Cambia este número
    currency: 'S/',
    siteName: 'PlantillaPE'
};
```

### Modificar Colores

Edita el archivo `css/styles.css` en la sección de variables:
```css
:root {
    --primary-color: #2563eb;
    --primary-dark: #1d4ed8;
    --primary-light: #3b82f6;
    --secondary-color: #10b981;
    --accent-color: #f59e0b;
    /* ... más variables */
}
```

### Agregar Datos de Demostración

Edita el objeto `DEMO_DATA` en `js/app.js` para agregar más plantillas, categorías o vendedores.

## 🔮 Integraciones

### Supabase (Conectado)
El proyecto ya está conectado con Supabase para:

- **Autenticación de usuarios**: Registro, login y cierre de sesión
- **Gestión de roles**: Comprador, vendedor y admin
- **Protección de rutas**: Los paneles privados requieren autenticación
- **Base de datos**: Perfiles de usuarios (tabla `public.perfiles`)

#### Configuración de Supabase
El cliente de Supabase está configurado en `js/supabase.js` con las credenciales proporcionadas.

#### Funcionalidades Implementadas
- Registro de usuarios con metadatos (nombre, rol)
- Login con correo y contraseña
- Cierre de sesión
- Verificación de sesión activa
- Redirección según rol del usuario
- Protección de páginas privadas

#### Estructura de la Base de Datos
- **auth.users**: Usuarios de Supabase Auth
- **public.perfiles**: Perfiles de usuarios (creado automáticamente por trigger)
  - `id`: UUID (referencia a auth.users)
  - `nombre_completo`: Text
  - `rol`: Text (comprador, vendedor, admin)
  - `created_at`: Timestamp

### Integraciones Futuras
- **Supabase Storage**: Almacenamiento de archivos (imágenes, ZIP)
- **GitHub Pages**: Hosting de la aplicación
- **Yape API**: Pagos automáticos (cuando esté disponible)

## 📱 Responsive Design

El diseño es completamente responsive y se adapta a:
- Móviles (320px+)
- Tablets (768px+)
- Computadoras de escritorio (1024px+)

## 🔒 Seguridad

- Validación de formularios en el cliente
- Preparado para validación en el servidor
- Protección contra CSRF (para implementar con backend)
- Sanitización de entradas (para implementar con backend)

## 📝 Notas Importantes

### Estado Actual
- ✅ Interfaz completa y funcional
- ✅ Sistema de navegación
- ✅ Datos de demostración (catálogo de plantillas)
- ✅ Responsive design
- ✅ Autenticación con Supabase (registro, login, sesión)
- ✅ Gestión de roles (comprador, vendedor, admin)
- ✅ Protección de rutas privadas
- ⏳ Backend de plantillas y ventas (pendiente de implementar)
- ⏳ Pagos automáticos (pendiente de implementar)

### Limitaciones Actuales
- El catálogo de plantillas usa datos de demostración (no conectado a DB)
- Los pagos son manuales (sin integración API real de Yape)
- Los archivos no se cargan realmente (interfaz visual)
- Las ventas y ganancias son datos de demostración en los paneles

## 🤝 Contribuciones

Este es un proyecto educativo/demostrativo. Para contribuir:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👨‍💻 Autor

Desarrollado para el mercado peruano de plantillas web.

## 📞 Soporte

Para consultas o soporte:
- WhatsApp: +51 987 654 321
- Email: contacto@plantillape.com

## 🙏 Agradecimientos

- Font Awesome por los iconos
- Google Fonts por la tipografía
- Unsplash por las imágenes de demostración

---

**Nota**: Este proyecto es una demostración de interfaz. Para un sistema en producción, se requiere implementar un backend real con base de datos y autenticación.
