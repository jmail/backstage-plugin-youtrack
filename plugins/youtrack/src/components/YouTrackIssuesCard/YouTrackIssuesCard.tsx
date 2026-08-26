import {
  InfoCard,
  InfoCardVariants,
  Link,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { List, ListItem, ListItemText, Typography } from '@material-ui/core';
import useAsync from 'react-use/lib/useAsync';

import { getYouTrackSelector } from '../../annotations';
import {
  YouTrackApiError,
  buildYouTrackQuery,
  getCustomFieldValue,
  youtrackApiRef,
} from '../../api';
import {
  YOUTRACK_QUERY_ANNOTATION,
  YOUTRACK_TAG_ANNOTATION,
} from '../../constants';

/** Props for {@link EntityYouTrackCard}. */
export interface YouTrackIssuesCardProps {
  title?: string;
  maxItems?: number;
  variant?: InfoCardVariants;
}

export const YouTrackIssuesCard = (props: YouTrackIssuesCardProps) => {
  const { title = 'YouTrack', maxItems = 5, variant = 'gridItem' } = props;
  const { entity } = useEntity();
  const api = useApi(youtrackApiRef);
  const selector = getYouTrackSelector(entity);
  const query = selector
    ? buildYouTrackQuery(selector, { unresolvedOnly: true })
    : undefined;

  const {
    value: issues,
    loading,
    error,
  } = useAsync(async () => {
    if (!query) {
      return [];
    }
    return api.listIssues({ query, top: maxItems });
  }, [query, maxItems]);

  if (!selector) {
    return (
      <MissingAnnotationEmptyState
        annotation={[YOUTRACK_TAG_ANNOTATION, YOUTRACK_QUERY_ANNOTATION]}
      />
    );
  }

  let deepLink: { title: string; link: string } | undefined;
  let configError: Error | undefined;
  try {
    deepLink = { title: 'Open in YouTrack', link: api.getQueryUrl(query!) };
  } catch (e) {
    configError = e as Error;
  }

  const renderBody = () => {
    if (configError) {
      return (
        <WarningPanel severity="error" title="YouTrack plugin is misconfigured">
          {configError.message}
        </WarningPanel>
      );
    }
    if (loading) {
      return <Progress />;
    }
    if (error) {
      const hint = error instanceof YouTrackApiError ? error.hint : undefined;
      return (
        <WarningPanel
          severity="error"
          title="Failed to load YouTrack issues"
          message={hint}
        >
          {error.message}
        </WarningPanel>
      );
    }
    if (!issues || issues.length === 0) {
      return (
        <Typography variant="body2">
          No open issues found for this entity.
        </Typography>
      );
    }
    return (
      <List dense disablePadding>
        {issues.map(issue => {
          const secondary = [
            getCustomFieldValue(issue, api.getStateFieldNames()),
            getCustomFieldValue(issue, api.getAssigneeFieldNames()),
          ]
            .filter(Boolean)
            .join(' • ');
          return (
            <ListItem key={issue.idReadable} divider disableGutters>
              <ListItemText
                primary={
                  <>
                    <Link to={api.getIssueUrl(issue.idReadable)}>
                      {issue.idReadable}
                    </Link>{' '}
                    {issue.summary}
                  </>
                }
                secondary={secondary || undefined}
              />
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <InfoCard
      title={title}
      subheader="Unresolved issues, most recently updated first"
      variant={variant}
      deepLink={deepLink}
    >
      {renderBody()}
    </InfoCard>
  );
};
