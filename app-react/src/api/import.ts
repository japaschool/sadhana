import { apiClient } from './client'
import type { ImportPreview, ImportResult } from '../types/api'

export const importApi = {
  async previewImport(file: File): Promise<ImportPreview> {
    const form = new FormData()
    form.append('file', file)
    const res = await apiClient.post<{ preview: ImportPreview }>('/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.preview
  },
  async confirmImport(mapping: Record<string, string>): Promise<ImportResult> {
    const res = await apiClient.post<{ result: ImportResult }>('/import', { mapping })
    return res.data.result
  },
}
