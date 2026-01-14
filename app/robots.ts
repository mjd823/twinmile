import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/driver", "/api"],
      },
    ],
    sitemap: "https://twinmile.com/sitemap.xml",
    host: "https://twinmile.com",
  };
}
