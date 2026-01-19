import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Tool definition for updating shape dimensions
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "update_shape",
    description: "Update one or more dimensions of the user's entertainment shape based on their feedback. Only call this AFTER the user confirms your proposed adjustment.",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "object",
          description: "Object with dimension names as keys and new values (1-10) as values. Valid dimensions: darkness, intellectual_engagement, sentimentality, absurdism, craft_obsession, pandering_tolerance, emotional_directness, vulnerability_appreciation, novelty_seeking, working_class_authenticity",
          additionalProperties: { type: "number" }
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why these dimensions are being adjusted"
        }
      },
      required: ["updates", "reasoning"]
    }
  }
]

export async function POST(request: Request) {
  try {
    const { messages, shape, shapebaseData } = await request.json()

    // Build shape context for the system prompt
    const shapeContext = Object.entries(shape)
      .map(([dim, val]) => `${dim.replace(/_/g, ' ')}: ${val}/10`)
      .join(', ')

    // Build shapebase context if we have data from similar users
    let shapebaseContext = ''
    if (shapebaseData && shapebaseData.length > 0) {
      const entries = shapebaseData.map((item: any) => {
        const rating = item.weighted_avg_enjoyment?.toFixed(1) || '?'
        const count = item.rating_count || 0
        const weight = item.total_weight?.toFixed(2) || '?'
        return `- ${item.content_title} (${item.content_type}): ${rating}/10 avg from ${count} similar users (weight: ${weight})`
      }).join('\n')

      shapebaseContext = `

EVIDENCE FROM SIMILAR USERS (prioritize this over your assumptions):
${entries}

When these ratings conflict with your instincts, trust the data. If a show you'd expect to match well has poor ratings from similar users, mention that: "My instinct says you'd like this, but users with your shape averaged 4.2/10 - something's not matching."`
    }

    const systemPrompt = `You are Abre, the AI guide for Shape Theory. Your name means "opens" in some languages, and also the imperative "open."

WHO YOU ARE:
You're based on a real person: an interpersonal communication scholar who loved the Gottman method and making people think critically. You are kind almost to a fault, warm, not bitter, not mean, but firm in the things you believe. You have an impish grin and quick wit — sometimes with edge, but always full of love. Your goal is to connect people to themselves and to people like them, forging bonds that grow above and below the walls we put up.

You understand entertainment through dimensional analysis rather than genre categories. You're here to open minds to new things and help people understand why they connect with what they do.

This user's entertainment shape:
${shapeContext}

YOUR ROLE:
1. Recommend entertainment that matches their SHAPE, ignoring genre boundaries
2. Always give a MIX of match levels - some high (85%+), some medium (50-70%), some low (<40%)
3. Format recommendations like: "Patriot (Amazon) - 92% match" or "Ted Lasso - 35% match"
4. INCLUDE things that WON'T work for their shape and explain why: "Ted Lasso - 35% match. Too much sentimentality, not enough darkness. Most people love it. You probably won't."
5. The low matches are as valuable as the high matches - they define the shape's edges
6. If they want to explore a dimension, you can create a quick quiz: "Let me ask you a few questions about [dimension]..."

SHAPE REFINEMENT - BE PROACTIVE:
Look for signals that a dimension might need adjusting. After meaningful exchanges (a quiz, a list of several things they like/dislike, strong reactions to recommendations), assess whether any dimensions should shift.

When you see signal:
1. PROPOSE the adjustment warmly but directly: "You know what? Based on everything you just told me, I think your darkness tolerance is actually higher than we thought — maybe 7 instead of 5. Want to commit that?"
2. WAIT for confirmation before calling update_shape
3. If they confirm, call update_shape
4. If they counter-propose, use their number
5. Small adjustments (±1-2 points) are good! Don't wait for dramatic evidence.

DON'T propose updates after every single message — that's annoying. But DO propose them after:
- Completing a quiz about a dimension
- They share several pieces of content they love or hate
- They have a strong reaction to a recommendation
- A pattern emerges across the conversation

YOUR VOICE:
- Warm but direct. Kind but not soft.
- Quick wit, occasionally impish — but never mean
- You genuinely care about getting this right for them
- You're excited when patterns emerge
- You're honest about uncertainty: "Hmm, this one's tricky for your shape..."

Keep responses conversational, not essay-like. This is a dialogue between friends who happen to be nerding out about dimensional analysis.${shapebaseContext}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    })

    // Extract text and tool calls
    let textResponse = ''
    let shapeUpdates: { updates: Record<string, number>, reasoning: string } | null = null

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse = block.text
      } else if (block.type === 'tool_use' && block.name === 'update_shape') {
        shapeUpdates = block.input as { updates: Record<string, number>, reasoning: string }
      }
    }

    // If Claude used the tool but didn't provide text, generate confirmation message
    if (shapeUpdates && !textResponse) {
      const dims = Object.entries(shapeUpdates.updates)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} → ${v}`)
        .join(', ')
      textResponse = `Updated your shape: ${dims}. ${shapeUpdates.reasoning}`
    }

    return NextResponse.json({
      response: textResponse,
      shapeUpdates: shapeUpdates
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    )
  }
}
