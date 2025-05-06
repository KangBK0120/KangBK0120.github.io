import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";

import expressiveCode from "astro-expressive-code";

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), icon(), expressiveCode(
    {
      themes: ['dracula'],
      styleOverrides: {
        codeFontFamily: 'IBM Plex Mono, monospace',
        codeFontSize: '0.875rem',
      }
    }
  ), sitemap()],
  markdown: {
    remarkPlugins: ['remark-gfm', 'remark-smartypants', 'remark-math'],
    rehypePlugins: ['rehype-katex'],
  },
  site: 'https://kangbk0120.github.io',
});