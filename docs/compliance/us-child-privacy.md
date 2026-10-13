# Red Teddy Tutor: US child privacy position (October 2026)

This is an engineering record, not legal advice. It has not been reviewed by a lawyer.
It lists what the product does, which US laws are likely relevant, and what code alone
cannot settle.

## What the product collects
| Data | When | Where |
|---|---|---|
| Answers, hints used, mistake codes, settings | Always | Browser localStorage only, unless a parent signs in |
| Parent email | Parent signs in (email link) | Supabase (EU, Ireland) |
| Child nickname, age band, country, settings, answer records | Parent creates a profile and the child learns while signed in | Supabase, row-level security: only the parent's account can read |
| Tutor turn counts and token use (no text) | Signed-in tutor use | Supabase `rtt_tutor_usage` |
| Tutor messages (question, child's message, short history) | Signed-in tutor use | Sent to Anthropic via Vercel AI Gateway for a reply; not stored by Red Teddy |
| News-list email | An adult opts in | Supabase `rtt_waitlist` |

No birth dates, surnames, schools, photos, addresses or location. No advertising or
third-party analytics. Children cannot message other users.

## Laws likely relevant
- **COPPA** (children under 13). Answer records tied to a child profile, and the profile's
  persistent identifier, are probably "personal information collected from a child" once the
  child uses the signed-in app. COPPA then requires notice to parents and **verifiable parental
  consent** before collection, plus parental review and deletion rights.
  - Done in code: only a parent can create an account or a profile; children never enter
    contact details; parents can delete progress and profiles; data minimisation.
  - **Not settled by code:** whether email-link sign-in by the parent is an adequate consent
    method. Sending a child's tutor messages to an AI provider is a disclosure to a third
    party, which likely needs a stronger consent method than "email plus". **Action: legal
    review of the consent flow before marketing the signed-in tutor to under-13s.**
- **FERPA**: applies to schools and their education records. Red Teddy is sold to families,
  not schools, so it is not currently a school service provider. If schools adopt it, a
  data processing agreement and FERPA "school official" terms are needed.
- **State student privacy laws** (for example California SOPIPA and similar laws): mostly
  apply to services designed and marketed for K-12 school purposes. Same trigger as FERPA.
- **State consumer privacy laws covering teens** (for example California's CCPA rules for
  minors): no sale or sharing of personal information takes place; review if analytics or
  advertising are ever added.

## Open actions
1. Legal review of the parental consent method (COPPA), especially for the AI tutor.
2. A contact address for privacy and deletion requests (the privacy page currently asks
   parents to reply to an email).
3. A data processing agreement with the AI provider confirming no training on or retention
   of messages.
4. If schools become customers: FERPA and state student privacy terms.

## Readiness review, 13 October 2026
Engineering audit only. Nothing below is a legal conclusion.

**Technical safeguards verified on the live database (project kxzywyflylkcqoidiqmo):**
- RLS is on for every `rtt_*` table. Profiles, attempts and sessions are readable and
  writable only through the owning parent's `auth.uid()`; `anon` has no table grants.
- `rtt_entitlements` and `rtt_tutor_usage`: `authenticated` has SELECT only. A client cannot
  grant itself a paid plan or reset its tutor quota.
- Deleting a profile cascades to its attempts and sessions; deleting an auth user cascades
  to profiles.

**Fixed in this release:**
- Signing in no longer overwrites progress made on the device without an account.
- A synced child's device copy is now removed on sign-out, on sign-in expiry and when the
  profile is deleted (previously it stayed in localStorage and was shown as device progress).
- Privacy notice now discloses the device copy, the Ask Red Teddy mode, and that AI provider
  retention terms have not been reviewed.

**Needs qualified legal review before marketing to under-13s:**
1. COPPA applicability and the verifiable parental consent method. Email-link sign-in alone
   is likely insufficient once a child's free text is sent to an AI provider.
2. Disclosure of children's messages to Anthropic via Vercel AI Gateway: obtain written terms
   on retention and no-training; decide whether the tutor should be off by default for under-13s.
3. Retention schedule: records currently persist while the account exists; no inactivity
   deletion. COPPA requires keeping data only as long as reasonably necessary.
4. Self-serve parent account deletion: not built (needs a server-side function to delete the
   auth user). Today a parent must ask by email, and no privacy contact address is published.
5. Google Fonts: browsers contact Google on every page load (disclosed). Self-hosting the
   fonts would remove this third-party contact.
6. FERPA / state student privacy laws if schools become customers.
