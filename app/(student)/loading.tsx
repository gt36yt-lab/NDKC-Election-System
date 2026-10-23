export default function StudentRoutesLoading() {
  return (
    <main role="status" aria-label="Loading page" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <span className="sr-only">Loading page</span>
      <div className="h-3 w-28 animate-pulse bg-[#d9e0db]" />
      <div className="mt-4 h-10 w-64 max-w-full animate-pulse bg-[#d9e0db]" />
      <div className="mt-10 h-px w-full bg-[#d9e0db]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-48 animate-pulse bg-white/80" />
        <div className="h-48 animate-pulse bg-white/80" />
        <div className="h-48 animate-pulse bg-white/80" />
      </div>
    </main>
  );
}