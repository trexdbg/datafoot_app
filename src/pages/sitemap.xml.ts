import { getCollection } from 'astro:content';

export async function GET() {
  const origin = 'https://trexdbg.github.io';
  const base = '/datafoot_app';
  const staticUrls = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/articles/', priority: '0.9', changefreq: 'daily' },
    { path: '/stats/', priority: '0.8', changefreq: 'daily' },
    { path: '/methodologie/', priority: '0.6', changefreq: 'monthly' },
  ];
  const articles = await getCollection('articles');
  const urls = [
    ...staticUrls.map((item) => ({ loc: `${origin}${base}${item.path}`, lastmod: null, ...item })),
    ...articles.map((article) => ({
      loc: `${origin}${base}/articles/${article.id}/`,
      lastmod: article.data.publishedAt.toISOString(),
      priority: '0.8',
      changefreq: 'weekly',
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((item) => `  <url>\n    <loc>${item.loc}</loc>${item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : ''}\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
