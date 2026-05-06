import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, XCircle, Calendar } from 'lucide-react'
import AnimatedCounter from './AnimatedCounter'

export default function HealthChart({ progress }) {
  const normalizeStatus = (status) => {
    const value = String(status || '').toLowerCase()
    if (value.includes('optimal') || value.includes('normal')) return 'optimal'
    if (value.includes('border') || value.includes('warn')) return 'warning'
    if (value.includes('critical') || value.includes('deficient') || value.includes('elevated')) return 'critical'
    return 'warning'
  }

  const healthMetrics = useMemo(() => {
    if (!progress || progress.length === 0) return null

    const uploadsWithBiomarkers = progress.filter(
      (upload) => Array.isArray(upload?.biomarkers) && upload.biomarkers.length > 0
    )
    if (uploadsWithBiomarkers.length === 0) return null

    const latest = uploadsWithBiomarkers[uploadsWithBiomarkers.length - 1]
    const previous = uploadsWithBiomarkers.length > 1 ? uploadsWithBiomarkers[uploadsWithBiomarkers.length - 2] : null

    const latestStats = {
      total: latest.biomarkers?.length || 0,
      optimal: latest.biomarkers?.filter(b => normalizeStatus(b.status) === 'optimal').length || 0,
      warning: latest.biomarkers?.filter(b => normalizeStatus(b.status) === 'warning').length || 0,
      critical: latest.biomarkers?.filter(b => normalizeStatus(b.status) === 'critical').length || 0,
    }

    const previousStats = previous ? {
      total: previous.biomarkers?.length || 0,
      optimal: previous.biomarkers?.filter(b => normalizeStatus(b.status) === 'optimal').length || 0,
      warning: previous.biomarkers?.filter(b => normalizeStatus(b.status) === 'warning').length || 0,
      critical: previous.biomarkers?.filter(b => normalizeStatus(b.status) === 'critical').length || 0,
    } : null

    // Calculate trend
    let trend = 'stable'
    let trendDirection = null
    if (previousStats) {
      const currentOptimalPercent = (latestStats.optimal / latestStats.total) * 100
      const previousOptimalPercent = (previousStats.optimal / previousStats.total) * 100
      const currentCriticalPercent = (latestStats.critical / latestStats.total) * 100
      const previousCriticalPercent = (previousStats.critical / previousStats.total) * 100

      if (currentOptimalPercent > previousOptimalPercent + 5) {
        trend = 'improving'
        trendDirection = 'up'
      } else if (currentCriticalPercent > previousCriticalPercent + 5) {
        trend = 'declining'
        trendDirection = 'down'
      }
    }

    return {
      latest: latestStats,
      previous: previousStats,
      trend,
      trendDirection,
      testDate: latest.test_date || latest.created_at?.split('T')[0] || null,
      totalLabs: uploadsWithBiomarkers.length,
      timeline: uploadsWithBiomarkers.slice(-5).reverse(),
    }
  }, [progress])

  const getStatusIcon = (status) => {
    switch (status) {
    case 'optimal': return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />
    case 'critical': return <XCircle className="w-4 h-4 text-red-600" />
    default: return <Minus className="w-4 h-4 text-gray-400" />
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
    case 'improving': return <TrendingUp className="w-5 h-5 text-green-600" />
    case 'declining': return <TrendingDown className="w-5 h-5 text-red-600" />
    default: return <Minus className="w-5 h-5 text-gray-400" />
    }
  }

  const getTrendColor = (trend) => {
    switch (trend) {
    case 'improving': return 'text-green-700 bg-green-50 border-green-200'
    case 'declining': return 'text-red-700 bg-red-50 border-red-200'
    default: return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  if (!healthMetrics) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center py-12 text-slate-400"
      >
        <Calendar className="w-8 h-8 mb-3" />
        <p className="mb-2">No health data available yet</p>
        <p className="text-sm">Upload your lab results to see trends and insights</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className={`rounded-xl border p-6 ${getTrendColor(healthMetrics.trend)} ${
          healthMetrics.trend === 'improving' ? 'cabinet-glow' : ''
        } transition-all duration-300`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getTrendIcon(healthMetrics.trend)}
            <div>
              <h3 className="font-semibold text-lg">
                {healthMetrics.trend === 'improving' && 'Health Improving'}
                {healthMetrics.trend === 'declining' && 'Health Declining'}
                {healthMetrics.trend === 'stable' && 'Health Stable'}
              </h3>
              <p className="text-sm opacity-80">
                Based on your latest lab results
                {healthMetrics.testDate && ` from ${new Date(healthMetrics.testDate).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {healthMetrics.latest.total > 0
                ? Math.round((healthMetrics.latest.optimal / healthMetrics.latest.total) * 100)
                : 0}%
            </div>
            <div className="text-xs opacity-70">Optimal biomarkers</div>
          </div>
        </div>
      </motion.div>

      {/* Biomarker Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-3">
            {getStatusIcon('optimal')}
            <span className="font-semibold text-green-800">Optimal</span>
          </div>
          <div className="text-3xl font-bold text-green-700 mb-1">
            <AnimatedCounter value={healthMetrics.latest.optimal} />
          </div>
          <div className="text-sm text-green-600">of {healthMetrics.latest.total} biomarkers</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.15 }}
          whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
          className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-3">
            {getStatusIcon('warning')}
            <span className="font-semibold text-yellow-800">Borderline</span>
          </div>
          <div className="text-3xl font-bold text-yellow-700 mb-1">
            <AnimatedCounter value={healthMetrics.latest.warning} />
          </div>
          <div className="text-sm text-yellow-600">need attention</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
          className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-6 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-3">
            {getStatusIcon('critical')}
            <span className="font-semibold text-red-800">Critical</span>
          </div>
          <div className="text-3xl font-bold text-red-700 mb-1">
            <AnimatedCounter value={healthMetrics.latest.critical} />
          </div>
          <div className="text-sm text-red-600">require action</div>
        </motion.div>
      </div>

      {/* Progress Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="cabinet-card p-6"
      >
        <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Lab Results Timeline
        </h4>
        <div className="space-y-2">
          {healthMetrics.timeline.map((lab, index) => {
            const optimalCount = lab.biomarkers?.filter(b => normalizeStatus(b.status) === 'optimal').length || 0
            const totalCount = lab.biomarkers?.length || 0
            const percentage = totalCount > 0 ? Math.round((optimalCount / totalCount) * 100) : 0

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ x: 4, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                className="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-100 transition-all"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2.5 h-2.5 bg-emerald-500 rounded-full"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {(() => {
                      const dateStr = lab.test_date || lab.created_at
                      if (!dateStr) return 'Recently uploaded'
                      try {
                        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      } catch {
                        return 'Recently uploaded'
                      }
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-slate-900">{optimalCount}/{totalCount}</div>
                  <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    percentage >= 70 ? 'bg-green-100 text-green-700' :
                      percentage >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                  }`}>
                    {percentage}%
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 text-center"
        >
          Total lab uploads: <span className="font-semibold text-slate-700">{healthMetrics.totalLabs}</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
