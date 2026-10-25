# Accessibility (WCAG 2.2 AA)

Every block, in every variation and with every option, meets **WCAG 2.2
level AA** on the published page, in a light and in a dark context. This is
the contract the blocks build against; `docs/creating-blocks.md` points
here, and `docs/accessibility-audit.md` records the audit of 2.1.

## 1. Colour and contrast

| Pair | Minimum |
|---|---|
| Text (incl. placeholders, badges, captions, button labels in every state) | **4.5:1** |
| Large text: 24 px, or 18.66 px from weight 700 | **3:1** |
| Boundary that identifies a control (input, select, switch, inactive dot), focus ring, state indicator (selected tab, current dot), meaningful icon (stars, check/cross) | **3:1** |
| Decorative borders, separators, `aria-hidden` decorative icons, logotypes, disabled controls | — |

Text over an image counts against the **lightest and the darkest pixel**
the image could have under the overlay: white text needs a black overlay of
at least **54 %** (42 % if it's all large text). `wrbc_min_overlay_opacity()`
computes it for any colours.

### Tokens (`assets/shared.css`, on every `.wrbc-root`)

| Token | Use it for | Default |
|---|---|---|
| `--wrbc-accent` | Fills: buttons, active dots, pressed chips, icon holders, badges | `#4f46e5` (6.29:1 on white) |
| `--wrbc-on-accent` | Text and icons **on** an accent fill | `#fff`; automatic on a custom accent |
| `--wrbc-accent-text` | The accent **as text**, link, icon or marker on the block's background | `var(--wrbc-accent)`; readable version printed when needed |
| `--wrbc-focus` | Focus rings | `var(--wrbc-accent-text)` |
| `--wrbc-muted` | Secondary text | currentColor 72 % (4.5:1 with theme text up to ≈ #444) |
| `--wrbc-control-line` | The boundary of a control (inputs, selects, toggles, inactive dots/steps) | currentColor 64 % (3:1 up to ≈ #5a5a5a) |
| `--wrbc-line` | Decoration only (card borders, dividers) | currentColor 14 % (≈ 1.3:1) |
| `--wrbc-surface` | Tinted backgrounds (hover, chips) | currentColor 4 % |

Never use `--wrbc-accent` as a text, link, icon or focus colour: use
`--wrbc-accent-text` / `--wrbc-focus`. Those two are computed where they're
declared (the block root), so an inner element that sets its own
`--wrbc-accent` (a notice tone, a featured plan) must set its own
`--wrbc-accent-text` and `--wrbc-focus` too (or redeclare
`--wrbc-accent-text: var(--wrbc-accent); --wrbc-focus: var(--wrbc-accent-text)`
there), or its links and rings keep the root's colours. Never put text on a fill without its
"on" colour (`--wrbc-on-accent`, or the block's own on-colour attribute).
Opacity and `color-mix(… transparent)` on text lower its contrast: compute
the result, don't guess.

### Colours the author picks

- **A pair the block controls** (its own pickers: accent and on-accent,
  card / featured / item / slide / table backgrounds and the text, icons,
  stars, markers and tone colours on them): `render.php` and `edit.js`
  print the readable version, `wrbc_readable_color( $picked, $bg, 4.5 )`
  (3 for large text and non-text) — the closest colour to the author's,
  changed only as much as AA needs. The stored value stays as chosen, so a
  later background change can bring it back. When no colour was picked,
  the automatic one (`wrbc_on_color()`, tone classes) applies.
- A block that layers a translucent colour over a background itself (a
  white 10 % card tint over the section) passes the exact composite to the
  helpers — `wrbc_color_over( $tint_rgba, $under_rgba )` as an array, not its
  rounded hex: checkers don't round, and 4.5:1 against the hex can be 4.49:1
  against the real colour.
- **The native Color panel** (text, background, link of the block): never
  overridden — `ContrastAudit` warns. A text colour the author didn't pick
  follows the tone (`.wrbc-is-dark` / `.wrbc-is-light`).
- `wrbc-has-link-color` is added to a block whose Color panel sets a link
  colour (`includes/a11y/context.php`, `src/shared/editor-hooks.js`;
  WordPress only prints `wp-elements-N`): the dark-context link rule leaves
  those links alone.

### Tone: what the colours sit on

`.wrbc-is-dark` goes on any element that paints — or sits on — a dark
background; `.wrbc-is-light` on a light one inside a dark context. The CSS
turns the text white (or ink) when no text colour was chosen
(`:not(.has-text-color)`), and lightens `--wrbc-accent-text` / `--wrbc-focus`.
When PHP/JS know the colours they print the exact readable accent instead
(`wrbc_accent_vars()`), so the mix in the CSS is only a fallback.

A block learns its background from:
- its own Color panel background or gradient (`wrbc_block_colors()`), its
  own background image + overlay, `werun-community/section`'s text tone;
- otherwise the **render context**: the nearest ancestor block that paints
  a background (a werun section, a core group/columns with a background, a
  cover) — `includes/a11y/context.php` keeps a stack during rendering
  (`render_block_data` → `render_block`); the editor reads the parents from
  the block editor store (`useSurface()`);
- otherwise the page (`wrbc_page_colors()`: the theme's global styles, white
  for classic themes; filter `wrbc_page_colors` for a dark classic theme).

### PHP (`includes/a11y/contrast.php`, `context.php`)

```php
$surface   = wrbc_surface( $a, $block );                // own background, or the one around the block
$classes[] = wrbc_tone_class( $surface, wrbc_context_background( $block ) ); // wrbc-is-dark / wrbc-is-light / ''
$vars      = array_merge( $vars, wrbc_accent_vars( $a, $surface ) );       // --wrbc-accent, automatic --wrbc-on-accent, --wrbc-accent-text
// Inner elements with their own background (cards, plans, slides, notices):
$card_class = wrbc_tone_class( $card_bg, $surface );
$card_text  = wrbc_on_color( $card_bg );                 // white or #0f172a
$readable   = wrbc_readable_color( $fg, $bg, 4.5 );      // closest colour to $fg that reaches 4.5:1 on $bg
$ratio      = wrbc_contrast_ratio( $fg, $bg );           // 1–21, 0 = unknown
$min        = wrbc_min_overlay_opacity( '#fff', $overlay_color, 4.5 );
```

Also: `wrbc_color_rgba()` (hex, rgb/rgba, hsl/hsla, presets, `var:preset|color|x`,
`color-mix(in srgb, …)`), `wrbc_color_hex()`, `wrbc_is_dark_color()`,
`wrbc_preset_color()`, `wrbc_context_background()`. Constants
`WERUN_BLOCKS_COMMUNITY_INK` (#0f172a), `WERUN_BLOCKS_COMMUNITY_PAPER` (#fff),
`WERUN_BLOCKS_COMMUNITY_AA_TEXT` / `_LARGE` / `_UI`.

### JS twins (`src/shared/contrast.js`)

Same names in camelCase and the same palette (`wrbcSettings.colors`), so the
preview picks the same colours as the page: `colorRgba`, `contrastRatio`,
`onColor`, `readableColor`, `isDarkColor`, `toneClass`, `minOverlayOpacity`,
`blockColors`, `blockSurface`, `accentVars`, and the hooks
`useSurface( clientId, attributes, name )` / `useContextBackground( clientId )`.

```js
const surface = useSurface( clientId, attributes, name ); // own background, or the one around the block
const around = useContextBackground( clientId );
const style = cssVars( { ...accentVars( attributes, surface ), '--wrbc-gap': px( gap ) } );
const className = cx( 'wrbc-root wrbc-x', toneClass( surface, around ) );
```

### Warnings in the editor (`src/shared/a11y.js`)

```js
const ref = useRef();
const blockProps = useBlockProps( { ref, className, style } );
return (
	<>
		<ContrastAudit
			blockRef={ ref }
			deps={ [ attributes ] }
			checks={ [ { selector: '.wrbc-x__dot', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Slider dots', 'werun-blocks-community' ) } ] }
			actions={ overlayTooLight ? [ { label: sprintf( __( 'Raise the overlay to %d %%', 'werun-blocks-community' ), minOverlay ), onClick: () => setAttributes( { overlayOpacity: minOverlay } ) } ] : [] }
		/>
		<InspectorControls>…</InspectorControls>
		<div { ...blockProps }>…</div>
	</>
);
```

- Scans every visible text of the block in the canvas with its computed
  colour, ancestors' opacity and translucent backgrounds, gradients, and
  overlays over images; lists what's under 4.5:1 / 3:1 at the top of the
  sidebar, with a sample of the text. Nothing shows while all passes.
- Mark background media and overlays so it (and the audit harness) can see
  them: `data-wrbc-backdrop="image"` on a background `<img>`/`<video>`,
  `data-wrbc-backdrop="overlay"` on the overlay element (in `edit.js` **and**
  `render.php`). core/cover's own classes are recognised.
- `checks` adds non-text pairs (`property` can be `box-shadow`: its first
  colour, for rings drawn with a spread shadow); `ignore` leaves out decorative text
  (a selector); `labels` names parts (`{ '.wrbc-x__price': __( 'Price' ) }`);
  `actions` are one-click fixes.
- `checks` can also measure text a pseudo-element draws (a CSS counter in a
  marker): `{ selector, pseudo: '::before', property: 'color', against:
  'pseudo', min: 4.5 }`.
- Overlays over background images: the opacity never goes under the
  minimum that keeps the text readable over any image. `OverlayOpacityControl`
  (`src/shared/controls.js`) starts its range there for the chosen overlay
  and text colours, and `render.php` clamps with
  `wrbc_overlay_opacity( $value, $text, $overlay )` (JS `overlayOpacity()`),
  so an older, lower stored value never reaches the page. Defaults pass.

## 2. Structure and names

- Headings: a configurable level for titles, no skipped levels inside a
  block, titles of items one level under the block's header.
- Lists as `ul`/`ol` (grids of cards too; `role="list"` on a list styled
  without bullets, which Safari otherwise drops, or on a `div` grid with
  `role="listitem"` children); term/value pairs as `dl`; data as
  `<table>` with `<caption>` and `<th scope>`.
- Item titles are one level under the block's printed title (H2 → H3); a
  level control for them appears only when the block has no title.
- `section` + `aria-labelledby` only when the heading is printed; no
  landmark for decoration.
- Images: meaningful ones need `alt` (logos: the company name); decorative
  ones `alt=""`; icons `aria-hidden="true" focusable="false"` (what
  `wrbc_icon()` prints) unless they carry meaning — then `wrbc_icon( $icon,
  array( 'label' => … ) )` or a visually hidden text (`.wrbc-sr-only`).
- State never by colour alone: featured plan (badge text), current tab /
  dot / page (`aria-current` or `aria-selected` **and** a shape/weight/line
  cue), notice tones (icon + visually hidden "Warning:"), excluded features
  ("Not included").
- Links: underlined inside running text (the shared rule does it); "Read
  more" style links say what they're about (visually hidden title or
  `aria-describedby`); whole-card links are one link named by the title, with
  no interactive element inside, and show a focus ring around the card;
  "opens in a new tab" in the name when `target="_blank"`.

## 3. Operation

- Keyboard: every action is a `button` or an `a`; scrollers that hold
  content get `tabindex="0"`, `role="group"` and a label while they
  actually overflow, unless they contain focusable items (`group`, not
  `region`: a named region is a landmark, and a page of carousels would be
  a page of landmarks); no traps; dialogs return focus.
- Carousels: the root `role="region"` (or `section`) with
  `aria-roledescription="carousel"` and a label; slides `role="group"` +
  `aria-roledescription="slide"` + "n of m"; the play/pause button changes
  its label ("Pause the slides" / "Play the slides"), without `aria-pressed`.
- A button or link without a URL isn't printed as a link (`href="#"` is a
  fake link): print the label as text, and warn in the editor.
- New-tab links say so: `wrbc_new_tab_note( $new_tab )` prints the same
  visually hidden "(opens in a new tab)" in every block.
- Focus: the shared `.wrbc-root :focus-visible` ring (2 px `--wrbc-focus`,
  offset 2 px) — restate offset/radius in a component, never remove it;
  inside a scroller draw it inset (negative offset) so it isn't clipped;
  nothing sticky covers the focused element (`scroll-margin-top`).
- Buttons against theme styles: themes style `button`, `[type=button]` and
  their `:hover`/`:focus` (Hello Elementor: transparent with a pink border,
  pink on hover and focus) and print after the blocks. `.wrbc-btn` buttons
  are restated in `assets/shared.css` at (0,3,0); a block's own `<button>`
  (arrows, close, info, toggles) restates background, colour, border and
  padding for its rest, `:hover`, `:focus` and `:focus-visible` states with
  at least `.wrbc-root .wrbc-x .wrbc-x__btn` (0,3,0).
- Target size: 24 × 24 px at least (dots and chips draw a small shape
  inside a 24–28 px button); `.wrbc-btn` is 44 px tall, `.wrbc-btn--link` 24 px.
- Motion: anything that moves on its own for more than 5 s (autoplay,
  marquee, background video) has a **visible pause button**; icon loops stop
  after < 5 s by themselves; `prefers-reduced-motion` removes animation,
  transitions and auto-scrolling; nothing flashes.
- Loops and marquees duplicate items: the copies are `aria-hidden="true"`
  and `inert` (or their links `tabindex="-1"`).
- Status messages (`role="status"` / `aria-live="polite"`): filter counts,
  form results, "N more loaded", price period switch.
- Forms: visible labels, `autocomplete`, required in text, errors in text
  linked with `aria-describedby` + `aria-invalid`, focus to the first error.

## 4. Checking

1. `node bin/a11y/audit.mjs --group <slug>` (README in `bin/a11y/`: install
   its fixtures mu-plugin and seed content on a local site first): axe-core
   WCAG 2.2 AA, focus visibility and ring contrast, target size, reflow at
   320 px, text spacing, motion after 5 s, non-text and pseudo-element
   contrast, light and dark contexts, 1280 and 375 px; again with
   `--theme-css hello-last` and once with `--editor`.
2. The editor's contrast warning for the block, in each variation, with the
   colour options at their defaults and at extremes.
3. Keyboard only and a screen reader (VoiceOver: rotor headings, links,
   form controls) on the published page.
