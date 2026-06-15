/**
 * Renders the figure(s) attached to a question stem (dice diagrams, figure-
 * counting images, seating layouts, …). Images are public URLs from the
 * Supabase Storage `question-images` bucket. Returns null when a question has
 * no figures, so it's safe to drop in unconditionally.
 */
export default function QuestionFigures({
  images,
  className = '',
}: {
  images?: string[] | null
  className?: string
}) {
  if (!images || images.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Figure ${i + 1}`}
          loading="lazy"
          className="max-h-64 w-auto max-w-full rounded-lg border border-navytext/10 bg-white object-contain p-1"
        />
      ))}
    </div>
  )
}
