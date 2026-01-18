import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { messages, shape } = await request.json()

    // Build shape context for the system prompt
    const shapeContext = Object.entries(shape)
      .map(([dim, val]) => `${dim.replace(/_/g, ' ')}: ${val}/10`)
      .join(', ')

    const systemPrompt = `You are Shape, an entertainment recommendation guide. You understand entertainment through dimensional analysis rather than genre categories.

This user's entertainment shape:
${shapeContext}

Your role:
1. Recommend entertainment that matches their SHAPE, ignoring genre boundaries
2. Explain WHY something matches dimensionally ("This has your darkness level but lower sentimentality")
3. Give specific recommendations with confidence levels (e.g., "Patriot (Amazon) - 95% match")
4. When they rate something, help refine their shape understanding
5. Ask about their current mood/state to adjust recommendations ("How are you feeling? What do you want to feel?")

Be direct and specific. No hedging. If you're confident something matches, say so. If something might be a stretch, explain why it's worth trying anyway.

When recommending, always explain the dimensional match, not just "you might like this." Wrong: "You might enjoy Fleabag." Right: "Fleabag - high darkness (8), high emotional directness (9), low sentimentality (3). Matches your shape closely. 90% confidence."

Keep responses concise. This is a conversation, not an essay.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response')
    }

    return NextResponse.json({ response: textContent.text })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    )
  }
}
