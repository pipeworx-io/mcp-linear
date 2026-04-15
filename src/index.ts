interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Linear MCP — wraps the Linear GraphQL API (OAuth)
 *
 * Tools:
 * - linear_list_issues: query issues with optional filter
 * - linear_get_issue: get a single issue by ID
 * - linear_create_issue: create a new issue
 * - linear_list_teams: list all teams in the workspace
 * - linear_search: search issues by query text
 */


const API = 'https://api.linear.app/graphql';

interface LinearContext {
  linear?: { accessToken: string };
}

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'linear_list_issues',
    description:
      'List issues from Linear with optional filtering. Returns issue ID, title, state, priority, assignee, and URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          description:
            'Optional filter object as JSON string (e.g., {"state":{"name":{"eq":"In Progress"}}}). Passed directly to the Linear issues query filter.',
        },
        first: {
          type: 'number',
          description: 'Number of issues to return (default 20, max 50)',
        },
      },
    },
  },
  {
    name: 'linear_get_issue',
    description:
      'Get a single Linear issue by its ID (e.g., "ABC-123"). Returns full issue details including title, description, state, priority, assignee, labels, and comments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Issue identifier (e.g., "ABC-123")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'linear_create_issue',
    description:
      'Create a new issue in Linear. Returns the created issue ID, identifier, title, and URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Issue title' },
        description: { type: 'string', description: 'Issue description (markdown supported)' },
        teamId: { type: 'string', description: 'Team ID to create the issue in' },
        priority: {
          type: 'number',
          description: 'Priority level: 0 (none), 1 (urgent), 2 (high), 3 (medium), 4 (low)',
        },
      },
      required: ['title', 'teamId'],
    },
  },
  {
    name: 'linear_list_teams',
    description:
      'List all teams in the Linear workspace. Returns team ID, name, key, and description.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'linear_search',
    description:
      'Search Linear issues by text query. Returns matching issues with ID, title, state, priority, and URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query text' },
        first: {
          type: 'number',
          description: 'Number of results to return (default 20, max 50)',
        },
      },
      required: ['query'],
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function getToken(args: Record<string, unknown>): string {
  const context = (args._context ?? {}) as LinearContext;
  const token = context.linear?.accessToken;
  if (!token) throw new Error('Linear OAuth token required. Connect Linear via OAuth first.');
  return token;
}

async function graphql(token: string, query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`);
  }
  return json.data;
}

// ── Tool implementations ─────────────────────────────────────────────

async function listIssues(token: string, filter?: string, first?: number) {
  const count = Math.min(50, Math.max(1, first ?? 20));
  const filterObj = filter ? JSON.parse(filter) : undefined;
  const query = `
    query ListIssues($first: Int!, $filter: IssueFilter) {
      issues(first: $first, filter: $filter, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          state { name }
          priority
          priorityLabel
          assignee { name email }
          url
          createdAt
          updatedAt
        }
      }
    }
  `;
  const data = (await graphql(token, query, { first: count, filter: filterObj })) as {
    issues: { nodes: unknown[] };
  };
  return { issues: data.issues.nodes };
}

async function getIssue(token: string, id: string) {
  const query = `
    query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        state { name }
        priority
        priorityLabel
        assignee { name email }
        labels { nodes { name color } }
        comments { nodes { body user { name } createdAt } }
        url
        createdAt
        updatedAt
      }
    }
  `;
  const data = (await graphql(token, query, { id })) as { issue: unknown };
  return data.issue;
}

async function createIssue(
  token: string,
  title: string,
  teamId: string,
  description?: string,
  priority?: number,
) {
  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;
  const input: Record<string, unknown> = { title, teamId };
  if (description) input.description = description;
  if (priority !== undefined) input.priority = priority;
  const data = (await graphql(token, query, { input })) as {
    issueCreate: { success: boolean; issue: unknown };
  };
  return data.issueCreate;
}

async function listTeams(token: string) {
  const query = `
    query ListTeams {
      teams {
        nodes {
          id
          name
          key
          description
        }
      }
    }
  `;
  const data = (await graphql(token, query)) as { teams: { nodes: unknown[] } };
  return { teams: data.teams.nodes };
}

async function searchIssues(token: string, queryText: string, first?: number) {
  const count = Math.min(50, Math.max(1, first ?? 20));
  const query = `
    query SearchIssues($term: String!, $first: Int!) {
      searchIssues(term: $term, first: $first) {
        nodes {
          id
          identifier
          title
          state { name }
          priority
          priorityLabel
          assignee { name }
          url
          updatedAt
        }
      }
    }
  `;
  const data = (await graphql(token, query, { term: queryText, first: count })) as {
    searchIssues: { nodes: unknown[] };
  };
  return { issues: data.searchIssues.nodes };
}

// ── callTool dispatcher ──────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const token = getToken(args);
  delete args._context;

  switch (name) {
    case 'linear_list_issues':
      return listIssues(token, args.filter as string | undefined, args.first as number | undefined);
    case 'linear_get_issue':
      return getIssue(token, args.id as string);
    case 'linear_create_issue':
      return createIssue(
        token,
        args.title as string,
        args.teamId as string,
        args.description as string | undefined,
        args.priority as number | undefined,
      );
    case 'linear_list_teams':
      return listTeams(token);
    case 'linear_search':
      return searchIssues(token, args.query as string, args.first as number | undefined);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 10 }, provider: 'linear' } satisfies McpToolExport;
