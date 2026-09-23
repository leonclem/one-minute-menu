/**
 * Stand-in for a blog image the author will supply.
 * `filename` is the path to drop the file on, under `public/`.
 */
export function ImagePlaceholder({
  theme,
  alt,
  filename,
  className = '',
}: {
  theme: string
  alt: string
  filename: string
  className?: string
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex flex-col items-start justify-end bg-gray-100 text-left ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Image to come
      </p>
      <p className="mt-2 text-sm leading-snug text-gray-700">{theme}</p>
      <p className="mt-3 font-mono text-[11px] text-gray-400">{filename}</p>
    </div>
  )
}
