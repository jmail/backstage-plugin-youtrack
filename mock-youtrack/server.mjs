#!/usr/bin/env node
/*
 * Minimal mock of the YouTrack REST API for interactive testing of
 * @jmail/backstage-plugin-youtrack. No dependencies, Node 18+.
 *
 * Implements GET /api/issues with:
 *   - `query`  — supports `tag: {value}`, `#Unresolved`, `sort by: updated desc`
 *   - `$top` / `$skip` — pagination
 *   - 401 when the Authorization: Bearer header is missing
 *   - 400 on a malformed query (unbalanced braces)
 *
 * Usage: node server.mjs   (PORT env var overrides the default 8090)
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8090);

const HOUR = 3_600_000;
const NOW = 1_755_000_000_000; // fixed reference time so fixtures are stable

/** Fixtures: 8 issues, mixed resolved/unresolved, tags, custom field shapes. */
const ISSUES = [
  {
    idReadable: 'DEMO-101',
    summary: 'Checkout button unresponsive on Safari',
    resolved: null,
    updated: NOW - 2 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:example'],
    customFields: [
      { name: 'State', value: { name: 'In Progress' } },
      { name: 'Assignee', value: { name: 'Alice Doe' } },
    ],
  },
  {
    idReadable: 'DEMO-102',
    summary: 'Payment webhook retries duplicate orders',
    resolved: null,
    updated: NOW - 5 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:example'],
    customFields: [
      { name: 'State', value: { name: 'Open' } },
      // multi-value field — the plugin must handle array values
      { name: 'Assignee', value: [{ name: 'Alice Doe' }, { name: 'Bob Roe' }] },
    ],
  },
  {
    idReadable: 'DEMO-103',
    summary: 'Migrate order service to Node 22',
    resolved: NOW - 30 * HOUR,
    updated: NOW - 30 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:example'],
    customFields: [
      { name: 'State', value: { name: 'Done' } },
      { name: 'Assignee', value: { name: 'Bob Roe' } },
    ],
  },
  {
    idReadable: 'DEMO-104',
    summary: 'Flaky e2e test: cart totals rounding',
    resolved: null,
    updated: NOW - 12 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:example'],
    // unassigned — Assignee value is null
    customFields: [
      { name: 'State', value: { name: 'Open' } },
      { name: 'Assignee', value: null },
    ],
  },
  {
    idReadable: 'OPS-7',
    summary: 'Zadanie z polskimi nazwami pól (localized field names)',
    resolved: null,
    updated: NOW - 1 * HOUR,
    project: { shortName: 'OPS' },
    tags: ['svc:example'],
    // localized custom field names — exercises the candidate-list config
    customFields: [
      { name: 'Stan', value: { name: 'W trakcie' } },
      { name: 'Wykonawca', value: { name: 'Celina Kowalska' } },
    ],
  },
  {
    idReadable: 'OPS-8',
    summary: 'Rotate YouTrack sync token',
    resolved: NOW - 100 * HOUR,
    updated: NOW - 90 * HOUR,
    project: { shortName: 'OPS' },
    tags: ['svc:example'],
    customFields: [
      { name: 'State', value: { name: 'Fixed' } },
      { name: 'Assignee', value: { name: 'Celina Kowalska' } },
    ],
  },
  {
    idReadable: 'DEMO-105',
    summary: 'Belongs to another service, must not show up',
    resolved: null,
    updated: NOW - 3 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:other'],
    customFields: [
      { name: 'State', value: { name: 'Open' } },
      { name: 'Assignee', value: { name: 'Dan Poe' } },
    ],
  },
  {
    idReadable: 'DEMO-106',
    summary: 'Spike: evaluate search relevance tuning',
    resolved: null,
    updated: NOW - 48 * HOUR,
    project: { shortName: 'DEMO' },
    tags: ['svc:example'],
    // no State/Assignee at all — plugin must render placeholders
    customFields: [],
  },
];

function applyQuery(query) {
  let list = [...ISSUES];
  const tagMatch = query.match(/tag:\s*\{([^}]+)\}/);
  if (tagMatch) {
    list = list.filter(issue => issue.tags.includes(tagMatch[1]));
  }
  if (/#unresolved\b/i.test(query)) {
    list = list.filter(issue => issue.resolved === null);
  }
  if (/sort by:\s*updated desc/i.test(query)) {
    list.sort((a, b) => b.updated - a.updated);
  }
  return list;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${req.method} ${req.url}`);

  if (req.method !== 'GET' || url.pathname !== '/api/issues') {
    send(res, 404, { error: 'Not Found' });
    return;
  }

  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) {
    send(res, 401, {
      error: 'Unauthorized',
      error_description: 'Missing or invalid Authorization header',
    });
    return;
  }

  const query = url.searchParams.get('query') ?? '';
  const opens = (query.match(/\{/g) ?? []).length;
  const closes = (query.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    send(res, 400, {
      error: 'bad_request',
      error_description: `Invalid query: ${query}`,
    });
    return;
  }

  const skip = Math.max(0, Number(url.searchParams.get('$skip') ?? 0) || 0);
  const topRaw = Number(url.searchParams.get('$top'));
  const top = Number.isFinite(topRaw) && topRaw > 0 ? topRaw : 42;

  // `fields` is accepted but ignored — the mock always returns the full shape
  const page = applyQuery(query)
    .slice(skip, skip + top)
    .map(({ tags, ...issue }) => issue);

  send(res, 200, page);
});

server.listen(PORT, () => {
  console.log(`mock-youtrack listening on http://localhost:${PORT}`);
  console.log(`try: curl -H "Authorization: Bearer perm:dummy" "http://localhost:${PORT}/api/issues?query=tag:%20%7Bsvc%3Aexample%7D%20%23Unresolved"`);
});
