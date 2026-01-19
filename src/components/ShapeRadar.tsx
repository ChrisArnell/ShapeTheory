'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

interface ShapeRadarProps {
  dimensions: Record<string, number>
  size?: number
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

export default function ShapeRadar({ dimensions, size = 150 }: ShapeRadarProps) {
  const data = Object.entries(dimensions).map(([key, value]) => ({
    dimension: dimensionLabels[key] || key,
    value: value,
    fullMark: 10
  }))

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
          />
          <Radar
            name="Shape"
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.4}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
