"use client";

import { useState } from "react";

/**
 * Proposed trade-enquiry form. Demonstration only: values stay in component state,
 * nothing is transmitted or stored, and the form has no action URL.
 */
export function DemoEnquiryForm({ businessTypes, categories }: { businessTypes: string[]; categories: string[] }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div role="status" className="border border-oat/30 p-8">
        <p className="font-serif text-3xl text-cream">Thanks — this is where the enquiry would be sent.</p>
        <p className="mt-3 text-oat">
          In this concept nothing has been transmitted or stored. On a live site, the trade team would receive the enquiry
          and the business would get an instant confirmation email.
        </p>
        <button type="button" onClick={() => setDone(false)} className="mt-6 text-sm underline underline-offset-4">
          Back to the form
        </button>
      </div>
    );
  }

  const field = "mt-2 block min-h-12 w-full rounded-none border border-oat/30 bg-transparent px-3 text-base text-cream placeholder:text-oat/50 focus:border-cream";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.currentTarget.reset();
        setDone(true);
      }}
      className="grid gap-5 sm:grid-cols-2"
      aria-label="Trade enquiry (demonstration)"
    >
      <div>
        <label htmlFor="biz" className="text-sm font-medium">Business name</label>
        <input id="biz" name="biz" required autoComplete="off" className={field} />
      </div>
      <div>
        <label htmlFor="type" className="text-sm font-medium">Type of business</label>
        <select id="type" name="type" required defaultValue="" className={`${field} [&>option]:text-rye`}>
          <option value="" disabled>Select…</option>
          {businessTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="name" className="text-sm font-medium">Contact name</label>
        <input id="name" name="name" required autoComplete="off" className={field} />
      </div>
      <div>
        <label htmlFor="town" className="text-sm font-medium">Town / county</label>
        <input id="town" name="town" autoComplete="off" className={field} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Products of interest</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-oat/30 px-4 text-sm has-[:checked]:border-cream has-[:checked]:bg-cream has-[:checked]:text-rye">
              <input type="checkbox" name="products" value={c} className="sr-only" />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="text-sm font-medium">Tell us about your requirements</label>
        <textarea id="notes" name="notes" rows={4} className={`${field} py-3`} placeholder="Volumes, delivery days, fresh or frozen…" />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-oat">Demonstration only — nothing you type is sent or stored.</p>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-cream px-7 text-sm font-medium text-rye hover:bg-oat">
          Send enquiry (demo)
        </button>
      </div>
    </form>
  );
}
