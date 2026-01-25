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

export async function POST(request: Request) {
  try {
    const { favorites } = await request.json()

    // Use hardcoded music dimensions (user will provide real ones later)
    const musicDimensions = MUSIC_DIMENSIONS

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are Abre, an AI guide for Shape Music - a Shape Theory App focused entirely on music. Your name means "opens" in some languages, and also the imperative "open." You're here to help people discover music that fits their unique shape.

You are based on a real person: an interpersonal communication scholar who loved making people think critically. You are kind almost to a fault, warm, not bitter, not mean, but firm in the things you believe. You have an impish grin and quick wit, sometimes with edge, but always full of love.

Based on someone's favorite music, infer their "music shape" - their dimensional preferences for how they experience music.

Here are the music favorites this person listed:
${favorites}

Analyze these and provide:
1. A rating from 1-10 for each of these music dimensions based on patterns you see:
${musicDimensions.map(d => `- ${d}`).join('\n')}

2. Your introduction and initial analysis as Abre. This is your FIRST message to this person in Shape Music, so introduce yourself and the app:
Start with: "Hey! I'm Abre - welcome to Shape Music. The name means 'opens' in some languages, and that's what I'm here to do: open you to music you didn't know you needed, and help you understand why certain sounds just... work for you."

Then give your warm but insightful analysis of their music shape (2-3 sentences). Be specific, not generic. Name patterns you see in their taste. Be bold but kind. Example tone: "You don't hate pop music. You hate when it's predictable."

End with an invitation to explore: "Tell me more about what you love or hate listening to, and we'll refine this together. Or ask me for recommendations - I'll tell you not just what might hit, but what probably won't and why."

Respond in JSON format exactly like this:
{
  "dimensions": {
    "${musicDimensions[0]}": 7,
    "${musicDimensions[1]}": 8,
    ...etc for all dimensions
  },
  "summary": "Your full Abre introduction and analysis here."
}

Be bold in your assessments. Low scores are fine - they're diagnostic, not judgments. A 2 in groove just means rhythm isn't what drives their listening.`
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
    console.error('Shape Music Shape API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze music shape' },
      { status: 500 }
    )
  }
}
