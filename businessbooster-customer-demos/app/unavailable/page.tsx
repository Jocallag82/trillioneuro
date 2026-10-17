export const metadata = { title: "Demonstration unavailable · BusinessBooster.ie" };

export default function Unavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="font-serif text-3xl tracking-tight">This demonstration is no longer available</h1>
      <p className="mt-3 text-neutral-600">It has been paused or withdrawn by BusinessBooster.ie.</p>
      <form action="/logout" method="post" className="mt-8">
        <button type="submit" className="text-sm underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
