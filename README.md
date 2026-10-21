# werun.Blocks.Community

Bloques de Gutenberg para sitios corporativos: estructura, conversión, prueba social, organización de contenido, contenido dinámico de cualquier tipo de contenido, empleos desde el ATS y formularios de los proveedores habituales. Íconos de Lucide y animaciones al estilo de Lucide Animated.

- Funciona desde WordPress 6.6 y PHP 7.4.
- Se probó en WordPress 7.1.3 con el tema Twenty Twenty-Five, en el editor y en la página publicada, a 1440, 820 y 390 px de ancho.

## Catálogo

Cada bloque aparece una sola vez en el insertador; sus variantes (al menos 3) se eligen en **Transformar en variación**. Todos tienen **Saved styles**.

| Grupo | Bloques (variantes) |
|---|---|
| Estructura y conversión | **Hero** (imagen derecha/izquierda, centrado, con cifras, solo texto, video de fondo) · **Section** (contenido, ancho completo con fondo, imagen con overlay, dos columnas) · **CTA** (banner centrado, split con imagen, franja compacta, tarjeta flotante) · **Media + texto** (imagen izquierda/derecha, video, cuadrada) |
| Prueba social | **Logos** (grilla, marquesina infinita, carrusel, grises con hover) · **Testimonios** (grilla, carrusel, uno a la vez, desde un tipo de contenido) · **Stats** con contadores (fila, tarjetas, con íconos, grandes con descripción) |
| Organización | **Feature grid** · **Tabs** (horizontales, verticales, pills, ícono + texto, segmentadas) · **Accordion / FAQ** con schema · **Tabla de contenidos** (lista, sticky, desplegable en móvil, numerada, pills) |
| Dinámicos | **Query** — Query Builder visual sobre cualquier tipo de contenido público: filtros por taxonomía y por campos (meta), orden por fecha, título, campo o próximos eventos, relacionados, selección manual; tarjetas con campos mapeados; grilla, lista, carrusel o mapa; filtros, búsqueda y paginación para el visitante (también sin JS). Variantes: últimos posts, relacionados, team, eventos, oficinas con mapa, resource library (enlaces de descarga protegidos), case studies, personalizado · **Jobs** desde Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio, Teamtailor o BambooHR (agrupado, tarjetas, tabla, con filtros) · **Form**: HubSpot, Marketo, Salesforce Account Engagement, Dynamics 365, Typeform, Jotform, Mailchimp, ActiveCampaign, Zoho, Calendly, Gravity Forms, WPForms, Contact Form 7, Fluent, Ninja, Formidable (contacto, HubSpot, newsletter, descarga con gating, agendar reunión) |
| Otros | **Pricing** · **Tabla comparativa** (planes × características, checks, plan destacado, precios arriba) · **Timeline** (vertical, alternada, horizontal, por años) · **Video** (modal con poster, inline lazy, fondo, con transcripción) · **Carousel** (contenido libre, imágenes, tarjetas, miniaturas) · **Notice** (barra descartable, info, alerta, programado) |

## Accesibilidad (WCAG 2.2 AA)

Todos los bloques cumplen WCAG 2.2 AA en cada variante y opción, sobre fondo claro y oscuro, también con el CSS del tema cargado después de los bloques:

- **Colores que se adaptan:** cada bloque sabe sobre qué fondo está (su propio color, una imagen con overlay, o una sección, grupo o cover oscuro que lo contiene). Con eso elige texto, acento y anillo de foco legibles. Los colores que se eligen en los selectores del bloque se muestran en la versión legible más cercana, y el valor guardado no cambia.
- **Aviso en el editor:** cuando un texto o un control no llega al contraste mínimo, el panel lateral lo indica arriba y ofrece el arreglo en un clic.
- **Teclado y lectores de pantalla:**
  - foco visible en todo;
  - patrones ARIA en tabs, acordeón, carruseles, diálogos e interruptores;
  - mensajes de estado anunciados;
  - objetivos de al menos 24 px;
  - lo que se mueve más de 5 s tiene botón de pausa y respeta "reducir movimiento".
