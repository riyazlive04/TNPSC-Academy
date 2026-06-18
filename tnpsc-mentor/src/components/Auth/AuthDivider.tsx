/** A horizontal "── or ──" separator between the email form and the Google
 * button on the auth screens. */
export default function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-line" />
      <span className="font-heading text-xs font-semibold uppercase tracking-wide text-ink2">
        {label}
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}
