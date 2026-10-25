# Shared modules and APIs (contract)

What every block can rely on. Blocks build against this contract; the
owners below implement it. Read `docs/creating-blocks.md` and
`docs/block-controls-audit.md` first.

## Ownership (who may edit what)

| Area | Owner | Others |
|---|---|---|
| `werun-blocks-community.php`, `webpack.config.js`, `src/shared/block-icons.js`, `src/shared/controls.js`, `src/shared/icons.js`, `src/shared/IconControl.js`, `assets/shared.css`, `assets/shared-view.js`, `includes/helpers.php`, `src/presets/`, `includes/presets/`, `includes/security/`, `includes/integrations/` | integrator | request changes in the report |
| `src/shared/view/*`, `src/shared/controls-extra.js`, `assets/modules.css`, `assets/vendor/`, `includes/modules/`, `scripts/vendor.mjs`, carousel migration in `src/testimonials/` and filter import in `src/accordion/view.js` | modules owner | use only |
| `includes/query/`, `src/query/` | query owners | use `Werun\BlocksCommunity\Query\*` only |
| `src/<slug>/` and the `includes/<area>/` of a block | that block's owner | — |

Already registered for every new block (integrator): the slug in
`WERUN_BLOCKS_COMMUNITY_BLOCKS`, its Lucide icon in `SHAPES`, presets (any parent
`werun-community/*` block; opt out with `"supports": { "wrbcPresets": false }`), the
`werun` category.

Never `git stash` the shared tree. Never run the full `npm run build` while
others work: scoped build into a scratch folder,
`npx wp-scripts build --webpack-src-dir=src/<slug> --output-path=<scratch>/<slug> --webpack-copy-php`.

## Front-end module handles

Registered on `init` before the blocks (so `block.json` can list them):
`wrbc-consent`, `wrbc-carousel`, `wrbc-counter`, `wrbc-video` (needs consent),
`wrbc-tabs`, `wrbc-filter`, `wrbc-map` (needs consent), `wrbc-gate` (needs
consent); style `wrbc-modules` (dialog, consent placeholder, chips, carousel
track; depends on `wrbc-shared`).

A block that uses a module lists it in `block.json`:

```json
"style": [ "wrbc-shared", "wrbc-modules", "file:./style-index.css" ],
"viewScript": [ "wrbc-shared-view", "wrbc-carousel", "file:./view.js" ]
```

Every module initialises itself on `DOMContentLoaded` for every matching
root, and exposes `window.wrbc.<module>.setup( root )` for markup inserted
later (query load-more). Options travel as JSON in a data attribute printed
with `wp_json_encode()`; texts shown by JS (labels) are passed from PHP so
they're translated (the modules also carry translatable defaults through
`wp.i18n`, which `wp_set_script_translations()` already loads for them).

Accessibility is part of the contract (`docs/accessibility.md`): each
section below says what the module does for keyboard and screen-reader
users and what the block must print. Colours in `wrbc-modules` use the
tokens: fills `--wrbc-accent` + `--wrbc-on-accent`, marks and links
`--wrbc-accent-text`, focus rings `--wrbc-focus`, control boundaries
(inputs, chips, inactive dots) `--wrbc-control-line`; `.wrbc-is-dark` /
`.wrbc-is-light` retune them. The module's own buttons (dots, arrows, play,
chips, the dialog's close) restate their look with `.wrbc-root` specificity
so a theme's `button` reset (Hello Elementor's pink) can't repaint them.

### wrbc-carousel

