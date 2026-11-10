"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SelectMenuOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

type SelectMenuProps<T extends string | number> = {
  value: T;
  options: readonly SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  align?: "left" | "right";
  className?: string;
};

export function SelectMenu<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  compact = false,
  align = "left",
  className = "",
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listID = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={rootRef} className={`select-menu ${compact ? "compact" : ""} align-${align} ${open ? "open" : ""} ${className}`.trim()}>
    <button
      type="button"
      className="select-menu-trigger"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listID}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <span>{selected?.label ?? placeholder ?? ariaLabel}</span>
      <ChevronDown aria-hidden="true" />
    </button>
    {open && <div id={listID} className="select-menu-popover" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return <button
          type="button"
          role="option"
          aria-selected={isSelected}
          className={isSelected ? "selected" : ""}
          key={String(option.value)}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          {isSelected && <Check aria-hidden="true" />}
        </button>;
      })}
    </div>}
  </div>;
}
