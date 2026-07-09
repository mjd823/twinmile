import type { MetadataRoute } from "next";

import { getAllPublicPosts } from "@/lib/blog-store";

// Blog entries include published pipeline posts from Mongo — refresh hourly
// so newly published articles get real lastmod without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://twinmile.com";
  const now = new Date();

  // getAllPublicPosts never throws (falls back to the 8 legacy posts).
  const blogPosts = await getAllPublicPosts();

  const industrySlugs = [
    "construction",
    "ecommerce",
    "manufacturing",
    "medical",
    "distribution",
  ];

  const serviceAreaSlugs = ["texas", "louisiana", "california", "nationwide"];

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/service-areas`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/service-areas/texas`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/service-areas/louisiana`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/service-areas/california`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/service-areas/nationwide`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/industries`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...industrySlugs.map((slug) => ({
      url: `${baseUrl}/industries/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.55,
    })),
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    {
      url: `${baseUrl}/get-a-quote`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/drive-with-us`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    ...serviceAreaSlugs.map((slug) => ({
      url: `${baseUrl}/service-areas/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
