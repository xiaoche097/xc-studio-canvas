type ResearchTelemetryEvent =
  | 'search.request'
  | 'search.success'
  | 'search.fail'
  | 'extract.request'
  | 'extract.success'
  | 'extract.fail'
  | 'rehost.request'
  | 'rehost.success'
  | 'rehost.fail';

export const logResearchTelemetry = (
  event: ResearchTelemetryEvent,
  details: Record<string, unknown>,
): void => {
  console.info(`[research] ${event}`, details);
};
