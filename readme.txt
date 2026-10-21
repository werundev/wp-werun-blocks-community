=== werun.Blocks.Community ===
Contributors: werundev
Tags: blocks, accessibility, gdpr, jobs, query
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Accessible corporate blocks that fix their own contrast, wait for cookie consent, and pull jobs from your ATS and content from any post type.

== Description ==

werun.Blocks.Community is a set of blocks for company websites built around three things most block libraries leave to you: **accessibility that checks itself**, **privacy by default**, and **real data from the tools a company already uses**.

= What makes it different =

* **Contrast that fixes itself.** Each block knows the background it sits on (its own colour, an image with an overlay, or a dark section around it) and picks text, accent and focus colours that pass WCAG 2.2 AA there. When a choice still fails, the sidebar says so and offers a one-click fix. Every block, variation and option is tested on light and dark backgrounds.
* **Nothing loads before consent.** Maps, YouTube / Vimeo videos and third-party forms show a placeholder until the visitor clicks, or wait for your cookie banner (WP Consent API, Complianz, CookieYes, Cookiebot). Leaflet maps and all icons are bundled, so nothing comes from a CDN.
* **Jobs straight from your ATS.** The Jobs block lists open positions from Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio, Teamtailor or BambooHR, fetched and cached by your server, with filters and search.
* **A query builder for any post type.** Team, events, locations on a map, resource libraries, case studies: filter by terms and custom fields, order by upcoming dates, map fields to cards, add visitor filters and pagination that also work without JavaScript. Its settings are signed in the page and checked on every request, and it never shows drafts, private posts or protected fields.
* **Gated downloads you can trust.** Ask for a form before a file. With a WordPress form plugin the server verifies the submission before handing out a short-lived signed link, and can stream the file so its address is never revealed.
* **One form block for every provider.** HubSpot, Marketo, Salesforce Account Engagement, Dynamics 365, Typeform, Jotform, Mailchimp, ActiveCampaign, Zoho, Calendly, Gravity Forms, WPForms, Contact Form 7, Fluent Forms, Ninja Forms and Formidable. API keys are stored encrypted and never reach the browser.

= The blocks =

* **Structure and conversion:** Hero, Section, Call to action, Media and text.
* **Social proof:** Logos (grid, marquee, carousel), Testimonials (by hand or from a post type), Stats with count-up numbers.
* **Organization:** Feature grid, Tabs, Accordion / FAQ with schema, Table of contents.
* **Pricing:** Pricing table with a working monthly / yearly switch, Comparison table.
* **Dynamic:** Query, Jobs, Form.
* **More:** Timeline, Video (loaded only when played, with captions and transcript), Carousel, Notice (scheduled, dismissible).

Every block ships with ready-made variations, Lucide icons with optional animations, and **Saved styles**: save a block's look and options and reuse them anywhere on the site.

= Accessibility =

Besides contrast: focus is always visible, ARIA patterns are used for tabs, accordions, carousels and dialogs, and anything that moves for more than 5 seconds can be paused and respects "reduce motion".

= Privacy =

Consent is remembered per kind of embed for as long as you choose, and each block can override the site setting. The Integrations screen lists every outside host a visitor's browser may contact with your settings, ready for a Content-Security-Policy.

= Documentation and support =

* **Documentation:** every block, every setting and common problems, in English and Spanish: https://crm.werun.dev/knowledge-base/category/werun-blocks-community
* **Support:** please open an issue on GitHub: https://github.com/werundev/wp-werun-blocks-community/issues
* **Need something custom?** werun.dev builds custom blocks, variations for your brand, integrations and whole WordPress sites: https://werun.dev/contact?utm_source=werun-blocks-community&utm_medium=wporg&utm_campaign=custom-work

== External services ==

The plugin does not contact any service by default. Each service below is only used when a site administrator or editor configures the related block or setting.

