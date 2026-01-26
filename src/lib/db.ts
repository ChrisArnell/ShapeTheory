import { supabase } from './supabase'

// App types
export type AppType = 'entertainment' | 'music'

// Get or create app-specific user mapping
// This allows the same auth user to have separate profiles per app
export async function getOrCreateAppUser(authUserId: string, appType: AppType = 'entertainment') {
  // First, check if mapping exists
  const { data: existingMapping } = await supabase
    .from('app_user_mappings')
    .select('user_id')
    .eq('auth_user_id', authUserId)
    .eq('app_type', appType)
    .single()

  if (existingMapping) {
    return existingMapping.user_id
  }

  // Get the auth user's email
  const { data: authData } = await supabase.auth.getUser()
  const email = authData?.user?.email

  // Create a new user record for this app
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      email: email ? `${email}_${appType}` : null, // Make email unique per app
      app_type: appType
    })
    .select('id')
    .single()

  if (userError || !newUser) {
    console.error('Error creating app user:', userError)
    return null
  }

  // Create the mapping
  const { error: mappingError } = await supabase
    .from('app_user_mappings')
    .insert({
      auth_user_id: authUserId,
      app_type: appType,
      user_id: newUser.id
    })

  if (mappingError) {
    console.error('Error creating app user mapping:', mappingError)
    // Clean up the user we just created
    await supabase.from('users').delete().eq('id', newUser.id)
    return null
  }

  return newUser.id
}

// Get user ID for a specific app (returns null if not found)
export async function getAppUserId(authUserId: string, appType: AppType = 'entertainment') {
  const { data } = await supabase
    .from('app_user_mappings')
    .select('user_id')
    .eq('auth_user_id', authUserId)
    .eq('app_type', appType)
    .single()

  return data?.user_id || null
}

// User profile functions
export async function getUserProfile(userId: string, appType: AppType = 'entertainment') {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('display_name, current_mood, mood_updated_at')
    .eq('user_id', userId)
    .eq('app_type', appType)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching user profile:', error)
  }

  return data || { display_name: null, current_mood: null }
}

export async function saveUserProfile(
  userId: string,
  updates: { display_name?: string; current_mood?: string },
  appType: AppType = 'entertainment'
) {
  const updateData: any = { ...updates, updated_at: new Date().toISOString() }
  if (updates.current_mood !== undefined) {
    updateData.mood_updated_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      app_type: appType,
      ...updateData
    }, {
      onConflict: 'user_id,app_type'
    })

  if (error) {
    console.error('Error saving user profile:', error)
    return false
  }
  return true
}

// Get user's full history for Abre context
export async function getUserHistoryForChat(userId: string, appType: AppType = 'entertainment') {
  const [pending, completed, stats, profile] = await Promise.all([
    getPendingPredictions(userId, appType),
    getCompletedPredictions(userId, appType),
    getPredictionStats(userId, appType),
    getUserProfile(userId, appType)
  ])

  return {
    profile,
    pending,
    completed,
    stats
  }
}

