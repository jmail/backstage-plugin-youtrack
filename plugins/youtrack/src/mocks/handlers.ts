// msw stays a devDependency: these handlers are only imported from tests and
// the dev app, and src/ is not part of the published package (files: ["dist"]).
// eslint-disable-next-line @backstage/no-undeclared-imports
import { rest } from 'msw';
import { queryMockIssues } from './fixtures';

/**
 * msw handlers emulating the Backstage proxy route to YouTrack
 * (`GET <backend>/api/proxy/<proxyPath>/issues`). The handlers play the
 * combined role of proxy + YouTrack, so no Authorization header is expected
 * — in the real setup the proxy injects it server-side.
 */
export function createYouTrackHandlers(options: { proxyPath?: string } = {}) {
  const { proxyPath = '/youtrack' } = options;
  return [
    rest.get(`*/api/proxy${proxyPath}/issues`, (req, res, ctx) => {
      const query = req.url.searchParams.get('query') ?? '';
      const opens = (query.match(/\{/g) ?? []).length;
      const closes = (query.match(/\}/g) ?? []).length;
      if (opens !== closes) {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'bad_request',
            error_description: `Invalid query: ${query}`,
          }),
        );
      }
      const top = Number(req.url.searchParams.get('$top') ?? 42) || 42;
      const skip = Number(req.url.searchParams.get('$skip') ?? 0) || 0;
      return res(ctx.json(queryMockIssues(query, { top, skip })));
    }),
  ];
}

/** Handler that fails every issues request with the given status and body. */
export function createYouTrackErrorHandler(
  status: number,
  body: Record<string, unknown> = { error: 'error' },
  options: { proxyPath?: string } = {},
) {
  const { proxyPath = '/youtrack' } = options;
  return rest.get(`*/api/proxy${proxyPath}/issues`, (_req, res, ctx) =>
    res(ctx.status(status), ctx.json(body)),
  );
}

export const handlers = createYouTrackHandlers();
