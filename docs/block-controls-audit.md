# Block controls audit (2026-10-16)

One agent per block went through every attribute, control and `supports`
option end to end: control → attribute → `render.php` markup → CSS → `view.js`,
plus the editor preview. Every case was rendered with `do_blocks()`; pricing was
also measured in headless Chrome. Fixed in werun.Blocks.Community 1.1.0.

## What was broken

| Block | Bug | Fix |
|---|---|---|
| Accordion | "An icon before each question" had no icon picker on the accordion: the picker only existed in each question's sidebar, and the question's `icon` had a hard-coded default, so "same icon for all" was impossible. | Parent `itemIcon` (default `circle-question-mark`) passed by context; the question's `icon` has **no default**: unset = inherit, `{ name: '' }` = no icon, "Use the accordion's icon" resets it. |
| Accordion | Icon type None + side Left still indented the answers; Boxed + Left lost the indent; Minimal ignored Gap (hard-coded 4px); hash links to a nested question didn't open the outer one. | `wrbc-accordion--icon-none`, restated combination rule, gap from `--wrbc-gap`, view.js opens every enclosing `<details>`. |
| Hero | px → vh kept 600 → `600vh`; replacing the image kept the old alt; the block icon size didn't reach button/eyebrow icons; font size didn't scale heading/text (rem); "Remove" icon came back after reload; empty `<h1>` and empty actions div. | Clamp on unit switch and in render; new image's alt; `--wrbc-icon-size: inherit` on buttons; `em`; Remove stores `{}`; only print parts with content. |
| Features | Card `transition` shorthand wiped the reveal fade and stagger; hover "border" did nothing on filled/shadow cards; highlight/hover ring replaced the drop shadow; inline layout + centred kept centring the icon column; "card link" with titles off differed between editor and page. | Full transition list on revealed cards, ring and shadow as separate custom properties, effective layout computed once in PHP and JS. |
| Pricing | "Featured plan taller" did nothing (`height:100%` in the row cancelled it); block link colour repainted every CTA (`.wp-elements-N a:where()` beats `.wrbc-btn`); prices ignored font size (rem); tablet columns 4 in the editor, 3 on the page; editor and PHP disagreed on "is the price a number"; period texts only editable inline. | Featured plan extends 18px above/below; button colours with `.wrbc-root` specificity (shared); `em`; same cap; one regex in both; Period fields in the sidebar. |
| Testimonials | Tablet columns 4 in the editor, 3 on the page; loop off + autoplay ticked forever on the last slide; focusing the play button paused the carousel; no Home/End, arrows not reversed in RTL; "slide" label not translated. | Same cap; autoplay stops at the end; play button exempt from focus-pause; keyboard; translated label. |
| Shared | `IconControl` "Remove" sent `undefined`, which brings back the block.json default; `.wrbc-header__title` in rem. | Remove stores `{}`; title in `em`. |

## Controls now hidden when they do nothing (examples)

- Testimonials: the whole Carousel panel (arrows, dots, loop, autoplay, interval, pause) only for carousel; controls position only when arrows, dots or autoplay exist; star colour only with stars; card background not for plain, border colour only for bordered; per-card rating/photo and "hide in this card" only when the parent shows that part.
- Hero: image side and text-column width only for split with an image; "image first on phones" only with an image; vertical alignment only when it can apply; image fit only with a fixed ratio; overlay colour only with a background image; icon size/stroke only when a visible part has an icon.
- Features: same height only with more than one column; icon position only with icons or badges; alignment only for the stacked layout; hover limited to none/lift on plain cards; icon background only with a circle/square holder; child icon/link/hide toggles only when the grid shows that part.
- Pricing: yearly price, labels and savings note only with the switch; currency position only with a currency; featured-taller only with more than one desktop column; badge text only for a featured plan when badges show; excluded-line icon only when excluded lines show; border colour only for bordered cards.
- Accordion: custom open/close icons only for Custom; side only when there is an icon; expand-all only when several can be open; search texts only with search; item background only for boxed; line/border colour not for minimal; gap not for Lines with one column.

## Rules (so it doesn't happen again)

