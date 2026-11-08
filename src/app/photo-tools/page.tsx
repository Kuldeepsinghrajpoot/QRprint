"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { slugFromHostname } from "@/lib/shopUrl";
import PoweredBy from "@/components/PoweredBy";
import {
  composeCollage,
  composeTextOverlay,
  composeBatchResize,
  composeIdCardFrontBack,
  COLLAGE_LAYOUTS,
  SIZE_PRESETS_CM,
  type CollageLayout,
} from "@/lib/photoTools";

type Mode = "collage" | "text" | "batch" | "idcard";

/** Where "back to the upload page" goes. On the main address the shop lives in ?shop=, which "/" alone would lose
 *  (the main address now shows the landing page when no shop is given). */
function customerHome(): string {
  try {
    const shop = sessionStorage.getItem("qrprint_shop");
    if (shop && !slugFromHostname(window.location.hostname)) return `/${encodeURIComponent(shop)}`;
  } catch {
    /* storage blocked */
  }
  return "/";
}

export default function PhotoToolsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("collage");
  const [files, setFiles] = useState<File[]>([]);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitInfo, setFitInfo] = useState<{ fitted: number; total: number } | null>(null);

  const [layoutName, setLayoutName] = useState(Object.keys(COLLAGE_LAYOUTS)[2]);
  const [text, setText] = useState("");
  const [includeDate, setIncludeDate] = useState(true);
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [presetName, setPresetName] = useState(Object.keys(SIZE_PRESETS_CM)[0]);
  const [sheet, setSheet] = useState<"A4" | "Photo">("A4");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function switchMode(m: Mode) {
    setMode(m);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setFitInfo(null);
    setError(null);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files || []));
    setPreviewUrl(null);
    setPreviewBlob(null);
    setError(null);
  }

  async function handleGenerate() {
    setError(null);
    setProcessing(true);
    try {
      let blob: Blob;

      if (mode === "collage") {
        const layout: CollageLayout = COLLAGE_LAYOUTS[layoutName];
        if (files.length < 2) throw new Error("Please select at least 2 photos for a collage.");
        blob = await composeCollage(files, layout);
      } else if (mode === "text") {
        if (files.length < 1) throw new Error("Please select a photo.");
        if (!text.trim() && !includeDate) throw new Error("Enter some text or enable the date stamp.");
        blob = await composeTextOverlay(files[0], { text, includeDate, position, color: "#ffffff" });
      } else if (mode === "idcard") {
        if (!frontFile || !backFile) throw new Error("Please select both the front and back photos of the card.");
        blob = await composeIdCardFrontBack(frontFile, backFile, sheet);
      } else {
        if (files.length < 1) throw new Error("Please select at least 1 photo.");
        const target = SIZE_PRESETS_CM[presetName];
        const result = await composeBatchResize(files, target, sheet);
        blob = result.blob;
        setFitInfo({ fitted: result.fitted, total: result.total });
      }

      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the photo(s)");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUseThisPhoto() {
    if (!previewBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("qrprint_photo_tool_result", reader.result as string);
      router.push(customerHome());
    };
    reader.readAsDataURL(previewBlob);
  }

  const canGenerate =
    mode === "idcard" ? !!frontFile && !!backFile : mode === "text" ? files.length >= 1 : files.length >= (mode === "collage" ? 2 : 1);

  return (
    <div className="flex-1 flex justify-center px-3 sm:px-4 py-5 sm:py-6">
      <div className="w-full max-w-md md:max-w-lg">
        <div className="text-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-700">📷 Photo Tools</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Collage, captions, ID cards &amp; passport-size batches</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(37,99,235,0.08)] border border-slate-200 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            {(["collage", "text", "idcard", "batch"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`py-2 rounded-lg text-[12px] font-bold border-[1.5px] ${
                  mode === m ? "border-blue-600 bg-indigo-50 text-blue-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {m === "collage" ? "🖼️ Collage" : m === "text" ? "✏️ Text/Date" : m === "idcard" ? "🪪 ID Card F/B" : "📐 Batch Resize"}
              </button>
            ))}
          </div>

          {mode === "idcard" ? (
            <div className="space-y-3">
              <p className="text-[11.5px] text-slate-500">
                Upload the front and back of your ID card (e.g. Aadhaar) — both sides will be arranged on a single sheet, full-size and uncropped.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Front side">
                  <input type="file" accept="image/jpeg,image/png" onChange={(e) => setFrontFile(e.target.files?.[0] || null)} className="input" />
                  {frontFile && <div className="text-[11px] text-green-600 mt-1">✅ {frontFile.name}</div>}
                </Field>
                <Field label="Back side">
                  <input type="file" accept="image/jpeg,image/png" onChange={(e) => setBackFile(e.target.files?.[0] || null)} className="input" />
                  {backFile && <div className="text-[11px] text-green-600 mt-1">✅ {backFile.name}</div>}
                </Field>
              </div>
              <Field label="Print sheet">
                <ChipRow
                  value={sheet}
                  onChange={setSheet}
                  options={[{ value: "A4", label: "A4 sheet" }, { value: "Photo", label: "Photo (4×6)" }]}
                />
              </Field>
            </div>
          ) : (
            <Field label={mode === "text" ? "Select a photo" : "Select photos"}>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple={mode !== "text"}
                onChange={handleFiles}
                className="input"
              />
              {files.length > 0 && <div className="text-[11.5px] text-slate-500 mt-1">{files.length} photo(s) selected</div>}
            </Field>
          )}

          {mode === "collage" && (
            <Field label="Layout">
              <ChipRow
                value={layoutName}
                onChange={setLayoutName}
                options={Object.keys(COLLAGE_LAYOUTS).map((name) => ({ value: name, label: name }))}
              />
            </Field>
          )}

          {mode === "text" && (
            <div className="space-y-3">
              <Field label="Caption / Name">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Happy Birthday Ayush" className="input" />
              </Field>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={includeDate} onChange={(e) => setIncludeDate(e.target.checked)} className="w-4 h-4" />
                Add today&apos;s date
              </label>
              <Field label="Position">
                <ChipRow value={position} onChange={setPosition} options={[{ value: "bottom", label: "Bottom" }, { value: "top", label: "Top" }]} />
              </Field>
            </div>
          )}

          {mode === "batch" && (
            <div className="space-y-3">
              <Field label="Target size">
                <ChipRow
                  value={presetName}
                  onChange={setPresetName}
                  options={Object.keys(SIZE_PRESETS_CM).map((name) => ({ value: name, label: name }))}
                />
              </Field>
              <Field label="Print sheet">
                <ChipRow value={sheet} onChange={setSheet} options={[{ value: "A4", label: "A4 sheet" }, { value: "Photo", label: "Photo (4×6)" }]} />
              </Field>
              {fitInfo && fitInfo.total > fitInfo.fitted && (
                <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Only {fitInfo.fitted} of {fitInfo.total} photos fit on one {sheet} sheet at this size — the rest were left out. Use a bigger sheet or place a second order for the remainder.
                </div>
              )}
            </div>
          )}

          <button onClick={handleGenerate} disabled={processing || !canGenerate} className="btn-primary">
            {processing ? "Processing…" : "Generate Preview"}
          </button>

          {previewUrl && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="w-full rounded-xl border border-slate-200" />
              <button onClick={handleUseThisPhoto} className="btn-primary">
                ✅ Use This Photo →
              </button>
            </div>
          )}

          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              router.push(customerHome());
            }}
            className="btn-secondary block text-center"
          >
            ← Back to normal upload
          </Link>
        </div>
        <PoweredBy className="mt-5" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ChipRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-lg text-[12px] font-bold border-[1.5px] transition ${
            value === opt.value ? "border-blue-600 bg-indigo-50 text-blue-700" : "border-slate-200 text-slate-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
