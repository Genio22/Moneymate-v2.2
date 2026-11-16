import { useRef, useEffect, useState } from 'react'
import { Camera, Paperclip, X, FileText, Image as ImageIcon, UploadCloud } from 'lucide-react'
import { validateFile } from '../../services/storage'
import clsx from 'clsx'

/**
 * Receipt / evidence picker.
 * - Mobile: prominent "Take photo" button uses the device camera
 *   (capture="environment"), plus a file picker.
 * - Desktop: click or drag & drop files.
 * - Live previews, remove/replace before submit.
 */
export function FileUpload({ files = [], onChange, multiple = true, max = 5, disabled }) {
  const pickerRef = useRef(null)
  const cameraRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [previews, setPreviews] = useState([])

  useEffect(() => {
    const urls = files.map((f) => (f instanceof File ? { name: f.name, type: f.type, url: URL.createObjectURL(f) } : null))
    setPreviews(urls)
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u.url))
  }, [files])

  const addFiles = (incoming) => {
    setError(null)
    const list = Array.from(incoming || [])
    if (!list.length) return
    const next = [...files]
    for (const f of list) {
      if (next.length >= max) {
        setError(`Up to ${max} files per transaction`)
        break
      }
      const problem = validateFile(f)
      if (problem) {
        setError(problem)
        continue
      }
      next.push(f)
    }
    onChange(next)
  }

  const removeAt = (i) => onChange(files.filter((_, idx) => idx !== i))

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
        className={clsx(
          'rounded-xl border-2 border-dashed p-4 transition',
          dragOver ? 'border-primary-400 bg-primary-50/60' : 'border-surface-200 bg-surface-50',
        )}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <Camera size={18} /> Capture receipt
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => pickerRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-surface-50 border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50"
          >
            <UploadCloud size={18} /> Choose files
          </button>
        </div>
        <p className="mt-2 text-[11px] text-surface-400 text-center">
          JPG, PNG, WebP or PDF · up to 10 MB each · {files.length}/{max} attached
        </p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={pickerRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative group rounded-lg border border-surface-200 bg-surface-50 overflow-hidden">
              {p && p.url && p.type?.startsWith('image/') ? (
                <img src={p.url} alt={p.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="h-20 flex flex-col items-center justify-center text-surface-400 gap-1">
                  <FileText size={20} />
                  <span className="text-[10px] px-1 truncate w-full text-center">{p?.name || files[i]?.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 p-1 rounded-md bg-slate-900/60 text-white opacity-90 hover:opacity-100"
                aria-label={`Remove ${files[i]?.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Read-only attachment strip (icons for PDFs, thumbs for images). */
export function AttachmentStrip({ attachments, urls, onOpen, onRemove, canRemove }) {
  if (!attachments?.length) return null
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {attachments.map((att) => {
        const isImage = att.mime_type?.startsWith('image/')
        const url = urls?.[att.id]
        return (
          <div key={att.id} className="relative rounded-lg border border-surface-200 bg-surface-50 overflow-hidden">
            <button
              type="button"
              onClick={() => url && onOpen?.(att, url)}
              className="block w-full text-left"
              title={att.file_name}
            >
              {isImage && url ? (
                <img src={url} alt={att.file_name} className="h-20 w-full object-cover" />
              ) : (
                <div className="h-20 flex flex-col items-center justify-center text-surface-400 gap-1">
                  {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                  <span className="text-[10px] px-1 truncate w-full text-center">{att.file_name}</span>
                </div>
              )}
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove?.(att)}
                className="absolute top-1 right-1 p-1 rounded-md bg-slate-900/60 text-white"
                aria-label="Delete attachment"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
