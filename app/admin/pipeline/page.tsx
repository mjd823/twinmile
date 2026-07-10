import { redirect } from "next/navigation";

/**
 * /admin/pipeline merged into /admin/lead-engine (Recruiting Pipeline).
 * Two pages both claiming to be "the pipeline" with different numbers was the
 * worst source of confusion — there is now exactly one.
 */
export default function PipelineRedirect() {
  redirect("/admin/lead-engine");
}
