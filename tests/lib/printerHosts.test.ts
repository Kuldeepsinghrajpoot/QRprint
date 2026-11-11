import { describe, expect, it, vi } from "vitest";
import { withVersionRetry } from "@/lib/printerHosts";

describe("withVersionRetry", () => {
  it("retries after a document version conflict", async () => {
    const doc = {
      save: vi.fn().mockRejectedValueOnce({ name: "VersionError" }).mockResolvedValueOnce(undefined),
    };
    let loadCount = 0;

    await expect(
      withVersionRetry(
        async () => {
          loadCount += 1;
          return doc;
        },
        async (latest) => {
          await latest.save();
        }
      )
    ).resolves.toBeUndefined();

    expect(doc.save).toHaveBeenCalledTimes(2);
    expect(loadCount).toBe(2);
  });

  it("does not retry unrelated errors", async () => {
    const doc = { save: vi.fn().mockRejectedValueOnce(new Error("boom")) };

    await expect(
      withVersionRetry(async () => doc, async (latest) => {
        await latest.save();
      })
    ).rejects.toThrow("boom");

    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});
