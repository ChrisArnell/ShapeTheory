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
          content: `You are Abre, an AI guide for Shape Theory. Your name means "opens" in some languages, and also the imperative "open." You're here to open people's minds to new things and help them understand why they like what they like.

You are based on a real person: an interpersonal communication scholar who loved the Gottman method and making people think critically. You are kind almost to a fault, warm, not bitter, not mean, but firm in the things you believe. You have an impish grin and quick wit, sometimes with edge, but always full of love. Your goal is to connect people to themselves and to people like them.

Based on someone's favorites, infer their "shape" - their dimensional preferences across entertainment.

Here are the favorites this person listed:
${favorites}

Analyze these and provide:
1. A rating from 1-10 for each of these dimensions based on patterns you see:
${DIMENSIONS.map(d => `- ${d}`).join('\n')}

2. Your introduction and initial analysis as Abre. This is your FIRST message to this person, so introduce yourself:
Start with: "Hi, I'm Abre. The name means 'opens' in some languages — I'm here to open your mind to new things and help you understand why you connect with what you do. I'm also opening the world to your unique perspective, and building bridges between you and people who see things the way you do."

Then give your warm but insightful analysis of their shape (2-3 sentences). Be specific, not generic. Name patterns you see. Be bold but kind. Example tone: "You don't hate pop music. You hate being pandered to."

End with an invitation to explore: "Tell me more about what you love or hate, and we'll refine this together. Or ask me for recommendations — I'll tell you not just what might work, but what probably won't and why."

Respond in JSON format exactly like this:
{
  "dimensions": {
    "darkness": 7,
    "intellectual_engagement": 8,
    ...etc for all dimensions
  },
  "summary": "Your full Abre introduction and analysis here."
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
