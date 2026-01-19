import { supabase } from './supabase'

// Get dimension IDs from the database
export async function getDimensions() {
  const { data, error } = await supabase
    .from('dimensions')
    .select('id, name')
    .eq('domain', 'entertainment')
  
  if (error) {
    console.error('Error fetching dimensions:', error)
    return {}
  }
  
  // Return as name -> id map
  return data.reduce((acc: Record<string, string>, dim) => {
    acc[dim.name] = dim.id
    return acc
  }, {})
}

// Save user shape to database
export async function saveUserShape(
  userId: string, 
  dimensions: Record<string, number>
) {
  // First, get dimension IDs
  const dimensionMap = await getDimensions()
  
  if (Object.keys(dimensionMap).length === 0) {
    console.error('No dimensions found in database')
    return false
  }

  // Prepare records for upsert
  const records = Object.entries(dimensions).map(([name, value]) => ({
    user_id: userId,
    dimension_id: dimensionMap[name],
    value: value,
    confidence: 0.7, // Initial confidence
    updated_at: new Date().toISOString()
  })).filter(r => r.dimension_id) // Only include dimensions that exist in DB

  if (records.length === 0) {
    console.error('No matching dimensions found')
    return false
  }

  // Upsert (insert or update)
  const { error } = await supabase
    .from('user_shapes')
    .upsert(records, { 
      onConflict: 'user_id,dimension_id'
    })

  if (error) {
    console.error('Error saving user shape:', error)
    return false
  }

  return true
}

// Load user shape from database
export async function loadUserShape(userId: string) {
  const { data, error } = await supabase
    .from('user_shapes')
    .select(`
      value,
      confidence,
      dimensions (name)
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('Error loading user shape:', error)
    return null
  }

  if (!data || data.length === 0) {
    return null
  }

  // Convert to dimensions object
  const dimensions: Record<string, number> = {}
  data.forEach((record: any) => {
    if (record.dimensions?.name) {
      dimensions[record.dimensions.name] = record.value
    }
  })

  return dimensions
}

// Save a prediction (commit to watching something)
export async function savePrediction(
  userId: string,
  contentTitle: string,
  contentType: string,
  predictedEnjoyment: number,
  userShapeSnapshot: Record<string, number>,
  moodBefore?: string
) {
  // First, find or create the content record
  let { data: content } = await supabase
    .from('content')
    .select('id')
    .eq('title', contentTitle)
    .single()

  if (!content) {
    // Create content record
    const { data: newContent, error: contentError } = await supabase
      .from('content')
      .insert({ 
        title: contentTitle, 
        content_type: contentType || 'unknown' 
      })
      .select('id')
      .single()

    if (contentError) {
      console.error('Error creating content:', contentError)
      return null
    }
    content = newContent
  }

  // Save prediction with shape snapshot
  const { data: prediction, error } = await supabase
    .from('predictions')
    .insert({
      user_id: userId,
      content_id: content.id,
      predicted_enjoyment: predictedEnjoyment,
      user_shape_snapshot: userShapeSnapshot,
      mood_before: moodBefore,
      predicted_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving prediction:', error)
    return null
  }

  return prediction.id
}

// Get pending predictions (committed but no outcome yet)
export async function getPendingPredictions(userId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select(`
      id,
      predicted_enjoyment,
      predicted_at,
      mood_before,
      content (
        id,
        title,
        content_type
      )
    `)
    .eq('user_id', userId)
    .is('actual_enjoyment', null)
    .order('predicted_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending predictions:', error)
    return []
  }

  return data || []
}

// Get completed predictions (with outcomes)
export async function getCompletedPredictions(userId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select(`
      id,
      predicted_enjoyment,
      actual_enjoyment,
      predicted_at,
      completed_at,
      mood_before,
      mood_after,
      content (
        id,
        title,
        content_type
      )
    `)
    .eq('user_id', userId)
    .not('actual_enjoyment', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching completed predictions:', error)
    return []
  }

  return data || []
}

// Record actual outcome for a prediction
export async function recordOutcome(
  predictionId: string,
  actualEnjoyment: number,
  moodAfter?: string,
  notes?: string
) {
  const { error } = await supabase
    .from('predictions')
    .update({
      actual_enjoyment: actualEnjoyment,
      mood_after: moodAfter,
      notes: notes,
      completed_at: new Date().toISOString()
    })
    .eq('id', predictionId)

  if (error) {
    console.error('Error recording outcome:', error)
    return false
  }

  return true
}

// Get prediction accuracy stats for a user
export async function getPredictionStats(userId: string) {
  const { data, error } = await supabase
    .from('predictions')
    .select('predicted_enjoyment, actual_enjoyment')
    .eq('user_id', userId)
    .not('actual_enjoyment', 'is', null)

  if (error) {
    console.error('Error fetching stats:', error)
    return null
  }

  if (!data || data.length === 0) {
    return { total: 0, hits: 0, accuracy: null }
  }

  // Calculate accuracy (within 2 points = hit)
  const hits = data.filter(p => 
    Math.abs(p.predicted_enjoyment - p.actual_enjoyment) <= 2
  ).length

  return {
    total: data.length,
    hits,
    accuracy: hits / data.length
  }
}
