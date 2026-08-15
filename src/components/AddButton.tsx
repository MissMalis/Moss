"use client";

import { Modal } from "@/components/Modal";

/**
 * Rev 05 §1.5: "Add ___" always opens a real modal popup — never an inline
 * expanding panel. Same external API as before (label + children), so
 * every existing call site upgraded automatically.
 */
export function AddButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Modal label={label} title={label}>
      {children}
    </Modal>
  );
}