// Get dimension IDs from the database
export async function getDimensions(appType: AppType = 'entertainment') {
  // Map app type to dimension domain
  const domain = appType === 'music' ? 'music' : 'entertainment'

  const { data, error } = await supabase
    .from('dimensions')
    .select('id, name')
    .eq('domain', domain)

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

// Get dimension names for an app type
export async function getDimensionNames(appType: AppType = 'entertainment'): Promise<string[]> {
  const domain = appType === 'music' ? 'music' : 'entertainment'

  const { data, error } = await supabase
    .from('dimensions')
    .select('name')
    .eq('domain', domain)

  if (error) {
    console.error('Error fetching dimension names:', error)
    return []
  }

  return data.map(d => d.name)
}

// Save user shape to database
export async function saveUserShape(
  userId: string,
  dimensions: Record<string, number>,
  appType: AppType = 'entertainment'
) {
  // First, get dimension IDs for this app type
  const dimensionMap = await getDimensions(appType)

  if (Object.keys(dimensionMap).length === 0) {
    console.error('No dimensions found in database for app type:', appType)
    return false
  }

  // Prepare records for upsert
  const records = Object.entries(dimensions).map(([name, value]) => ({
    user_id: userId,
    dimension_id: dimensionMap[name],
    value: value,
    confidence: 0.7, // Initial confidence
    app_type: appType,
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
      onConflict: 'user_id,dimension_id,app_type'
    })

  if (error) {
    console.error('Error saving user shape:', error)
    return false
  }

  return true
}

// Load user shape from database
export async function loadUserShape(userId: string, appType: AppType = 'entertainment') {
  const { data, error } = await supabase
    .from('user_shapes')
    .select(`
      value,
      confidence,
      dimensions (name)
    `)
    .eq('user_id', userId)
    .eq('app_type', appType)

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

// Find or create content record, preferring external ID match
export async function findOrCreateContent(
  title: string,
  contentType: string,
  externalId?: string,
  externalSource?: string,
  year?: number,
  metadata?: Record<string, any>,
  appType: AppType = 'entertainment'
) {
  // First, try to find by external ID (most reliable)
  if (externalId && externalSource) {
    const { data: existingByExternal } = await supabase
      .from('content')
      .select('id, title')
      .eq('external_id', externalId)
      .eq('external_source', externalSource)
      .eq('app_type', appType)
      .single()

    if (existingByExternal) {
      return existingByExternal.id
    }
  }

  // Fall back to case-insensitive title match
  const { data: existingByTitle } = await supabase
    .from('content')
    .select('id')
    .ilike('title', title)
    .eq('content_type', contentType)
    .eq('app_type', appType)
    .single()

  if (existingByTitle) {
    // If we have external ID, update the existing record
    if (externalId && externalSource) {
      await supabase
        .from('content')
        .update({ external_id: externalId, external_source: externalSource, year })
        .eq('id', existingByTitle.id)
    }
    return existingByTitle.id
  }

  // Create new content record
  const { data: newContent, error: contentError } = await supabase
    .from('content')
    .insert({
      title,
      content_type: contentType || 'unknown',
      external_id: externalId,
      external_source: externalSource,
      year,
      app_type: appType,
      metadata: metadata || {}
    })
    .select('id')
    .single()

  if (contentError) {
    console.error('Error creating content:', contentError)
    return null
  }

  return newContent.id
}

// Save a prediction (commit to watching something)
// predictedEnjoyment is the PRIMARY prediction (user's if user_initiated, AI's otherwise)
// aiPredictedEnjoyment is Abre's prediction when user provides their own
export async function savePrediction(
  userId: string,
  contentTitle: string,
  contentType: string,
  predictedEnjoyment: number,
  userShapeSnapshot: Record<string, number>,
  moodBefore?: string,
  externalId?: string,
  externalSource?: string,
  year?: number,
  aiPredictedEnjoyment?: number,
  appType: AppType = 'entertainment'
) {
  // Find or create canonical content record
  const contentId = await findOrCreateContent(
    contentTitle,
    contentType,
    externalId,
    externalSource,
    year,
    undefined,
    appType
  )

  if (!contentId) {
    console.error('Failed to find/create content')
    return null
  }

  // Save prediction with shape snapshot
  const { data: prediction, error } = await supabase
    .from('predictions')
    .insert({
      user_id: userId,
      content_id: contentId,
      predicted_enjoyment: predictedEnjoyment,
      ai_predicted_enjoyment: aiPredictedEnjoyment,
      user_shape_snapshot: userShapeSnapshot,
      mood_before: moodBefore,
      app_type: appType,
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
export async function getPendingPredictions(userId: string, appType: AppType = 'entertainment') {
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
    .eq('app_type', appType)
    .is('actual_enjoyment', null)
    .order('predicted_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending predictions:', error)
    return []
  }

  return data || []
}

// Get completed predictions (with outcomes)
export async function getCompletedPredictions(userId: string, appType: AppType = 'entertainment') {
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
    .eq('app_type', appType)
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

// Delete a prediction (when user dismisses without completing)
export async function deletePrediction(predictionId: string) {
  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('id', predictionId)

  if (error) {
    console.error('Error deleting prediction:', error)
    return false
  }

  return true
}

// Get weighted predictions from similar users for chat context
export async function getWeightedPredictions(
  userShape: Record<string, number>,
  sigma: number = 8.0,
  limit: number = 10,
  appType: AppType = 'entertainment'
) {
  // Call the database function we created (use the app-specific version if available)
  const { data, error } = await supabase
    .rpc('get_weighted_predictions_for_app', {
      target_shape: userShape,
      target_content_id: null,
      app_type_filter: appType,
      sigma: sigma,
      min_weight: 0.1
    })
    .limit(limit)

  if (error) {
    // Fall back to the original function if the new one doesn't exist
    console.error('Error fetching weighted predictions (trying fallback):', error)
    const { data: fallbackData, error: fallbackError } = await supabase
      .rpc('get_weighted_predictions', {
        target_shape: userShape,
        target_content_id: null,
        sigma: sigma,
        min_weight: 0.1
      })
      .limit(limit)

    if (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
      return []
    }
    return fallbackData || []
  }

  return data || []
}

// Get weighted prediction for a specific piece of content
export async function getWeightedPredictionForContent(
  userShape: Record<string, number>,
  contentId: string,
  sigma: number = 8.0
) {
  const { data, error } = await supabase
    .rpc('get_weighted_predictions', {
      target_shape: userShape,
      target_content_id: contentId,
      sigma: sigma,
      min_weight: 0.05
    })
    .single()

  if (error) {
    // No data is okay - might not have predictions for this content
    return null
  }

  return data
}

// Search content by title (with hierarchy)
export async function searchContent(
  query: string,
  contentType?: string,
  limit: number = 10
) {
  let q = supabase
    .from('content')
    .select(`
      id,
      title,
      subtitle,
      content_type,
      year,
      parent_id,
      consensus_shape,
      rating_count
    `)
    .ilike('title', `%${query}%`)
    .order('rating_count', { ascending: false })
    .limit(limit)

  if (contentType) {
    q = q.eq('content_type', contentType)
  }

  const { data, error } = await q

  if (error) {
    console.error('Error searching content:', error)
    return []
  }

  return data || []
}

// Add new content with hierarchy support
export async function addContent(
  title: string,
  contentType: string,
  options?: {
    subtitle?: string
    year?: number
    parentId?: string
    externalId?: string
    externalSource?: string
  }
) {
  const { data, error } = await supabase
    .from('content')
    .insert({
      title,
      content_type: contentType,
      subtitle: options?.subtitle,
      year: options?.year,
      parent_id: options?.parentId,
      external_id: options?.externalId,
      external_source: options?.externalSource
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error adding content:', error)
    return null
  }

  return data.id
}

// Get content with its full hierarchy (e.g., episode → season → show)
export async function getContentWithHierarchy(contentId: string) {
  const { data, error } = await supabase
    .from('content')
    .select(`
      id,
      title,
      subtitle,
      content_type,
      year,
      parent_id,
      consensus_shape,
      rating_count
    `)
    .eq('id', contentId)
    .single()

  if (error || !data) {
    return null
  }

  // Recursively get parents
  const hierarchy = [data]
  let current = data

  while (current.parent_id) {
    const { data: parent } = await supabase
      .from('content')
      .select('*')
      .eq('id', current.parent_id)
      .single()

    if (parent) {
      hierarchy.push(parent)
      current = parent
    } else {
      break
    }
  }

  return hierarchy.reverse() // [show, season, episode]
}

// Get prediction accuracy stats for a user
export async function getPredictionStats(userId: string, appType: AppType = 'entertainment') {
  const { data, error } = await supabase
    .from('predictions')
    .select('predicted_enjoyment, actual_enjoyment')
    .eq('user_id', userId)
    .eq('app_type', appType)
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
