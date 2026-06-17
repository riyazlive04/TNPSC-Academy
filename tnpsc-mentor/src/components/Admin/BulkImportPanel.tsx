import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from 'lucide-react'
import {
  bulkInsertQuestions,
  parseImportText,
  validateRows,
  type RowError,
} from '../../lib/importQuestions'

interface BulkImportPanelProps {
  onClose: () => void
  /** Called after a successful import with the number of rows inserted. */
  onImported: (count: number) => void
}

export default function BulkImportPanel({ onClose, onImported }: BulkImportPanelProps) {
  const [fileName, setFileName] = useState('')
  const [valid, setValid] = useState<Record<string, unknown>[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const reset = () => {
    setValid([])
    setErrors([])
    setParseError('')
    setImportError('')
    setDone(null)
  }

  const handleFile = async (file: File) => {
    reset()
    setFileName(file.name)
    const text = await file.text()
    const { rows, parseError: pErr } = parseImportText(file.name, text)
    if (pErr) {
      setParseError(pErr)
      return
    }
    const { valid: v, errors: e } = validateRows(rows)
    setValid(v)
    setErrors(e)
  }

  const handleImport = async () => {
    setImporting(true)
    setImportError('')
    try {
      const count = await bulkInsertQuestions(valid)
      setDone(count)
      onImported(count)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setImportError(
        msg.includes('not authorized') ? 'You are not authorised to import questions.' : `Import failed: ${msg}`
      )
    } finally {
      setImporting(false)
    }
  }

  const canImport = valid.length > 0 && errors.length === 0 && !done

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="animate-pop my-4 w-full max-w-xl rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-navytext">Bulk Import Questions</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink2 transition hover:bg-ink/5" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 font-body text-sm text-ink2">
          Upload a <strong>CSV</strong> or <strong>JSON</strong> file. Required columns:
          <code className="mx-1 rounded bg-canvas px-1 text-xs">category, question_text, option_a-d, correct_answer</code>.
          Every imported row is tagged <code className="rounded bg-canvas px-1 text-xs">tnpsc-official</code> so the old
          mock bank can be removed afterwards. See <code className="rounded bg-canvas px-1 text-xs">docs/IMPORT-FORMAT.md</code>.
        </p>

        {/* File picker */}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-canvas px-4 py-6 font-heading text-sm font-semibold text-ink2 transition hover:border-brand-ring hover:text-brand">
          <FileUp size={18} />
          {fileName || 'Choose a CSV or JSON file…'}
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>

        {/* Parse error */}
        {parseError && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-coralsoft px-3 py-2 font-body text-sm font-medium text-coral">
            <AlertTriangle size={16} /> {parseError}
          </p>
        )}

        {/* Summary */}
        {(valid.length > 0 || errors.length > 0) && !done && (
          <div className="mt-4 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap gap-4 font-body text-sm">
              <span className="font-semibold text-green-600">{valid.length} valid</span>
              <span className={errors.length ? 'font-semibold text-coral' : 'text-ink2'}>
                {errors.length} with errors
              </span>
            </div>

            {errors.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-coralsoft/50 p-3">
                <p className="mb-1 font-heading text-xs font-bold uppercase text-coral">
                  Fix these rows, then re-upload (import is all-or-nothing):
                </p>
                <ul className="space-y-1 font-body text-xs text-coral">
                  {errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      <span className="font-semibold">Row {e.row}:</span> {e.message}
                    </li>
                  ))}
                  {errors.length > 50 && <li>…and {errors.length - 50} more.</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {done !== null && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 font-body text-sm font-semibold text-green-700">
            <CheckCircle2 size={18} /> Imported {done} question{done === 1 ? '' : 's'} successfully.
          </p>
        )}

        {importError && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-coralsoft px-3 py-2 font-body text-sm font-medium text-coral">
            <AlertTriangle size={16} /> {importError}
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-line bg-card px-5 py-2.5 font-heading text-sm font-semibold text-ink2 transition hover:text-ink"
          >
            {done !== null ? 'Close' : 'Cancel'}
          </button>
          {done === null && (
            <button
              onClick={handleImport}
              disabled={!canImport || importing}
              className="btn-brand inline-flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-50"
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              Import {valid.length > 0 ? `${valid.length} ` : ''}question{valid.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
