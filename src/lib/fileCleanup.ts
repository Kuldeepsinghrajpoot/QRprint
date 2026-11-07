import { Order } from "@/models/Order";
import { deleteFile, listStoredFiles } from "@/lib/storage";

/** How long a file may stay when its order never reached "collected"/"cancelled" (failed, ready but not collected, abandoned upload). */
const retentionMs = () => Math.max(1, Number(process.env.FILE_RETENTION_HOURS || 24)) * 60 * 60 * 1000;

/**
 * Privacy: customer documents are deleted as soon as the order is collected (or cancelled).
 * On success the order's fileKey/fileUrl are cleared too, so nothing points at a deleted file and
 * "file still stored?" can be answered from the database.
 */
export async function purgeOrderFile(order: { _id: unknown; fileKey?: string | null }): Promise<{ deleted: boolean; error?: string }> {
  if (!order.fileKey) return { deleted: true };
  try {
    await deleteFile(order.fileKey);
    await Order.updateOne({ _id: order._id as never }, { $unset: { fileKey: "", fileUrl: "" } });
    return { deleted: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "delete failed";
    console.error(`Could not delete stored file ${order.fileKey}:`, error);
    return { deleted: false, error };
  }
}

/**
 * Safety net for files that are still stored although they are no longer needed:
 *  - collected / cancelled orders whose first delete failed (network blip, storage hiccup)
 *  - failed or ready orders older than FILE_RETENTION_HOURS (default 24) - e.g. an auto-cancelled cash order,
 *    or a printed order nobody collected. (Younger failed orders keep their file so staff can re-print.)
 */
export async function sweepStaleFiles(limit = 25): Promise<number> {
  const cutoff = new Date(Date.now() - retentionMs());
  const stale = await Order.find({
    fileKey: { $exists: true, $nin: [null, ""] },
    $or: [
      { printStatus: { $in: ["collected", "cancelled"] } },
      { printStatus: { $in: ["failed", "ready"] }, updatedAt: { $lt: cutoff } },
    ],
  })
    .select("_id fileKey")
    .limit(limit)
    .lean();
  let deleted = 0;
  for (const o of stale) if ((await purgeOrderFile(o)).deleted) deleted++;
  return deleted;
}

/** Deletes uploads older than the retention time that no order points at (customer uploaded, then never placed the order). */
export async function sweepOrphanUploads(limit = 200): Promise<number> {
  const cutoff = Date.now() - retentionMs();
  const old = (await listStoredFiles().catch(() => [])).filter((f) => f.createdAt < cutoff).slice(0, limit);
  if (old.length === 0) return 0;
  const used = new Set(
    (await Order.find({ fileKey: { $in: old.map((f) => f.key) } }).select("fileKey").lean()).map((o) => o.fileKey)
  );
  let deleted = 0;
  for (const f of old) {
    if (used.has(f.key)) continue;
    try {
      await deleteFile(f.key);
      deleted++;
    } catch (err) {
      console.error(`Could not delete orphan upload ${f.key}:`, err);
    }
  }
  return deleted;
}

export async function runCleanup(): Promise<{ orderFiles: number; orphanUploads: number }> {
  const orderFiles = await sweepStaleFiles();
  const orphanUploads = await sweepOrphanUploads();
  return { orderFiles, orphanUploads };
}

let lastRun = 0;
/** Runs the cleanup at most every 10 minutes from the dashboard's order polling, so it works even without a scheduled job. */
export async function maybeRunCleanup(): Promise<void> {
  if (Date.now() - lastRun < 10 * 60 * 1000) return;
  lastRun = Date.now();
  await runCleanup().catch((err) => console.error("File cleanup failed:", err));
}
