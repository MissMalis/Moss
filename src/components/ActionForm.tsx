"use client";

import { useActionState } from "react";

type ActionFn = (formData: FormData) => Promise<void> | void;

/**
 * Rev 05 §0.1: a plain `<form action={serverAction}>` lets a thrown error
 * propagate to the nearest error boundary and eject the user from whatever
 * they were doing — that's the "Remove crashes the app" bug. Routing the
 * call through useActionState catches the throw and turns it into local
 * state instead, so the form just shows the error inline and stays put.
 */
export function ActionForm({
  action,
  onSuccess,
  children,
  className,
  id,
}: {
  action: ActionFn;
  onSuccess?: () => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    async (_prev, formData) => {
      try {
        await action(formData);
        onSuccess?.();
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Something went wrong" };
      }
    },
    { error: null },
  );

  return (
    <form id={id} action={formAction} className={className} aria-busy={pending}>
      {children}
      {state.error && <p className="mt-1.5 w-full text-[12.5px] text-bad">{state.error}</p>}
    </form>
  );
}
