import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold">404</p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">Page not found</h1>
      <Link href="/" className="mt-8 text-sm underline underline-offset-4">BusinessBooster.ie</Link>
    </main>
  );
}
