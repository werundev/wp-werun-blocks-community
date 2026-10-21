# Accessibility audit (2026-10-17, werun.Blocks.Community 2.1.0)

Every block, variation and option against **WCAG 2.2 AA**: one agent per
block group, a shared colour foundation (`includes/a11y/`,
`src/shared/contrast.js`, `src/shared/a11y.js`, tokens in
`assets/shared.css`) and an automated harness (`bin/a11y/`): axe-core
WCAG 2.2 AA, focus visibility and ring contrast, target size, reflow at
320 px, text spacing, motion after 5 s, non-text and pseudo-element
contrast, light and dark contexts, 1280 and 375 px, Hello Elementor's
stock CSS printed first and last, the block editor, and a stand-in
Contact Form 7 for the WordPress-plugin path. The contract is
`docs/accessibility.md`; rules 1–22 are in `docs/block-controls-audit.md`.

## What was broken

| Found (in most blocks) | Fix |
|---|---|
| The accent (#4f46e5) used as text, links, icons and focus rings: 2.84:1 on dark backgrounds, invisible on accent-coloured ones. | `--wrbc-accent-text` / `--wrbc-focus`, computed for what the block sits on (`wrbc_accent_vars()`). |
| A dark section/group/cover or the block's own dark colour left theme text on it (1.1–1.4:1); white shadow cards in a dark section kept white text (1:1). | Render-context stack + tone classes `wrbc-is-dark` / `wrbc-is-light` on roots and on every part that paints. |
| Light custom accents with white labels (1.18–1.74:1); picked card/marker/star/tone colours that didn't read. | Automatic on-colour; pickers printed as the closest readable colour. |
| Text over images at the default overlays (slide 40 %: 2.85:1, section 50 %: 3.98:1), muted text and eyebrows over pictures. | Overlay floor (54 % for white on black), text colour for secondary text over pictures. |
| Control edges at `--wrbc-line` (1.3:1): search fields, selects, switches, inactive dots, open-tab markers. | `--wrbc-control-line` (3:1). |
| Content with the entrance reveal invisible without JS, with a blocked script, for tall elements at 400 % zoom, or with focus inside. | `html.wrbc-js` guard, viewport-based reveal, `:focus-within`, print. |
| Theme styles printed after the blocks (Hello `[type=button]` pink, `[tabindex]` ring, `.alignwide` −80 px, `.alignfull img`, link #c36 / `a:hover` #336). | Restated at (0,3,0)+, `--wrbc-focus-offset`, clamped wide/full, link rule for dark contexts. |
| WordPress dropping `rgb()`/`hsl()`/`color-mix()` from wrapper styles (colours the maths used never reached the page). | `wrbc_css_vars()` prints them as hex. |
| Heading levels skipping or repeating; landmarks for decoration; lists without list semantics in Safari; `href="#"` buttons; "Read more" without context; missing new-tab notes. | Titles one level under the block title, `role="list"`, links only with a URL, `wrbc_new_tab_note()`. |
| Focus lost to `<body>` after an action; focused elements under sticky parts or in half-visible slides; rings clipped by `overflow: hidden`. | Focus management per action, instant scroll on focus, rings inside scrollers. |
| Motion over 5 s without a control (looping icons, marquee, count-ups up to 10 s). | Loops stop in < 5 s, pause buttons, 5 s cap. |

## Rules (continuing 1–22)

23. A block works out what it sits on (`wrbc_surface()` / `useSurface()`) and prints its tone class and accent variables from the helpers — never a colour chosen by eye.
24. Every part that paints its own background (card, plan, slide, item, featured column, notice, table head) gets its own tone class and readable colours for that background.
25. `--wrbc-accent` is only a fill (with `--wrbc-on-accent` on it); as text, link, icon or marker it is `--wrbc-accent-text`; rings are `--wrbc-focus`.
26. A control's boundary is `--wrbc-control-line` (3:1); `--wrbc-line` is decoration only.
27. No `opacity` or translucent mix on text without computing the result.
28. Colours the block's own pickers set are printed as the closest readable colour (`wrbc_readable_color()`); native Color-panel colours are never overridden — the editor warns.
29. Text over images: backdrops marked `data-wrbc-backdrop`, overlay never under the floor (`wrbc_overlay_opacity()` / `OverlayOpacityControl`), defaults that pass.
30. Every parent block (and every child with its own colours) has `<ContrastAudit>`, silent on defaults in light and dark.
31. Translucent layers are passed to the helpers as exact composites, never as their rounded hex.
32. Nothing but hex or `var()` goes into a wrapper's style attribute (WordPress drops colour functions); `wrbc_css_vars()` converts.
33. One focus ring for everything (`.wrbc-root :focus-visible`); move it with `--wrbc-focus-offset`, draw it inside scrollers, never remove it.
34. A block's own `<button>` restates every state at (0,3,0) or more: themes style `[type=button]` and its `:hover`/`:focus` after the blocks.
35. Images the block sizes itself use at least (0,2,0): Hello's `.alignfull img { width: 100% }` is (0,1,1).
36. Item titles sit one level under the block's printed title; a level control appears only without one.
37. Lists are lists (`role="list"` when unstyled), data is a table with caption and header scopes, landmarks only with a heading.
38. No fake links: a button or link without a URL prints its label as text, and the editor says so.
39. New-tab links carry `wrbc_new_tab_note()`; generic link texts are described by the item's title.
40. Carousels follow one pattern: named region with roledescription, slides "n of m", play/pause named by what it does (no `aria-pressed`), arrows `aria-disabled` at the ends, focus brings a slide fully into view instantly.
41. Scrollers are a Tab stop (`role="group"` + name) only while they overflow and hold nothing focusable.
42. Anything that moves for more than 5 s has a visible pause button; loops stop by themselves; reduced motion stops motion, transitions and smooth scrolling.
43. Content is never hidden waiting for JavaScript: the reveal runs only under `html.wrbc-js` and shows on focus and in print.
44. Status messages live in regions that exist before their first text; focus never falls to `<body>` after an action.
45. Targets are at least 24 × 24 px; no text in fixed heights; `min-width: 0` on flex/grid children with text (320 px, text spacing).
46. Every block is checked with the harness in both contexts, at both widths, with the theme's CSS printed last, and in the editor — 0 failures, every review explained.

## How it was checked

18 block groups plus the shared modules, about 420 fixtures (every variation × style option, `align: wide/full`, empty and long content, colours at the extremes), each in a light and a dark context, at 1280 and 375 px, plus 320 px reflow, motion and reduced-motion runs, with and without Hello Elementor's CSS, and an editor pass per fixture. Every group ended at **0 failures**; the remaining reviews are by design (autoplay with a visible pause button, marquee rails clipped on purpose, two-tone rings the harness can't credit).

## Known limits and decisions

- Colours set in the native Color panel are only warned about, never changed.
- YouTube/Vimeo players, their captions and the focus inside them are the provider's; third-party form markup is the provider's (werun.Blocks.Community fixes the colours and widths it can around it).
- Fluid display sizes reach 200 % within the browser's zoom range (at 400 %), not at 200 % zoom.
- Contact Form 7 keeps Send disabled until its acceptance box is ticked.
- Gated downloads need JavaScript for soft gating; hard gating with a WordPress form plugin also works without it.
