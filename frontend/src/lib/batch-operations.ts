import api from './api'

export class BatchOperations {
  static async deleteMultipleUploads(uploadIds: string[]) {
    return Promise.all(
      uploadIds.map(id =>
        api.delete(`/uploads/${id}`).catch(err => ({ error: true, id, message: err.message }))
      )
    )
  }

  static async updateMultipleGoals(goals: string[]) {
    return api.patch('/profile', { goals }).catch(err => {
      throw new Error(`Failed to update goals: ${err.message}`)
    })
  }

  static async archiveMultipleResults(resultIds: string[]) {
    return Promise.all(
      resultIds.map(id =>
        api.patch(`/results/${id}`, { archived: true }).catch(err => ({ error: true, id }))
      )
    )
  }

  static async exportMultipleBiomarkers(uploadIds: string[]) {
    const results = await Promise.all(
      uploadIds.map(id =>
        api.get(`/results/${id}`).then(res => res.data?.biomarkers || []).catch(() => [])
      )
    )
    return results.flat()
  }

  static async shareBiomarkerReport(uploadId: string, emails: string[]) {
    return api.post(`/uploads/${uploadId}/share`, { recipients: emails })
  }
}
