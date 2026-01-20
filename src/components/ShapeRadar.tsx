'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

interface ShapeRadarProps {
  dimensions: Record<string, number>
  size?: number
  highlightedDimensions?: string[]
  glowIntensity?: number // 0-1, for animation
}

// Short 1-2 letter labels for the radar chart
const dimensionLabels: Record<string, string> = {
  darkness: 'Dk',
  intellectual_engagement: 'IQ',
  sentimentality: 'St',
  absurdism: 'Ab',
  craft_obsession: 'Cr',
  pandering_tolerance: 'Pn',
  emotional_directness: 'Ed',
  vulnerability_appreciation: 'Vu',
  novelty_seeking: 'Nv',
  working_class_authenticity: 'Au'
}

// Full dimension names for mapping
const dimensionKeys = Object.keys(dimensionLabels)

export default function ShapeRadar({
  dimensions,
  size = 150,
  highlightedDimensions = [],
  glowIntensity = 0
}: ShapeRadarProps) {
  const data = Object.entries(dimensions).map(([key, value]) => ({
    dimension: dimensionLabels[key] || key,
    fullKey: key,
    value: value,
    fullMark: 10,
    isHighlighted: highlightedDimensions.includes(key)
  }))

  // Custom tick renderer to highlight changed dimensions
  const renderTick = (props: any) => {
    const { payload, x, y, textAnchor } = props
    const dataPoint = data.find(d => d.dimension === payload.value)
    const isHighlighted = dataPoint?.isHighlighted && glowIntensity > 0

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={isHighlighted ? '#F59E0B' : '#9CA3AF'}
        fontSize={10}
        fontWeight={isHighlighted ? 'bold' : 'normal'}
        style={{
          filter: isHighlighted ? `drop-shadow(0 0 ${4 * glowIntensity}px #F59E0B)` : 'none',
          transition: 'all 0.3s ease'
        }}
      >
        {payload.value}
      </text>
    )
  }

  // Glow filter for the radar shape
  const glowFilter = glowIntensity > 0
    ? `drop-shadow(0 0 ${8 * glowIntensity}px #3B82F6) drop-shadow(0 0 ${16 * glowIntensity}px #3B82F6)`
    : 'none'

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={renderTick}
          />
          <Radar
            name="Shape"
            dataKey="value"
            stroke={glowIntensity > 0 ? '#60A5FA' : '#3B82F6'}
            fill={glowIntensity > 0 ? '#60A5FA' : '#3B82F6'}
            fillOpacity={0.4 + (glowIntensity * 0.2)}
            strokeWidth={2 + (glowIntensity * 2)}
            style={{ filter: glowFilter, transition: 'all 0.3s ease' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
