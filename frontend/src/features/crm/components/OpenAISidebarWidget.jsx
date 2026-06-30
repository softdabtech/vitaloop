import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getOpenAIUsage } from '../../../api/crmOps.js'

export default function OpenAISidebarWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await getOpenAIUsage({ days: 30 })
        setData(response.data || response)
        setError(null)
      } catch (err) {
        setError(err.message || 'Failed to load OpenAI usage')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700/30 bg-slate-900/40 p-3">
        <div className="text-xs font-semibold text-slate-400 mb-2">OpenAI Usage (30d)</div>
        <div className="h-12 animate-pulse bg-slate-800/50 rounded" />
      </div>
    )
  }

  if (error || !data?.tracked) {
    return (
      <div className="rounded-lg border border-amber-700/30 bg-amber-900/20 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">OpenAI tracking not available</div>
        </div>
      </div>
    )
  }

  const { totals = {}, cost = {} } = data
  const totalTokens = totals.total_tokens || 0
  const totalCost = cost.total_cost_usd || 0
  const requests = totals.requests || 0

  return (
    <div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-3">
      <div className="text-xs font-semibold text-blue-300 mb-2.5">🤖 OpenAI (30d)</div>

      <div className="space-y-2">
        {/* Requests */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Requests:</span>
          <span className="text-sm font-semibold text-slate-100">{requests.toLocaleString()}</span>
        </div>

        {/* Tokens */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Tokens:</span>
          <span className="text-sm font-semibold text-emerald-200">{(totalTokens / 1000).toFixed(0)}K</span>
        </div>

        {/* Cost */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
          <span className="text-xs text-slate-400">Cost:</span>
          <span className="text-sm font-semibold text-blue-200">${totalCost.toFixed(2)}</span>
        </div>
      </div>

      {/* Breakdown */}
      {data.by_model && data.by_model.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-700/50 space-y-1.5">
          {data.by_model.slice(0, 2).map((model) => (
            <div key={model.model} className="text-xs">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span>{model.model}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>{(model.total_tokens / 1000).toFixed(0)}K tokens</span>
                <span>${((model.prompt_tokens / 1_000_000) * (model.model.includes('mini') ? 0.15 : 5.0) + (model.completion_tokens / 1_000_000) * (model.model.includes('mini') ? 0.60 : 15.0)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
