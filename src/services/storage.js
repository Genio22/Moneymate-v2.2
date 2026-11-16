import { supabase } from '../lib/supabase'
import { q } from './api'
import { MAX_FILE_SIZE_MB, ACCEPTED_FILE_TYPES } from '../constants'

const RECEIPTS_BUCKET = 'receipts'

export function validateFile(file) {
  if (!file) return 'No file selected'
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_FILE_SIZE_MB} MB`
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return `"${file.name}" is not a supported file type (JPG, PNG, WebP or PDF)`
  return null
}

export function safeFileName(file) {
  const base = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 80)
  return `${Date.now()}_${base}`
}

/**
 * Upload receipt files for a transaction and register them in
 * transaction_attachments. Path convention (matches storage policies):
 *   {project_id}/{user_id}/{transaction_type}/{transaction_id}/{filename}
 */
export async function uploadReceipts(projectId, txType, txId, files) {
  const user = (await supabase.auth.getUser()).data.user
  const saved = []
  for (const file of files) {
    const problem = validateFile(file)
    if (problem) throw new Error(problem)
    const path = `${projectId}/${user.id}/${txType}/${txId}/${safeFileName(file)}`
    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const { data: att, error: dbErr } = await supabase
      .from('transaction_attachments')
      .insert({
        transaction_type: txType,
        transaction_id: txId,
        project_id: projectId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select('*')
      .single()
    if (dbErr) throw dbErr
    saved.push(att)
  }
  return saved
}

/** Signed, access-controlled URLs (never public). */
export async function getAttachmentUrls(attachments, expiresIn = 60 * 30) {
  const urls = {}
  await Promise.all(
    attachments.map(async (att) => {
      const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(att.storage_path, expiresIn)
      urls[att.id] = error ? null : data?.signedUrl || null
    }),
  )
  return urls
}

export async function deleteAttachment(attachment) {
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([attachment.storage_path])
  if (error) throw error
  return q(supabase.from('transaction_attachments').delete().eq('id', attachment.id))
}

/** Upload a project logo/image (optional, stored in the public project-images bucket). */
export async function uploadProjectImage(projectId, file) {
  const problem = validateFile(file)
  if (problem) throw new Error(problem)
  const ext = file.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
  const path = `projects/${projectId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('project-images').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl
}

export const receiptsBucket = RECEIPTS_BUCKET
