export function safeExtractTextFromOptimizerOutput(output: any): string | null {
  if (output?.message && typeof output.message === 'string') {
    return output.message;
  }

  const p0 = output?.proposals?.[0];
  if (p0?.message && typeof p0.message === 'string') {
    return p0.message;
  }

  return null;
}
