import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteFile } from "@/lib/storage";

describe("deleteFile with Supabase Storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configureSupabase(response: Response) {
    vi.stubEnv("SUPABASE_URL", "https://storage.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  }

  it("treats an HTTP 404 as an already-deleted file", async () => {
    configureSupabase(new Response(null, { status: 404 }));
    await expect(deleteFile("orders/file.pdf")).resolves.toBeUndefined();
  });

  it("treats Supabase's object-not-found error as an already-deleted file", async () => {
    configureSupabase(
      new Response(JSON.stringify({ statusCode: "404", error: "Not Found", message: "Object not found" }), {
        status: 400,
      })
    );
    await expect(deleteFile("orders/file.pdf")).resolves.toBeUndefined();
  });

  it("still reports other Supabase delete failures", async () => {
    configureSupabase(new Response(JSON.stringify({ message: "Storage unavailable" }), { status: 400 }));
    await expect(deleteFile("orders/file.pdf")).rejects.toThrow("Supabase delete failed: Storage unavailable");
  });
});
