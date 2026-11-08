/**
 * "Collected" deletes the customer's file for good, so it must only happen to an order that really printed.
 * Returns null when marking it collected is fine, otherwise the message to show (and whether staff can confirm).
 */
export function collectBlocked(
  before: { printStatus: string; readyBy?: string | null; requiresManualPrint?: boolean | null },
  confirmPrinted: boolean | undefined
): { error: string; needsConfirm?: boolean } | null {
  if (before.printStatus === "collected") return null; // already collected, nothing to protect
  if (before.printStatus !== "ready") {
    return {
      error:
        before.printStatus === "queued" || before.printStatus === "printing"
          ? "This order has not printed yet, so it can't be marked collected. Wait for it to print, press Print now, or cancel it."
          : `This order is "${before.printStatus}", so it can't be marked collected. Print it again first, or cancel it.`,
    };
  }
  // Marked ready by hand (the printer never reported it): staff must confirm paper really came out.
  if (before.readyBy === "staff" && !before.requiresManualPrint && !confirmPrinted) {
    return {
      error: "This order was marked ready by hand and the printer never reported it. Confirm that it printed, or print it again.",
      needsConfirm: true,
    };
  }
  return null;
}
