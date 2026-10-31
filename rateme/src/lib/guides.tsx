import Link from 'next/link';
import type { ReactNode } from 'react';

export type Guide = { slug: string; audience: 'consumer' | 'business'; title: string; description: string; updated: string; body: ReactNode };

// Hand-written guides. Factual claims about Irish bodies are limited to well-established public
// registers and regulators; readers are pointed to the official source to check details.
export const GUIDES: Guide[] = [
  {
    slug: 'choosing-a-tradesperson-in-ireland', audience: 'consumer', updated: '2026-10-31',
    title: 'How to choose a reliable tradesperson in Ireland',
    description: 'A practical checklist for hiring an electrician, plumber, gas installer or builder in Ireland: registrations to check, quotes, reviews and paperwork.',
    body: (<>
      <p>Most bad experiences with trades come from skipping one of a few simple checks. This list takes about ten minutes per business.</p>
      <h2>1. Check the registration that applies to the job</h2>
      <ul>
        <li><strong>Electrical work</strong>: in Ireland, most electrical work must be done by a registered electrical contractor. Check the contractor on the Safe Electric register.</li>
        <li><strong>Gas work</strong>: gas installation and servicing must be done by a Registered Gas Installer. Check the RGII register.</li>
        <li><strong>Limited companies</strong>: you can look up a company’s registration on the CRO website.</li>
      </ul>
      <p>Ask for the registration number and check it yourself on the official register, rather than relying on a logo on a van or website.</p>
      <h2>2. Get two or three written quotes</h2>
      <p>A written quote should describe the work, materials, price including VAT, the expected start date and how long it will take. Be wary of large cash deposits before any work starts.</p>
      <h2>3. Read reviews the right way</h2>
      <ul>
        <li>Look at the <strong>number</strong> of reviews and how <strong>recent</strong> they are, not just the average.</li>
        <li>Read the negative reviews and the business’s replies. A calm, specific reply is a good sign.</li>
        <li>Look for detail that matches your job: a bathroom refit review tells you more about a bathroom refit than a review of a quick repair.</li>
      </ul>
      <p>On RateMe.ie, scores only appear once real customers have rated a business, and paid membership never changes a rating or the order of reviews. <Link href="/how-it-works">How ratings work</Link>.</p>
      <h2>4. Agree how changes and payments work</h2>
      <p>Agree in writing how extra work will be priced and approved, and when stage payments are due. Keep receipts and certificates (for example electrical or gas completion certs).</p>
      <h2>5. Know your rights</h2>
      <p>The Competition and Consumer Protection Commission (CCPC) publishes plain-language guidance on your rights when buying services in Ireland, including what to do when a service isn’t provided with reasonable care and skill.</p>
      <h2>After the job</h2>
      <p>Whether it went well or badly, <Link href="/search">rate the business</Link>. It takes about a minute, it’s free, and it helps the next person choose.</p>
    </>),
  },
  {
    slug: 'how-to-read-business-reviews', audience: 'consumer', updated: '2026-10-31',
    title: 'How to judge whether business reviews are trustworthy',
    description: 'Signs of genuine and suspicious reviews, what an average rating can and can’t tell you, and how review platforms should handle disputes.',
    body: (<>
      <h2>An average needs context</h2>
      <p>A 5.0 from two reviews tells you much less than a 4.6 from eighty. Always read the count and the dates alongside the score. That’s why RateMe.ie only includes businesses with at least five published reviews in its “Highest rated” lists.</p>
      <h2>Signs a review is more likely to be genuine</h2>
      <ul>
        <li>It describes a specific job, visit or product, and when it happened.</li>
        <li>It mentions both good and less good points.</li>
        <li>The reviewer’s other details (timing, type of experience) are consistent.</li>
      </ul>
      <h2>Warning signs</h2>
      <ul>
        <li>Many short, generic reviews posted in a few days.</li>
        <li>Reviews that read like adverts, or that attack a competitor by name.</li>
        <li>A platform that lets businesses pay to hide reviews or to appear higher.</li>
      </ul>
      <h2>Ask how the platform works</h2>
      <p>A trustworthy platform tells you who can post, what it checks, and what it can’t verify. RateMe.ie confirms every reviewer’s email, runs the same checks on 1-star and 5-star reviews, and says plainly that it does not verify purchases. <Link href="/review-policy">Read our review policy</Link>.</p>
    </>),
  },
  {
    slug: 'collecting-customer-reviews-fairly', audience: 'business', updated: '2026-10-31',
    title: 'How small businesses can collect customer reviews fairly',
    description: 'A practical, rule-abiding way for Irish small businesses to get more customer reviews: who to ask, when, how, and what to avoid.',
    body: (<>
      <p>Most happy customers never leave a review simply because nobody asked at the right moment. A short, consistent routine fixes that.</p>
      <h2>Ask everyone, the same way</h2>
      <p>Ask every customer, not just the ones you think are happy. Choosing who to ask (“review gating”) misleads future customers and breaks most review platforms’ rules, including ours.</p>
      <h2>Pick the moment</h2>
      <ul>
        <li><strong>Trades</strong>: when you finish the job and the customer has seen the result. Leave a card or send the link that evening.</li>
        <li><strong>Shops and salons</strong>: at the till, with a counter card next to the card machine.</li>
        <li><strong>Services by appointment</strong>: in the follow-up email or text.</li>
      </ul>
      <h2>Make it take one step</h2>
      <p>A QR code that opens your review form directly, or a link in a WhatsApp message, removes the effort. RateMe.ie members get a permanent QR code and printable kit (poster, counter cards, invoice slips and van artwork).</p>
      <h2>What not to do</h2>
      <ul>
        <li>Don’t offer discounts, gifts or prize draws in exchange for reviews.</li>
        <li>Don’t write reviews yourself or ask staff, friends or family to.</li>
        <li>Don’t ask customers to change or remove a rating.</li>
      </ul>
      <h2>Reply to what comes in</h2>
      <p>Thank people for positive reviews and answer negative ones calmly. Future customers read the replies. See <Link href="/guides/responding-to-a-negative-review">how to respond to a negative review</Link>.</p>
      <p><Link href="/for-business">See how RateMe.ie membership works</Link>.</p>
    </>),
  },
  {
    slug: 'responding-to-a-negative-review', audience: 'business', updated: '2026-10-31',
    title: 'How to respond to a negative customer review',
    description: 'A calm, effective way for Irish small businesses to reply to negative reviews, when to dispute one, and what to avoid.',
    body: (<>
      <p>Your reply is written for the next customer as much as for the reviewer. A good reply can make a negative review work in your favour.</p>
      <h2>A simple structure</h2>
      <ol>
        <li><strong>Thank them</strong> for taking the time to give feedback.</li>
        <li><strong>Acknowledge</strong> the specific problem without arguing about details in public.</li>
        <li><strong>Explain</strong> briefly what you have done or will do.</li>
        <li><strong>Offer</strong> a direct way to talk: a phone number or email address.</li>
      </ol>
      <h2>What to avoid</h2>
      <ul>
        <li>Replying in anger, or on the same day if you’re upset.</li>
        <li>Sharing the customer’s personal details or job specifics they didn’t mention.</li>
        <li>Accusing the reviewer of lying in public.</li>
      </ul>
      <h2>When to dispute instead</h2>
      <p>If you believe the review isn’t from a real customer, or it breaches the <Link href="/review-policy">review policy</Link>, verified owners can dispute it. On RateMe.ie a dispute asks the reviewer to reconfirm their review within 14 days. Disagreeing with an honest opinion isn’t grounds for a dispute.</p>
    </>),
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
