"use client";

import { useId, useRef, useState } from "react";
import type { PhotoInput } from "@/lib/hazards/types";

export function PhotoField({ value, onChange, label = "Photo evidence", required = true, disabled = false }: {
  value: PhotoInput | null; onChange: (photo: PhotoInput | null) => void; label?: string; required?: boolean; disabled?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const latestFile = useRef(0);
  return <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-200" htmlFor={id}>{label}{required ? " (required)" : ""}</label>
    <input className="block w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100" id={id} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required={required && !value} disabled={disabled} aria-describedby={`${id}-help`} onChange={async (event) => {
      const file = event.target.files?.[0];
      const sequence = ++latestFile.current;
      setError(null); onChange(null);
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
        setError("Choose a JPEG, PNG or WebP photo under 2 MB."); event.target.value = ""; return;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Unable to read this photo."));
          reader.readAsDataURL(file);
        });
        if (sequence === latestFile.current) onChange({ dataUrl });
      } catch { if (sequence === latestFile.current) setError("Unable to read this photo. Choose it again."); }
    }} />
    <p className="text-xs text-muted" id={`${id}-help`}>Take a photo or select one. JPEG, PNG or WebP, up to 2 MB.</p>
    {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
    {value ? <img alt="Selected evidence preview" className="max-h-52 rounded-xl border border-slate-700 object-contain" src={value.dataUrl} /> : null}
  </div>;
}
