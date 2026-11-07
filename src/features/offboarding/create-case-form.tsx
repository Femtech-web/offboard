"use client";

import { useActionState } from "react";
import { createCase } from "@/server/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClassName } from "@/components/ui/workspace";
import { initialCreateCaseState } from "./create-case-state";

export function CreateCaseForm() {
  const [state, formAction] = useActionState(
    createCase,
    initialCreateCaseState,
  );
  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical/5 p-3 text-sm leading-6 text-critical"
        >
          {state.message}
        </p>
      )}
      <label className="block text-sm">
        Person’s name
        <input
          name="fullName"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={state.values.fullName}
          aria-invalid={Boolean(state.fieldErrors.fullName)}
          aria-describedby={
            state.fieldErrors.fullName ? "case-name-error" : undefined
          }
          className={inputClassName}
        />
        <FieldError
          id="case-name-error"
          messages={state.fieldErrors.fullName}
        />
      </label>
      <label className="block text-sm">
        Departure date
        <input
          name="departureOn"
          required
          type="date"
          defaultValue={state.values.departureOn}
          aria-invalid={Boolean(state.fieldErrors.departureOn)}
          aria-describedby={
            state.fieldErrors.departureOn ? "case-departure-error" : undefined
          }
          className={inputClassName}
        />
        <FieldError
          id="case-departure-error"
          messages={state.fieldErrors.departureOn}
        />
      </label>
      <label className="block text-sm">
        GitHub username
        <input
          name="username"
          required
          maxLength={39}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          defaultValue={state.values.username}
          aria-invalid={Boolean(state.fieldErrors.username)}
          aria-describedby={
            state.fieldErrors.username
              ? "case-username-help case-username-error"
              : "case-username-help"
          }
          className={inputClassName}
        />
        <span
          id="case-username-help"
          className="mt-2 block text-xs leading-6 text-muted-foreground"
        >
          Use the username shown on their GitHub profile.
        </span>
        <FieldError
          id="case-username-error"
          messages={state.fieldErrors.username}
        />
      </label>
      <p className="text-xs leading-6 text-muted-foreground">
        We’ll check this account’s access. You’ll review the person and each
        proposed change before anything is removed.
      </p>
      <SubmitButton pendingLabel="Creating…">
        Create offboarding case
      </SubmitButton>
    </form>
  );
}
function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.[0] ? (
    <span id={id} className="mt-2 block text-xs leading-6 text-critical">
      {messages[0]}
    </span>
  ) : null;
}
