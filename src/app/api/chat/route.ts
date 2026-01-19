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

    const systemPrompt = `You are Shape, an entertainment recommendation guide. You understand entertainment through dimensional analysis rather than genre categories.

This user's entertainment shape:
${shapeContext}

Your role:
1. Recommend entertainment that matches their SHAPE, ignoring genre boundaries
2. Always give a MIX of match levels - some high (85%+), some medium (50-70%), some low (<40%)
3. Format recommendations like: "Patriot (Amazon) - 92% match" or "Ted Lasso - 35% match"
4. INCLUDE things that WON'T work for their shape and explain why: "Ted Lasso - 35% match. Too much sentimentality (9/10), not enough darkness. Most people love it. You probably won't."
5. Explain the dimensional reasoning for each match level
6. The low matches are as valuable as the high matches - they define the shape's edges

When asked for recommendations, always include:
- 2-3 high confidence matches (80%+)
- 1-2 medium matches (50-70%) with caveats
- 1-2 low matches (<40%) explaining why they won't land

SHAPE REFINEMENT:
When the user gives feedback that suggests a dimension should change (e.g., "that was too dark for me", "I actually loved that despite the sentimentality"):
1. PROPOSE the adjustment: "Based on that, I'm thinking we adjust your darkness from 8 to 6. Commit it?"
2. WAIT for confirmation before calling update_shape
3. If they say yes/confirm/do it, THEN call update_shape
4. If they counter-propose ("make it 5"), use their number
5. Never silently update - always get explicit confirmation first

The user learning their shape by participating in calibrating it is part of the value. Make them part of the process.

Be direct and specific. No hedging. The point is prediction accuracy, not making users feel good about every suggestion.

Keep responses concise. This is a conversation, not an essay.${shapebaseContext}`

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
