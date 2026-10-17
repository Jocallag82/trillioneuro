"use client";

import { useState } from "react";

export interface StoreOption {
  value: string;
  label: string;
}

/**
 * Walk-through of a proposed ordering journey. Nothing is submitted, stored or charged:
 * there is no network call anywhere in this component.
 */
export function DemoOrderJourney({ productName, stores }: { productName: string; stores: StoreOption[] }) {
  const [step, setStep] = useState(0);
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const steps = ["Collection", "Personalise", "Review"];

  const storeLabel = stores.find((s) => s.value === store)?.label;
  const canContinue = step === 0 ? Boolean(store && date) : true;

  if (step === 3) {
    return (
      <div role="status" className="border border-rye/15 bg-cream p-6">
        <p className="font-serif text-2xl">This is where checkout would begin.</p>
        <p className="mt-3 text-sm leading-relaxed text-cocoa">
          In this concept, no order has been placed, no payment taken and no details stored. On a live site, the customer
          would now pay securely and receive a confirmation for collection.
        </p>
        <button type="button" onClick={() => setStep(0)} className="mt-5 text-sm font-medium underline underline-offset-4">
          Start again
        </button>
      </div>
    );
  }

  return (
    <form
      className="border border-rye/15 bg-cream"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) setStep((s) => s + 1);
      }}
      aria-label={`Order ${productName} (demonstration)`}
    >
      <ol className="grid grid-cols-3 border-b border-rye/10 text-center text-xs">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`px-2 py-3 uppercase tracking-[0.16em] ${i === step ? "bg-rye text-cream" : i < step ? "text-rye" : "text-cocoa"}`}
          >
            <span className="tabular-nums">{i + 1}.</span> {s}
          </li>
        ))}
      </ol>

      <div className="space-y-5 p-6">
        {step === 0 && (
          <>
            <div>
              <label htmlFor="store" className="block text-sm font-medium">Collect from</label>
              <select
                id="store"
                required
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="mt-2 block min-h-12 w-full rounded-none border border-rye/25 bg-flour px-3 text-base"
              >
                <option value="">Choose a store…</option>
                {stores.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium">Collection date</label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 block min-h-12 w-full rounded-none border border-rye/25 bg-flour px-3 text-base"
              />
              <p className="mt-2 text-xs text-cocoa">Lead times and available dates would be confirmed by the bakery.</p>
            </div>
          </>
        )}

        {step === 1 && (
          <div>
            <label htmlFor="msg" className="block text-sm font-medium">Message on the cake <span className="font-normal text-cocoa">(optional)</span></label>
            <input
              id="msg"
              maxLength={40}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Happy Birthday Aoife"
              className="mt-2 block min-h-12 w-full rounded-none border border-rye/25 bg-flour px-3 text-base"
            />
            <p className="mt-2 text-xs text-cocoa">Personalisation options to be confirmed with the bakery.</p>
          </div>
        )}

        {step === 2 && (
          <dl className="divide-y divide-rye/10 text-sm">
            {[
              ["Cake", productName],
              ["Collect from", storeLabel ?? "—"],
              ["Date", date || "—"],
              ["Message", message || "None"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-2.5">
                <dt className="text-cocoa">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex items-center gap-3 pt-1">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-12 px-4 text-sm underline underline-offset-4">
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={!canContinue}
            className="ml-auto inline-flex min-h-12 items-center rounded-full bg-rye px-6 text-sm font-medium text-cream transition-colors hover:bg-crust-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === 2 ? "Continue to payment (demo)" : "Continue"}
          </button>
        </div>
        <p className="text-[0.72rem] text-cocoa">Demonstration only — no order is placed and nothing is sent.</p>
      </div>
    </form>
  );
}
