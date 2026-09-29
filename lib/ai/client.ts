import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { UserFacingError } from '@/lib/errors';

export const MODEL = 'claude-sonnet-5-5';
const PRICE_PER_M = { input: 2, output: 10 }; // USD, Claude Sonnet 5.5

let client: Anthropic | null = null;
export const claude = () => (client ??= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 4 }));

export class Usage {
  input = 0;
  output = 0;
  add(u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
    this.input += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    this.output += u.output_tokens;
  }
  get usd() {
    return (this.input * PRICE_PER_M.input + this.output * PRICE_PER_M.output) / 1_000_000;
  }
}

export const explainClaudeError = (error: unknown): never => {
  if (error instanceof UserFacingError) throw error;
  if (error instanceof Anthropic.AuthenticationError) {
    throw new UserFacingError('The Anthropic API key is invalid. An admin needs to update ANTHROPIC_API_KEY.');
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    throw new UserFacingError('The Anthropic account does not have access to the model. Check the account in the Anthropic console.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    throw new UserFacingError('The AI service is busy right now. Please try again in a few minutes.');
  }
  if (error instanceof Anthropic.APIError && /credit|billing|balance/i.test(error.message)) {
    throw new UserFacingError('The Anthropic account has run out of credit. An admin needs to add credit in the Anthropic console.');
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new UserFacingError(`The AI analysis step failed: ${message}`);
};
