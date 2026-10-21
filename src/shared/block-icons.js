/**
 * The blocks' own icons in the inserter, the toolbar and the block card:
 * Lucide icons, the same library the blocks offer for their content. The
 * shapes are copied from lucide-static (ISC, see LICENSE-lucide.txt).
 */
import { SVG } from '@wordpress/primitives';

const SHAPES = {
	'hero': ( // layout-panel-top
		<><rect width="18" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /></>
	),
	'features': ( // layout-grid
		<><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></>
	),
	'feature': ( // sparkles
		<><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" /></>
	),
	'pricing': ( // badge-dollar-sign
		<><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></>
	),
	'pricing-plan': ( // tag
		<><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>
	),
	'accordion': ( // list-collapse
		<><path d="M10 5h11" /><path d="M10 12h11" /><path d="M10 19h11" /><path d="m3 10 3-3-3-3" /><path d="m3 20 3-3-3-3" /></>
	),
	'accordion-item': ( // message-circle-question-mark
		<><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>
	),
	'testimonials': ( // messages-square
		<><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" /></>
	),
	'testimonial': ( // quote
		<><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /></>
	),
	'section': ( // square-dashed
		<><path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /></>
	),
	'cta': ( // megaphone
		<><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" /><path d="M8 6v8" /></>
	),
	'media-text': ( // panels-left-bottom
		<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M9 15h12" /></>
	),
	'logos': ( // gallery-horizontal
		<><path d="M2 3v18" /><rect width="12" height="18" x="6" y="3" rx="2" /><path d="M22 3v18" /></>
	),
	'stats': ( // chart-no-axes-column
		<><path d="M5 21v-6" /><path d="M12 21V3" /><path d="M19 21V9" /></>
	),
	'stat': ( // hash
		<><line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" /></>
	),
	'tabs': ( // panel-top
		<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /></>
	),
	'tab': ( // rectangle-horizontal
		<><rect width="20" height="12" x="2" y="6" rx="2" /></>
	),
	'toc': ( // list-tree
		<><path d="M8 5h13" /><path d="M13 12h8" /><path d="M13 19h8" /><path d="M3 10a2 2 0 0 0 2 2h3" /><path d="M3 5v12a2 2 0 0 0 2 2h3" /></>
	),
	'query': ( // layout-list
		<><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><path d="M14 4h7" /><path d="M14 9h7" /><path d="M14 15h7" /><path d="M14 20h7" /></>
	),
	'jobs': ( // briefcase
		<><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></>
	),
	'form': ( // clipboard-pen
		<><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M21.34 15.664a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" /><path d="M8 22H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>
	),
	'comparison': ( // table
		<><path d="M12 3v18" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /></>
	),
	'timeline': ( // milestone
		<><path d="M12 13v8" /><path d="M12 3v3" /><path d="M18.172 6a2 2 0 0 1 1.414.586l2.06 2.06a1.207 1.207 0 0 1 0 1.708l-2.06 2.06a2 2 0 0 1-1.414.586H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" /></>
	),
	'timeline-item': ( // circle-dot
		<><circle cx="12" cy="12" r="1" /><circle cx="12" cy="12" r="10" /></>
	),
	'video': ( // circle-play
		<><path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" /><circle cx="12" cy="12" r="10" /></>
	),
	'carousel': ( // gallery-horizontal-end
		<><path d="M2 7v10" /><path d="M6 5v14" /><rect width="12" height="18" x="10" y="3" rx="2" /></>
	),
	'slide': ( // square
		<><rect width="18" height="18" x="3" y="3" rx="2" /></>
	),
	'notice': ( // info
		<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>
	),
};

/**
 * The icon setting of a block, from its block.json name ("werun-community/hero").
 *
 * @param {string} name Block name.
 */
export function blockIcon( name ) {
	const shapes = SHAPES[ name.replace( /^werun\//, '' ) ];
	if ( ! shapes ) {
		return undefined;
	}
	return {
		src: (
			<SVG
				className="wrbc-block-icon"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width="24"
				height="24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{ shapes }
			</SVG>
		),
	};
}
