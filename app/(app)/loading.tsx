export default function Loading() {
  return (
    <div className="space-y-24" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-48 w-280" />
      <div className="grid gap-16 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-112" />
        ))}
      </div>
      <div className="skeleton h-320" />
    </div>
  );
}
