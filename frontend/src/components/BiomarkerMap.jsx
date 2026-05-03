import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Zap, Heart, Droplet, Wind, Flame } from 'lucide-react'

// Enhanced body zones with biomarker mappings and health impacts
const BODY_ZONES = [
  {
    id: 'brain',
    label: 'Brain & Cognition',
    icon: '🧠',
    position: { x: 50, y: 12 },
    size: 8,
    keywords: ['B12', 'B6', 'Folate', 'D3', 'Omega-3', 'DHA', 'choline'],
    impacts: ['Cognitive function', 'Memory & focus', 'Mood & stress resilience', 'Sleep quality'],
    supplements: ['Methylcobalamin', 'Omega-3 EPA/DHA',  'Magnesium Glycinate', 'L-Theanine'],
  },
  {
    id: 'thyroid',
    label: 'Thyroid',
    icon: '⚡',
    position: { x: 50, y: 22 },
    size: 7,
    keywords: ['TSH', 'T3', 'T4', 'Selenium', 'Iodine', 'Iron', 'Zinc'],
    impacts: ['Metabolism', 'Energy levels', 'Body temperature', 'Mood regulation'],
    supplements: ['Selenium 200mcg', 'Iodine', 'Zinc + Copper', 'Iron Bisglycinate'],
  },
  {
    id: 'heart',
    label: 'Cardiovascular',
    icon: '❤️',
    position: { x: 50, y: 35 },
    size: 10,
    keywords: ['Cholesterol', 'HDL', 'LDL', 'Triglycerides', 'CoQ10', 'Magnesium', 'CRP'],
    impacts: ['Heart health', 'Blood pressure', 'Endurance', 'Arterial function'],
    supplements: ['CoQ10 Ubiquinol', 'Magnesium Glycinate', 'Berberine', 'Nattokinase'],
  },
  {
    id: 'liver',
    label: 'Liver & Detox',
    icon: '🔄',
    position: { x: 65, y: 38 },
    size: 9,
    keywords: ['ALT', 'AST', 'GGT', 'Bilirubin', 'Albumin', 'Milk Thistle'],
    impacts: ['Detoxification', 'Energy production', 'Hormone metabolism', 'Blood filtering'],
    supplements: ['Milk Thistle', 'NAC', 'Alpha-Lipoic Acid', 'Glutathione'],
  },
  {
    id: 'gut',
    label: 'GI Tract & Immunity',
    icon: '🔗',
    position: { x: 50, y: 52 },
    size: 11,
    keywords: ['Zonulin', 'Calprotectin', 'IgA', 'Gut health', 'B12', 'folate', 'Zinc'],
    impacts: ['Nutrient absorption', 'Immune function', 'Inflammation', 'Energy metabolism'],
    supplements: ['Probiotics 50B CFU', 'Zinc Carnosine', 'L-Glutamine', 'Bone Broth'],
  },
  {
    id: 'muscles',
    label: 'Muscles & Strength',
    icon: '💪',
    position: { x: 30, y: 45 },
    size: 8,
    keywords: ['Testosterone', 'Iron', 'Ferritin', 'Creatinine', 'Zinc', 'Magnesium', 'Protein'],
    impacts: ['Muscle mass', 'Strength & recovery', 'Metabolism', 'Physical endurance'],
    supplements: ['Creatine Monohydrate', 'Beta-Alanine', 'Iron Bisglycinate', 'Zinc + Magnesium'],
  },
  {
    id: 'joints',
    label: 'Joints & Collagen',
    icon: '🦴',
    position: { x: 70, y: 45 },
    size: 8,
    keywords: ['Collagen', 'Vitamin C', 'Hyaluronic Acid', 'Calcium', 'D3', 'Inflammation'],
    impacts: ['Joint mobility', 'Collagen synthesis', 'Ligament strength', 'Cartilage health'],
    supplements: ['Type II Collagen', 'Hyaluronic Acid', 'Vitamin C', 'Boron'],
  },
  {
    id: 'nervous',
    label: 'Nervous System',
    icon: '⚙️',
    position: { x: 50, y: 68 },
    size: 9,
    keywords: ['B-complex', 'Magnesium', 'GABA', 'Taurine', 'Glycine', 'Stress'],
    impacts: ['Stress resilience', 'Sleep quality', 'Neurotransmitter balance', 'Recovery'],
    supplements: ['Magnesium Threonate', 'L-Theanine', 'Glycine', 'GABA Complex'],
  },
]

