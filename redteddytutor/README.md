# Red Teddy Tutor landing page

Static page served for `redteddytutor.com` (see `vercel.json`).

## Early-access form
Not connected. `ENDPOINT` in `index.html` is empty, so submissions are validated
but NOT sent or stored, and the form tells the visitor so.

To connect: set `ENDPOINT` to an HTTPS URL that accepts
`POST {email, audience, consent}` as JSON, and add that origin to `connect-src`
in the root `vercel.json` CSP. Only collect email + optional audience (children may use the site).
