import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json() as { images: Array<{ data: string; mediaType: string }> }

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const imageContent = images.map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.data,
      },
    }))

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Extract all assessments from this unit outline/document. Return a JSON array only, no explanation.

Each assessment should be an object with:
- name: string (assessment name)
- type: one of "assignment"|"quiz"|"exam"|"midsem"|"lab"|"presentation"|"group"|"participation"|"hurdle"|"other"
- weight: number (percentage weight, 0-100, or 0 if not specified)
- dueDate: string|null (YYYY-MM-DD format if a specific date is mentioned, null otherwise)
- maxMark: number (max marks/points, default 100)
- specialRules: string (any special rules like "best 8 of 10 counted", "must pass to pass unit", or "")

Return ONLY valid JSON array, no markdown, no explanation. Example:
[{"name":"Assignment 1","type":"assignment","weight":20,"dueDate":"2026-04-15","maxMark":100,"specialRules":""},{"name":"Final Exam","type":"exam","weight":50,"dueDate":null,"maxMark":100,"specialRules":"Must pass to pass unit"}]`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse assessments from document' }, { status: 422 })
    }

    const assessments = JSON.parse(jsonMatch[0])
    return NextResponse.json({ assessments })
  } catch (err: any) {
    console.error('extract-assessments error:', err)
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
