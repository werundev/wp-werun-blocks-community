# werun.Blocks.Community a11y harness

Automated WCAG 2.2 AA checks for werun.Blocks.Community fixtures: one WordPress page per
fixture × context (light page, dark background), each audited at every width
in headless Chromium. You write `fixtures/<group>.json`, run one command, read
`reports/<group>/summary.md`.

```
H=bin/a11y
node $H/audit.mjs --group cta                     # everything, light + dark, 1280 + 375 (+320 reflow)
node $H/audit.mjs --group cta --only cta-split --skip motion   # fast loop while fixing one variation
```

A fixture takes about 1–2 s per width; the two motion runs wait 6.5 s each but
run in parallel with everything else. A group of 4 fixtures × 2 contexts takes
~15 s with motion, ~8 s with `--skip motion`.

## What is installed (local site only)

- **mu-plugin** `wp-content/mu-plugins/wrbc-a11y-fixtures.php` (source: `fixtures-mu.php`; only active
  when the environment is `local` and the host is `werun-template.local`):
  - post types (public, `show_in_rest`): `team`, `event`, `location`, `resource`, `case_study`, `testimonial_cpt`;
  - taxonomies: `department` (team, case_study; hierarchical, `Frontend` under `Engineering`),
    `event_type` (event), `region` (location, case_study), `resource_type` (resource);
  - registered meta (`show_in_rest`): team `team_role`, `team_email`, `team_linkedin` ·
    event `event_start_date`, `event_end_date` (Ymd), `event_venue`, `event_price` ·
    location `location_lat`, `location_lng`, `location_latlng` ("lat,lng"), `location_address`, `location_phone`,
    `location_email`, `location_hours` · resource `_wrbc_download_id` (attachment, the gate's key), `resource_pages` ·
    case_study `case_client`, `case_metric`, `case_logo_id` · testimonial_cpt `testimonial_rating` (0–5),
    `testimonial_company`, `testimonial_role`;
  - an **offline ATS mock** (`pre_http_request`) for every provider: board **`acme`** = 8 jobs in Design /
    Engineering / Sales (locations, remote, types, salaries on Lever/Ashby), **`acme-empty`** = no jobs,
    **`acme-404`** = "board not found". Teamtailor answers only with the API key `wrbc-a11y-fixture`;
  - `?wrbc_a11y_theme=hello|hello-last` on fixture pages prints Hello Elementor's stock CSS (see `--theme-css`).
  - a **stand-in Contact Form 7** (only while the real plugin is not active), see below.
- **Seeded content** (`seed.php`, idempotent, re-run any time: event dates move with today):
  8 items per post type with terms and meta, 4 posts in categories *Product updates* / *Guides*,
  46 files in `uploads/wrbc-a11y/`. Events: 5 upcoming (+7 … +60 days), 1 ongoing (−1 … +1), 2 past.
  Two items per type have no image (cards without media), two resources have no file.
- Everything created carries `_wrbc_a11y_fixture = 1` (post meta / term meta).

```
cd /Volumes/ExtHDD/DevStuff/LocalWP/werun-template/app/public
wp eval-file $H/seed.php            # (re)seed; "images" as extra word regenerates the files
$H/cleanup.sh --dry                 # count what cleanup would delete
$H/cleanup.sh                       # delete fixtures + every "WRB A11Y …" page; --all also removes the mu-plugin
```
Don't run cleanup during the audit: the other agents use the same content.

## Stand-in Contact Form 7 (form block: contact variation, hard gating)

No form plugin is installed, so the mu-plugin imitates what werun.Blocks.Community relies on
(`includes/forms/providers/class-cf7.php`, `includes/forms/class-forms.php`, `includes/gate/class-hard.php`):
`WPCF7_ContactForm` (`find()`, `get_instance()`, `id()`, `title()`…), `wpcf7_contact_form()`, `WPCF7_Submission`,
the `wpcf7_contact_form` post type, and the `[contact-form-7 id="…"]` shortcode printing CF7 6.x markup:
labels around the fields, `.wpcf7-form-control` name / email (`autocomplete`, `aria-required`) / message /
acceptance checkbox, the hidden fields with the `wpcf7_form_hidden_fields` filter (the gate ticket goes there),
the screen-reader response, `.wpcf7-response-output`, `.wpcf7-not-valid-tip` errors with `aria-invalid` +
`aria-describedby`, and CF7's stock CSS (tips `#dc3232`, response borders, spinner).

- **Submitting works.** With JS, a copy of CF7's front-end script posts to `POST /wp-json/contact-form-7/v1/contact-forms/{id}/feedback`
  (CF7's JSON: `status`, `message`, `invalid_fields[{field,message,error_id}]`, `into`, `posted_data_hash`), sets the status
  classes, tips and messages, and fires `wpcf7mailsent` / `wpcf7invalid` / `wpcf7submit` on the form. As in CF7, the
  submit button stays **disabled until the acceptance box is ticked**. Without JS, the form posts to the page; the
  result is printed in the form (and a gated form comes back with its download link). Both paths fire
  `wpcf7_before_send_mail` and `wpcf7_mail_sent` (no mail leaves the site), so `Hard::mark()` sees the ticket,
  `wrbc-gate` unlocks and returning visitors get the link.
- **Forms** (seeded, use `{{post:KEY}}` as `formId`): `cf7-contact` "Contact form", `cf7-download` "Download request",
  `cf7-invalid` (always printed in its error state: name missing, bad email, response output — for static audits),
  `cf7-failing` (submissions answer `mail_failed`).
- **Fixtures**: `form.json` → `form-wp-contact`, `form-wp-gated` (resource `resource-1`, PDF), `form-wp-error`.
- `node $H/cf7-flow.mjs` submits them the four ways (valid, invalid, gated with JS, gated without JS) and prints
  what happened (REST answers, events, tips, the unlocked link and the file).

Limits: the fields are fixed (CF7's default template), CF7 options (`acceptance_as_validation`, quiz, file fields,
reCAPTCHA) aren't there, and nothing is mailed.

## Commands

```
node $H/audit.mjs --group <name>
  [--only id,id]                fixtures to run (others keep their last results in the report)
  [--contexts light,dark]       default both
  [--widths 1280,375]           default 1280,375 (a fixture may narrow it with "widths"; this flag wins)
  [--skip a,b]                  checks to skip: axe, target, nontext, pseudo, spacing, focus, reflow, motion
  [--screenshots]               full-page PNGs in reports/<group>/shots/
  [--editor]                    also open each page in the block editor (≈10 s per page)
  [--theme-css hello|hello-last]  inject Hello Elementor's stock CSS first / last (report in reports/<group>--<mode>/)
  [--concurrency 4]             pages in parallel (keep ≤ 4: other agents run too)
  [--motion-wait 6500]          ms after navigation for the 2.2.2 check
  [--fresh]                     drop earlier results of the group instead of merging
  [--list]                      only create/update the pages and print their URLs
```

The exit code is 0 even with issues (2 = usage/setup error). The console prints
one line per fixture: `FAIL n · review n · bp n  seconds  [failures by check]`.

Typical loop: edit `src/<slug>/…` → `$A11Y/bin/build-block.sh <slug>` →
`node $H/audit.mjs --group <slug> --only <id> --skip motion` → read the summary →
at the end run the whole group, then `--editor`, then `--theme-css hello-last`.

## Fixtures: `fixtures/<group>.json`

```json
[
	{
		"id": "cta-centered",
		"title": "CTA: centred banner (defaults)",
		"markup": "<!-- wp:werun-community/cta /-->"
	},
	{
		"id": "cta-split",
		"title": "CTA: split with image",
		"markup": "<!-- wp:werun-community/cta {\"layout\":\"split\",\"showMedia\":true,\"mediaId\":{{img:illustration}},\"mediaUrl\":\"{{url:illustration}}\",\"mediaAlt\":\"A dashboard\"} /-->"
	},
	{
		"id": "carousel-dots",
		"title": "Testimonials carousel, autoplay",
		"contexts": [ "light" ],
		"widths": [ 1280 ],
		"markup": "<!-- wp:werun-community/testimonials {\"autoplay\":true} -->\n<!-- wp:werun-community/testimonial {\"quote\":\"…\",\"name\":\"Ana\"} /-->\n<!-- wp:werun-community/testimonial {\"quote\":\"…\",\"name\":\"Bruno\"} /-->\n<!-- /wp:werun-community/testimonials -->",
		"nonText": [
			{ "selector": ".wrbc-carousel__dot[aria-current]", "property": "background-color", "min": 3, "label": "current dot" },
			{ "selector": ".wrbc-timeline__marker", "pseudo": "::before", "property": "border-color", "min": 3 }
		]
	}
]
```

| Field | |
|---|---|
| `id` | letters, digits, `-` `_`; unique in the file; used in page titles and file names |
| `title` | what the variation is (shown in the report) |
| `markup` | serialized block markup, as the editor saves it. Any blocks (core ones too). Parents with inner blocks: open and close comments with the children in between |
| `contexts` | optional, `["light"]`, `["dark"]` or both (default) |
| `widths` | optional, e.g. `[1280]` for a fixture where 375 adds nothing (`--widths` overrides) |
| `nonText` | optional 1.4.11 rules, see below |
| `expect` / `expectNot` | optional lists of `check:rule` the fixture must / must not trigger (harness self-test; the console prints `expect ✓` or `EXPECT ✗ missing … unexpected …`) |

**Tokens** (resolved on the server from the seeded content, so fixtures survive a re-seed):
`{{img:KEY}}` attachment id · `{{url:KEY}}` attachment URL · `{{post:KEY}}` post id ·
`{{term:taxonomy/Name or slug}}` term id · `{{home}}` home URL. Media and posts usually need both id and
URL in the attributes, as the editor stores them (the editor preview reads the URL, `render.php` the id).

- Images: `person-1` … `person-8` (portraits, alt = the name), `logo-1` … `logo-6` (Northwind, Contoso,
  Fabrikam, Tailspin, Lumen Labs, Acme Co; transparent PNG with the name, alt = the name), `poster-2`…`poster-6`, `poster-8`
  (event posters), `case-img-1` … `case-img-6` (16:9 project images), `cover-1` … `cover-6` (resource covers),
  `bg-light` (white→pale sky: worst case for white text), `bg-dark`, `bg-busy` (black/white stripes),
  `illustration` (4:3), `illustration-square` (1:1, alt "A dashboard with a bar chart").
- Other files: `video` (6 s mp4 test pattern), `video-poster`, `captions` (.vtt), `doc-1` … `doc-6` (PDFs).
- Posts: `team-1…8`, `event-1…8`, `location-1…8`, `resource-1…8`, `case-1…8`, `testimonial-1…8`, `post-1…4`.
- Terms: department Leadership / Engineering / Frontend / Design / Sales · event_type Webinar / Conference / Workshop ·
  region Americas / Europe / Asia-Pacific · resource_type Whitepaper / Guide / Checklist · category Product updates / Guides.

Query / testimonials / jobs examples:
```
<!-- wp:werun-community/query {"variant":"team","query":{"postType":"team","orderBy":"menu_order","order":"ASC","perPage":8},"layout":"grid","card":{"style":"plain","link":"none","imageRatio":"1/1","fields":[{"type":"image"},{"type":"title","level":3},{"type":"meta","key":"team_role","format":"text"}]}} /-->
<!-- wp:werun-community/query {"variant":"events","query":{"postType":"event","orderBy":"upcoming","upcoming":{"startKey":"event_start_date","endKey":"event_end_date","format":"Ymd","when":"upcoming"}}} /-->
<!-- wp:werun-community/testimonials {"source":"query","query":{"postType":"testimonial_cpt"},"map":{"quote":"excerpt","name":"title","role":"meta:testimonial_role","rating":"meta:testimonial_rating"}} /-->
<!-- wp:werun-community/jobs {"provider":"greenhouse","board":"acme","showFilters":true} /-->
```

Writing markup: escape quotes as `\"` inside the JSON string; never put `--` inside an attribute
value (block comments can't hold it: use `--`); check a render with
`wp eval 'echo do_blocks( "<!-- wp:werun-community/cta /-->" );'`. `node audit.mjs --group x --list` creates the pages
and prints their URLs; the bridge warns when a token is unknown or markup sits outside any block.

**Contexts.** `light` = the markup on the page as is. `dark` = the markup inside
`<!-- wp:group {"align":"full","style":{"color":{"background":"#0f172a","text":"#f8fafc"}},"layout":{"type":"constrained"}} -->`.
Pages: `WRB A11Y <group> <id> [<context>]`, published, `_wrbc_a11y_fixture = 1`, updated in place.

**The page.** This site prints no theme CSS and no header/footer: body text is #000 Times 16 px on white,
links are browser blue. `--theme-css hello` adds Hello Elementor's `reset.css`, `theme.css`,
`header-footer.css` at the start of `<head>` (block styles after them); `--theme-css hello-last` prints them
at the end of `<body>`, after every block style (a stock Hello site: buttons `[type=button]` and their
`:hover`/`:focus` turn pink, links #c36, `.alignwide` gets −80 px margins). The blocks must pass both ways.
Known Hello behaviour to keep in mind: its `theme.css` has `.alignfull { width: 100vw; margin-inline: calc(50% - 50vw);
overflow-x: hidden }` and `.alignfull img { width: 100% }`, so blocks set to `align: full` are clipped sideways
and their images stretched under `--theme-css hello-last` (write fixtures with `align: full` to see it).

**nonText rules** (1.4.11, for graphics axe can't see: dots, markers, stars, toggles, icons that carry
meaning): `selector` (inside werun blocks; up to 12 matches), `pseudo` (`::before`/`::after`, optional),
`property` (`background-color`, `border-color`, `border-top-color`, `color`, `fill`, `stroke`,
`outline-color`…), `min` (default 3), `label`, `against` (optional: `parent` = what is painted under the
element, the default; a colour like `#ffffff`; or `self:<property>` = another property of the same
element, e.g. icon `fill` against `self:background-color`). Over an image the result is a review with
worst/best numbers.

## The checks

Levels: **FAIL** = a failure the check is sure about · **review** = needs a human look (worst case over an
image, partial, heuristics) · **bp** = axe best practice, not WCAG · **info** = context (only in results.json,
except motion and scrollers). Every issue has `check`, `rule`, `sc`, `selector`, `snippet`, `message`.

| check · rule | SC | What it does |
|---|---|---|
| `axe` · axe rule id | per rule | axe-core 4.14 with tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` on the whole page; only nodes inside `[class*="wp-block-werun-community-"], .wrbc-root` are kept. `color-contrast` lines show fg, bg, ratio and the needed ratio |
| `axe-review` · `color-contrast` | 1.4.3 | axe's "incomplete" (it couldn't tell the background: images, gradients, overlapping layers). The harness walks the paint stack under the text (`elementsFromPoint`, translucent layers composited, opacity included). Solid result → resolved (pass = info, fail = **FAIL**). Image / video under it → worst case with a white and a black pixel under the overlays: worst ≥ need → info, best < need → **FAIL**, otherwise **review** with both numbers. Other incomplete axe rules → review |
| `bp` | – | axe `best-practice` tag (heading-order, landmarks, …), reported apart |
| `focus` · `focus-visible` | 2.4.7 | Tab walk through the page (≤ 150 presses; only stops inside werun blocks are reported, with role and accessible name from Chrome's accessibility tree). For each stop: screenshot of the box + 6 px, focused vs blurred (transitions/animations and the caret off). Nothing changed → FAIL. If nothing changed around a small element the walk retries on its card/item (rings drawn by a card or `::after`) |
| `focus` · `focus-contrast` | 1.4.11 | Outline (or box-shadow ring) colour, with the element's opacity, vs what is painted around it at the ring's position: < 3:1 and no other ≥3:1 change → FAIL; < 3:1 but another part of the focus style changes by ≥3:1 over about one perimeter (e.g. the outline button's border turning to the text colour) → review. No outline and the pixel change is mostly < 3:1 (a background tint) → FAIL. On an inactive control (`aria-disabled="true"`/`disabled`) these are reviews: 1.4.11 exempts its contrast, 2.4.7 still wants a visible focus |
| `focus` · `focus-clipped` | 2.4.7 | The style has a good outline but almost no pixel changed: clipped by an `overflow:hidden` ancestor or covered |
| `focus` · others | 2.1.2 / 2.4.3 / 4.1.2 | `keyboard-trap` (Tab stays on the same element), `positive-tabindex`, `focus-no-name` |
| `obscured` | 2.4.11 / 2.4.12 | After Tab, a 5 × 5 grid over the element; at each point that lies on the element's own shape (rounded corners don't count) the paint stack is read (`elementsFromPoint`, `pointer-events` ignored) and a layer above it that paints something (background, image, text) covers it. All points covered (sticky/fixed bars, overlays) or the element outside the viewport → FAIL; some → review (2.4.12, AAA) |
| `target` | 2.5.8 | Interactive elements inside werun blocks smaller than 24 × 24: FAIL unless the spacing exception holds (24 px circles on each undersized target don't touch other targets or circles; those are info). Inline links inside a sentence are excluded |
| `nontext` · `control-boundary` | 1.4.11 | Every input/select/textarea in werun blocks: border colour (each side) or fill vs the background around it ≥ 3:1. Native checkboxes/radios are left to the browser unless `appearance: none` |
| `nontext` · `placeholder-contrast` | 1.4.3 | `::placeholder` colour on the field ≥ 4.5:1 |
| `nontext` · `fixture-rule` | 1.4.11 | Your `nonText` rules |
| `pseudo` · `pseudo-text-contrast` | 1.4.3 | Text drawn by `::before`/`::after` (`content` with a string, `counter()`, `attr()`) and numbered `::marker`s: their colour on their own background over the element's background, 4.5:1 (3:1 large). axe never sees this text |
| `spacing` | 1.4.12 | Injects `line-height:1.5; letter-spacing:.12em; word-spacing:.16em; p{margin-bottom:2em}` and lists elements whose text becomes clipped (`overflow` hidden/clip, line clamps, ellipsis) or more clipped than before |
| `reflow` (run "reflow 320") | 1.4.10 / 2.1.1 | Fresh load at 320 px: werun elements past the right edge (outermost only); content or text cut by an `overflow: hidden/clip` box (review; the box is its padding box plus `overflow-clip-margin` when it clips with `clip`, so a track's padding painted on purpose isn't reported); horizontal scrollers (info) and **FAIL** when a scroller is neither focusable nor holds anything focusable |
| `motion` (run "motion") | 2.2.2 | Normal motion, viewport as tall as the page (carousels pause off screen). Animations inside werun blocks are judged by their own timing (`getComputedTiming()`): reported only when infinite or when iterations × duration + delay > 5 s, whenever they started (looked at ~1 s, mid-way and at the end). Carousel tracks (`[data-wrbc-track]`) are watched for 6.5 s from the moment each was first on screen (up to 8 s more on a slow machine) and reported when `scrollLeft` moved ≥ 16 px (or 10 % of the track) by itself; the carousel is the track's closest `[data-wrbc-carousel]` (else `.wrbc-carousel`) and its pause/play button is looked for inside that root. Also playing videos and autoplay carousels without a visible pause button. With a visible pause control → review/info, else FAIL |
| `motion` (run "reduced motion") | 2.3.3 | `prefers-reduced-motion: reduce`: any running animation/transition, auto-advance or playing video inside werun blocks → FAIL |
| `headings` | 1.3.1 | A heading inside a werun block that skips a level after the previous heading on the page (review). The full outline is in the report |
| `editor` (run "editor", `--editor`) | – | Opens `post.php?post=ID&action=edit` with WP-CLI auth cookies: block validation failures (`block-invalid`, with the expected vs saved HTML), `.block-editor-warning`s (`block-warning`), console errors (review), and the text of the `.wrbc-contrast-audit` notice after selecting each werun block (`contrast-audit`, review; none = the block passes or has no ContrastAudit) |
| `error` | – | HTTP status ≠ 200, PHP warnings printed in the page, no werun block rendered, site CSS/JS that failed to load even after one automatic reload (`resources`: results unreliable, run again), page JS errors (review, identical lines merged), harness errors. The editor run also retries once when the editor doesn't start |

PHP warnings/notices written to `debug.log` during the run are listed at the end of the summary (other
agents write there too; the theme's `hello-elementor-child-style` notice is filtered out).

## Reading the report

`reports/<group>/summary.md`: a table per fixture × context × run (`1280`, `375`, `reflow 320`, `motion`,
`reduced motion`, `editor`) with **failures**+reviews per check, then per fixture → context → run the issues
(FAIL first) with selector, snippet, colours and ratios, the Tab order (role, name, selector, indicator, ring
contrast, pixel change) and the heading outline. `results.json` has everything, including info items, the
raw pseudo-text and control measurements, motion snapshots and editor data. `aria/<id>--<context>--<width>.yml`
is the ARIA snapshot of each werun block root; `shots/` the full-page screenshots (`--screenshots`).
`--only` runs merge into the existing report (each fixture keeps its latest run); `--fresh` starts over.

Tab order lines read like `3. link "Apply for Product Designer" … — ok · outline #7972eb 4.61:1 vs #0f172a ·
Δ3566px, ≥3:1 400px (1.6× perimeter)`: Δ = pixels that changed, ≥3:1 = pixels whose focused and plain colours
differ by 3:1 or more; about 1× the perimeter is a 1 px ring, 2× a 2 px ring. Indicators: `ok`, `none`,
`low` (FAIL), `low-outline` (review), `not-painted`, `obscured`, `offscreen`.

**"needs review" over images**: the harness can't know the pixels of an image or video, so it computes the
worst case (a white and a black pixel under every overlay). `worst 1.00:1 against #ffffff, best 21:1` means
white text straight on a photo: it depends on the photo, so the block has to guarantee contrast (overlay,
text shadow plate, minimum overlay opacity). If the worst case passes the item is resolved (info).

## Known limits and false positives

- **Focus rings far from the element** (e.g. a ring on a card drawn by `:focus-within` while the focused link
  is the title) are found by the card/item retry only when the card is an `article`, `li`, `label`,
  `figure`, `[class*="__card"]`, `[class*="__item"]` or `[class*="__option"]` ancestor; otherwise "no visible
  focus change" may be a false positive — check the screenshot.
- **Hidden native controls** (opacity 0 / sr-only radios and checkboxes) are measured on their label
  (`label[for]`, wrapping label), else the next/previous sibling, else the parent: the stop shows
  "focus shown on …".
- **Outline contrast** is measured at the four sides, mid-way along each; a ring crossing a neighbour (two
  dots 2 px apart) is measured against that neighbour: correct, but read it as a spacing issue.
- **Chrome makes scrollers without focusable content focusable** (keyboard-focusable scrollers), so the Tab
  walk may stop on them while axe still reports `scrollable-region-focusable`: fix it anyway (other browsers).
- **Pseudo-element text**: for in-flow `::before`/`::after` the position is estimated (start / end of the
  element) and marked "approximated"; absolutely positioned ones use their offsets. Decorative glyphs (quote
  marks, icon fonts) are reported too: exempt them by making them decorative (`content: "”" / ""`) and say so.
- **Text spacing** catches clipping, not overlapping text (`overflow: visible` boxes of fixed height): look
  at a screenshot when a box has a fixed height.
- **Motion**: JS animations that are not Web Animations (requestAnimationFrame counters) are only seen
  through scroll changes; an autoplay interval > 6.5 s is caught by the markup check (autoplay without a
  visible pause button) rather than by movement. The delay counts in an animation's length (a 1 s animation
  delayed 4.5 s is reported), as agreed.
- **Target size**: an inline link counts as "in a sentence" when its block container holds other text.
- **Text contrast of a whole element** uses its first text run; mixed colours inside one element are axe's job.
- **Carousels / scrollers**: before a colour is measured (non-text rules, form controls, pseudo-element text, the
  over-image probe) the element is brought into view inside its scrollers (its slide moved to the scroller's start,
  a snap position) and the scrollers are put back afterwards; what still can't be shown is skipped. Targets in
  slides scrolled out of their track are left out of 2.5.8 (the visible slides have the same markup).
- The browser is the cached Chrome headless shell (1243) picked automatically (Playwright 1.64 wants 1248,
  which isn't installed). Never download browsers; `WRB_CHROMIUM=/path` overrides.
- Self-test: `node $H/audit.mjs --group harness-selftest` (plus `--editor` for `st-invalid`) must print
  `expect ✓` on every line; its pages contain deliberate failures. `harness-validate` holds the harness's own
  hero/CTA/query/jobs checks (don't edit `hero.json` / `cta.json` for harness tests: the block agents own them).

## Files

| File | |
|---|---|
| `audit.mjs` | CLI: sync pages, run the checks, write the reports |
| `lib/page.js` | in-page library (`window.__wrbcA11y`): colours, paint stack, target size, reflow, spacing, motion, focus probes |
| `lib/checks.mjs` | the checks (Playwright side) and their verdicts |
| `lib/report.mjs`, `lib/pixels.mjs`, `lib/env.mjs` | summary/results writer, PNG diff, paths + browser |
| `bridge.php` | WP side (`wp eval-file`): creates/updates the pages, resolves tokens, auth cookies |
| `fixtures-mu.php` → mu-plugin, `seed.php`, `cleanup.php`, `cleanup.sh` | fixture content |
| `fixtures/*.json` | one file per block group (owned by its agent), `harness-selftest`, `harness-validate` |
