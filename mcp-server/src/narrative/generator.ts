import Anthropic from '@anthropic-ai/sdk';
import { UserProfile, ScoreResult } from '../types';
import { PlatformAverages } from './types';
import { SYSTEM_PROMPT, buildUserMessage } from './promptTemplate';

export async function generateNarrative(
  profile: UserProfile,
  scoreResult: ScoreResult,
  platformAverages: PlatformAverages
): Promise<string> {
  try {
    const client = new Anthropic();

    const userMessage = buildUserMessage(profile, scoreResult, platformAverages);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return text || '[Narrative generation returned empty response]';
  } catch (error: any) {
    return `[Narrative generation unavailable: ${error.message || String(error)}]`;
  }
}
