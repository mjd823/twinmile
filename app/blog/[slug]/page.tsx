import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { blogPostingSchema, breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema } from "@/lib/seo";
import { BLOG_POSTS, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const post = getPostBySlug(slug);
    if (!post) return { title: "Blog" };

    return {
      title: post.title,
      description: post.description,
      alternates: { canonical: `/blog/${post.slug}` },
    };
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          blogPostingSchema({
            url: `${baseUrl}/blog/${post.slug}`,
            headline: post.title,
            description: post.description,
            datePublished: post.publishedAt,
            imageUrl: `${baseUrl}/og.png`,
          }),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Blog", url: `${baseUrl}/blog` },
            { name: post.title, url: `${baseUrl}/blog/${post.slug}` },
          ]),
        ]}
      />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-44 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-3xl">
            <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="/blog">
              ← Back to Blog
            </Link>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Logistics insights • Built for execution
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">{post.title}</h1>
            <p className="mt-4 text-muted-foreground">{post.description}</p>
            <div className="mt-6 text-xs text-muted-foreground">
              {post.publishedAt} • {post.readingTime}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-3xl">
            <article className="prose prose-neutral dark:prose-invert">
              {post.content.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </article>

            <div className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <div className="text-sm font-semibold tracking-tight">Need time‑critical execution?</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Share the lane, timing, and constraints — we’ll respond fast with a clear plan.
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="/get-a-quote">Get a Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/services">Explore Services</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
