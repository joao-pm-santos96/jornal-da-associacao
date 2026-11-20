export function Falling({ emojis, count, burst = false }: { emojis: string[]; count: number; burst?: boolean }) {
  return (
    <div aria-hidden="true" className="jornal-falling pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="jornal-fall absolute top-0"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            animationDuration: `${(burst ? 3 : 9) + ((i * 7) % 6)}s`,
            animationDelay: `${(i * 13) % (burst ? 3 : 9)}s`,
            animationIterationCount: burst ? 2 : "infinite",
            fontSize: `${14 + ((i * 5) % 14)}px`,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  );
}
