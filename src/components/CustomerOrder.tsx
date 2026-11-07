"use client";

import { LEX_FONT, PAGE_BG } from "@/components/lexical/ui";
import { shopOpenStatus } from "@/lib/shopHours";
import { useState, useMemo, useEffect, useRef } from "react";
import { slugFromHostname } from "@/lib/shopUrl";
import Link from "next/link";
import Script from "next/script";
import { detectPageCount, isAutoDetectable, isWordDoc, isZipFile } from "@/lib/pdf";
import { enhanceScan } from "@/lib/photoTools";
import { calcOrderPrice, PrintType, PaperSize, BindingType } from "@/lib/pricing";
import PrinterMachine from "@/components/PrinterMachine";
import type { OrderDTO, PricingConfigDTO } from "@/types/order";

type Step = "upload" | "payment" | "processing" | "receipt";
type PaymentMethod = "cash" | "online" | "free";

const CANCEL_WINDOW_SECONDS = 30;

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CustomerPage() {
  const [step, setStep] = useState<Step>("upload");
  const [config, setConfig] = useState<PricingConfigDTO | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [pageCountEstimated, setPageCountEstimated] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [printType, setPrintType] = useState<PrintType>("bw");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [duplex, setDuplex] = useState(false);
  const [binding, setBinding] = useState<BindingType>("none");
  const [priority, setPriority] = useState(false);
  const [copies, setCopies] = useState(1);
  const [detecting, setDetecting] = useState(false);

  const [pickedMethod, setMethod] = useState<PaymentMethod | null>(null);
  const [processingText, setProcessingText] = useState("Processing payment");
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Order-cancellation window (right after payment, in case of a wrong file/mistake)
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const cancelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Which shop this customer scanned: the QR link carries ?shop=<id>. Remembered for the session so it
  // survives a trip to /photo-tools and back.
  const shopRef = useRef<string>("");
  const [queue, setQueue] = useState<{ ahead: number; minutes: number } | null>(null);
  useEffect(() => {
    // On a shop sub-address the shop is the first part of the host name; old QR links use ?shop=<id>.
    // Main address: the shop is the first part of the path (/ravi-xerox); old links use ?shop=<id>.
    const pathShop = window.location.pathname.split("/").filter(Boolean)[0] || "";
    let shop = slugFromHostname(window.location.hostname) || pathShop || new URLSearchParams(window.location.search).get("shop") || "";
    try {
      if (shop) sessionStorage.setItem("qrprint_shop", shop);
      else shop = sessionStorage.getItem("qrprint_shop") || "";
    } catch {
      /* storage blocked — the query string still works for this page view */
    }
    shopRef.current = shop;
    fetch(`/api/settings/pricing${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load shop pricing");
        return data;
      })
      .then(setConfig)
      .catch((e) => setError(e instanceof Error && e.message.includes("Shop not found")
        ? "This shop link isn't valid. Please scan the shop's QR code again."
        : "Could not load shop pricing. Please refresh."));
  }, []);

  // Live queue: how many orders are waiting and about how long, refreshed every 30 seconds while the page is open.
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const shop = shopRef.current;
        const r = await fetch(`/api/queue-estimate${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`, { cache: "no-store" });
        const d = await r.json();
        if (!stop) setQueue(r.ok && d.enabled ? { ahead: d.ahead, minutes: d.minutes } : null);
      } catch {
        if (!stop) setQueue(null);
      }
    }
    const first = setTimeout(load, 400); // after the shop has been worked out from the address
    const t = setInterval(load, 30000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  // If the customer just came back from /photo-tools (collage, text/date
  // overlay, ID card front+back, or batch resize), pick up the composed
  // image it left behind and load it as this order's file.
  useEffect(() => {
    const dataUrl = sessionStorage.getItem("qrprint_photo_tool_result");
    if (!dataUrl) return;
    sessionStorage.removeItem("qrprint_photo_tool_result");

    fetch(dataUrl)
      .then((r) => r.blob())
      .then(async (blob) => {
        const f = new File([blob], "photo-tools-output.jpg", { type: "image/jpeg" });
        setFile(f);
        setPaperSize("Photo");
        setPrintType("color");
        setPageCountEstimated(false);
        const count = await detectPageCount(f);
        setPages(count);
      })
      .catch(() => {
        // If this fails for any reason, the customer can just upload normally.
      });
  }, []);

  // Keep a preview URL in sync with whichever file is selected, and clean
  // up the old one so we don't leak memory as the customer swaps files.
  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clearing the preview URL when the file is removed
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Start (and clean up) the cancellation countdown once an order is placed.
  useEffect(() => {
    if (step !== "receipt" || !order || cancelled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: starting a countdown timer when the receipt appears
    setCancelSecondsLeft(CANCEL_WINDOW_SECONDS);
    cancelIntervalRef.current = setInterval(() => {
      setCancelSecondsLeft((s) => {
        if (s <= 1 && cancelIntervalRef.current) {
          clearInterval(cancelIntervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when a new order is placed
  }, [order?._id]);

  async function handleCancelOrder() {
    if (!order) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: order.cancelKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel this order");
      if (cancelIntervalRef.current) clearInterval(cancelIntervalRef.current);
      setCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this order");
    } finally {
      setCancelling(false);
    }
  }

  const price = useMemo(() => {
    if (!config) return null;
    return calcOrderPrice({
      rates: config.rates,
      paperSize,
      printType,
      pages,
      copies,
      duplex,
      binding,
      priority,
      duplexDiscountPercent: config.duplexDiscountPercent,
      bindingSpiralCharge: config.bindingSpiralCharge,
      bindingLaminationCharge: config.bindingLaminationCharge,
      priorityFeePercent: config.priorityFeePercent,
      gstEnabled: config.gstEnabled,
      gstPercent: config.gstPercent,
    });
  }, [config, paperSize, printType, pages, copies, duplex, binding, priority]);

  // Shop Controls: opening hours and order rules the shop has set
  const hours = config ? shopOpenStatus(config) : { open: true, message: "" };
  // Shop has switched off both Cash and Online payments: nothing can be paid, so the shop is not taking orders.
  // Free printing (college / office): no payment step at all.
  const free = config?.freePrinting === true;
  const onlyMethod: PaymentMethod | null = config && config.cashPaymentEnabled !== config.onlinePaymentEnabled ? (config.cashPaymentEnabled ? "cash" : "online") : null;
  // The customer's choice, or the only method the shop accepts (nothing to choose between).
  const method: PaymentMethod | null = free ? "free" : (pickedMethod ?? onlyMethod);
  const noPayment = !!config && !free && !config.cashPaymentEnabled && !config.onlinePaymentEnabled;
  const phoneOk = /^\+?[0-9][0-9 -]{6,18}$/.test(phone.trim());
  const ruleMessage = !config || !file || pages <= 0
    ? ""
    : config.requirePhone && !phoneOk
      ? "Enter your mobile number to continue."
      : config.maxPagesPerOrder && pages > config.maxPagesPerOrder
        ? `This shop takes up to ${config.maxPagesPerOrder} pages per order. Please split your file.`
        : !free && config.minOrderAmount && price && price.total < config.minOrderAmount
          ? `The minimum order is ₹${config.minOrderAmount}.`
          : "";
  const canContinue = name.trim().length > 0 && !!file && pages > 0 && !detecting && !!config && hours.open && !noPayment && !ruleMessage;
  const showDuplexTip = pages > 4 && !duplex && paperSize === "A4";

  async function loadFile(f: File) {
    setFile(f);
    setError(null);
    if (isAutoDetectable(f)) {
      setDetecting(true);
      setPageCountEstimated(false);
      try {
        const count = await detectPageCount(f);
        setPages(count);
      } finally {
        setDetecting(false);
      }
    } else {
      // Word docs / ZIPs can't be auto-counted — ask the customer for an
      // estimate instead of silently guessing.
      setPages(1);
      setPageCountEstimated(true);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await loadFile(f);
  }

  async function handleScanCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScanning(true);
    setError(null);
    try {
      const blob = await enhanceScan(f, printType === "color" ? "color" : "bw");
      const scanned = new File([blob], "scanned-document.jpg", { type: "image/jpeg" });
      await loadFile(scanned);
    } catch {
      setError("Could not process the scan — please try again.");
    } finally {
      setScanning(false);
    }
  }

  /**
   * Uploads the chosen file. With Supabase storage the browser sends it straight to storage (so big PDFs
   * work on Vercel, which limits request bodies to 4.5 MB); otherwise it goes through /api/upload.
   */
  async function uploadSelectedFile(f: File): Promise<{ fileUrl: string; fileKey: string; fileName: string }> {
    const viaServer = async () => {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data as { fileUrl: string; fileKey: string; fileName: string };
    };

    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: f.name, fileType: f.type, fileSize: f.size }),
    });
    const sign = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(sign.error || "Upload failed");
    if (!sign.direct) return viaServer();

    try {
      const fd = new FormData();
      fd.append("cacheControl", "3600");
      fd.append("", f);
      const put = await fetch(sign.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: fd });
      if (!put.ok) throw new Error("direct upload rejected");
      return { fileUrl: sign.fileUrl, fileKey: sign.key, fileName: f.name };
    } catch {
      // Small files can still go through the server; big ones can't (Vercel 4.5 MB limit).
      if (f.size <= 4 * 1024 * 1024) return viaServer();
      throw new Error("Upload failed — please check your internet and try again.");
    }
  }

  async function submitOrder(razorpayFields?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    setProcessingText(method === "cash" || method === "free" ? "Confirming order" : "Uploading file");
    const uploadData = await uploadSelectedFile(file!);

    setProcessingText(method === "cash" || method === "free" ? "Generating token" : "Verifying payment");
    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: shopRef.current || undefined,
        customerName: name,
        customerPhone: phone || undefined,
        fileUrl: uploadData.fileUrl,
        fileKey: uploadData.fileKey,
        fileName: uploadData.fileName,
        printType,
        paperSize,
        duplex,
        binding,
        pages,
        pageCountEstimated,
        copies,
        priority,
        paymentMethod: method,
        ...razorpayFields,
      }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      throw new Error(orderData.error?.formErrors?.[0] || orderData.error || "Order failed");
    }

    setProcessingText(method === "free" ? "Sent to the shop ✅" : "Payment successful ✅");
    await new Promise((r) => setTimeout(r, 700));
    setOrder(orderData);
    setStep("receipt");
  }

  async function handlePay() {
    if (!method || !file || !price) return;
    setSubmitting(true);
    setError(null);
    setStep("processing");

    try {
      if (method === "online") {
        setProcessingText("Starting payment");
        const createRes = await fetch("/api/payments/razorpay/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: price.total, receipt: `qrp_${Date.now()}`, shop: shopRef.current || undefined }),
        });
        const createData = await createRes.json();

        if (createRes.ok && createData.configured) {
          await new Promise<void>((resolve, reject) => {
            const rzp = new window.Razorpay({
              key: createData.keyId,
              amount: createData.amount,
              currency: createData.currency,
              order_id: createData.razorpayOrderId,
              name: config?.shopName || "QRtoPrint",
              description: `Print order — ${pages} pages x ${copies}`,
              prefill: { name, contact: phone || undefined },
              theme: { color: "#2563eb" },
              handler: async (response: {
                razorpay_order_id: string;
                razorpay_payment_id: string;
                razorpay_signature: string;
              }) => {
                try {
                  await submitOrder({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  });
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
            });
            rzp.open();
          });
        } else {
          setProcessingText("Verifying UPI (test mode)");
          await new Promise((r) => setTimeout(r, 900));
          await submitOrder();
        }
      } else {
        await submitOrder();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep(free ? "upload" : "payment");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("upload");
    setName("");
    setPhone("");
    setFile(null);
    setPages(0);
    setPageCountEstimated(false);
    setPrintType("bw");
    setPaperSize("A4");
    setDuplex(false);
    setBinding("none");
    setPriority(false);
    setCopies(1);
    setMethod(null);
    setOrder(null);
    setError(null);
    setCancelled(false);
    setCancelSecondsLeft(0);
  }

  return (
    <div
      className="flex-1 flex justify-center px-3 sm:px-4 py-5 sm:py-8"
      style={{ fontFamily: LEX_FONT, background: PAGE_BG }}
    >
      {/* Public Sans — same font as the shop dashboard (React 19 hoists this into <head>) */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap"
        precedence="default"
      />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="w-full max-w-md md:max-w-lg">
        <header className="mb-5 flex items-center gap-3 px-1">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-white"
            style={{ background: "linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 60%, var(--accent-light) 100%)" }}
          >
            <Ico name="printer" size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[1.25rem] font-extrabold leading-tight tracking-tight text-slate-900/90">
              {config?.shopName || "QRtoPrint"}
            </h1>
            <p className="text-[13px] text-slate-900/60">{free ? "Upload your file and collect it at the counter. Printing is free." : "Upload your file, pay, collect it at the counter."}</p>
          </div>
        </header>

        <div className="rounded-[10px] border border-slate-200 bg-white p-5 sm:p-7">
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {config?.customerNotice && step === "upload" && (
            <div className="mb-4 rounded-lg border border-[color:var(--accent)]/25 px-3.5 py-2.5 text-[13px] text-slate-900/80" style={{ background: "rgb(var(--accent-rgb) / 0.07)" }}>
              {config.customerNotice}
            </div>
          )}

          {queue && hours.open && !config?.printingPaused && step === "upload" && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-700">
              {queue.ahead === 0
                ? "✅ No queue right now. Your print starts right away."
                : `⏱️ ${queue.ahead} ${queue.ahead === 1 ? "order" : "orders"} waiting · about ${queue.minutes} min`}
            </div>
          )}

          {!hours.open && step !== "receipt" && (
            <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{hours.message}</div>
          )}

          {noPayment && step !== "receipt" && (
            <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              🚫 This shop isn&apos;t taking orders right now. Please check back later or ask at the counter.
            </div>
          )}

          {config?.printingPaused && step !== "receipt" && (
            <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⏸️ We&apos;re on a short break right now (lunch/printer maintenance) — new orders are temporarily paused. Please check back shortly.
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Apna naam likhein">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayush" className="input" />
                </Field>
                <Field label={config?.requirePhone ? "Mobile number" : "Mobile number (optional)"}>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" className="input" />
                </Field>
              </div>

              {!file && (
                <Field label="Your file">
                  <label className="group flex cursor-pointer flex-col items-center rounded-[10px] border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-[color:var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.05)]">
                    <span
                      className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[color:var(--accent)]"
                      style={{ background: "rgb(var(--accent-rgb) / 0.12)" }}
                    >
                      <Ico name="upload" size={24} />
                    </span>
                    <span className="text-[15px] font-bold text-slate-900/90">Tap to choose a file</span>
                    <span className="mt-0.5 text-xs text-slate-500">PDF, Word, ZIP, JPG or PNG</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => scanInputRef.current?.click()}
                      disabled={scanning}
                      className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <Ico name="camera" size={17} />
                      {scanning ? "Scanning…" : "Scan a document"}
                    </button>
                    <Link
                      href="/photo-tools"
                      className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <Ico name="id" size={17} />
                      Photos &amp; ID cards
                    </Link>
                  </div>
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleScanCapture}
                  />
                </Field>
              )}

              {file && (
                <FilePreview
                  file={file}
                  previewUrl={previewUrl}
                  detecting={detecting}
                  onRemove={() => {
                    setFile(null);
                    setPages(0);
                    setPageCountEstimated(false);
                  }}
                />
              )}

              {file && !isAutoDetectable(file) && (
                <Field label={`How many pages? ${isWordDoc(file) ? "(Word doc)" : isZipFile(file) ? "(ZIP)" : ""}`}>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={pages}
                    onChange={(e) => setPages(Math.max(1, Number(e.target.value)))}
                    className="input"
                  />
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠️ We can&apos;t auto-count pages for this file type — enter your best estimate. Shop staff will confirm the exact count and adjust the price if needed.
                  </p>
                </Field>
              )}

              <div className="space-y-5 border-t border-slate-100 pt-6">
                <Field label="Print type">
                  <div className="grid grid-cols-2 gap-2">
                    <TypeTile active={printType === "bw"} onClick={() => setPrintType("bw")} title="B&W" dots={["#0f172a", "#94a3b8"]} />
                    <TypeTile active={printType === "color"} onClick={() => setPrintType("color")} title="Colour" dots={["#ef4444", "#eab308", "#3b82f6"]} />
                  </div>
                </Field>

                <Field label="Paper size">
                  <Segmented
                    value={paperSize}
                    onChange={setPaperSize}
                    options={(["A4", "A3", "Legal", "Letter", "Photo"] as PaperSize[]).map((s) => ({ value: s, label: s }))}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-[9.5rem_1fr]">
                  <Field label="Copies">
                    <Stepper value={copies} onChange={setCopies} min={1} max={50} />
                  </Field>
                  <Field label="Binding">
                    <Segmented
                      value={binding}
                      onChange={setBinding}
                      options={[
                        { value: "none", label: "None" },
                        { value: "spiral", label: "Spiral" },
                        { value: "lamination", label: "Laminate" },
                      ]}
                    />
                  </Field>
                </div>

                <div className="divide-y divide-slate-100 rounded-[10px] border border-slate-200">
                  <SwitchRow
                    icon="layers"
                    title="Double-sided"
                    hint={config?.duplexDiscountPercent ? `Uses less paper, ${config.duplexDiscountPercent}% off` : "Uses less paper"}
                    on={duplex}
                    onClick={() => setDuplex((v) => !v)}
                  />
                  <SwitchRow
                    icon="zap"
                    title="Priority"
                    hint={config?.priorityFeePercent ? `Prints ahead of the queue, +${config.priorityFeePercent}%` : "Prints ahead of the queue"}
                    on={priority}
                    onClick={() => setPriority((v) => !v)}
                  />
                </div>
              </div>

              {showDuplexTip && (
                <div className="rounded-lg border border-[color:var(--accent)]/20 px-3.5 py-2.5 text-[12.5px] text-slate-700" style={{ background: "rgb(var(--accent-rgb) / 0.06)" }}>
                  This document has {pages} pages — turn on <strong>Double-sided</strong> to cut your paper cost.
                </div>
              )}

              {config && price && !free && (
                <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm tabular-nums">
                  <Row label="Pages" value={pages ? `${pages} page(s)${pageCountEstimated ? " (estimated)" : ""}` : "—"} />
                  <Row label="Printing" value={`₹${price.baseCost}`} />
                  {price.duplexDiscount > 0 && <Row label="Double-sided discount" value={`− ₹${price.duplexDiscount}`} />}
                  {price.bindingCharge > 0 && <Row label="Binding" value={`+ ₹${price.bindingCharge}`} />}
                  {price.priorityFee > 0 && <Row label="Priority fee" value={`+ ₹${price.priorityFee}`} />}
                  {price.gstAmount > 0 && <Row label={`GST (${config.gstPercent}%)`} value={`+ ₹${price.gstAmount}`} />}
                </div>
              )}

              {ruleMessage && <p className="-mb-3 text-[13px] font-medium text-amber-700">{ruleMessage}</p>}

              {/* Always-visible total + action, so the price never scrolls out of sight on a phone */}
              <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-2 pl-4 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.25)]">
                <div className="min-w-0 grow">
                  <div className="text-[11px] leading-none text-slate-900/60">{canContinue ? (free ? "Cost" : "Total") : free ? "Add a file" : "Total (add a file)"}</div>
                  <div className="mt-1 text-[1.5rem] font-extrabold leading-none tracking-tight text-slate-900/90 tabular-nums">{free ? "Free" : `₹${price?.total ?? 0}`}</div>
                </div>
                <button
                  disabled={!canContinue || config?.printingPaused || submitting}
                  onClick={() => (free ? handlePay() : setStep("payment"))}
                  className="rounded-lg px-5 py-3 text-sm font-medium text-white transition active:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
                  style={{ background: !canContinue || config?.printingPaused ? undefined : "var(--accent)" }}
                >
                  {free ? "Send to print" : "Continue to payment"}
                </button>
              </div>
            </div>
          )}

          {step === "payment" && config && price && (
            <div className="space-y-4">
              <p className="text-[15px] font-bold text-slate-900/90">How do you want to pay?</p>
              <div className="flex gap-3">
                {config.onlinePaymentEnabled && (
                  <PayOption label="📱 UPI / Online" active={method === "online"} onClick={() => setMethod("online")} />
                )}
                {config.cashPaymentEnabled && (
                  <PayOption label="💵 Cash" active={method === "cash"} onClick={() => setMethod("cash")} />
                )}
              </div>
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-[10px] px-4 py-3.5 flex justify-between text-[15px] font-bold text-slate-900/90 tabular-nums">
                <span>Amount to pay</span>
                <span>₹{price.total}</span>
              </div>
              <button disabled={!method || submitting || config.printingPaused || noPayment} onClick={handlePay} className="btn-primary">
                Pay Now
              </button>
              <button onClick={() => setStep("upload")} className="btn-secondary">
                ← Back
              </button>
            </div>
          )}

          {step === "processing" && price && (
            <div className="text-center py-4">
              <PrinterMachine amountLabel={`₹${price.total}`} />
              <div className="text-[14.5px] font-bold text-[color:var(--accent)] mt-1 min-h-[20px]">
                {processingText}
                <span className="dot-anim inline-flex ml-0.5">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          )}

          {step === "receipt" && order && cancelled && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🗑️</div>
              <p className="font-bold text-slate-800 mb-1">Order Cancelled</p>
              <p className="text-sm text-slate-500 mb-5">
                Your order #{order.token} has been cancelled.
                {order.paymentMethod === "online" && " If you were charged, a refund has been initiated."}
              </p>
              <button onClick={reset} className="btn-primary">
                Start New Order
              </button>
            </div>
          )}

          {step === "receipt" && order && !cancelled && (
            <div>
              <div className="check-pop w-[70px] h-[70px] mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-9 h-9">
                  <path d="M4 12l5 5L20 6" className="check-draw" stroke="#16a34a" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-center font-bold text-green-600 mb-4">Order Confirmed!</p>

              <div className="border border-dashed border-slate-300 rounded-lg px-4 py-4">
                <div className="text-center text-[color:var(--accent)] font-extrabold text-2xl tracking-wide py-2.5 rounded-lg mb-3" style={{ background: "rgb(var(--accent-rgb) / 0.1)" }}>
                  #{order.token}
                </div>
                <Row label="Name" value={order.customerName} />
                <Row label="Date & Time" value={new Date(order.createdAt).toLocaleString()} />
                <Row label="Print Type" value={`${order.printType === "bw" ? "Black & White" : "Color"} · ${order.paperSize}`} />
                <Row label="Pages × Copies" value={`${order.pages} × ${order.copies}${order.pageCountEstimated ? " (est.)" : ""}`} />
                {order.binding !== "none" && <Row label="Binding" value={order.binding === "spiral" ? "Spiral" : "Lamination"} />}
                {order.priority && <Row label="Priority" value="⚡ Rush order" />}
                <Row label="Payment Method" value={order.paymentMethod === "cash" ? "Cash (pay at counter)" : order.paymentMethod === "free" ? "Free printing" : "UPI / Online"} />
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Status</span>
                  {order.paymentStatus === "pending" ? (
                    <span className="badge-pending">Pending at counter</span>
                  ) : (
                    <span className="badge-paid">{order.paymentMethod === "free" ? "No payment needed" : "Paid"}</span>
                  )}
                </div>
                <div className="flex justify-between pt-2 mt-1 font-extrabold text-slate-800">
                  <span>{order.paymentMethod === "free" ? "Amount to pay" : "Total Paid"}</span>
                  <span>{order.paymentMethod === "free" ? "Free" : `₹${order.totalPrice}`}</span>
                </div>
              </div>

              {cancelSecondsLeft > 0 && (
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="w-full mt-4 py-3 rounded-lg border-[1.5px] border-red-200 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition"
                >
                  {cancelling ? "Cancelling…" : `❌ Wrong file? Cancel order (${cancelSecondsLeft}s)`}
                </button>
              )}

              <Link href={`/track/${order.token}`} className="btn-secondary block text-center mt-4">
                📍 Track my order status
              </Link>

              <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed">
                🔊 Aapka naam counter par pukara jaayega jab print ready ho.
                <br />
                Ye ek digital receipt hai.
              </p>

              <button onClick={reset} className="btn-primary mt-4">
                New Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable UI pieces
// ---------------------------------------------------------------------------

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[14px] font-bold text-slate-900/90">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-[13.5px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  printer: <><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><rect x="6" y="14" width="12" height="8" rx="1" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  id: <><rect width="20" height="14" x="2" y="5" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 10h4" /><path d="M14 14h4" /><path d="M5.5 17c.6-1.6 4.4-1.6 5 0" /></>,
  layers: <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5" /><path d="m2 17 10 5 10-5" /></>,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
  phone: <><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></>,
  cash: <><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
};

function Ico({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const ON = "border-[color:var(--accent)] bg-[color:var(--accent)] text-white";
const OFF = "border-slate-300 bg-white text-slate-600 active:bg-slate-50";

function PayOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const upi = label.includes("UPI");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3.5 text-[14px] font-bold transition ${active ? ON : OFF}`}
    >
      <Ico name={upi ? "phone" : "cash"} size={18} />
      {upi ? "UPI / Online" : "Cash at counter"}
    </button>
  );
}

/** Joined option strip — one tap picks one value. Used instead of native <select> menus for a faster mobile experience. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex-1 rounded-lg px-2 py-2.5 text-[13px] font-semibold transition ${
            value === opt.value ? "bg-[color:var(--accent)] text-white" : "text-slate-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TypeTile({ active, onClick, title, dots }: { active: boolean; onClick: () => void; title: string; dots: string[] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-[14px] font-bold transition ${active ? ON : OFF}`}
    >
      <span className="flex -space-x-1.5">
        {dots.map((c) => (
          <span key={c} className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c }} />
        ))}
      </span>
      {title}
    </button>
  );
}

function SwitchRow({ icon, title, hint, on, onClick }: { icon: string; title: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? "text-[color:var(--accent)]" : "text-slate-500 bg-slate-100"}`} style={on ? { background: "rgb(var(--accent-rgb) / 0.12)" } : undefined}>
        <Ico name={icon} size={18} />
      </span>
      <span className="min-w-0 grow">
        <span className="block text-[14px] font-bold text-slate-900/90">{title}</span>
        <span className="block text-[12px] text-slate-500">{hint}</span>
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? "bg-[color:var(--accent)]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** +/- stepper for copies — friendlier to tap on mobile than a <select> with 50 options. */
function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center rounded-lg bg-slate-100 p-1">
      <button
        type="button"
        aria-label="Fewer copies"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-slate-600 active:bg-white"
      >
        −
      </button>
      <div className="flex-1 text-center text-[15px] font-extrabold tabular-nums text-slate-900/90">{value}</div>
      <button
        type="button"
        aria-label="More copies"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-slate-600 active:bg-white"
      >
        +
      </button>
    </div>
  );
}

