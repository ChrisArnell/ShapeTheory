'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

interface ShapeRadarProps {
  dimensions: Record<string, number>
  size?: number
}

// Shorter labels for the radar chart
const dimensionLabels: Record<string, string> = {
  darkness: 'Dark',
  intellectual_engagement: 'Intellect',
  sentimentality: 'Sentiment',
  absurdism: 'Absurd',
  craft_obsession: 'Craft',
  pandering_tolerance: 'Pandering',
  emotional_directness: 'Direct',
  vulnerability_appreciation: 'Vulnerable',
  novelty_seeking: 'Novelty',
  working_class_authenticity: 'Authentic'
}

export default function ShapeRadar({ dimensions, size = 200 }: ShapeRadarProps) {
  const data = Object.entries(dimensions).map(([key, value]) => ({
    dimension: dimensionLabels[key] || key,
    value: value,
    fullMark: 10
  }))

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#9CA3AF', fontSize: 9 }}
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