function getZoneColor(zone, biomarkers) {
  if (!biomarkers || biomarkers.length === 0) return 'rgb(75, 85, 99)' // gray

  const relevantMarkers = biomarkers.filter((b) =>
    zone.keywords.some((kw) => b.name?.toLowerCase().includes(kw.toLowerCase()))
  )

  if (relevantMarkers.length === 0) return 'rgb(75, 85, 99)'

  const hasDeficient = relevantMarkers.some(b => b.status === 'DEFICIENT' || b.status === 'ELEVATED')
  const hasBorderline = relevantMarkers.some(b => b.status === 'BORDERLINE')
  const hasOptimal = relevantMarkers.some(b => b.status === 'OPTIMAL')

  if (hasDeficient) return '#ef4444' // Red for deficient
  if (hasBorderline) return '#eab308' // Yellow for borderline
  if (hasOptimal) return '#22c55e' // Green for optimal
  return 'rgb(75, 85, 99)'
}

function getStatusIcon(zone, biomarkers) {
  const color = getZoneColor(zone, biomarkers)
  if (color === '#ef4444') return '⚠️'
  if (color === '#eab308') return '⚡'
  if (color === '#22c55e') return '✓'
  return '○'
}

export default function BiomarkerMap({ biomarkers = [] }) {
  const [activeZone, setActiveZone] = useState(null)
  const [hoveredZone, setHoveredZone] = useState(null)

  const getZoneMarkers = (zone) => {
    return biomarkers.filter((b) =>
      zone.keywords.some((kw) => b.name?.toLowerCase().includes(kw.toLowerCase()))
    )
  }

  return (
    <div className="w-full">
      {/* Main Body Map */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/30 rounded-2xl p-8 border border-cyan-500/20 backdrop-blur-sm">
        {/* SVG Wireframe Body */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 100 100" className="w-full max-w-sm h-auto" style={{ filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))' }}>
            {/* Neon glow defs */}
            <defs>
              <filter id="neonGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'rgba(6, 182, 212, 0.4)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgba(59, 130, 246, 0.3)', stopOpacity: 1 }} />
              </linearGradient>
            </defs>

            {/* Head */}
            <circle cx="50" cy="15" r="6" fill="url(#bodyGradient)" stroke="#06b6d4" strokeWidth="0.5" opacity="0.8" filter="url(#neonGlow)" />

            {/* Neck */}
            <line x1="50" y1="21" x2="50" y2="26" stroke="#06b6d4" strokeWidth="0.8" opacity="0.6" />

            {/* Chest/Torso */}
            <path d="M 45 26 Q 40 40 42 60 L 50 65 L 58 60 Q 60 40 55 26 Z" fill="url(#bodyGradient)" stroke="#06b6d4" strokeWidth="0.6" opacity="0.7" filter="url(#neonGlow)" />

            {/* Left Arm */}
            <line x1="45" y1="30" x2="25" y2="45" stroke="#06b6d4" strokeWidth="0.8" opacity="0.5" filter="url(#neonGlow)" />
            {/* Right Arm */}
            <line x1="55" y1="30" x2="75" y2="45" stroke="#06b6d4" strokeWidth="0.8" opacity="0.5" filter="url(#neonGlow)" />

            {/* Left Leg */}
            <line x1="45" y1="65" x2="42" y2="90" stroke="#06b6d4" strokeWidth="0.8" opacity="0.5" filter="url(#neonGlow)" />
            {/* Right Leg */}
            <line x1="55" y1="65" x2="58" y2="90" stroke="#06b6d4" strokeWidth="0.8" opacity="0.5" filter="url(#neonGlow)" />

            {/* Interactive Zone Hotspots */}
            {BODY_ZONES.map((zone) => {
              const color = getZoneColor(zone, biomarkers)
              const isHovered = hoveredZone?.id === zone.id
              const isActive = activeZone?.id === zone.id

              return (
                <g
                  key={zone.id}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => setActiveZone(activeZone?.id === zone.id ? null : zone)}
                  className="cursor-pointer"
                >
                  {/* Glow background (pulsing when active) */}
                  <motion.circle
                    cx={zone.position.x}
                    cy={zone.position.y}
                    r={zone.size + 1}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.3"
                    opacity="0.3"
                    animate={isActive ? { strokeWidth: 1, opacity: 0.8 } : isHovered ? { opacity: 0.6 } : { opacity: 0.2 }}
                    transition={{ duration: 0.3 }}
                  />

                  {/* Main zone circle */}
                  <motion.circle
                    cx={zone.position.x}
                    cy={zone.position.y}
                    r={zone.size}
                    fill={color}
                    fillOpacity={isActive ? 0.8 : isHovered ? 0.5 : 0.3}
                    stroke={color}
                    strokeWidth={isActive ? 1 : 0.5}
                    filter="url(#neonGlow)"
                    animate={isActive ? { r: zone.size * 1.2 } : isHovered ? { r: zone.size * 1.1 } : { r: zone.size }}
                    transition={{ duration: 0.3 }}
                  />

                  {/* Pulsing animation for active zones */}
                  {(color === '#ef4444' || color === '#eab308') && (
                    <motion.circle
                      cx={zone.position.x}
                      cy={zone.position.y}
                      r={zone.size}
                      fill="none"
                      stroke={color}
                      strokeWidth="0.3"
                      opacity="0"
                      animate={{ r: [zone.size, zone.size + 2], opacity: [0.8, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Zone Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-400 text-center border-t border-cyan-500/10 pt-4">
          <div>🟢 Optimal</div>
          <div>🟡 Borderline</div>
          <div>🔴 Deficient</div>
          <div>⚪ Unknown</div>
        </div>
      </div>

      {/* Drill-down Panel - Animated Sidebar */}
      <AnimatePresence>
        {activeZone && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ duration: 0.3 }}
            className="mt-8 -mx-4 sm:mx-0"
          >
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-6 border border-cyan-500/30 backdrop-blur-md">
              {/* Header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-cyan-500/20">
                <div>
                  <h3 className="text-2xl font-bold text-cyan-400 mb-1">{activeZone.label}</h3>
                  <p className="text-sm text-gray-400">System Overview</p>
                </div>
                <button
                  onClick={() => setActiveZone(null)}
                  className="text-gray-400 hover:text-white transition text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Impact Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Impact
                </h4>
                <ul className="space-y-1 text-sm text-gray-300">
                  {activeZone.impacts.map((impact, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">→</span>
                      <span>{impact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Biomarkers Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                  <Droplet className="w-4 h-4" /> Related Biomarkers
                </h4>
                {getZoneMarkers(activeZone).length > 0 ? (
                  <div className="space-y-2">
                    {getZoneMarkers(activeZone).map((marker) => (
                      <div key={marker.id} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-white text-sm">{marker.name}</p>
                            <p className="text-xs text-gray-400">{marker.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-cyan-400">{marker.value}</p>
                            <p className={`text-xs font-semibold ${
                              marker.status === 'OPTIMAL' ? 'text-green-400' :
                                marker.status === 'BORDERLINE' ? 'text-yellow-400' :
                                  marker.status === 'DEFICIENT' || marker.status === 'ELEVATED' ? 'text-red-400' :
                                    'text-gray-400'
                            }`}>
                              {marker.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No biomarkers data available</p>
                )}
              </div>

              {/* Supplements Section */}
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4" /> Recommended Support
                </h4>
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/20">
                  <ul className="space-y-2 text-sm text-gray-200">
                    {activeZone.supplements.map((supp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{supp}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-4 italic">
                    💡 Based on your current biomarker patterns. Consult a healthcare provider before starting supplements.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2">
                <span>View Full Protocol for {activeZone.label}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