* **OpenStreetMap tiles** (tile.openstreetmap.org) — map tiles for the Query block's map layout, loaded in the visitor's browser after consent. [Terms](https://wiki.osmfoundation.org/wiki/Terms_of_Use) · [Privacy](https://osmfoundation.org/wiki/Privacy_Policy)
* **Google Maps** (maps.googleapis.com) — only if you choose Google Maps and enter your API key; loaded after consent. [Terms](https://cloud.google.com/maps-platform/terms) · [Privacy](https://policies.google.com/privacy)
* **YouTube / Vimeo** — embedded videos in the Video, Hero and Media + text blocks, loaded after consent. [YouTube terms](https://www.youtube.com/t/terms) · [Google privacy](https://policies.google.com/privacy) · [Vimeo terms](https://vimeo.com/terms) · [Vimeo privacy](https://vimeo.com/privacy)
* **Form providers** — the Form block embeds the form of the provider you choose (HubSpot, Marketo, Salesforce Account Engagement / Pardot, Microsoft Dynamics 365, Typeform, Jotform, Mailchimp, ActiveCampaign, Zoho Forms, Calendly). The provider's script is loaded in the visitor's browser after consent and the visitor's answers are sent to that provider. The HubSpot token you enter is used server side to read your forms. See each provider's terms and privacy policy: [HubSpot](https://legal.hubspot.com/privacy-policy), [Adobe Marketo](https://www.adobe.com/privacy.html), [Salesforce](https://www.salesforce.com/company/privacy/), [Microsoft](https://privacy.microsoft.com/), [Typeform](https://www.typeform.com/help/a/privacy-policy-360054301192/), [Jotform](https://www.jotform.com/privacy/), [Mailchimp](https://www.intuit.com/privacy/statement/), [ActiveCampaign](https://www.activecampaign.com/legal/privacy-policy), [Zoho](https://www.zoho.com/privacy.html), [Calendly](https://calendly.com/legal/privacy-notice).
* **Applicant tracking systems** — the Jobs block reads your public job openings from the ATS you choose (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio, Teamtailor, BambooHR). Your site's server requests the job board you configured (and the API key for Teamtailor and BambooHR) on a schedule and caches the result; no visitor data is sent. See each provider's terms and privacy policy: [Greenhouse](https://www.greenhouse.com/privacy-policy), [Lever](https://www.lever.co/privacy-notice/), [Ashby](https://www.ashbyhq.com/privacy), [Workable](https://www.workable.com/privacy), [SmartRecruiters](https://www.smartrecruiters.com/legal/privacy-policy/), [Personio](https://www.personio.com/privacy-policy/), [Teamtailor](https://www.teamtailor.com/en/privacy-policy/), [BambooHR](https://www.bamboohr.com/legal/privacy-policy).

The plugin's admin screen links to the documentation (crm.werun.dev), GitHub issues and werun.dev; they are plain links and nothing is loaded from those sites. The icon picker links to lucide.dev and lucide-animated.com for reference; nothing is loaded from those sites. Leaflet and all Lucide icons are bundled with the plugin.

== Source code ==

The JavaScript and CSS in `build/` are compiled from the human-readable sources in `src/`, published at https://github.com/werundev/wp-werun-blocks-community. To build: `npm ci` and `npm run build`.

== Installation ==

1. Install from Plugins → Add New, or upload the zip and activate it.
2. Open the block inserter: the blocks are in the **werun.Blocks.Community** category.
3. Optional: configure maps, consent, form providers, jobs and gated downloads in **werun.Blocks.Community → Integrations**.

== Frequently Asked Questions ==

= Where do I get help? =

Read the documentation at https://crm.werun.dev/knowledge-base/category/werun-blocks-community, and report bugs or ask questions in the GitHub issues: https://github.com/werundev/wp-werun-blocks-community/issues

= Do I need a license or an account? =

No. The plugin is free and fully functional; it never asks for a key and never contacts werun.dev.

= Can it run next to werun.Blocks? =

Yes. Every block, class, option and endpoint has its own prefix, so both plugins can be active on the same site.

= How do I build it from source? =

Run `npm ci` and `npm run build`. The source is in `src/`; the release zip already contains the compiled `build/` folder.

== Changelog ==

= 1.0.0 =
* First public release.