- **Documentación:**
  - el contrato y la API en `docs/accessibility.md`;
  - la auditoría y sus reglas en `docs/accessibility-audit.md`;
  - el checklist para bloques nuevos en `docs/creating-blocks.md`;
  - el harness de pruebas en `bin/a11y/`, que no va en el zip.

## Integraciones y privacidad

**werun.Blocks.Community → Integrations**: mapas (OpenStreetMap con Leaflet incluido en el plugin, o Google Maps con key), privacidad (consentimiento por clic, por el banner de cookies — WP Consent API, Complianz, CookieYes, Cookiebot — o sin consentimiento), formularios (portal de HubSpot y su token, Marketo, Pardot, Dynamics, ActiveCampaign, Zoho), empleos (proveedor, board, caché, keys de Teamtailor y BambooHR) y gating (duración de los enlaces, recordar, entrega). Las keys se guardan cifradas y nunca llegan al navegador. La pantalla lista los hosts que el sitio puede cargar, para armar una CSP.

- Mapas, videos de YouTube/Vimeo y formularios de terceros no cargan nada antes del consentimiento.
- **Gating**: con los plugins de formularios de WordPress es "duro" (se verifica el envío en el servidor); con HubSpot, Marketo y los demás servicios es "suave" (se confía en el evento del proveedor). La descarga es un enlace firmado de pocos minutos; el archivo sigue estando en `uploads`, así que quien conozca su URL directa puede bajarlo (para protegerlo de verdad: entrega "stream" y una carpeta no pública).
- **Query**: la configuración de cada bloque va firmada en la página y se valida de nuevo en cada pedido; solo muestra contenido publicado de tipos públicos y nunca meta protegida o sensible.

## Licencia y distribución

- GPL-2.0-or-later. Versión gratuita para el directorio de WordPress.org: sin licencias, sin claves de activación y sin conexión a servidores de werun.dev. Las actualizaciones llegan por WordPress.org.
- Convive con werun.Blocks (la versión de werun.dev para clientes): todo lleva prefijo propio — bloques `werun-community/*`, clases y handles `wrbc-*`, REST `wrbc/v1`, opciones `wrbc_*`, PHP `Werun\BlocksCommunity` y `WERUN_BLOCKS_COMMUNITY_*` —, así que ambos pueden estar activos a la vez. El contenido de uno no se abre con el otro.
- `readme.txt` es la ficha de WordPress.org (incluye la sección "External services" que pide el directorio).
- Release: `Version:` y `WERUN_BLOCKS_COMMUNITY_VERSION` en `werun-blocks-community.php`, `Stable tag` en `readme.txt`, `package.json` y `CHANGELOG.md`; commit `Release X.Y.Z`, tag `vX.Y.Z`. El workflow compila, verifica la versión y adjunta `werun-blocks-community.zip` al release (ese zip es el que se sube a WordPress.org).

## Instalación

Subí `werun-blocks-community.zip` en **Plugins › Añadir nuevo › Subir plugin** y activalo. La carpeta `build/` ya viene compilada, así que no hace falta Node para usarlo.

Los bloques aparecen en el insertador, en la categoría **werun.Blocks.Community**. El insertador muestra un solo bloque de cada tipo, con su ícono de Lucide y el monograma de werun arriba a la derecha (`assets/brand/werun-monograma-oscuro.svg`). Las variaciones listas (por ejemplo, Hero con la imagen a la derecha, a la izquierda o centrado) se eligen desde el bloque, en **Transformar en variación** de la barra de herramientas o del panel lateral.

## Detalle de los bloques originales