```html
<section role="region" aria-roledescription="carousel" aria-label="Carousel" (or aria-labelledby="<title id>")
     data-wrbc-carousel='{"loop":true,"autoplay":false,"interval":6,"pauseOnHover":true,
     "labels":{"carousel":"Carousel","slide":"slide","dotLabel":"Go to slide %d","slideLabel":"%1$d of %2$d",
               "current":"Slide %1$d of %2$d","track":"Slides, use the arrow keys to move","play":"Play the slides","pause":"Pause the slides"}}'
     style="--wrbc-pv-d:3;--wrbc-pv-t:2;--wrbc-pv-m:1;--wrbc-gap:24px">
  <div class="wrbc-carousel__track" data-wrbc-track tabindex="0" aria-label="…"> <div data-wrbc-slide>…</div> … </div>
  <button data-wrbc-prev aria-label="Previous slide">…</button> <button data-wrbc-next aria-label="Next slide">…</button>
  <div role="group" aria-label="Choose a slide" data-wrbc-dots></div> <button data-wrbc-play aria-label="Pause the slides"></button>
</section>
```
Scroll-snap track (works without JS), slides per view from `--wrbc-pv-*`
(container queries in `wrbc-modules`), loop, autoplay (pauses on hover,
focus, off-screen, hidden tab, pause button; never with reduced motion),
RTL, arrows/Home/End. `window.wrbc.carousel.refresh( root )`.

PHP: `wrbc_carousel_attrs( $a, array( 'label' => __( 'Testimonials', 'werun-blocks-community' ), 'count' => 5 ) )`
returns `role="region"`, `aria-roledescription`, a fallback `aria-label`
and `data-wrbc-carousel`. The name: a block that prints its title adds
`aria-labelledby` (wins); else the `label` arg; else "%d slides" from
`count`; else "Carousel" until the module counts the slides
(`options.autoName`: the module replaces only that printed fallback, never
a name the block set itself). `wrbc_carousel_controls()` prints the
controls row.

What the module does (WAI-ARIA APG carousel; WCAG 2.2.2, 2.4.3, 4.1.2):
- Root: a region (or a named `section`) with `aria-roledescription`
  "carousel" and a name, added when the markup lacks them.
- Slides: `aria-roledescription` "slide" and "n of m"; `role="group"` on
  generic containers (`div`, `section`), while an `li`, `figure` or
  `article` keeps its own role (a list stays a list).
- Track: a Tab stop (`tabindex="0"`, `role="group"`, named) only while it
  scrolls and some slide has nothing focusable; otherwise no tab stop and no
  role/name (a `role="list"` track keeps its role).
- Prev/next at the ends without loop: `aria-disabled="true"` (never
  `disabled`, so a focused arrow keeps focus); the icon fades.
- Dots: buttons "Go to slide n", `aria-current="true"` on the current one,
  rebuilt when slides per view change (a focused dot keeps its place).
- Play/pause: its name says what it does ("Pause the slides" / "Play the
  slides"), no `aria-pressed`; `.is-paused` swaps the icon; hidden (and
  `display: none`) under reduced motion.
- A polite live region (`.wrbc-carousel__status`) says "Slide n of m" after a
  move the visitor made; never while autoplay moves it.
- Focus that stays in view: a link or button focused in a slide that is only
  partly on screen (a peek; the browser's minimal scroll pulled back by
  snapping) brings its whole slide in (WCAG 2.4.11). Blocks don't need their
  own copy.
- Slides are `position: relative`, so visually hidden text inside a slide
  scrolled out of view can't widen the page.
- Peek and gap are capped against the track's width (`--wrbc-track-peek`: 25 %
  at most; `--wrbc-track-gap`: 8 %, never under 12 px), so slides aren't
  squeezed at 320 px; a block that sets its own track columns uses these two
  custom properties instead of `--wrbc-peek` / `--wrbc-gap`.
- Focus rings: `--wrbc-focus`, offset through `--wrbc-focus-offset` (dots set
  `-2px`: the ring sits inside the 28 px button).
- The track has no `scroll-behavior: smooth` (the browser's own scroll to a
  focused link would be animated, leaving it off screen for a moment). The
  module glides only for arrows, dots, thumbnails (`wrbc.carousel.goTo()`) and
  autoplay, never under reduced motion; moves driven by focus (the reveal) or
  by the keys on the track are instant, so what has focus is never
  mid-scroll. Blocks don't set smooth scrolling on their tracks either.

### wrbc-counter

