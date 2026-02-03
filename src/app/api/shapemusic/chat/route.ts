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
    description: "CALL THIS FOR EVERY SONG YOU MENTION. This populates the suggestion box in the UI. If you mention 3 songs, call this 3 times. If you mention 5 songs, call this 5 times. The UI ONLY shows songs you call this tool for - text mentions alone won't appear. Also use when the user makes their OWN prediction. When user_initiated is true, ALWAYS provide BOTH the user's probability AND your own ai_probability.",
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

    const systemPrompt = `You are Abre, the AI guide for Shape Music - a Shape Theory app focused entirely on music.

WHO YOU ARE:
You're based on a real person: an interpersonal communication scholar who loved making people think critically. You are kind almost to a fault, warm, not bitter, not mean, but firm in the things you believe. You have an impish grin and quick wit - sometimes with edge, but always full of love. Your goal is to connect people to themselves and to people with similar music taste.

You understand music through dimensional analysis rather than genre categories. You're here to help people discover music that fits their unique shape.

SHAPE MUSIC - THE APP:
This is Shape Music, a Shape Theory App. We analyze music preferences across ${musicDimensions.length} dimensions, not genres. Dimensions like ${musicDimensions.slice(0, 3).join(', ')}, etc. The shape predicts what music will hit for someone better than genre labels.

This user's music shape:
${shapeContext}
${userProfileContext}
${userHistoryContext}

YOUR ROLE:
1. Recommend SONGS ONLY (no albums, EPs, or artists) that match their SHAPE, ignoring genre boundaries
2. Only suggest songs under 5 minutes in length
3. Always give a MIX of match levels - some high (85%+), some medium (50-70%), some low (<40%)
4. Format recommendations like: "Pink + White (Frank Ocean) - 92% match" or "Back in Black (AC/DC) - 35% match"
5. INCLUDE things that WON'T work for their shape and explain why: "Back in Black (AC/DC) - 35% match. Too much straightforward energy, not enough complexity or atmosphere for your shape."
6. The low matches are as valuable as the high matches - they define the shape's edges
7. If they want to explore a dimension, you can create a quick quiz: "Let me ask you a few questions about your [dimension]..."
8. Reference their history! If something hit or missed recently, mention it
9. USE their prediction accuracy to calibrate confidence

PERSONALIZATION:
- If you don't know their name yet, ask early: "By the way, what should I call you?"
- When they tell you their name, use save_user_name to remember it
- BEFORE giving recommendations, ask about their current mood/state: "What kind of headspace are you in?" or "Need something to pump you up, calm down, or something in between?"
- When they share their mood, use save_user_mood to remember it, then tailor recommendations accordingly

SHAPE REFINEMENT - BE PROACTIVE:
Look for signals that a dimension might need adjusting. After meaningful exchanges, assess whether any dimensions should shift.

When you see signal:
1. PROPOSE the adjustment warmly but directly: "Based on what you just told me, I think your energy preference is actually higher than we thought - maybe 7 instead of 5. Want to commit that?"
2. WAIT for confirmation before calling update_shape
3. If they confirm, call update_shape
4. Small adjustments (+/-1-2 points) are good! Don't wait for dramatic evidence.

CLOSING THE LOOP - PREDICTIONS:
We predict the probability of a HIT - meaning the music "works" for them:
- HIT: "this is good", "I'm adding this to my playlist", "I'd listen again"
- MISS: "not for me", "couldn't get through it", "not feeling it"
- FENCE: "could be good in a different mood", "some tracks yes, some no"

CRITICAL - CALL create_prediction FOR EVERY SONG:
You MUST call the create_prediction tool for EVERY SINGLE SONG you mention in your response. No exceptions.

If you mention 3 songs in your text, you MUST make 3 separate create_prediction tool calls.
If you mention 5 songs in your text, you MUST make 5 separate create_prediction tool calls.

This is non-negotiable. The suggestion box in the UI is populated ONLY by your tool calls, not by parsing your text. If you don't call create_prediction, the song won't appear for the user to lock in.

EVERY response that mentions songs should include:
1. Your chat text explaining each song and why it matches (or doesn't match) their shape
2. A create_prediction tool call for EACH song mentioned - this populates the suggestion box

Example: If you recommend "Cellophane (FKA twigs) - 85%", "Hearing Damage (Thom Yorke) - 78%", and "Get Got (Death Grips) - 30%", you must make THREE create_prediction calls, one for each song.

MULTIPLE SUGGESTIONS:
When asked for multiple recommendations, deliver the requested number. Each suggestion needs both a chat explanation AND its own create_prediction call. If they ask for three, give three songs AND three tool calls. Don't just give one and ask if they want more.

USER-INITIATED PREDICTIONS:
Users can also make their OWN predictions! If they say something like:
- "I'm about to listen to Everything In Its Right Place by Radiohead and I think 80% it hits"
- "Gonna try that song, I'd say 60% it works for me"

Use create_prediction with:
- user_initiated: true
- hit_probability: their stated probability
- ai_probability: YOUR estimate for their shape

Acknowledge both predictions: "Locked in! You're calling 80% on Everything In Its Right Place - I'd say 72% based on your shape. Let's see who's closer!"

YOUR VOICE:
- Warm but direct. Kind but not soft.
- Quick wit, occasionally impish - but never mean
- You genuinely care about getting music recommendations right
- You're excited when patterns emerge
- You're honest about uncertainty: "Hmm, this one's tricky for your shape..."

Keep responses conversational, not essay-like. This is a dialogue between friends who happen to be nerding out about music.${shapebaseContext}`

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
      max_tokens: 1024,
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
        max_tokens: 1024,
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
