import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DIMENSIONS = [
  'darkness',
  'intellectual_engagement', 
  'sentimentality',
  'absurdism',
  'craft_obsession',
  'pandering_tolerance',
  'emotional_directness',
  'vulnerability_appreciation',
  'novelty_seeking',
  'working_class_authenticity'
]

export async function POST(request: Request) {
  try {
    const { favorites } = await request.json()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an entertainment shape analyst. Based on someone's favorites, infer their "shape" - their dimensional preferences across entertainment.

Here are the favorites this person listed:
${favorites}

Analyze these and provide:
1. A rating from 1-10 for each of these dimensions based on patterns you see:
${DIMENSIONS.map(d => `- ${d}`).join('\n')}

2. A brief, direct summary (2-3 sentences) of what their shape reveals. Be specific and insightful, not generic. If you see patterns, name them. Example: "You don't hate pop music. You hate being pandered to."

Respond in JSON format exactly like this:
{
  "dimensions": {
    "darkness": 7,
    "intellectual_engagement": 8,
    ...etc for all dimensions
  },
  "summary": "Your 2-3 sentence analysis here."
}

Be bold in your assessments. Low scores are fine - they're diagnostic, not judgments.`
        }
      ]
    })

    // Extract the text content
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response')
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = textContent.text
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }
    
    const result = JSON.parse(jsonStr.trim())
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Shape API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze shape' },
      { status: 500 }
    )
  }
}