| Bloque | Qué se puede cambiar | Qué hace en la página |
|---|---|---|
| **Hero** (`werun-community/hero`) | Diseño dividido o centrado, lado de la imagen, ancho de la columna de texto, alto mínimo, alineación vertical. Se puede encender o apagar cada parte: antetítulo, texto, checklist, cada uno de los dos botones, cifras e imagen. También admite imagen de fondo con overlay, forma de los botones, color de acento e íconos de cada parte. | Entrada con fundido al hacer scroll. La imagen se carga con prioridad (LCP). |
| **Grilla de features** (`werun-community/features` + `werun-community/feature`) | Columnas de 1 a 6 en escritorio, de 1 a 4 en tablet y 1 o 2 en móvil, y la separación entre ellas. Estilo de tarjeta: plana, con borde, con relleno o con sombra. Ícono arriba o al costado, alineación, efecto al pasar el mouse y misma altura por fila. El contenedor del ícono puede ser círculo, cuadrado, anillo o ninguno. El enlace puede ser texto, botón o la tarjeta entera. Cada tarjeta puede ocultar su ícono, texto o enlace, y destacarse. | Entrada escalonada. Con "tarjeta entera", toda la tarjeta es un enlace accesible. |
| **Tabla de precios** (`werun-community/pricing` + `werun-community/pricing-plan`) | Selector mensual / anual con su etiqueta y la nota de ahorro. Moneda antes o después. Columnas por pantalla. Plan destacado con insignia y más alto en escritorio. Estilo de los botones. Líneas incluidas y no incluidas, con un ícono para cada caso. Descripción y nota de cada plan, que se pueden apagar en todos o en uno solo. | El selector funciona: cambia los precios y avisa a los lectores de pantalla. Un precio que no es número, como "Custom", se muestra solo. |
| **Acordeón / FAQ** (`werun-community/accordion` + `werun-community/accordion-item`) | Uno o varios abiertos, el primero abierto, estilo (líneas, cajas o mínimo), 1 o 2 columnas. Ícono de abrir y cerrar: chevron, + / −, uno a elección o ninguno, a la izquierda o a la derecha. Ícono por pregunta. Buscador. Botones de expandir y contraer todo. Schema FAQPage. | Usa `<details>` nativo, así que abre y cierra sin JavaScript y la búsqueda del navegador (Ctrl+F) lo despliega. El buscador ignora tildes. Un enlace a `#ancla-de-la-pregunta` la abre. La respuesta admite cualquier bloque. |
| **Testimonios** (`werun-community/testimonials` + `werun-community/testimonial`) | Carrusel o grilla, tarjetas visibles por pantalla, flechas con su ícono, puntos, controles arriba o abajo, loop, autoplay con su intervalo, pausa al pasar el mouse. Comillas, estrellas, foto y cargo se pueden apagar en todos o en una sola tarjeta. | Carrusel con scroll-snap nativo, que funciona con swipe y trackpad sin JS. Flechas, puntos y teclado. El autoplay se pausa con el mouse, con el foco, fuera de pantalla y con el botón de pausa, y no corre si el visitante pidió movimiento reducido. |

**Ajustes comunes a todos:**

- Cabecera de sección opcional: antetítulo, título e intro, con su alineación y nivel de encabezado.
- Colores, tipografía, espaciado y ancho (amplio o completo) desde los paneles nativos de WordPress.
- Colores propios del bloque: acento, fondos y bordes.
- Tamaño y grosor de los íconos.

## Íconos

- **Lucide**: https://lucide.dev/icons/
  - Se importan los 1891 íconos (paquete `lucide-static` 1.58.0, licencia ISC, ver `LICENSE-lucide.txt`).
  - Se imprimen como SVG inline: no hay fuentes de íconos, ni CDN, ni JavaScript en la página.
  - El selector del editor busca por nombre y por etiqueta.
- **Lucide Animated**: https://lucide-animated.com
  - No se importa. Sus íconos son componentes de React con la librería motion, pensados para instalarse con shadcn, y los términos del proyecto permiten usarlos pero no redistribuirlos.
  - El plugin lee solo la lista de nombres y muestra en su propia pestaña los 426 que también existen en Lucide (otros 42 tienen nombres propios del proyecto).
  - Cada uno trae el preset CSS más parecido a su animación original: dibujar el trazo, wiggle, empujón, rebote, pulso, giro, pop, flotar, sacudir o inclinar.
  - El panel de cada ícono enlaza al original: `https://lucide-animated.com/icons/<nombre>`.
