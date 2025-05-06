/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
			  sans: ['Noto Sans KR', 'sans-serif'],
			  serif: ['Pretendard', 'serif'],
			  code: ['IBM Plex Mono', 'monospace'],
			},
		  },
	},
	plugins: [],
}
