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

interface PRData {
  number: number;
  html_url: string;
  title: string;
  body: string;
  state: string;
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

  async createPR(
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<PRData> {
    return this.request<PRData>("POST", "/pulls", { title, body, head, base });
  }

  async addComment(issueNumber: number, body: string): Promise<CommentData> {
    return this.request<CommentData>(
      "POST",
      `/issues/${issueNumber}/comments`,
      { body },
    );
  }

  async updatePRBody(prNumber: number, body: string): Promise<PRData> {
    return this.request<PRData>("PATCH", `/pulls/${prNumber}`, { body });
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
