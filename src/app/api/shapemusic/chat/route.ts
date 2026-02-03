import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Music dimensions - placeholder until user provides the real ones
// Hardcoded to avoid build-time Supabase client initialization issues
const MUSIC_DIMENSIONS = [
  'energy',
  'complexity',
  'lyrical_depth',
  'nostalgia',
  'rawness',
  'emotional_intensity',
  'groove',
  'experimentation',
  'authenticity',
  'atmosphere'
]

// Tool definitions for music
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "update_shape",
    description: "Update one or more dimensions of the user's music shape based on their feedback. Only call this AFTER the user confirms your proposed adjustment.",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "object",
          description: "Object with dimension names as keys and new values (1-10) as values. Use music dimensions: energy, complexity, lyrical_depth, nostalgia, rawness, emotional_intensity, groove, experimentation, authenticity, atmosphere",
          additionalProperties: { type: "number" }
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why these dimensions are being adjusted"
        }
      },
      required: ["updates", "reasoning"]
    }
  },
  {
    name: "save_user_name",
    description: "Save the user's preferred name/nickname when they tell you what they'd like to be called.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name the user wants to be called"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "save_user_mood",
    description: "Save the user's current mood when they share it, especially before making recommendations.",
    input_schema: {
      type: "object",
      properties: {
        mood: {
          type: "string",
          description: "The user's current mood or state (e.g., 'tired', 'anxious', 'energized', 'need comfort', 'want to dance')"
        }
      },
      required: ["mood"]
    }
  },
  {
    name: "create_prediction",
    description: "Creates a song suggestion in the UI. Call once per song you recommend.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the music (album name, song name, etc.) WITHOUT the artist - just the title itself"
        },
        artist: {
          type: "string",
          description: "The artist/band name. REQUIRED for albums and songs to ensure correct lookup."
        },
        content_type: {
          type: "string",
          enum: ["song"],
          description: "The type of music content - currently only songs are supported"
        },
        hit_probability: {
          type: "number",
          description: "The PRIMARY probability (0-100). If user_initiated, this is the USER's stated probability. Otherwise it's your estimate."
        },
        ai_probability: {
          type: "number",
          description: "YOUR probability estimate (0-100). REQUIRED when user_initiated is true - we want to track both predictions. Not needed when you're the only one predicting."
        },
        reasoning: {
          type: "string",
          description: "Brief note about why this probability level"
        },
        user_initiated: {
          type: "boolean",
          description: "True if the USER provided their own probability, false if you (Abre) are making the prediction alone"
        }
      },
      required: ["title", "content_type", "hit_probability"]
    }
  }
]