```html
<span data-wrbc-count='{"to":1200,"from":0,"decimals":0,"grouping":true,"prefix":"","suffix":"+","duration":1600}'>1,200+</span>
```
The final value is printed by PHP (SEO, no JS). Counts once in view
(IntersectionObserver) for at most 5 s (WCAG 2.2.2; longer `duration`s are
capped), with the group and decimal marks of the printed number
("1.200.000" counts as "1.199.999"; `Intl.NumberFormat( document.documentElement.lang )`
when the text doesn't show them plainly), keeping the final width while it
counts (no layout jump); reduced motion shows the final value. The animated
text is `aria-hidden` next to a visually hidden final value.

### wrbc-video

```html
<div data-wrbc-video='{"provider":"youtube|vimeo|file","id":"…","src":"…","mode":"inline|modal|background","start":0,"title":"…"}'>
  <button class="wrbc-video__play">poster + play</button>
</div>
```
IDs validated with the same regex in PHP and JS (`wrbc_video_id()` /
`videoId()`): YouTube `^[A-Za-z0-9_-]{11}$`, Vimeo `^\d{6,12}$`; `file`
only an attachment URL. Facade: the iframe (`youtube-nocookie.com`,
`player.vimeo.com …?dnt=1`) is created only on click (or consent for
`cmp`). Modal: `<dialog>.showModal()`, Escape, focus returns, iframe
removed on close. Background: self-hosted `<video muted loop playsinline>`
with a visible pause button (WCAG 2.2.2), poster only under reduced motion
or Save-Data.

Accessibility: the block names the play button ("Play video: title") and
gives the poster `alt=""`; options `title` (the iframe's `title`, the
dialog's name), `labels.close` / `frame` / `play` / `pause`, `tracks`
(captions for a file: `[{ src, srclang, label, kind, default }]`).
Inline: focus moves into the player when it came from the play button (not
when a consent banner allowed it later). Modal: named `<dialog>`, focus on
the 44 px close button, which sits in a bar above the player inside the
dialog (never off screen); Escape and the backdrop close; focus returns to
the play button. The player's focus ring is drawn inside its frame
(`.wrbc-video__frame::after`, `.is-focus-visible` for iframes), since the
frame clips. Background: the toggle's name says what it does ("Pause…" /
"Play…"), it offers "Play" when the browser refuses to autoplay.

### wrbc-tabs

```html
<div data-wrbc-tabs='{"activation":"auto|manual","orientation":"horizontal|vertical","hash":true}'>
  <div role="tablist"> <button role="tab" id="t1" aria-controls="p1">…</button> … </div>
  <section role="tabpanel" id="p1" aria-labelledby="t1">…</section>
</div>
```
Roving tabindex, arrows by orientation, Home/End, hash deep links (a tab
id, or an element inside a panel, opens it; nested too). Without JS every
panel shows with its heading; with JS inactive panels get
`hidden="until-found"` (in-page find opens them). A tab that gets focus is
scrolled fully into view (`scrollIntoView( { block: 'nearest', inline: 'nearest' } )`),
so a sideways-scrolling row never leaves it half hidden (WCAG 2.4.11).

### wrbc-filter

`import { filterList, normalize } from '../shared/view/filter'` for bundled
use, or the handle for markup-driven lists:
```html
<div data-wrbc-filter='{"live":"%d results","liveOne":"1 result"}'>
  <label for="q">Search</label> <input id="q" data-wrbc-filter-search>
  <label for="d">Department</label> <select id="d" data-wrbc-filter-select="dept">…</select>
  <button data-wrbc-filter-chip="dept" data-value="12" aria-pressed="false">…</button>
  <ul> <li data-wrbc-filter-item data-dept="12" data-text="…">…</li> </ul>
  <p data-wrbc-filter-empty hidden>…</p> <p class="wrbc-sr-only" data-wrbc-filter-status aria-live="polite"></p>
</div>
```
Word-AND search without accents, selects and chips AND-ed, live count.
The block prints the labels (visible, or `aria-label`) and the status
element (`aria-live="polite"`, present from the start). `.wrbc-filter__chip`
(the module's own chip look): a 3:1 boundary (`--wrbc-control-line`); pressed
= the accent fill with its on-colour, a border in `--wrbc-accent-text` and a
drawn tick (so the state reaches 3:1 in every context, not through the fill
alone). The module keeps
`aria-pressed` on chips, never navigates on change, updates the count after
every change and when the browser restored a value (back/forward), and
stops Enter in the search from submitting a surrounding form. Count texts,
best first: `"counts": [ "0 results", "1 result", … ]` (one per number, from
PHP's `_n()`), `"live": { "one": "…", "few": "…", "other": "…" }` (picked
with `Intl.PluralRules`), or `"live"` / `"liveOne"`.

### wrbc-consent

`window.wrbc.consent.has( category )`, `.request( category, element )`,
`.grant( category )`, event `wrbc:consent` on `document`. Categories:
`maps`, `video`, `forms`. Mode from Integrations `privacy.consent`
(`click` | `cmp` | `none`) or a per-block override; `cmp` honours the WP
Consent API (`wp_has_consent`), Complianz, CookieYes and Cookiebot.
PHP helper (modules owner, `includes/modules/`):
`wrbc_consent_placeholder( string $category, string $host, string $label, array $args = array() ): string`
— the placeholder button "Load … (from host)" every third-party embed shows
first.

The placeholder is printed `hidden` (its button needs JS): `request()`
shows it when the embed asks for consent and never when consent was
already given; without JS a `<noscript>` line says the embed needs
JavaScript (not for `'hidden' => true`, which stays hidden until the
module asks, as wrbc-video does in cmp mode). The editor's canvas shows it
(`[data-wrbc-consent-wait]`). The note above the button describes it
(`aria-describedby`); a status element (`[data-wrbc-consent-status]`,
`role="status"`) says "Loading…" and load errors.

`window.wrbc.consent.loaded( placeholder, target )` — call it when the embed
is in: if the visitor's focus was on the placeholder's button, it moves to
`target` (made focusable with `tabindex="-1"` when needed), never to
`<body>`. `window.wrbc.consent.failed( placeholder, message )` — the embed
could not load: the message in the status, the button usable again; call
`request()` again to wait for the retry. While loading, the button is
`aria-disabled="true"`.

### wrbc-map

```html
<div data-wrbc-map='{"provider":"leaflet|google","zoom":12,"fitBounds":true,"cluster":true,"height":420,"markerColor":"#…"}'>
  <script type="application/json" data-wrbc-map-points>[{"lat":-34.6,"lng":-58.4,"title":"…","address":"…","url":"…"}]</script>
  <!-- consent placeholder -->
</div>
```
Points JSON printed with `wp_json_encode( $points, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT )`.
Leaflet/markercluster are vendored in `assets/vendor/leaflet/` and injected
from `window.wrbcModules.leaflet` only after consent; tiles/attribution and
the Google key/Map ID from `window.wrbcModules.integrations.maps`. The list
of locations is always printed by the block (accessible without the map).

Accessibility: the map is a focusable region named by `labels.map`
("Map of …"); markers are buttons named by the point's title (else its
address, else `labels.point` "Location %d"); clusters "%d locations, zoom
in" (`labels.cluster`); the custom pin has a dark and a white outline, so
any `markerColor` keeps 3:1 on the tiles. Enter on a marker opens its popup
and moves focus into it (its link or close button); Escape or the close
button closes it and focus returns to the marker. After the consent button,
focus moves to the map; if the map can't load, `labels.error` is said in
the placeholder and its button retries. Buttons with
`data-wrbc-map-focus="<index>"` (the list's "Show on the map") open a popup
without moving focus. The attribution link is underlined.

### wrbc-gate

Gating of downloads. Markup:
```html
<div data-wrbc-gate='{"ticket":"<signed>","mode":"hard|soft","provider":"…","formId":"…","labels":{…}}'> <!-- form --> <div data-wrbc-gate-result></div></div>
```
Adds `wrbc_gate_ticket` to native WP forms before submit, listens to the
provider's success event (origin checked for postMessage), calls
`POST wrbc/v1/gate/unlock { ticket }` and swaps in the download link it
returns. The ticket is only added to forms that post to this site.
The result box (`[data-wrbc-gate-result]`, created when missing) is a
`role="status"` live region from setup, so "Preparing your download…",
"ready" and errors are announced; the link takes focus, and the skip button
(`[data-wrbc-gate-skip]`, "Get the file") is hidden. The error colour is the
red mixed with the text colour (readable on light and dark).
Server side lives in `includes/gate/`: ticket payload `{r,p,f,n,m,k}`
(resource, page, file, nonce, hard|soft, `provider:formId`); PHP
`wrbc_gate_ticket( $resource, $page, 'soft'|'hard', 'provider:formId' )`,
`wrbc_gate_remembered()`, `wrbc_gate_download_url()`, `wrbc_gate_attachment_id()`.
The file is the resource's post meta `_wrbc_download_id`, or the resource
itself when it's an attachment. The form block fires `wrbc:form-success` and
calls `wrbc.gate.unlock()`.

## Editor controls (`src/shared/controls-extra.js`, modules owner)

- `CarouselPanel( { attributes, setAttributes } )`: loop, autoplay,
  interval, pause on hover, arrows, dots, controls position, prev/next icons
  — attributes named like testimonials (`loop`, `autoplay`, `interval`,
  `pauseOnHover`, `showArrows`, `showDots`, `controlsPosition`, `prevIcon`,
  `nextIcon`), with their own conditional visibility.
- `RuleRows( { rows, onChange, renderRow, addLabel, max } )`: add / remove /
  reorder a list of rule rows (query filters, card fields).
- `ConsentControl( { value, onChange } )`: inherit | click | cmp | none.
- `MediaOrVideoControl( { value, onChange, allowVideo, label } )`: image (media
  library) or video (YouTube/Vimeo URL → validated id, or an uploaded file)
  plus poster, title, transcript and, for a file, captions (a `.vtt` from
  the media library); value `{ type, id, url, provider, videoId, posterId,
  posterUrl, alt, captionsId, captionsUrl, transcript }` (`alt` is the
  image's alternative text or the video's title; the poster's alt is never
  copied into it).

## PHP APIs (integrator)

- `Werun\BlocksCommunity\Security\Signer::sign( array $payload, string $purpose, int $ttl = 0 ): string`,
  `::verify( $token, string $purpose ): ?array`, `::id( array $payload ): string`.
  Purposes in use: `query`, `gate`, `download`, `gate-cookie`.
- `Werun\BlocksCommunity\Integrations\Integrations::get( 'section.key' )`,
  `::secret( 'hubspot_token' | 'teamtailor_key' | 'bamboohr_key' )`,
  `::schema()`, `::sanitize()`, `::public_settings()`, `::editor_settings()`.
  Editor JS reads `window.wrbcSettings.integrations` (plain values plus
  `secrets.<name>: bool`). Front JS reads `window.wrbcModules.integrations`
  (public values only).
- `includes/<area>/loader.php` is required automatically for the areas
  `modules`, `query`, `forms`, `gate`, `jobs`, `toc`, `admin/integrations`.
- Existing helpers: `wrbc_uid`, `wrbc_text`, `wrbc_rich`, `wrbc_css_value`,
  `wrbc_css_vars`, `wrbc_px`, `wrbc_icon`, `wrbc_icon_wrap`, `wrbc_link_attrs`,
  `wrbc_on`, `wrbc_section_header`, `wrbc_in_faq_schema`.

## REST namespace `wrbc/v1`

Editor routes need `edit_posts` (and the post type's own edit cap where it
applies); settings routes need `manage_options`; public routes accept only
signed input (Signer) and run as an anonymous visitor.