1. **A parent toggle that unlocks something on the children needs a control on the parent** (a default for all), not a hint like "chosen on each item".
2. **An attribute that inherits from the parent has no default in block.json.** Otherwise "not set" and "set" can't be told apart. Store "none" as an explicit empty value (`{}` / `''`), never `undefined` (it brings the default back).
3. **Every control has a visibility condition that mirrors the code that uses it**: write the condition from render.php's own `if`. Ask for each control: which other settings make it do nothing?
4. **Editor and render.php share one rule**: the same clamps (columns, units), the same "effective value" logic (layout, card link, is-numeric), with a comment pointing to the twin. Ranges come from the same limits.
5. **No `rem` and no fixed line-height inside a block that offers typography supports**: use `em` and put defaults on the wrapper with zero specificity.
6. **Shared components must not reset a token the block exposes as a setting** (`--wrbc-icon-size` on `.wrbc-btn`), or read it as `var(--x, fallback)`.
7. **Two features on one CSS property override each other** (`transition`, `transform`, `box-shadow`): compose them through custom properties or full longhand lists.
8. **`supports.color.link` adds `.wp-elements-N a:where(…)` (0,1,1)**: components that are links (`.wrbc-btn`) need at least `.wrbc-root .x` (0,2,0).
9. **Clamp values that outlive a unit or mode switch**, on change and again in render.
10. **Test option combinations, not only each option** (loop × autoplay, style × icon side), and **measure layout features in a browser** (`height:100%` silently cancelled "featured taller").
11. **After editing `src/`, run `npm run build`**: WordPress loads `build/`, so nothing changes in the editor or on the page until then.
12. **Agents working in parallel never `git stash`** the shared tree, and never run the full build; scoped builds go to a scratch folder.

## 2.0 audit (2026-10-17): 15 new blocks, one agent per block group + security

What broke again, and the rules it added (13–22). Every one of these was
found in more than one block.

| Found | Rule |
|---|---|
| Variations left settings behind (strip → centred kept the eyebrow off; cards → carousel kept 1 slide in view; inline notice kept `align: full`). Transforms apply attributes only, never `innerBlocks`. | **13.** Every transform variation sets the same full set of keys the other variations change, and its `isActive` can't overlap another's. No `innerBlocks` in a transform variation. |
| An attribute named `style` (accordion look) collided with WordPress's own `style` (padding, colours): saving a padding scrambled it. | **14.** Never name a block attribute `style`, `className`, `align`, `anchor`, `lock`, `metadata`, `backgroundColor`, `textColor`, `gradient`, `fontSize`, `fontFamily`. |
| Saved styles switched off a notice's schedule, changed a video's source, a jobs board, the query variant, the testimonials field map. | **15.** "Where the content comes from" is content: source, provider, board, query, variant, schedule, field map, focal point → `"role": "content"`. |
| render.php printed editor values unclamped (gap −50, icon 999 px, 600vh). | **16.** Clamp every number in render.php to the editor's range (rule 4) — never trust the attribute. |
| Empty `<header>`, `<figure>`, `<ul>`, card bodies, sections with nothing in them; `aria-labelledby` pointing at a title that wasn't printed. | **17.** Print a wrapper only when it has content; set `aria-labelledby` only when the referenced element is printed. Strip tags before testing "is empty". |
| Shared module CSS (`assets/modules.css`) beat the blocks' own layout (tabs rows, hero video holder). | **18.** Shared CSS for modules is zero-specificity (`:where()`), so a block's own rules always win. |
| Controls shown that do nothing in the current mode (stars colour without a rating field, zoom hidden though used, radius hidden though it rounds images). | **19.** (Rule 3, again.) Derive each condition from render.php's code path, then check it in the editor with the opposite setting. |
| A rejected URL (`javascript:`) printed `href=""` / `src=""`. | **20.** A rejected URL means no link / no image, not an empty attribute. `wrbc_link_attrs()` falls back to `#`. |
| A child block's `Placeholder icon={ blockIcon(...) }` crashed the editor (React #31): `blockIcon()` returns `{ src }`. | **21.** `Placeholder` / `Icon` take the SVG: `blockIcon( name )?.src`. Check every parent block in the editor iframe (`.has-warning`), not only the outer document. |
| Hard-gated downloads could be unlocked with a soft ticket from another page; the download file was looked up from a different meta than the signed one. | **22.** A signed token is trusted only for its purpose and its own payload (file id, mode, form). Hard gates check a separate "verified" list. |

How it was checked: `do_blocks()` with wrong types, empty values and
malicious strings for every block; the real editor (toggling each driving
setting, every variation a → b → a, saved styles applied across blocks);
the front end at 1280 / 768 / 375 px with keyboard, reduced motion and no
JS; and a security pass that tried to exploit every REST route (signed
config tampering, ticket replay, SSRF via ATS slugs, XXE, secrets in the
page, path traversal in downloads).
