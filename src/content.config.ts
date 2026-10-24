// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ブログ記事用コレクション（日付・カテゴリを持つ）
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // 更新日。日付1つ（従来どおり）でも、複数日のリストでも書ける。
    // どちらの場合も、古い順に並べた Date[] に揃えて扱う。
    // 配列を先に試すのは、z.coerce.date() が配列を日付に変換しようとするのを避けるため。
    dateRevised: z
      .union([z.array(z.coerce.date()), z.coerce.date()])
      .transform((value) =>
        [...(Array.isArray(value) ? value : [value])].sort(
          (a, b) => a.valueOf() - b.valueOf()
        )
      )
      .optional(),
    category: z.enum([
      'web-dev',
      'infra',
      'infra_tools',
      'infra_howto',
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