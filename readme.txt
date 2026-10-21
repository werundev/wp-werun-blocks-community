=== werun.Blocks.Community ===
Contributors: werundev
Tags: blocks, gutenberg, hero, pricing, faq
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Corporate blocks for the block editor: hero, sections, CTAs, pricing, FAQ, testimonials, tabs, carousels, a query builder, jobs and forms.

== Description ==

werun.Blocks.Community adds a catalog of accessible, customizable blocks for corporate sites, with Lucide icons and Lucide Animated style animations.

* **Structure and conversion:** Hero, Section, CTA, Media + text.
* **Social proof:** Logos (grid, marquee, carousel), Testimonials, Stats with counters.
* **Organization:** Feature grid, Tabs, Accordion / FAQ with schema, Table of contents.
* **Dynamic:** Query — a visual query builder for any public post type, with taxonomy and meta filters, cards, grid, list, carousel or map, and visitor filters, search and pagination (also without JavaScript). Jobs from your ATS. Forms from the usual providers and WordPress form plugins.
* **More:** Pricing, Comparison table, Timeline, Video, Carousel, Notice.

Every block ships with ready-made variations and **Saved styles**: save a block's styles and options and reuse them anywhere on the site.

= Accessibility =

Every block, variation and option targets WCAG 2.2 AA on light and dark backgrounds: colours adapt to the background a block sits on, the editor warns about low contrast and offers a one-click fix, focus is always visible, ARIA patterns are used for tabs, accordions, carousels and dialogs, and anything that moves for more than 5 seconds can be paused and respects "reduce motion".

= Privacy =

Maps, YouTube / Vimeo videos and third-party forms load nothing before consent. Consent can be given per click or taken from your cookie banner (WP Consent API, Complianz, CookieYes, Cookiebot). API keys are stored encrypted and never reach the browser.

== External services ==

The plugin does not contact any service by default. Each service below is only used when a site administrator or editor configures the related block or setting.

* **OpenStreetMap tiles** (tile.openstreetmap.org) — map tiles for the Query block's map layout, loaded in the visitor's browser after consent. [Terms](https://wiki.osmfoundation.org/wiki/Terms_of_Use) · [Privacy](https://osmfoundation.org/wiki/Privacy_Policy)
* **Google Maps** (maps.googleapis.com) — only if you choose Google Maps and enter your API key; loaded after consent. [Terms](https://cloud.google.com/maps-platform/terms) · [Privacy](https://policies.google.com/privacy)
* **YouTube / Vimeo** — embedded videos in the Video, Hero and Media + text blocks, loaded after consent. [YouTube terms](https://www.youtube.com/t/terms) · [Google privacy](https://policies.google.com/privacy) · [Vimeo terms](https://vimeo.com/terms) · [Vimeo privacy](https://vimeo.com/privacy)
* **Form providers** — the Form block embeds the form of the provider you choose (HubSpot, Marketo, Salesforce Account Engagement / Pardot, Microsoft Dynamics 365, Typeform, Jotform, Mailchimp, ActiveCampaign, Zoho Forms, Calendly). The provider's script is loaded in the visitor's browser after consent and the visitor's answers are sent to that provider. The HubSpot token you enter is used server side to read your forms. See each provider's terms and privacy policy: [HubSpot](https://legal.hubspot.com/privacy-policy), [Adobe Marketo](https://www.adobe.com/privacy.html), [Salesforce](https://www.salesforce.com/company/privacy/), [Microsoft](https://privacy.microsoft.com/), [Typeform](https://www.typeform.com/help/a/privacy-policy-360054301192/), [Jotform](https://www.jotform.com/privacy/), [Mailchimp](https://www.intuit.com/privacy/statement/), [ActiveCampaign](https://www.activecampaign.com/legal/privacy-policy), [Zoho](https://www.zoho.com/privacy.html), [Calendly](https://calendly.com/legal/privacy-notice).
* **Applicant tracking systems** — the Jobs block reads your public job openings from the ATS you choose (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio, Teamtailor, BambooHR). Your site's server requests the job board you configured (and the API key for Teamtailor and BambooHR) on a schedule and caches the result; no visitor data is sent. See each provider's terms and privacy policy: [Greenhouse](https://www.greenhouse.com/privacy-policy), [Lever](https://www.lever.co/privacy-notice/), [Ashby](https://www.ashbyhq.com/privacy), [Workable](https://www.workable.com/privacy), [SmartRecruiters](https://www.smartrecruiters.com/legal/privacy-policy/), [Personio](https://www.personio.com/privacy-policy/), [Teamtailor](https://www.teamtailor.com/en/privacy-policy/), [BambooHR](https://www.bamboohr.com/legal/privacy-policy).

The icon picker links to lucide.dev and lucide-animated.com for reference; nothing is loaded from those sites. Leaflet and all Lucide icons are bundled with the plugin.

== Source code ==

The JavaScript and CSS in `build/` are compiled from the human-readable sources in `src/`, published at https://github.com/werundev/wp-werun-blocks-community. To build: `npm ci` and `npm run build`.

== Installation ==

1. Install from Plugins → Add New, or upload the zip and activate it.
2. Open the block inserter: the blocks are in the **werun.Blocks.Community** category.
3. Optional: configure maps, consent, form providers, jobs and gated downloads in **werun.Blocks.Community → Integrations**.

== Frequently Asked Questions ==

= Do I need a license or an account? =

No. The plugin is free and fully functional; it never asks for a key and never contacts werun.dev.

= Can it run next to werun.Blocks? =

Yes. Every block, class, option and endpoint has its own prefix, so both plugins can be active on the same site.

= How do I build it from source? =

Run `npm ci` and `npm run build`. The source is in `src/`; the release zip already contains the compiled `build/` folder.

== Changelog ==

= 1.0.0 =
* First public release.
