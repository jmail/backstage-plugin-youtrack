import { YouTrackIssue } from '../api';

/**
 * A fixture issue: the standard REST shape plus the internal `tags` list
 * used by the mock query engine (never returned to callers).
 *
 * Keep in sync with `mock-youtrack/server.mjs` at the repo root, which
 * serves the same data set for interactive testing.
 */
export interface MockYouTrackIssue extends YouTrackIssue {
  tags: string[];
}

const HOUR = 3_600_000;
const NOW = 1_755_000_000_000; // fixed reference time so fixtures are stable

export const mockIssues: MockYouTrackIssue[] = [
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
      // multi-value field — exercised by getCustomFieldValue tests
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
    customFields: [],
  },
];

/**
 * Applies a YouTrack-like search query to the fixtures: understands
 * `tag: {value}`, `#Unresolved` and `sort by: updated desc`, plus
 * `$top`/`$skip`-style pagination. Strips the internal `tags` field.
 */
export function queryMockIssues(
  query: string,
  options: { top?: number; skip?: number } = {},
): YouTrackIssue[] {
  const { top = 42, skip = 0 } = options;
  let list = [...mockIssues];
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
  return list.slice(skip, skip + top).map(({ tags: _tags, ...issue }) => issue);
}
