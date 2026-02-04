export interface GitHubErrorResponse {
  message: string;
  status: number;
  documentation_url?: string;
}

export class GitHubAPIError extends Error {
  status: number;
  documentation_url?: string;

  constructor(response: GitHubErrorResponse) {
    super(response.message);
    this.name = "GitHubAPIError";
    this.status = response.status;
    this.documentation_url = response.documentation_url;
  }
}

interface IssueData {
  number: number;
  html_url: string;
  title: string;
  body: string;
  state: string;
  node_id: string;
}

interface CommentData {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
}

interface ReactionData {
  id: number;
  content: string;
  user: { login: string };
}

interface CommitResponse {
  content: { sha: string };
  commit: { sha: string; html_url: string };
}

export class GitHubAPI {
  private token: string;
  private owner: string;
  private repo: string;
  private baseUrl: string;

  constructor(owner: string, repo: string, token?: string) {
    const resolvedToken = token ?? process.env["GITHUB_TOKEN"];
    if (!resolvedToken) {
      throw new Error(
        "GitHub token is required. Set GITHUB_TOKEN environment variable or pass it to the constructor.",
      );
    }
    this.token = resolvedToken;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = "https://api.github.com";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorData: GitHubErrorResponse;
      try {
        const parsed = (await response.json()) as Record<string, unknown>;
        errorData = {
          message: (parsed["message"] as string) ?? response.statusText,
          status: response.status,
          documentation_url: parsed["documentation_url"] as string | undefined,
        };
      } catch {
        errorData = {
          message: response.statusText,
          status: response.status,
        };
      }
      throw new GitHubAPIError(errorData);
    }

    return (await response.json()) as T;
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[],
  ): Promise<IssueData> {
    return this.request<IssueData>("POST", "/issues", {
      title,
      body,
      labels,
    });
  }

  async getIssue(issueNumber: number): Promise<IssueData> {
    return this.request<IssueData>("GET", `/issues/${issueNumber}`);
  }

  async updateIssueBody(
    issueNumber: number,
    body: string,
  ): Promise<IssueData> {
    return this.request<IssueData>("PATCH", `/issues/${issueNumber}`, {
      body,
    });
  }

  async closeIssue(issueNumber: number): Promise<IssueData> {
    return this.request<IssueData>("PATCH", `/issues/${issueNumber}`, {
      state: "closed",
    });
  }

  async pinIssue(issueNodeId: string): Promise<void> {
    const query = `mutation { pinIssue(input: { issueId: "${issueNodeId}" }) { issue { id } } }`;
    await fetch(`${this.baseUrl.replace("/repos/" + this.owner + "/" + this.repo, "")}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  }

  async unpinIssue(issueNodeId: string): Promise<void> {
    const query = `mutation { unpinIssue(input: { issueId: "${issueNodeId}" }) { issue { id } } }`;
    await fetch(`${this.baseUrl.replace("/repos/" + this.owner + "/" + this.repo, "")}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  }

  async addComment(issueNumber: number, body: string): Promise<CommentData> {
    return this.request<CommentData>(
      "POST",
      `/issues/${issueNumber}/comments`,
      { body },
    );
  }

  async getComment(commentId: number): Promise<CommentData> {
    return this.request<CommentData>(
      "GET",
      `/issues/comments/${commentId}`,
    );
  }

  async getComments(issueNumber: number): Promise<CommentData[]> {
    return this.request<CommentData[]>(
      "GET",
      `/issues/${issueNumber}/comments`,
    );
  }

  async getReactions(commentId: number): Promise<ReactionData[]> {
    return this.request<ReactionData[]>(
      "GET",
      `/issues/comments/${commentId}/reactions`,
    );
  }

  async getTrafficViews(): Promise<{
    count: number;
    uniques: number;
    views: { timestamp: string; count: number; uniques: number }[];
  }> {
    return this.request("GET", "/traffic/views");
  }

  async getTrafficClones(): Promise<{
    count: number;
    uniques: number;
    clones: { timestamp: string; count: number; uniques: number }[];
  }> {
    return this.request("GET", "/traffic/clones");
  }

  async getPopularReferrers(): Promise<
    { referrer: string; count: number; uniques: number }[]
  > {
    return this.request("GET", "/traffic/popular/referrers");
  }

  async dispatchEvent(
    eventType: string,
    clientPayload: Record<string, unknown>,
  ): Promise<void> {
    await this.request("POST", "/dispatches", {
      event_type: eventType,
      client_payload: clientPayload,
    });
  }

  async createPR(
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<{ number: number; html_url: string; title: string; body: string; state: string }> {
    return this.request("POST", "/pulls", {
      title,
      body,
      head,
      base,
    });
  }

  async updatePRBody(
    prNumber: number,
    body: string,
  ): Promise<{ number: number; html_url: string; title: string; body: string; state: string }> {
    return this.request("PATCH", `/pulls/${prNumber}`, {
      body,
    });
  }

  async updateReadme(
    content: string,
    message: string,
  ): Promise<CommitResponse> {
    const existing = await this.request<{
      sha: string;
      content: string;
    }>("GET", "/contents/README.md").catch(() => null);

    const encoded = btoa(content);
    const body: Record<string, unknown> = {
      message,
      content: encoded,
    };
    if (existing) {
      body["sha"] = existing.sha;
    }

    return this.request<CommitResponse>("PUT", "/contents/README.md", body);
  }
}
