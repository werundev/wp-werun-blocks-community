# Creating a new werun.Blocks.Community block

Step by step, with the conventions every block in `src/` follows. Read
`docs/block-controls-audit.md` too (rules 1–22: the checklist for the
controls), `docs/accessibility.md` (the WCAG 2.2 AA contract and its API)
and `docs/accessibility-audit.md` (rules 23 onwards: what the 2.1 audit
found and must not happen again).

## 0. Before you start

- **Reuse the shared modules** instead of writing behaviour again: carousel, counter, video (facade/modal/background), tabs, filter/search, consent, map, gating. Their markup contracts, PHP helpers (`wrbc_carousel_controls()`, `wrbc_consent_placeholder()`, `wrbc_video_id()`) and editor controls (`src/shared/controls-extra.js`: `CarouselPanel`, `RuleRows`, `ConsentControl`, `MediaOrVideoControl`) are in `docs/shared-modules.md`. A block lists the module handle in `block.json` (`viewScript: [ "wrbc-shared-view", "wrbc-carousel", … ]`, `style: [ "wrbc-shared", "wrbc-modules", … ]`) or enqueues it from `render.php` only when it's used.
- **Content from post types** goes through the query engine (`Werun\BlocksCommunity\Query\Config::normalize()` → `Runner`), never a hand-built `WP_Query` (see how testimonials' `source: query` does it).
- **Third-party embeds** (maps, video, forms) load only after consent (`wrbc_consent_placeholder()`), from validated ids and fixed hosts.
- **Settings and API keys** live in werun.Blocks.Community → Integrations (`Integrations::get()`, `Integrations::secret()`); never ask for a key in a block.
- **Signed data** the page prints and a request sends back uses `Werun\BlocksCommunity\Security\Signer` with its own purpose.
- **Rules 13–22** in `docs/block-controls-audit.md` (2.0 audit) are as mandatory as 1–12: full key sets in variations, never an attribute named `style`, "where content comes from" is content, clamp in render, no empty wrappers, `:where()` in shared CSS.
- **Accessibility is part of "done" (2.1)**: every variation and option meets WCAG 2.2 AA in a light **and** a dark context, with and without the theme's CSS, and the editor shows no contrast warning on the defaults. Never choose a colour by eye: the contrast helpers (`includes/a11y/`, `src/shared/contrast.js`) decide text, accent and focus colours from what the block sits on. Section 4 is the checklist.

## 1. Folder and files

```
src/<slug>/
├── block.json     ← name werun-community/<slug>, category "werun-community", textdomain "werun-blocks-community"
├── index.js       ← registerBlockType: icon, edit, save, variations
├── edit.js        ← editor: canvas + InspectorControls
├── render.php     ← front-end markup (dynamic block)
├── style.scss     ← front end + editor
├── editor.scss    ← editor only (optional)
├── view.js        ← front-end behaviour (optional, "viewScript": "file:./view.js")
└── colors.php/.js ← optional: the block's own colour logic, PHP and its JS twin (as pricing, feature)
```

- A child block (card, plan, item) gets its own folder and `"parent": [ "werun-community/<parent>" ]`.
- Add the slug to `WERUN_BLOCKS_COMMUNITY_BLOCKS` in `werun-blocks-community.php`, parents first: `register_block_type()` reads `build/<slug>/block.json`. PHP that isn't a render callback goes in `includes/<area>/` with a `loader.php` (auto-required for the areas listed in `werun-blocks-community.php`). Extra PHP files in `src/<slug>/` (like `colors.php`) are copied to `build/<slug>/` by `--webpack-copy-php`; require them with `__DIR__`.
- `block.json` of a parent block, as in `src/accordion/block.json`: `"editorScript": "file:./index.js"`, `"editorStyle": "file:./index.css"`, `"style": [ "wrbc-shared", "file:./style-index.css" ]`, `"viewScript": [ "wrbc-shared-view", "file:./view.js" ]` (only with a view.js), `"render": "file:./render.php"`. A child block only needs `editorScript`, `editorStyle` and `render`: its styles live in the parent's `style.scss`.
- Title without the brand ("Hero", "Pricing table"): the inserter groups them under **werun.Blocks.Community**.

## 2. Inserter: one entry per block

- `index.js`: `icon: blockIcon( metadata.name )`. Add the block to `SHAPES` in `src/shared/block-icons.js` with the shapes of a Lucide icon (copy the `<path>`/`<rect>` elements of `node_modules/lucide-static/icons/<name>.svg`, attributes in camelCase). **Don't** import the `.svg` from `node_modules`: it isn't run through svgr there and React crashes on a `data:` URL.
- The werun monogram badge (`assets/brand/werun-monograma-oscuro.svg`) is added by `assets/editor.css` to every `editor-block-list-item-werun-…`: nothing to do.
- Ready-made layouts are **variations with `scope: [ 'transform' ]`** (and `isActive`), never `inserter`: the inserter shows one block, and the layouts are under *Transform to variation* in the toolbar and the sidebar. No `isDefault`.
- Content the block starts with goes in the `edit.js` template (`useInnerBlocksProps( …, { template: TEMPLATE } )`), not only in variations: transforming changes attributes, not inner blocks.

## 3. Attributes

- Every attribute has a type and a default in `block.json`, **except** one that inherits from the parent (no default, so "not set" means inherit). "None" is stored as `{}` or `''`, never `undefined`.
- Icons are `{ name, lib, anim, trigger }` objects; pick them with `IconControl` (`src/shared/IconControl.js`) and print them with `<Icon />` / `wrbc_icon()`.
- Settings children need come from the parent through `providesContext` / `usesContext` (`werun-community/<parent>/<key>`), read the same way in the child's `edit.js` and `render.php` — colours included: a child that paints its own background needs the parent's accent and card settings to work out its tone.
- Colour defaults must already pass in both contexts. An overlay default over images is at least the readable floor (54 % black for white text).

### Saved styles (presets)

Every parent block gets a **Saved styles** panel (`src/presets/index.js`, stored by `includes/presets/class-presets.php`): it saves the block's styles and options with a name and applies them to the same block on any page. For a new block:

- Mark **every content attribute** with `"role": "content"` in `block.json` (texts, labels the editor writes in the canvas, URLs, images, media ids, alt texts, per-item lists). Everything else is saved as style: options, colours, icons, columns, and the `supports` attributes (`style`, `backgroundColor`, `fontSize`, `align`…). `anchor`, `metadata` and `lock` are never saved.
- Every **parent** `werun-community/*` block offers presets automatically (`Presets::supports()` and its JS twin); opt out with `"supports": { "wrbcPresets": false }`. Child blocks (with `parent`/`ancestor`) never do.
- Applying a preset sets every style attribute (the preset's value, or back to the default when it has none) and leaves content attributes alone.

## 4. Accessibility checklist (WCAG 2.2 AA)

The contract, with code, is `docs/accessibility.md`; the reasons are the rules in `docs/accessibility-audit.md`. For every block:

- **Colours from the helpers, PHP and JS twins alike.** Root: `$surface = wrbc_surface( $a, $block )`, class `wrbc_tone_class( $surface, wrbc_context_background( $block ) )`, vars `wrbc_accent_vars( $a, $surface )` (editor: `useSurface`, `useContextBackground`, `toneClass`, `accentVars`). Every inner part that paints its own background (card, plan, slide, item, featured column) gets its own tone class and readable colours for that background. A colour the block's own pickers set is printed as `wrbc_readable_color( $picked, $bg, 4.5 | 3 )`; the stored value stays. Native Color panel colours are never overridden — the editor warns.
- **Tokens, not raw colours.** `--wrbc-accent` only for fills (with `--wrbc-on-accent` on them); `--wrbc-accent-text` for accent used as text, links, icons and markers; `--wrbc-focus` for rings; `--wrbc-control-line` for the boundary of a control; `--wrbc-line` only for decoration; `--wrbc-muted` for secondary text. No `opacity` on text. An inner element that sets its own `--wrbc-accent` also sets `--wrbc-accent-text`, `--wrbc-focus` and `--wrbc-accent-hover`.
- **Text over images:** mark the media `data-wrbc-backdrop="image"` and the overlay `data-wrbc-backdrop="overlay"` (render.php and edit.js); the overlay never goes under the floor (`OverlayOpacityControl`, `wrbc_overlay_opacity()`).
- **Editor warning:** `<ContrastAudit blockRef={ ref } deps={ [ attributes ] } checks={ … } actions={ … } />` first in every parent block's edit output (and in children with their own colours), with `checks` for the non-text parts (dots, switches, input borders, selected markers, meaningful icons, text drawn by `::before`). Silent on defaults, light and dark.
- **Structure:** item titles one level under the block's printed title; lists as lists (`role="list"` when styled without bullets); data as `<table>` with `<caption>`/`<th scope>`; `section` + `aria-labelledby` only when the heading exists; meaningful images with alt, decorative `alt=""`, decorative icons `aria-hidden`; state never by colour alone.
- **Links and buttons:** a link without a URL is printed as text, never `href="#"`; new-tab links add `wrbc_new_tab_note( $new_tab )`; "Read more" says what about; a whole-card link is one link named by the title. A block's own `<button>` restates its colours for rest/`:hover`/`:focus`/`:focus-visible` at (0,3,0) or more (themes style `[type=button]` after the blocks).
- **Focus:** the shared ring (`.wrbc-root :focus-visible`) — move it with `--wrbc-focus-offset` (negative inside scrollers), never remove it; nothing sticky covers the focused element.
- **Operation:** keyboard patterns of the ARIA Authoring Practices (tabs, disclosure, carousel, dialog, switch/radio group); scrollers focusable (`role="group"` + label) only while they overflow and hold nothing focusable; targets ≥ 24 px; anything moving > 5 s has a visible pause button; reduced motion stops motion; live regions (`role="status"`) for changes the visitor caused (counts, results, "N more loaded"); focus never lost to `<body>` after an action.
- **Reflow:** no fixed heights on text, `min-width: 0` on flex/grid children that hold text, works at 320 px and with forced text spacing.

## 5. render.php

- Start with `$a = $attributes; $uid = wrbc_uid( $a, 'wrbc-<slug>' );` (HTML anchor or a unique id). Every id the block prints (titles, panels, fields, articles) starts with `$uid`, so two copies of the block on one page never share an id.
- Root classes: `wrbc-root wrbc-<slug> wrbc-<slug>--<modifier> $uid` plus the tone class, through `get_block_wrapper_attributes( $extra )`.
- Settings that style go out as CSS custom properties: `'style' => wrbc_css_vars( array_merge( wrbc_accent_vars( $a, $surface ), array( '--wrbc-gap' => wrbc_px( $a['gap'] ) ) ) )`. `wrbc_css_value()` drops anything that isn't a colour, a number or a colour/maths function, and `wrbc_css_vars()` turns colour functions into hex: WordPress drops `rgb()`, `hsl()` and `color-mix()` from a wrapper's style attribute.
- Enum attributes: `in_array( $value, array( … ), true ) ? $value : 'default'`; numbers: cast and clamp with **the same limits as the editor control**.
- Text: `esc_html()` / `esc_attr()`; rich text: `wrbc_rich()`; values inside arrays/objects: `wrbc_text()` first (block JSON can hold any type there). Links: `wrbc_link_attrs( $url, $new_tab )` + `wrbc_new_tab_note( $new_tab )`. Booleans: `wrbc_on( $a, 'key', default )`.
- Print a part only when it has content (no empty `<h2>`, no `aria-labelledby` pointing at nothing, no empty headings from a template).
- Rendering inner blocks again (as the FAQ schema does) needs a guard like `wrbc_in_faq_schema()`, or nesting multiplies the work.

## 6. edit.js

- Shared pieces in `src/shared/controls.js`: `ResponsiveColumns`, `Choice`, `Toggle`, `SectionHeader` / `SectionHeaderPanel`, `LinkFields`, `IconSizeControls`, `OverlayOpacityControl`, `cssVars()`, `px()`, `cx()`; colour twins in `src/shared/contrast.js`; the warning in `src/shared/a11y.js`. The editor preview uses the same classes and custom properties as `render.php` — check parity (tone classes and colour variables) on a page with extreme colours.
- `const ref = useRef(); const blockProps = useBlockProps( { ref, className, style } );` — `ContrastAudit` reads the canvas through that ref.
- **Every control is wrapped in the condition under which `render.php` uses it** (`{ layout === 'carousel' && <PanelBody …> }`); hide whole panels when nothing in them applies. Keep the stored values.
- When the parent switches something on for children, the parent also gets the control for its default (an icon for every item, …).
- Mirror `render.php`'s "effective value" logic with the same variable names, and a comment pointing to the twin.
- A server-rendered preview (`ServerSideRender`) never sees the block's colours or its parents: pass what render.php needs to work out the tone in the request (as jobs does).

## 7. CSS

- Classes `wrbc-<slug>__element` / `wrbc-<slug>--modifier`, never generic. Shared tokens and components live in `assets/shared.css` (tokens, tone classes, focus ring, link underline, `wrbc-btn`, `wrbc-header`, `[data-wrbc-reveal]`, icons, animations).
- Columns and layouts with container queries (the block's width, not the window).
- Sizes in `em` (the block's font size must scale them), line-height defaults on the wrapper with zero specificity, colour via the custom properties.
- Two features on one property (`transition`, `transform`, `box-shadow`) compose through custom properties.
- A link-looking component inside the block needs `.wrbc-root .x` specificity (block link colour prints `.wp-elements-N a:where()`); a block with a Color-panel link colour carries `wrbc-has-link-color`.
- Images the block sizes itself: at least `.wrbc-root .wrbc-x__img` — Hello Elementor's `.alignfull img { width: 100% }` (0,1,1) beats a single class.
- `prefers-reduced-motion`: no animation, no transition, no smooth scrolling. Icon loops stop by themselves in < 5 s; never an infinite animation without a pause button.

## 8. view.js

- Initialise per instance (`document.querySelectorAll( '.wrbc-<slug>' ).forEach( … )`), options from `data-*` attributes printed by `render.php`, no `innerHTML` with data. Works without JS where it can (`<details>`, scroll-snap, real links for filters and pagination).
- Keyboard and screen readers: roles, `aria-*`, live regions created at load (not on the first message), translated labels passed from PHP. Scroll that follows focus is instant, never smooth.
- After an action that removes or replaces what had focus (dismiss, filter, load more, consent, unlock), move focus somewhere meaningful.

## 9. Check, build, release

1. Build only what you touch while others work: `bin/build-block.sh <slug> [<slug>…]` (`shared` for the modules, `presets` for the editor hooks); `npm run build` once at the end. WordPress loads `build/`, not `src/`.
2. Render real combinations: `wp eval` with `do_blocks( '<!-- wp:werun-community/<slug> {…} /-->' )`, including wrong types (arrays where strings are expected), empty values, invalid colours and option combinations. No PHP warnings.
3. Accessibility harness (`bin/a11y/`, README there): write `bin/a11y/fixtures/<slug>.json` with every variation × every style option, `align: wide/full`, empty/long content and colours at the extremes (a light accent like #facc15, a mid-tone like #6366f1, a dark and a translucent card background), then `node bin/a11y/audit.mjs --group <slug>`, again with `--theme-css hello-last` and once with `--editor`. 0 FAIL; every "review" explained.
4. In the editor: insert the block, go through every panel in each mode, check that hidden controls really have no effect and that every visible one does; apply every variation; no contrast warning on defaults in a light page and inside a dark group; a deliberately failing colour shows the warning and its fix works. Keyboard only and a screen reader (VoiceOver rotor: headings, links, form controls) on the published page.
5. `php -l`, `CHANGELOG.md` under a new version (with "Notes for existing content" when markup or defaults change), `Version:` + `WERUN_BLOCKS_COMMUNITY_VERSION` + `readme.txt` Stable tag + `package.json` / `package-lock.json`, commit `Release X.Y.Z`, tag `vX.Y.Z`, push. The workflow publishes `werun-blocks-community.zip` for WordPress.org.
