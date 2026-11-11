import { describe, expect, it, vi } from "vitest";
import { AGENT_STALE_MS, isAgentOnline, withVersionRetry } from "@/lib/printerHosts";

describe("isAgentOnline", () => {
  const now = new Date("2026-11-11T12:00:00.000Z");

  it("requires online status and a heartbeat younger than 45 seconds", () => {
    expect(isAgentOnline({ status: "online", lastSeenAt: new Date(now.getTime() - AGENT_STALE_MS + 1) }, now)).toBe(true);
    expect(isAgentOnline({ status: "offline", lastSeenAt: now }, now)).toBe(false);
    expect(isAgentOnline({ status: "online", lastSeenAt: new Date(now.getTime() - AGENT_STALE_MS) }, now)).toBe(false);
  });
});

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
