import { BlogReviewClient } from "@/components/admin/blog-review-client";

export const metadata = {
  title: "Blog Pipeline | Twin Mile Admin",
};

export const dynamic = "force-dynamic";

export default function AdminBlogPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <BlogReviewClient />
    </main>
  );
}