/** Shows a real preview of the selected file before the customer pays — a PDF viewer, an image, or a generic file card for types that can't be previewed inline. */
function FilePreview({
  file,
  previewUrl,
  detecting,
  onRemove,
}: {
  file: File;
  previewUrl: string | null;
  detecting: boolean;
  onRemove: () => void;
}) {
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
      <div className="flex justify-between items-center px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="text-[12px] font-semibold text-slate-700 truncate pr-2">{file.name}</div>
        <button type="button" onClick={onRemove} className="text-[11px] font-bold text-red-500 shrink-0">
          Remove
        </button>
      </div>

      {isPdf && previewUrl && (
        <embed src={previewUrl} type="application/pdf" className="w-full h-56 sm:h-64" />
      )}
      {isImage && previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Preview" className="w-full max-h-56 sm:max-h-64 object-contain bg-slate-100" />
      )}
      {!isPdf && !isImage && (
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="text-3xl">{file.name.match(/\.zip$/i) ? "🗜️" : "📝"}</div>
          <div className="text-[12px] text-slate-500">
            Preview not available for this file type — {sizeLabel}. Shop staff will open and verify it before printing.
          </div>
        </div>
      )}

      <div className="px-3 py-2 text-[11.5px] text-slate-500 bg-white">
        {detecting ? "Counting pages…" : "Ready to print"}
      </div>
    </div>
  );
}
