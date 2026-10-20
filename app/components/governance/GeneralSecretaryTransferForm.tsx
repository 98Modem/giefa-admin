"use client";

import { useActionState } from "react";
import {
  transferGeneralSecretaryAction,
  type TransferGeneralSecretaryState,
} from "@/app/actions/leadership";

type TransferCandidate = {
  id: string;
  name: string;
  email: string | null;
};

type GeneralSecretaryTransferFormProps = {
  currentSecretary: {
    id: string;
    name: string;
    email: string | null;
  };
  candidates: TransferCandidate[];
};

const initialState: TransferGeneralSecretaryState = {
  ok: false,
  message: "",
};

export function GeneralSecretaryTransferForm({
  currentSecretary,
  candidates,
}: GeneralSecretaryTransferFormProps) {
  const [state, action, pending] = useActionState(
    transferGeneralSecretaryAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
        <p className="font-semibold">This is an immediate, atomic transfer.</p>
        <p className="mt-1 leading-6">
          {currentSecretary.name} will lose General Secretary authority and
          automatically return to the normal Member role when the incoming GS is
          assigned. Both changes succeed together or neither is saved.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Current General Secretary
        </p>
        <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-950">
          <p className="font-semibold text-gray-900 dark:text-white">
            {currentSecretary.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentSecretary.email ?? "No registrar email"}
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Incoming General Secretary
        </span>
        <select
          required
          name="incoming_member_id"
          defaultValue=""
          className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        >
          <option value="" disabled>
            Select an approved normal member
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
              {candidate.email ? ` — ${candidate.email}` : ""}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          To protect other leadership offices, the incoming GS must currently
          have the normal Member role.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Approval reason
        </span>
        <textarea
          required
          minLength={10}
          maxLength={500}
          name="reason"
          rows={4}
          placeholder="Record the election, resignation, term change, or other approved reason."
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Type TRANSFER to confirm
        </span>
        <input
          required
          name="confirmation"
          autoComplete="off"
          pattern="TRANSFER"
          className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
      </label>

      {state.message ? (
        <div
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300"
              : "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || candidates.length === 0}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Transferring authority…" : "Transfer General Secretary"}
      </button>

      {candidates.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          No approved normal member is currently eligible for transfer.
        </p>
      ) : null}
    </form>
  );
}
