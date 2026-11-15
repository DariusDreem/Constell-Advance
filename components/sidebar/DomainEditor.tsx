"use client";

import { useState, type FormEvent } from "react";
import { TrashIcon } from "@/components/icons";
import { DOMAIN_COLORS } from "@/lib/constellation/palette";

interface DomainEditorProps {
  initialName?: string;
  initialColor: string;
  onSave: (values: { name: string; color: string }) => void;
  onCancel: () => void;
  /** Present when editing an existing domain. */
  onDelete?: () => void;
}

/** Inline form to create or edit a domain: name, colour, and deletion. */
export function DomainEditor({
  initialName = "",
  initialColor,
  onSave,
  onCancel,
  onDelete,
}: DomainEditorProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [confirming, setConfirming] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSave({ name: trimmed, color });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5"
    >
      <input
        autoFocus
        className="field"
        value={name}
        maxLength={40}
        placeholder="Nom du domaine"
        aria-label="Nom du domaine"
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Couleur du domaine">
        {DOMAIN_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={color === swatch}
            aria-label={`Couleur ${swatch}`}
            onClick={() => setColor(swatch)}
            className="h-5 w-5 rounded-full transition-transform hover:scale-110"
            style={{
              background: swatch,
              boxShadow: color === swatch ? `0 0 0 2px #04020b, 0 0 0 3.5px ${swatch}` : "none",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="submit" disabled={!name.trim()} className="btn btn-primary px-3 py-1 text-xs">
          OK
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost px-3 py-1 text-xs">
          Annuler
        </button>
        {onDelete &&
          (confirming ? (
            <button type="button" onClick={onDelete} className="btn btn-danger ml-auto px-2.5 py-1 text-xs">
              Supprimer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Supprimer le domaine"
              title="Supprimer le domaine"
              className="ml-auto grid h-7 w-7 place-items-center rounded-full text-white/45 transition-colors hover:bg-rose-400/15 hover:text-rose-200"
            >
              <TrashIcon width={14} height={14} />
            </button>
          ))}
      </div>
      {confirming && (
        <p className="text-[11px] leading-snug text-rose-200/85">
          Les paliers de ce domaine seront supprimés aussi.
        </p>
      )}
    </form>
  );
}
