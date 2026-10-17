import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="display text-6xl text-sea">404</p>
      <h1 className="mt-4 text-3xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-2 text-ink-2">It may have moved, or the business may not be listed yet.</p>
      <div className="mt-6 flex justify-center gap-2"><Link className="btn btn-primary" href="/search">Find a business</Link><Link className="btn btn-ghost" href="/">Home</Link></div>
    </div>
  );
}
