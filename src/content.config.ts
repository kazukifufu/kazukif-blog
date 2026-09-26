// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ブログ記事用コレクション（日付・カテゴリを持つ）
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    dateRevised: z.coerce.date().optional(),
    category: z.enum([
      'web-dev',
      'infra',
      'infra_tools',
      'iot',
      'python-dev',
      'weather-ml',
      'llm-ai',
      'pc-gadget',
      'tech',
      'life',
      'hobby',
    ]),
  }),
});

// 固定ページ用コレクション（Welcomeページなど、日付・カテゴリを持たない単発の文章）
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    updatedAt: z.coerce.date().optional(),
  }),
});

export const collections = { posts, pages };