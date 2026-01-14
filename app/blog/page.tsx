import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Twin Mile LLC logistics blog: time-critical shipping, freight strategy, last-mile delivery, and operational best practices.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const baseUrl = "https://twinmile.com";
  const featured = BLOG_POSTS[0] ?? null;

  const TOPICS = [
    { label: "Time‑Critical", href: "/blog" },
    { label: "Freight Strategy", href: "/blog" },
    { label: "Last‑Mile", href: "/blog" },
    { label: "Hotshot", href: "/blog" },
    { label: "Dispatch / 3PL", href: "/blog" },
  ];

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Blog", url: `${baseUrl}/blog` },
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
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Practical logistics strategy • Time‑critical execution
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Blog</h1>
            <p className="mt-4 text-muted-foreground">
              Practical insights on time‑critical shipping, freight strategy, last‑mile delivery, and operational execution.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className="rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-card/55 hover:text-foreground"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          {featured ? (
            <div className="mb-8 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-10">
              <div className="text-xs font-semibold tracking-wide text-foreground/80">Featured</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{featured.title}</div>
              <div className="mt-3 max-w-2xl text-muted-foreground">{featured.description}</div>
              <div className="mt-4 text-xs text-muted-foreground">
                {featured.publishedAt} • {featured.readingTime}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href={`/blog/${featured.slug}`}>Read article</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/get-a-quote">Get a Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/services">Explore Services</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mb-8 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Why this blog exists</h2>
              <p className="mt-3 text-muted-foreground">
                Logistics gets expensive when details are unclear. These articles are built for operators who value execution:
                windows, access, paperwork, and communication.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Reduce surprises</div>
                  <div className="mt-2 text-sm text-muted-foreground">Detention, accessorials, reattempts — preventable with better inputs.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Improve visibility</div>
                  <div className="mt-2 text-sm text-muted-foreground">A simple cadence keeps urgent freight from turning into escalations.</div>
                </div>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                Need help now? Start with <Link className="text-primary underline-offset-4 hover:underline" href="/get-a-quote">Get a Quote</Link>.
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-card/50 hover:shadow-2xl hover:shadow-black/30"
              >
                <div className="text-lg font-semibold tracking-tight">{post.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{post.description}</div>
                <div className="mt-4 text-xs text-muted-foreground">
                  {post.publishedAt} • {post.readingTime}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 left-1/2 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Want a clear plan for time‑critical freight?</h2>
                <p className="mt-3 text-muted-foreground">
                  Share the lane, timing, and constraints — we’ll respond fast with a clear execution plan.
                </p>
              </div>
              <div className="md:col-span-4 md:flex md:justify-end">
                <div className="flex flex-wrap gap-3">
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
        </div>
      </section>
    </main>
  );
}