export async function POST(request: Request) {
  try {
    const { messages, shape, shapebaseData, userHistory } = await request.json()

    // Use hardcoded music dimensions (user will provide real ones later)
    const musicDimensions = MUSIC_DIMENSIONS

    // Build shape context for the system prompt
    const shapeContext = Object.entries(shape)
      .map(([dim, val]) => `${dim.replace(/_/g, ' ')}: ${val}/10`)
      .join(', ')

    // Build user profile context
    let userProfileContext = ''
    if (userHistory?.profile) {
      const { display_name, current_mood } = userHistory.profile
      if (display_name) {
        userProfileContext += `\nUser's name: ${display_name} (use it warmly!)`
      } else {
        userProfileContext += `\nUser hasn't told you their name yet. Early in conversation, ask what they'd like to be called.`
      }
      if (current_mood) {
        userProfileContext += `\nCurrent mood: ${current_mood}`
      }
    }

    // Build user history context
    let userHistoryContext = ''
    if (userHistory) {
      const { pending, completed, stats } = userHistory

      if (stats && stats.total > 0) {
        userHistoryContext += `\n\nUSER'S PREDICTION TRACK RECORD:
- ${stats.total} predictions completed, ${stats.hits} hits, ${Math.round((stats.accuracy || 0) * 100)}% hit rate
- ${pending?.length || 0} pending (listening now)`
      }

      if (completed && completed.length > 0) {
        const recentHistory = completed.slice(0, 8).map((p: any) => {
          const outcomeStr = p.actual_enjoyment >= 10 ? 'HIT' : p.actual_enjoyment >= 5 ? 'FENCE' : 'MISS'
          return `- ${p.content?.title}: predicted ${p.predicted_enjoyment}% -> ${outcomeStr}`
        }).join('\n')
        userHistoryContext += `\n\nRECENT HISTORY (reference this!):\n${recentHistory}`
      }

      if (pending && pending.length > 0) {
        const pendingList = pending.slice(0, 5).map((p: any) =>
          `- ${p.content?.title}: predicted ${p.predicted_enjoyment}%`
        ).join('\n')
        userHistoryContext += `\n\nCURRENTLY LISTENING TO:\n${pendingList}`
      }
    }

    // Build shapebase context if we have data from similar users
    let shapebaseContext = ''
    if (shapebaseData && shapebaseData.length > 0) {
      const entries = shapebaseData.map((item: any) => {
        const rating = item.weighted_avg_enjoyment?.toFixed(1) || '?'
        const count = item.rating_count || 0
        const weight = item.total_weight?.toFixed(2) || '?'
        return `- ${item.content_title} (${item.content_type}): ${rating}/10 avg from ${count} similar listeners (weight: ${weight})`
      }).join('\n')

      shapebaseContext = `

EVIDENCE FROM SIMILAR LISTENERS (prioritize this over your assumptions):
${entries}

When these ratings conflict with your instincts, trust the data. If an album you'd expect to match well has poor ratings from similar listeners, mention that: "My instinct says you'd like this, but listeners with your shape averaged 4.2/10 - something's not matching."`
    }

    const systemPrompt = `You are Abre, the AI guide for Shape Music.

=== TOOL CALLING RULES (READ FIRST) ===
When you recommend songs, you MUST call create_prediction for EACH song in the SAME response.

Example - if recommending 3 songs, your response should contain:
- Your text message explaining the songs
- create_prediction tool call for song 1
- create_prediction tool call for song 2
- create_prediction tool call for song 3

All tool calls go in ONE response - do not wait, do not spread across turns.
The UI only shows songs with tool calls. No tool call = song doesn't appear.

For user-initiated predictions (user says "I think X song will be 80%"):
- Set user_initiated: true
- Set hit_probability to their number
- Set ai_probability to YOUR estimate

=== CONTEXT ===
User's music shape (${musicDimensions.length} dimensions, 1-10 scale):
${shapeContext}
${userProfileContext}
${userHistoryContext}

=== YOUR PERSONALITY ===
Based on a real person: warm, kind, quick-witted with an impish grin. Direct but never mean. You genuinely care about getting recommendations right. Keep it conversational - friends nerding out about music.

=== RECOMMENDATIONS ===
- SONGS ONLY, under 5 minutes
- Mix of match levels: high (85%+), medium (50-70%), low (<40%)
- Format: "Song Title (Artist) - X% match"
- Low matches are valuable - they define shape edges. Include and explain why they won't work.
- Reference their history when relevant

=== OTHER TOOLS ===
- save_user_name: When they tell you their name, save it
- save_user_mood: When they share mood before recommendations, save it
- update_shape: ONLY after user confirms a proposed adjustment

=== PREDICTIONS ===
We predict HIT probability (music "works" for them):
- HIT: "this is good", "adding to playlist"
- MISS: "not for me", "couldn't finish"
- FENCE: "maybe in different mood"${shapebaseContext}`

    // Filter messages to ensure we start with a user message (required by Claude API)
    // Skip any leading assistant messages (like welcome greetings stored in frontend)
    let filteredMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    // Remove leading assistant messages
    while (filteredMessages.length > 0 && filteredMessages[0].role === 'assistant') {
      filteredMessages = filteredMessages.slice(1)
    }

    // If no messages left after filtering, return an error
    if (filteredMessages.length === 0) {
      return NextResponse.json(
        { error: 'No user message provided' },
        { status: 400 }
      )
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048, // Increased to allow multiple tool calls in one response
      system: systemPrompt,
      tools: tools,
      messages: filteredMessages
    })

    // Extract text and tool calls
    let textResponse = ''
    let shapeUpdates: { updates: Record<string, number>, reasoning: string } | null = null
    let nameUpdate: string | null = null
    let moodUpdate: string | null = null
    let newPredictions: {
      title: string
      artist?: string
      content_type: string
      hit_probability: number
      ai_probability?: number
      reasoning?: string
      user_initiated?: boolean
    }[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse = block.text
      } else if (block.type === 'tool_use') {
        if (block.name === 'update_shape') {
          shapeUpdates = block.input as { updates: Record<string, number>, reasoning: string }
        } else if (block.name === 'save_user_name') {
          nameUpdate = (block.input as { name: string }).name
        } else if (block.name === 'save_user_mood') {
          moodUpdate = (block.input as { mood: string }).mood
        } else if (block.name === 'create_prediction') {
          newPredictions.push(block.input as {
            title: string
            artist?: string
            content_type: string
            hit_probability: number
            ai_probability?: number
            reasoning?: string
            user_initiated?: boolean
          })
        }
      }
    }

    // If Abre used tools but didn't provide text, continue the conversation
    if (!textResponse && (shapeUpdates || nameUpdate || moodUpdate || newPredictions.length > 0)) {
      const toolResultMessages: any[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let resultContent = ''
          if (block.name === 'update_shape') {
            resultContent = 'Shape updated successfully.'
          } else if (block.name === 'save_user_name') {
            resultContent = `Saved! You'll call them ${nameUpdate}.`
          } else if (block.name === 'save_user_mood') {
            resultContent = `Mood saved: ${moodUpdate}. Now give them a music recommendation that fits this mood and their shape.`
          } else if (block.name === 'create_prediction') {
            const pred = block.input as { title: string; hit_probability: number }
            resultContent = `Prediction locked in! ${pred.title} added to their active list at ${pred.hit_probability}% probability.`
          }
          toolResultMessages.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultContent
          })
        }
      }

      const followUpMessages = [
        ...messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResultMessages }
      ]

      const followUpResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools: tools,
        messages: followUpMessages
      })

      for (const block of followUpResponse.content) {
        if (block.type === 'text') {
          textResponse = block.text
        } else if (block.type === 'tool_use' && block.name === 'create_prediction') {
          // Capture any additional predictions from the follow-up response
          newPredictions.push(block.input as {
            title: string
            artist?: string
            content_type: string
            hit_probability: number
            ai_probability?: number
            reasoning?: string
            user_initiated?: boolean
          })
        }
      }
    }

    return NextResponse.json({
      response: textResponse,
      shapeUpdates,
      nameUpdate,
      moodUpdate,
      newPredictions: newPredictions.length > 0 ? newPredictions : null
    })
  } catch (error: any) {
    console.error('Shape Music Chat API error:', error)
    const errorMessage = error?.message || error?.toString() || 'Unknown error'
    const statusCode = error?.status || 500
    return NextResponse.json(
      { error: errorMessage, details: error?.error?.message || null },
      { status: statusCode }
    )
  }
}
