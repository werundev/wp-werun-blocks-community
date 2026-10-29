# WordPress.org: reglas para publicar y mantener plugins

Estas reglas valen para todo plugin (o theme) de werun.dev que vaya al directorio de WordPress.org. Para los demás plugins son la base recomendada. Salieron de la primera revisión de werun.Blocks.Community (2026-10-25).

Cuando llega una revisión nueva o aparece un problema que estas reglas no cubrían, hay que hacer tres cosas:

1. Validar cada punto contra el código: qué pasó y por qué.
2. Corregirlo en todo el código, no solo en el ejemplo citado.
3. Anotarlo en el [registro](#7-registro-de-revisiones-e-incidentes) y, si hace falta, sumar la regla en su sección.

## 1. Qué se publica y qué queda solo en git

El paquete que recibe WordPress.org es el repo menos lo que lista `.distignore`. Esa misma lista usan:
- el zip (`npm run zip`);
- `npm run sync`;
- el deploy a SVN (`.github/workflows/release.yml`, job `wordpress-org`).

**Va siempre:**
- el código del plugin;
- `build/` y `assets/`;
- `readme.txt` y `changelog.txt`;
- las licencias de terceros (`LICENSE-*.txt`).

**No va nunca:**
- ningún `.md` (READMEs, docs, notas);
- ningún dotfile ni carpeta oculta;
- `src/`, `bin/`, `scripts/`, `docs/` y `node_modules/`;
- `package*.json` y la configuración del build;
- zips y logs.

### `readme.txt` y `changelog.txt`

- Los dos son obligatorios en cada versión.
- Cada versión nueva lleva su entrada `= X.Y.Z =` en `changelog.txt`, la más nueva arriba. La misma entrada va en `== Changelog ==` de `readme.txt`.
- El `Stable tag` de `readme.txt` y el `Version:` del plugin coinciden con el tag.
- La entrada de `changelog.txt` es la descripción del release de GitHub.
- El workflow falla en estos casos:
  - falta la entrada de la versión en `changelog.txt` o en `readme.txt`;
  - las versiones no coinciden;
  - el zip lleva algo de la lista "No va nunca".

## 2. El repositorio público

El repo público solo tiene el plugin y sus herramientas de desarrollo. Nada local, personal, secreto ni propio de las herramientas con que se trabaja:

- **Sin datos del equipo de quien desarrolla.**
  - Nada de rutas (`/Users/…`, `/Volumes/…`, `C:\Users\…`), hosts locales (`*.local`, `*.test`) ni nombres de sitios de prueba.
  - Las herramientas se configuran por variables de entorno y no traen valores locales por defecto. Ejemplo: el harness de `bin/a11y` usa `WRB_WP_ROOT` y `WRB_SITE_URL`.
- **Sin secretos.** Nada de tokens, API keys, contraseñas, `.env`, volcados de base de datos, logs ni reportes generados. Los datos de prueba son ficticios: `example.com`, `acme`, keys falsas.
- **Sin rastros de las herramientas de trabajo.**
  - Ni archivos de configuración de editores o asistentes, ni menciones a sesiones o agentes en código, docs o mensajes de commit.
  - Ningún trailer `Co-Authored-By` ni enlaces a sesiones.
  - Los archivos locales de esas herramientas se excluyen en `.git/info/exclude` (local), nunca en el `.gitignore` público: nombrarlos ahí ya es un indicio.
- **Identidad de los commits.** Siempre el email noreply de la cuenta de GitHub dueña del repo (`<id>+<cuenta>@users.noreply.github.com`), nunca un email personal.

Antes de cada push:

```bash
git log --format='%ae%n%ce' | sort -u            # solo direcciones @users.noreply.github.com
git log --format=%B | grep -i 'co-authored-by'   # nada
git grep -nIE '/Users/|/Volumes/|[a-z0-9-]+\.local\b|BEGIN [A-Z ]*PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}' -- . ':!docs/wordpress-org.md'   # nada
```

Lo que ya se publicó queda en el historial. Un force-push no alcanza: GitHub sigue sirviendo los commits viejos por su SHA y los lista en la vista Activity del repo. Si algo se filtró, hay que:
1. renombrar el repo y pasarlo a privado;
2. crear uno nuevo con el nombre original y un historial limpio;
3. volver a configurar descripción, homepage, issues y variables.

Por eso se revisa **antes** del push.

## 3. Código: lo que revisa el equipo de plugins

El equipo usa Plugin Check, herramientas propias e IA. **No tiene en cuenta los `// phpcs:ignore`**: los lee como una señal para mirar esa línea. Lo seguro es escribir código que no los necesite.

### 3.1 Nonces y permisos

- Toda acción que cambia datos o hace algo con privilegios verifica dos cosas:
  - el nonce: `check_admin_referer()`, `check_ajax_referer()` o `wp_verify_nonce()`;
  - el permiso: `current_user_can()`.
- **El nonce se verifica en el propio handler**, al lado de donde lee `$_POST`/`$_GET`. Si queda escondido en un helper (`authorize()`, `guard()`), Plugin Check y el equipo lo marcan como faltante aunque el código sea seguro. El helper puede encargarse de la capacidad.
- Las pantallas de ajustes usan la Settings API (`register_setting()` + `options.php`): ya verifica el nonce y `manage_options`.
- Leer `$_GET` para mostrar algo (una pestaña, un aviso, un filtro público) no necesita nonce, pero siempre lleva `sanitize_*( wp_unslash( … ) )`.

### 3.2 Rutas REST

- Toda ruta tiene un `permission_callback` real, por ejemplo `current_user_can( 'edit_posts' )` o la capacidad del objeto que toca.
- `__return_true` solo vale para rutas públicas de solo lectura sobre contenido público.
- Si la ruta es pública pero depende de un dato firmado (un ticket, una configuración firmada en la página), **la verificación de la firma y el rate limit van en el `permission_callback`**, no en el callback. Así queda explícito qué autoriza el pedido.
- Las rutas para logueados ya exigen el nonce `wp_rest` (cookie + `X-WP-Nonce`). No hay que reinventarlo.
- **WordPress llama al `permission_callback` más de una vez por pedido.** Una vez para autorizarlo y otra(s) desde `rest_send_allow_header()` (`rest_post_dispatch`), para armar la cabecera `Allow`. Todo lo que cuenta o tiene efectos (rate limits, logs) se memoiza por objeto `WP_REST_Request`, para que un pedido cuente una sola vez.
  - Para probarlo no alcanza con `rest_do_request()`, que no dispara `rest_post_dispatch`: hay que aplicar ese filtro a mano después de `dispatch()`.

### 3.3 Escapar tarde

- Escapar justo antes de imprimir, con la función del contexto:
  - `esc_html()` para texto;
  - `esc_attr()` para atributos;
  - `esc_url()` para URLs;
  - `wp_kses_post()` o `wp_kses( $html, $permitidos )` para HTML;
  - `tag_escape()` para nombres de etiqueta.
- **JSON en la página.** Nunca usar los flags `JSON_UNESCAPED_SLASHES` ni `JSON_UNESCAPED_UNICODE`: desactivan el escapado y el equipo los marca.
  - En JSON-LD: `wp_json_encode( $data )` o con `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT`.
  - En `wp_add_inline_script()`: `JSON_HEX_TAG | JSON_HEX_AMP`.
  - En atributos: `esc_attr( wp_json_encode( … ) )`.
- **Nunca imprimir un archivo o un HTML armado sin filtrar.** Por ejemplo, un sprite SVG con `echo file_get_contents()` debe pasar por `wp_kses()` con una lista mínima de etiquetas y atributos.
- Las funciones que devuelven markup lo escapan por dentro y lo documentan en su docblock. Un parámetro "markup de confianza" que se imprime crudo no está permitido: si no se usa, se elimina.
- Se imprimen tal cual, como hace core:
  - `get_block_wrapper_attributes()`;
  - `wp_get_attachment_image()`;
  - el `$content` de bloques internos ya renderizados;
  - la salida de shortcodes de plugins de formularios.

### 3.4 Sanitizar y validar la entrada

- Superglobales siempre con `wp_unslash()` y un `sanitize_*()`. Los arrays (`$_POST['campo']` como lista) se sanitizan entero con `map_deep()` o `array_map()`.
- Antes de convertir un valor con `(string)` o `(int)`, comprobar `is_scalar()`. Un campo enviado como array (`campo[]`) produce "Array to string conversion".
- `$_SERVER['REQUEST_METHOD']` y similares: `isset()` antes de comparar, no `?? ''`.
- Las opciones se validan en el `sanitize_callback` de `register_setting()`.
- Los datos firmados se validan de nuevo después de verificar la firma.

### 3.5 Versión mínima de PHP y WordPress

- `Requires PHP` y `Requires at least` (cabecera del plugin y `readme.txt`) tienen que coincidir con lo que el código usa de verdad.
- **No usar funciones de PHP 8** (`str_starts_with()`, `str_ends_with()`, `str_contains()`, `match`, nullsafe `?->`, etc.) si se declara 7.4, aunque WordPress tenga polyfill de algunas: la revisión lo marca igual.
- Pasar flags explícitos a `html_entity_decode()`, `htmlspecialchars()` y `htmlentities()`. Sus valores por defecto cambiaron en PHP 8.1.
- Probar también en el PHP más nuevo que use un cliente. Por ejemplo, `ReflectionProperty::setAccessible()` no hace nada desde 8.1 y da un aviso de obsoleto en 8.5. Las librerías de `vendor/` se revisan aparte y se actualizan de su origen, no se parchean.
- Verificarlo con PHPCompatibilityWP (ver el [checklist](#4-checklist-antes-de-enviar-o-publicar)).

### 3.6 Servicios externos: `== External services ==` en `readme.txt`

Cada servicio externo va documentado en su propia entrada, aunque el proveedor sea uno mismo, y aunque solo lo use el servidor o solo el navegador del visitante. Cada entrada dice:
- qué es el servicio y para qué se usa;
- los hosts exactos que se contactan, incluidos los de API (por ejemplo `api.hubapi.com` o `boards-api.greenhouse.io`);
- qué datos se envían y cuándo: al cargar, después del consentimiento, al hacer clic, por cron;
- los enlaces a **términos de servicio** y **política de privacidad**.

Cada enlace tiene que responder 200: el equipo los revisa en cada ronda y marca los 404.
- Para comprobarlos, usar `curl` con un user agent de navegador.
- Algunos sitios bloquean bots (403 o 429, por ejemplo Personio o Adobe): esos se confirman en un navegador.
- Mejor enlazar la página final que una que redirige a un índice genérico.

Si el plugin no contacta nada por defecto, se dice. También se dice qué espera el consentimiento y cómo se desactiva esa espera.

### 3.7 Archivos remotos

- Ningún JS, CSS, imagen ni fuente propios se cargan de un CDN o de un servidor propio: van incluidos en el plugin. Ejemplos: Leaflet y los íconos.
- Solo se permite cargar de afuera lo que forma parte de un servicio documentado (3.6), como el embed de un proveedor de formularios, mapas o video.
- Un host escrito en el código aunque no se cargue (por ejemplo, una fila de la tabla de hosts para la CSP) también se marca. Hay que explicarlo en la respuesta, y el comentario del código dice que no se carga nada.

### 3.8 Activación y carga de assets

Con `WP_DEBUG` encendido, en un WordPress limpio y con PHP de la versión mínima:
- la activación no imprime nada y no da errores, warnings ni notices;
- las tablas se crean con `$wpdb->prefix`, `$wpdb->get_charset_collate()` y `dbDelta()`;
- se verifica antes de usar todo lo que puede faltar (otro plugin, una extensión de PHP), y se explica el problema en vez de fallar;
- la activación no contacta servidores externos;
- los estilos y scripts del admin cargan solo en las pantallas del plugin. Lo único global permitido es lo mínimo, como el ícono del menú, con selectores que no alcanzan la interfaz de WordPress. Un estilo que solo sirve para la biblioteca de medios carga con `wp_enqueue_media` y en `upload.php`/`post.php`, no en todo el admin;
- las llamadas remotas en segundo plano que se disparan desde `admin_init` (licencia, estado) corren solo para usuarios con la capacidad que corresponde (`update_plugins`, `update_themes`), no para cualquier usuario logueado.

### 3.9 Themes

- **Un child theme de bloques no lleva `index.php`** ni otras plantillas PHP. WordPress da prioridad a la plantilla PHP del child sobre la plantilla de bloques del padre con el mismo slug, así que un `index.php` vacío ("Silence is golden") deja en blanco el blog, la búsqueda y el 404. Un child solo necesita `style.css` con `Template:`.
- La etiqueta `full-site-editing` solo va si el propio theme tiene `templates/index.html`.
- Pasar Theme Check (`wp plugin install theme-check`) sin errores REQUIRED.
- Comprobar las páginas con `curl`: un 200 con 0 bytes es un error, aunque el código de estado diga otra cosa.

### 3.10 Prefijos, i18n y otros

- Prefijo propio en funciones, clases, constantes, opciones, transients, handles, rutas REST y bloques.
- Al portar código entre ediciones, buscar el prefijo viejo también escrito de otras formas: dentro de una expresión regular (`/^werun\//`) no aparece al buscar `werun/`. Mejor aún, que el código no dependa del namespace.
- Text domain igual al slug.
- Sin `ini_set()` ni cambios globales de PHP.

## 4. Checklist antes de enviar o publicar

Desde la raíz del plugin, con WP-CLI apuntando al sitio de prueba.

1. Compilar y armar el paquete:
   ```bash
   npm run build
   npm run zip
   unzip -Z1 werun-blocks-community.zip | grep -E '\.md$|(^|/)\.[^/]+|/(bin|src|docs|scripts|node_modules)/'   # nada
   ```
2. Pasar Plugin Check sobre lo que se publica. Si el repo está clonado dentro de `wp-content/plugins/`, excluir lo mismo que `.distignore`:
   ```bash
   wp plugin check werun-blocks-community --include-experimental \
     --exclude-directories=bin,node_modules,scripts,src,docs,.github \
     --exclude-files=.gitignore,.distignore,package.json,package-lock.json,README.md,webpack.config.js,werun-blocks-community.zip
   ```
3. Verificar la compatibilidad con la versión mínima de PHP (PHPCompatibilityWP + PHP_CodeSniffer instalados aparte, fuera del repo):
   ```bash
   phpcs --standard=PHPCompatibilityWP --runtime-set testVersion 7.4- --extensions=php includes src templates build werun-blocks-community.php uninstall.php
   ```
4. Activar con `WP_DEBUG`, sin otros plugins activos. La salida no debe tener nada aparte del "Success":
   ```bash
   wp plugin deactivate werun-blocks-community
   wp --exec="define('WP_DEBUG', true); error_reporting(E_ALL); ini_set('display_errors','1');" plugin activate werun-blocks-community
   ```
5. Renderizar los bloques tocados con `do_blocks()` y `WP_DEBUG`, y comprobar:
   - que el JSON-LD y los `data-*` con JSON sean JSON válido;
   - que no haya `</` crudo dentro de un `<script>`.
6. Probar cada ruta REST pública con un token inválido (403) y uno válido (200).
7. Comprobar los enlaces de `readme.txt` (3.6).
8. Revisar el repo público antes del push (sección 2).

## 5. Responder una revisión

- Responder **en el mismo hilo** del email, no en uno nuevo.
- Subir antes el zip corregido en la página "Add your plugin", con la cuenta dueña del plugin.
- Respuesta corta y directa:
  - **sin la lista de cambios**: revisan el plugin entero otra vez;
  - solo aclaraciones que les sirvan, por ejemplo por qué una ruta es pública o por qué un host aparece sin cargarse;
  - nada de relleno.
- Corregir todo antes de responder. Las rondas que arreglan solo una parte alargan la revisión y pueden terminar en rechazo.
- Las dudas se preguntan junto con la actualización, después de corregir el resto.
- El slug (permalink) solo se puede cambiar antes de la aprobación, pidiéndolo explícitamente en la respuesta.

## 6. Publicar una versión

1. Subir la versión en:
   - `Version:` y la constante de versión del plugin;
   - `Stable tag` en `readme.txt`;
   - `package.json`.
2. Escribir la entrada en `changelog.txt` y la misma en `== Changelog ==` de `readme.txt`.
3. Hacer el checklist de la sección 4.
4. Commit `Release X.Y.Z`, tag `vX.Y.Z` y push del tag.
5. El workflow `Release` hace el resto:
   - compila y valida versiones, changelog y contenido del zip;
   - publica el release con el zip y con la entrada del changelog como descripción;
   - si el deploy está activo, sube a SVN `trunk/`, `tags/X.Y.Z/` y `assets/` (desde `.wordpress-org/`).

El deploy a SVN se activa una vez aprobado el plugin:
- crear la variable del repo `WPORG_DEPLOY=true`;
- crear los secrets `SVN_USERNAME` y `SVN_PASSWORD`;
- poner el banner, el ícono y las capturas en `.wordpress-org/`.

### 6.1 El repositorio SVN

- SVN: `https://plugins.svn.wordpress.org/werun-blocks-community` (aprobado el 2026-10-29).
- Página pública: `https://wordpress.org/plugins/werun-blocks-community/`.
- Usuario SVN: `werundev`, que distingue mayúsculas. No acepta el email.
- La contraseña SVN no es la de WordPress.org: se genera en el perfil de `werundev`, en "Account & Security". Si se regenera, hay que actualizar el secret `SVN_PASSWORD`.
- Estructura:
  - `trunk/`: la última versión;
  - `tags/X.Y.Z/`: una copia de cada versión;
  - `assets/`: banner, ícono y capturas de la página del directorio, sin entrar al plugin.
- WordPress.org sirve la versión que indica el `Stable tag` del `readme.txt` de `trunk/`. Por eso ese valor tiene que existir en `tags/`.
- La página se actualiza a los pocos minutos. La búsqueda del directorio puede tardar hasta 72 horas.

### 6.2 Deploy manual a SVN

Para cuando el job `wordpress-org` está apagado o falla. Se sube el contenido del tag de git, no la carpeta de trabajo, para que SVN reciba lo mismo que el release de GitHub:

```bash
VERSION=X.Y.Z
SRC=$(mktemp -d)
SVN=$(mktemp -d)
git archive "v$VERSION" | tar -x -C "$SRC"
svn checkout --depth immediates https://plugins.svn.wordpress.org/werun-blocks-community "$SVN"
svn update --set-depth infinity "$SVN/trunk" "$SVN/assets"
rsync -rc --delete --delete-excluded --exclude-from=.distignore "$SRC/" "$SVN/trunk/"
[ -d .wordpress-org ] && rsync -rc --delete .wordpress-org/ "$SVN/assets/"
cd "$SVN"
svn add --force trunk assets
svn status | awk '/^!/ { sub( /^![ ]+/, "" ); print }' | while read -r f; do svn rm "$f@"; done
svn cp trunk "tags/$VERSION"
svn status    # revisar: solo archivos del plugin
svn commit -m "Release $VERSION" --username werundev --no-auth-cache
```

Después:
- comprobar `https://plugins.svn.wordpress.org/werun-blocks-community/tags/X.Y.Z/` y el `Stable tag` de `trunk/readme.txt`;
- comprobar que la página pública muestra la versión.

## 7. Registro de revisiones e incidentes

### 2026-10-25: revisión 1 de werun.Blocks.Community 1.0.0

Llegó por email cuatro días después del envío. Todos los puntos se validaron contra el código y se corrigieron en una sola ronda.

| Punto del email | Qué había | Qué se hizo | Regla |
|---|---|---|---|
| Nonces y permisos | Punto genérico, sin ejemplos | Revisados todos los handlers: los ajustes usan la Settings API y las rutas del editor exigen capacidades. Solo cambiaron las rutas públicas (fila de abajo). | 3.1 |
| `permission_callback` en REST | `/gate/unlock` y `/query` con `__return_true` (públicas a propósito, la firma se verificaba en el callback) | La verificación de la firma y el rate limit pasaron a `can_unlock()` / `can_read()`. En la respuesta se explicó por qué son públicas. | 3.2 |
| Escapado | JSON-LD (acordeón FAQ y video) con `JSON_UNESCAPED_*` | Fuera los flags en todo JSON impreso; `JSON_HEX_TAG \| JSON_HEX_AMP` en los scripts inline. Una auditoría de las ~240 salidas con `phpcs:ignore` encontró además una opción `content` que imprimía markup crudo (eliminada) y el sprite SVG del admin con `echo file_get_contents()` (ahora pasa por `wp_kses`). | 3.3 |
| Activación | `str_starts_with()` con `Requires PHP: 7.4` (WordPress lo cubre con polyfill desde 5.9, pero lo marcaron igual) | Cambiado por `strpos()`. PHPCompatibilityWP encontró además `html_entity_decode()` sin flags. | 3.5 |
| URLs inválidas | 3 enlaces de privacidad con 404 (Typeform, Lever, SmartRecruiters) | Todos los enlaces revisados y reemplazados por las páginas vigentes, con términos y privacidad para cada servicio | 3.6 |
| Servicios no documentados | Había una sección, pero sin hosts de API, sin datos por servicio y sin términos | `== External services ==` reescrita, con una entrada por servicio (3.6) | 3.6 |
| Archivos remotos | `maps.gstatic.com` en la tabla de hosts para la CSP | No se carga nada: se explicó en la respuesta y Google Maps quedó documentado como servicio | 3.7 |

Además, en la misma fecha:

- **El zip llevaba `CHANGELOG.md`.** Se pasó a `changelog.txt`, todo `.md` quedó excluido en `.distignore`, y el workflow ahora valida el contenido del zip y el changelog de cada versión (secciones 1 y 6).
- **El repo público tenía rastros locales y personales:**
  - commits firmados con un email personal en vez del noreply de la cuenta;
  - trailers de coautoría y enlaces a sesiones de trabajo en los mensajes de commit;
  - rutas del disco local y el host del sitio de prueba en `bin/a11y` y en el README;
  - menciones al flujo de trabajo interno en las docs.

  Se limpió el contenido y se sumaron las reglas de la sección 2.

Respuesta enviada en el hilo:
- se subió la versión corregida;
- se aclaró que `/gate/unlock` y `/query` son públicas a propósito y qué verifica ahora su `permission_callback`;
- se aclaró que `maps.gstatic.com` no se carga (es una fila de la tabla de hosts para la CSP).

Estado: esperando la siguiente ronda.

### 2026-10-25: el rate limit contaba cada pedido 3 veces (detectado internamente)

Al portar estos arreglos a werun.Blocks se vio que, con la verificación dentro del `permission_callback`, cada pedido a `/gate/unlock` y `/query` sumaba 3 en el límite por IP. La causa: `rest_send_allow_header()` vuelve a llamar al `permission_callback`. El límite real era un tercio del configurado.
- Se corrigió memoizando la respuesta por `WP_REST_Request` en `can_unlock()` y `can_read()`.
- Se verificó simulando `dispatch()` + `rest_post_dispatch`: ahora cuenta 1 por pedido.
- La regla quedó en 3.2.
- El zip enviado en la ronda 1 se reemplazó por uno con el arreglo, antes de la siguiente revisión.

### 2026-10-25: auditoría con estas reglas de los demás plugins y themes de werun.dev

Se aplicaron las secciones 3 y 4 a werun.Blocks, werun.Toolkit, werun.BlocksTheme y su child. Lo que apareció, ya corregido y publicado:

| Producto | Qué había | Regla | Versión |
|---|---|---|---|
| werun.Blocks | Lo mismo que la ronda 1 de Community: rutas públicas, JSON, PHP 7.4 y doble conteo | 3.2, 3.3, 3.5 | 2.1.2 |
| werun.Toolkit | JSON-LD del FAQ con `JSON_UNESCAPED_*`; markup "de confianza" impreso tal cual (wrapper del FAQ, `aria-describedby` armado afuera); nonces escondidos en helpers; `$_POST` sin sanitizar como lista; `setAccessible()` obsoleto en PHP 8.5; CSS de Allow SVG en todo el admin | 3.1, 3.3, 3.4, 3.5, 3.8 | 1.9.5 |
| werun.BlocksTheme | Nonces dentro de un helper; ajustes sin sanitizar antes de validar; "Array to string conversion" con un campo enviado como lista; chequeo de licencia en `admin_init` para cualquier usuario; servidor de updates sin documentar | 3.1, 3.4, 3.6, 3.8 | 1.2.3 |
| werun.BlocksThemeChild | `index.php` vacío: blog, búsqueda y 404 **en blanco** (200 con 0 bytes); etiqueta `full-site-editing` sin plantillas | 3.9 | 1.0.1 |

Lo que quedaba abierto, también resuelto el mismo día:
- **Sitios de clientes con el child 1.0.0.** El child no se actualiza solo, así que lo arregla el padre: werun.BlocksTheme **1.2.4** detecta un `index.php` del child que solo tiene comentarios y vuelve a resolver la plantilla de bloques con `locate_block_template()`. Un `index.php` del child con código real se sigue respetando. Probado con los tres casos (vacío, con código, sin archivo).
- **werun.Toolkit 1.9.6.**
  - `readme.txt` documenta sus servicios externos: el CRM de werun.dev, los proveedores de IA del módulo Media AI y Brevo.
  - El zip ya no lleva `.md` ni dotfiles, y el workflow lo valida.
  - Los enlaces de OpenAI responden 403 a herramientas automáticas: son las URLs canónicas de sus políticas.
- **Términos de werun.dev.** La web tiene política de privacidad (general y por producto) pero no una página de términos. No hace falta crearla:
  - Community, que es lo único que revisa WordPress.org, no contacta werun.dev;
  - en los productos premium, los términos son el contrato de cada cliente con werun.dev; el readme de werun.Toolkit lo dice junto al enlace de privacidad.
- **Historial del repo público.** El repo con los commits viejos se renombró y pasó a privado. `werundev/wp-werun-blocks-community` se volvió a crear con un único commit limpio, con la identidad noreply y sin trailers, y con la misma descripción, homepage e issues.

### 2026-10-25: los bloques mostraban el ícono genérico en el editor (detectado internamente)

- En el insertador, la barra y la tarjeta del bloque, los 28 bloques aparecían con el ícono por defecto de WordPress en vez de su ícono de Lucide.
- La causa: `src/shared/block-icons.js` vino de werun.Blocks y buscaba la forma quitando el prefijo `werun/`. Los bloques de Community se llaman `werun-community/…`, así que no encontraba ninguna y devolvía `undefined`, que además pisaba el dashicon de cada `block.json`.
- Se corrigió tomando lo que va después del namespace, sea cual sea. Verificado en el editor: los 28 bloques muestran su ícono.
- La regla quedó en 3.10.
- Se armó un zip nuevo con el arreglo para reemplazar el enviado, antes de la siguiente revisión.

### 2026-10-29: plugin aprobado y primera versión en SVN

- WordPress.org aprobó werun.Blocks.Community con el slug `werun-blocks-community` y dio acceso SVN a `werundev` (sección 6.1).
- La 1.0.0 publicada es la que se envió a revisión, con el arreglo de los íconos del editor (entrada anterior). Hasta ahora no tenía tag ni release en GitHub: `v1.0.0` se creó sobre ese código.
- La 1.0.0 se subió a SVN a mano (sección 6.2). El deploy automático del workflow queda pendiente de crear la variable `WPORG_DEPLOY` y los secrets `SVN_USERNAME` y `SVN_PASSWORD`.
- Todavía no hay banner, ícono ni capturas en `.wordpress-org/`: la página del directorio usa el ícono genérico.