- **Cuándo se animan**: cualquier ícono de las dos librerías puede animarse al pasar el mouse sobre el ícono o su tarjeta, una vez al entrar en pantalla, o en loop. Con movimiento reducido no se anima nada.

## Clases e IDs únicos

Pensado para tener varios bloques iguales en la misma página.

- **ID por instancia**: cada bloque y cada tarjeta, plan, pregunta y testimonio sale con un `id` propio, generado con `wp_unique_id()`, por ejemplo `wrbc-pricing-10`.
  - Si se completa **Avanzado › Ancla HTML**, se usa esa ancla, que es fija y sirve para enlaces y CSS propio.
  - El mismo valor se agrega como clase.
- **IDs internos**: los ARIA (`-title`, `-heading`, `-q`, `-track`, `-plans`) derivan de ese ID.
- **Acordeones independientes**: cada uno usa su propio grupo `<details name>`, así que no se cierran entre sí.
- **Ajustes aislados**: cada ajuste es una variable CSS (`--wrbc-accent`, `--wrbc-cols-d`, etc.) en el envoltorio de esa instancia. Dos bloques con colores o columnas distintas no se pisan.
- **JavaScript por instancia**: el JS se inicializa por instancia, y el selector de precios, el buscador o el carrusel de un bloque no afectan a otro.
- **Clases con prefijo**: todas las clases llevan `wrbc-` y siguen el formato BEM (`.wrbc-plan__price`), así que no chocan con el tema.

## Responsive

- **Container queries**: las columnas y los diseños responden al ancho del bloque, no al de la ventana. El mismo bloque se acomoda en página completa, en una columna o en una barra lateral.
- **Cortes**: móvil por debajo de 600 px, tablet de 600 a 959 px y escritorio desde 960 px. El hero pasa a dos columnas desde 820 px.
- **Ancho por defecto**: el hero nace en ancho completo y los demás en ancho amplio.

## Estilos guardados

En todos los bloques principales, el panel **Saved styles** guarda los estilos y opciones del bloque con un nombre (colores, diseño, columnas, íconos, opciones) para aplicarlos al mismo bloque en cualquier otra página. Los textos, imágenes y enlaces no se guardan, así que al aplicar un estilo la página conserva su contenido. Los estilos son de todo el sitio: cualquiera que edite entradas los usa, y su autor (o un editor) puede actualizarlos o borrarlos.

## Desarrollo

```bash
npm install
npm run build   # regenera los íconos y compila build/
npm run start   # modo watch
npm run icons   # solo los datos de íconos (includes/lucide-*.php|json)
```

Estructura:

- `src/<bloque>/`: `block.json`, `edit.js`, `render.php`, `style.scss`, y `view.js` en los que tienen comportamiento en la página.
- `src/shared/`: selector de íconos y controles comunes; `src/shared/view/`: los módulos de la página (carrusel, contador, video, tabs, filtros, consentimiento, mapa, gating), compilados a `build/shared/`.
- `assets/`: CSS y JS compartidos en la página (`shared.css`, `modules.css`, `vendor/leaflet/`) y el kit de UI del admin.
- `includes/`: helpers de PHP, datos de íconos, y las áreas `query/`, `forms/`, `gate/`, `jobs/`, `toc/`, `modules/`, `integrations/`, `security/`, `admin/`.
- `scripts/build-icons.mjs` y `scripts/lucide-animated-names.json`: el generador de íconos y la lista de nombres de Lucide Animated.

Todos los bloques son dinámicos (`render.php`). Por eso un cambio de marcado no rompe la validación de los bloques ya guardados.

Los textos de la interfaz están en inglés, con el dominio `werun-blocks-community`, listos para traducir.

### Documentación para desarrollar

- **Crear un bloque nuevo:** [docs/creating-blocks.md](docs/creating-blocks.md).
- **Módulos y APIs compartidos:** [docs/shared-modules.md](docs/shared-modules.md).
- **Reglas de los controles:** [docs/block-controls-audit.md](docs/block-controls-audit.md) (auditorías del 2026-10-16 y del 2.0: reglas 1–22).
