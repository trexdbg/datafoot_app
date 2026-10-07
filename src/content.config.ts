import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    league: z.string(),
    player: z.string(),
    team: z.string(),
    source: z.string(),
    sourceUrl: z.string().url(),
    storyScore: z.number(),
  }),
});

export const collections = { articles };
