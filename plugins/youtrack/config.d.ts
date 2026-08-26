export interface Config {
  /**
   * Configuration for the YouTrack frontend plugin.
   */
  youtrack?: {
    /**
     * Base URL of the YouTrack web UI, used to build links to issues,
     * e.g. `https://example.youtrack.cloud`.
     * @visibility frontend
     */
    baseUrl: string;

    /**
     * Path of the Backstage proxy endpoint that targets the YouTrack REST
     * API. Defaults to `/youtrack`.
     * @visibility frontend
     */
    proxyPath?: string;

    /**
     * Names of the YouTrack custom fields shown in the issue table. Custom
     * field names are defined per YouTrack project and are often localized,
     * so each entry is a list of candidate names — the first field present
     * on an issue wins.
     */
    customFields?: {
      /**
       * Candidate names of the issue state field.
       * Defaults to `[State, Stan]`.
       * @visibility frontend
       * @items.visibility frontend
       */
      state?: string[];

      /**
       * Candidate names of the assignee field.
       * Defaults to `[Assignee, Wykonawca]`.
       * @visibility frontend
       * @items.visibility frontend
       */
      assignee?: string[];
    };
  };
}
