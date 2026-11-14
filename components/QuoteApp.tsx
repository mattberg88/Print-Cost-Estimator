"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, loadModelFile, sampleModel, type LoadedModel } from "@/lib/loadModel";
import { MATERIALS, SLA_DEFAULT_LAYER, type OrderRequest, type ProcessId, type QuoteResponse, type TurnaroundId } from "@/lib/options";
import { renderThumbnail } from "@/lib/thumbnail";
import { UNIT_TO_MM, type Unit } from "@/lib/units";
import { useAdmin } from "./AdminContext";
import PartCard, { type QuotePart } from "./PartCard";
import QuoteSummary from "./QuoteSummary";
import ViewerModal from "./ViewerModal";

const MAX_PARTS = 50;
const ACCEPT = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",");
let keySeq = 0;

export function measure(p: QuotePart) {
  const k = UNIT_TO_MM[p.unit];
  return {
    volumeMm3: p.model.volume * k ** 3,
    areaMm2: p.model.area * k ** 2,
    // Plate convention: L = x, W = z (depth), H = y (height)
    size: { x: p.model.size.x * k, y: p.model.size.y * k, z: p.model.size.z * k },
    supportMm3: p.model.supportVolume * k ** 3,
  };
}

export default function QuoteApp() {
  const { admin, markLoggedOut } = useAdmin();
  const [parts, setParts] = useState<QuotePart[]>([]);
  const [turnaround, setTurnaround] = useState<TurnaroundId>("standard");
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addModels = (models: LoadedModel[]) => {
    if (!models.length) return;
    const fresh: QuotePart[] = models.map((m) => ({
      key: `p${++keySeq}`,
      model: m,
      unit: m.defaultUnit,
      quantity: 1,
      process: "sla" as ProcessId,
      material: MATERIALS.sla[0].id,
      slaLayer: SLA_DEFAULT_LAYER,
      thumb: renderThumbnail(m),
    }));
    setParts((prev) => [...prev, ...fresh].slice(0, MAX_PARTS));
  };

  const handleFiles = useCallback(async (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setErrors([]);
    const loaded: LoadedModel[] = [];
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setLoading(files.length > 1 ? `Analyzing ${i + 1} of ${files.length}…` : "Analyzing your part…");
      await new Promise((r) => setTimeout(r, 30)); // let the overlay paint
      try {
        loaded.push(await loadModelFile(files[i]));
      } catch (e) {
        errs.push(`${files[i].name}: ${e instanceof Error ? e.message : "couldn't read this file."}`);
      }
    }
    setLoading(null);
    setErrors(errs);
    addModels(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePart = (key: string, patch: Partial<QuotePart>) =>
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePart = (key: string) => {
    const gone = parts.find((p) => p.key === key);
    setParts((prev) => prev.filter((p) => p.key !== key));
    if (viewKey === key) setViewKey(null);
    if (gone) setTimeout(() => gone.model.geometry.dispose(), 0);
  };

  const duplicatePart = (key: string) => {
    const src = parts.find((p) => p.key === key);
    if (!src || parts.length >= MAX_PARTS) return;
    setParts((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const copy = { ...src, key: `p${++keySeq}` };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };

  // Price the whole order (all turnaround options) whenever anything that affects price changes.
  const request = useMemo<OrderRequest | null>(() => {
    if (!parts.length) return null;
    return {
      parts: parts.map((p) => {
        const m = measure(p);
        return {
          id: p.key,
          volume: m.volumeMm3,
          area: m.areaMm2,
          size: m.size,
          supportVolume: m.supportMm3,
          quantity: Math.max(1, Math.floor(p.quantity) || 1),
          process: p.process,
          material: p.material,
          slaLayer: p.process === "sla" ? p.slaLayer : undefined,
        };
      }),
    };
  }, [parts]);

  useEffect(() => {
    if (!request) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setPricing(true);
    const t = setTimeout(() => {
      fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Couldn't get a price.");
          return r.json() as Promise<QuoteResponse>;
        })
        .then((d) => {
          setData(d);
          setPriceError(null);
          if (admin && !d.admin) markLoggedOut();
        })
        .catch((e) => {
          if (e.name !== "AbortError") setPriceError(e.message || "Couldn't get a price.");
        })
        .finally(() => !ctrl.signal.aborted && setPricing(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [request, admin, markLoggedOut]);

  const isAdmin = admin && !!data?.admin;
  const viewing = parts.find((p) => p.key === viewKey) ?? null;
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      hidden
      accept={ACCEPT}
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (!parts.length) {
    return (
      <div className="start">
        <div className={`upload-hero ${dragging ? "dragging" : ""}`} {...dropProps}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
            <path d="m3 7 9 5 9-5M12 12v10" />
          </svg>
          <h2>Get an instant quote</h2>
          <p>
            Drag and drop your 3D files here, or{" "}
            <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
              choose files
            </button>
          </p>
          <div className="upload-actions">
            <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()}>
              Upload parts
            </button>
            <button type="button" className="btn-secondary" onClick={() => addModels([sampleModel()])}>
              Try a sample part
            </button>
          </div>
          <p className="fine">Accepted files: STL · OBJ · 3MF · PLY · GLB · Your files stay in your browser and are never uploaded.</p>
          {loading && <div className="busy">{loading}</div>}
        </div>
        {errors.map((er) => (
          <div key={er} className="alert error">
            {er}
          </div>
        ))}
        <ol className="how">
          <li>
            <strong>Upload</strong>
            <span>Add one or more 3D models.</span>
          </li>
          <li>
            <strong>Configure</strong>
            <span>Pick a process, material and quantity for each part.</span>
          </li>
          <li>
            <strong>Get your price</strong>
            <span>Compare turnaround options and request your quote.</span>
          </li>
        </ol>
        {fileInput}
      </div>
    );
  }

  return (
    <div className="quote-layout">
      <div className="quote-main">
        <div className="quote-head">
          <div>
            <h1 className="quote-title">Your quote</h1>
            <p className="muted">
              {parts.length} {parts.length === 1 ? "part" : "parts"} · prices update as you configure
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
            + Add parts
          </button>
        </div>

        {errors.map((er) => (
          <div key={er} className="alert error">
            {er}
          </div>
        ))}

        {parts.map((p, i) => (
          <PartCard
            key={p.key}
            index={i + 1}
            part={p}
            measured={measure(p)}
            pricing={data?.options ?? null}
            turnaround={turnaround}
            loading={pricing}
            isAdmin={isAdmin}
            onChange={(patch) => updatePart(p.key, patch)}
            onRemove={() => removePart(p.key)}
            onDuplicate={() => duplicatePart(p.key)}
            onView={() => setViewKey(p.key)}
            onTurnaround={setTurnaround}
          />
        ))}

        <div className={`add-more ${dragging ? "dragging" : ""}`} {...dropProps}>
          <span>
            Drag and drop more parts here, or{" "}
            <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
              choose files
            </button>
          </span>
          {loading && <div className="busy">{loading}</div>}
        </div>
      </div>

      <QuoteSummary
        parts={parts}
        options={data?.options ?? null}
        turnaround={turnaround}
        onTurnaround={setTurnaround}
        loading={pricing}
        error={priceError}
        isAdmin={isAdmin}
      />

      {viewing && <ViewerModal part={viewing} measured={measure(viewing)} onClose={() => setViewKey(null)} />}
      {fileInput}
    </div>
  );
}

