import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Link,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  Typography,
} from '@material-ui/core';

import { getYouTrackSelector } from '../../annotations';
import {
  YouTrackApiError,
  YouTrackIssue,
  buildYouTrackQuery,
  getCustomFieldValue,
  youtrackApiRef,
} from '../../api';
import {
  YOUTRACK_QUERY_ANNOTATION,
  YOUTRACK_TAG_ANNOTATION,
} from '../../constants';

/** Props for {@link EntityYouTrackContent}. */
export interface YouTrackIssuesContentProps {
  /** Number of issues fetched per page. Defaults to 50. */
  pageSize?: number;
}

export const YouTrackIssuesContent = (props: YouTrackIssuesContentProps) => {
  const { pageSize = 50 } = props;
  const { entity } = useEntity();
  const api = useApi(youtrackApiRef);
  const selector = getYouTrackSelector(entity);

  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [issues, setIssues] = useState<YouTrackIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const requestRef = useRef(0);

  const query = selector
    ? buildYouTrackQuery(selector, { unresolvedOnly })
    : undefined;

  const fetchPage = useCallback(
    async (skip: number, reset: boolean) => {
      if (!query) {
        return;
      }
      const requestId = ++requestRef.current;
      setLoading(true);
      setError(undefined);
      try {
        const batch = await api.listIssues({ query, top: pageSize, skip });
        if (requestRef.current !== requestId) {
          return; // a newer request superseded this one
        }
        setIssues(prev => (reset ? batch : [...prev, ...batch]));
        setHasMore(batch.length === pageSize);
      } catch (e) {
        if (requestRef.current !== requestId) {
          return;
        }
        setError(e as Error);
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [api, query, pageSize],
  );

  useEffect(() => {
    setIssues([]);
    setHasMore(false);
    fetchPage(0, true);
  }, [fetchPage]);

  let queryUrl: string | undefined;
  let configError: Error | undefined;
  if (query) {
    try {
      queryUrl = api.getQueryUrl(query);
    } catch (e) {
      configError = e as Error;
    }
  }

  const columns: TableColumn<YouTrackIssue>[] = useMemo(
    () => [
      {
        title: 'ID',
        field: 'idReadable',
        width: '140px',
        render: row =>
          configError ? (
            <>{row.idReadable}</>
          ) : (
            <Link to={api.getIssueUrl(row.idReadable)}>{row.idReadable}</Link>
          ),
      },
      {
        title: 'Summary',
        field: 'summary',
        highlight: true,
      },
      {
        title: 'State',
        render: row =>
          getCustomFieldValue(row, api.getStateFieldNames()) ?? '—',
      },
      {
        title: 'Assignee',
        render: row =>
          getCustomFieldValue(row, api.getAssigneeFieldNames()) ?? '—',
      },
      {
        title: 'Updated',
        field: 'updated',
        defaultSort: 'desc',
        render: row => new Date(row.updated).toLocaleString(),
      },
    ],
    [api, configError],
  );

  if (!selector) {
    return (
      <MissingAnnotationEmptyState
        annotation={[YOUTRACK_TAG_ANNOTATION, YOUTRACK_QUERY_ANNOTATION]}
      />
    );
  }

  const errorHint =
    error instanceof YouTrackApiError ? error.hint : undefined;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1}>
        <FormControlLabel
          control={
            <Switch
              checked={unresolvedOnly}
              onChange={event => setUnresolvedOnly(event.target.checked)}
              color="primary"
            />
          }
          label="Unresolved only"
        />
        <Box flexGrow={1} />
        {queryUrl && <Link to={queryUrl}>Open in YouTrack</Link>}
      </Box>

      {configError && (
        <Box mb={2}>
          <WarningPanel
            severity="error"
            title="YouTrack plugin is misconfigured"
          >
            {configError.message}
          </WarningPanel>
        </Box>
      )}

      {error && (
        <Box mb={2}>
          <WarningPanel
            severity="error"
            title="Failed to load YouTrack issues"
            message={errorHint}
          >
            {error.message}
          </WarningPanel>
        </Box>
      )}

      <Table<YouTrackIssue>
        title={`YouTrack issues (${issues.length}${hasMore ? '+' : ''})`}
        columns={columns}
        data={issues}
        isLoading={loading && issues.length === 0}
        options={{
          search: true,
          paging: false,
          padding: 'dense',
          draggable: false,
        }}
        emptyContent={
          <Box p={2}>
            <Typography>
              No issues found in YouTrack for this query.
            </Typography>
          </Box>
        }
      />

      {hasMore && (
        <Box mt={1} display="flex" alignItems="center">
          <Button
            variant="outlined"
            size="small"
            disabled={loading}
            onClick={() => fetchPage(issues.length, false)}
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
          <Box ml={2}>
            <Typography variant="body2" color="textSecondary">
              Showing the first {issues.length} issues.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};
