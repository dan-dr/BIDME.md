import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { GitHubAPI, GitHubAPIError } from "../../scripts/utils/github-api";

const MOCK_TOKEN = "ghp_test123";
const OWNER = "test-owner";
const REPO = "test-repo";
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}`;

let originalFetch: typeof globalThis.fetch;

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  globalThis.fetch = mock(handler) as typeof fetch;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GitHubAPI constructor", () => {
  test("uses provided token", () => {
    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    expect(api).toBeDefined();
  });

  test("uses GITHUB_TOKEN env variable", () => {
    const orig = process.env["GITHUB_TOKEN"];
    process.env["GITHUB_TOKEN"] = "env-token";
    try {
      const api = new GitHubAPI(OWNER, REPO);
      expect(api).toBeDefined();
    } finally {
      if (orig !== undefined) {
        process.env["GITHUB_TOKEN"] = orig;
      } else {
        delete process.env["GITHUB_TOKEN"];
      }
    }
  });

  test("throws when no token available", () => {
    const orig = process.env["GITHUB_TOKEN"];
    delete process.env["GITHUB_TOKEN"];
    try {
      expect(() => new GitHubAPI(OWNER, REPO)).toThrow("GitHub token");
    } finally {
      if (orig !== undefined) {
        process.env["GITHUB_TOKEN"] = orig;
      }
    }
  });
});

describe("createPR", () => {
  test("creates a pull request", async () => {
    const prResponse = {
      number: 42,
      html_url: "https://github.com/test-owner/test-repo/pull/42",
      title: "Test PR",
      body: "Test body",
      state: "open",
    };

    mockFetch((url, init) => {
      expect(url).toBe(`${BASE_URL}/pulls`);
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.title).toBe("Test PR");
      expect(body.head).toBe("feature");
      expect(body.base).toBe("main");
      return new Response(JSON.stringify(prResponse), { status: 201 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.createPR("Test PR", "Test body", "feature", "main");
    expect(result.number).toBe(42);
    expect(result.title).toBe("Test PR");
  });

  test("throws GitHubAPIError on failure", async () => {
    mockFetch(() => {
      return new Response(
        JSON.stringify({ message: "Validation Failed", documentation_url: "https://docs.github.com" }),
        { status: 422 },
      );
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    try {
      await api.createPR("Test PR", "body", "feature", "main");
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(GitHubAPIError);
      const err = e as GitHubAPIError;
      expect(err.status).toBe(422);
      expect(err.message).toBe("Validation Failed");
      expect(err.documentation_url).toBe("https://docs.github.com");
    }
  });
});

describe("addComment", () => {
  test("adds a comment to an issue/PR", async () => {
    const commentResponse = {
      id: 101,
      body: "Nice work!",
      user: { login: "reviewer" },
      created_at: "2026-01-01T00:00:00Z",
    };

    mockFetch((url, init) => {
      expect(url).toBe(`${BASE_URL}/issues/5/comments`);
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify(commentResponse), { status: 201 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.addComment(5, "Nice work!");
    expect(result.id).toBe(101);
    expect(result.body).toBe("Nice work!");
  });
});

describe("updatePRBody", () => {
  test("updates pull request description", async () => {
    const prResponse = {
      number: 10,
      html_url: "https://github.com/test-owner/test-repo/pull/10",
      title: "Existing PR",
      body: "Updated body",
      state: "open",
    };

    mockFetch((url, init) => {
      expect(url).toBe(`${BASE_URL}/pulls/10`);
      expect(init?.method).toBe("PATCH");
      const body = JSON.parse(init?.body as string);
      expect(body.body).toBe("Updated body");
      return new Response(JSON.stringify(prResponse), { status: 200 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.updatePRBody(10, "Updated body");
    expect(result.body).toBe("Updated body");
  });
});

describe("getComments", () => {
  test("lists comments on an issue/PR", async () => {
    const comments = [
      { id: 1, body: "First", user: { login: "user1" }, created_at: "2026-01-01T00:00:00Z" },
      { id: 2, body: "Second", user: { login: "user2" }, created_at: "2026-01-02T00:00:00Z" },
    ];

    mockFetch((url, init) => {
      expect(url).toBe(`${BASE_URL}/issues/7/comments`);
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify(comments), { status: 200 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.getComments(7);
    expect(result).toHaveLength(2);
    expect(result[0]?.body).toBe("First");
  });
});

describe("getReactions", () => {
  test("gets reactions on a comment", async () => {
    const reactions = [
      { id: 1, content: "+1", user: { login: "fan1" } },
      { id: 2, content: "heart", user: { login: "fan2" } },
    ];

    mockFetch((url, init) => {
      expect(url).toBe(`${BASE_URL}/issues/comments/99/reactions`);
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify(reactions), { status: 200 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.getReactions(99);
    expect(result).toHaveLength(2);
    expect(result[0]?.content).toBe("+1");
  });
});

describe("updateReadme", () => {
  test("updates existing README", async () => {
    const existingFile = { sha: "abc123", content: btoa("old content") };
    const commitResponse = {
      content: { sha: "def456" },
      commit: { sha: "commit789", html_url: "https://github.com/test-owner/test-repo/commit/commit789" },
    };

    let callCount = 0;
    mockFetch((url, init) => {
      callCount++;
      if (init?.method === "GET") {
        expect(url).toBe(`${BASE_URL}/contents/README.md`);
        return new Response(JSON.stringify(existingFile), { status: 200 });
      }
      expect(init?.method).toBe("PUT");
      const body = JSON.parse(init?.body as string);
      expect(body.sha).toBe("abc123");
      expect(body.message).toBe("Update README");
      expect(body.content).toBe(btoa("new content"));
      return new Response(JSON.stringify(commitResponse), { status: 200 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.updateReadme("new content", "Update README");
    expect(result.commit.sha).toBe("commit789");
    expect(callCount).toBe(2);
  });

  test("creates README when it does not exist", async () => {
    const commitResponse = {
      content: { sha: "new-sha" },
      commit: { sha: "new-commit", html_url: "https://github.com/test-owner/test-repo/commit/new-commit" },
    };

    let callCount = 0;
    mockFetch((url, init) => {
      callCount++;
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      expect(init?.method).toBe("PUT");
      const body = JSON.parse(init?.body as string);
      expect(body.sha).toBeUndefined();
      return new Response(JSON.stringify(commitResponse), { status: 201 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    const result = await api.updateReadme("# New README", "Create README");
    expect(result.content.sha).toBe("new-sha");
    expect(callCount).toBe(2);
  });
});

describe("error handling", () => {
  test("handles non-JSON error response", async () => {
    mockFetch(() => {
      return new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    try {
      await api.getComments(1);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(GitHubAPIError);
      const err = e as GitHubAPIError;
      expect(err.status).toBe(500);
    }
  });

  test("sends correct authorization header", async () => {
    mockFetch((_url, init) => {
      const authHeader = (init?.headers as Record<string, string>)["Authorization"];
      expect(authHeader).toBe(`Bearer ${MOCK_TOKEN}`);
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const api = new GitHubAPI(OWNER, REPO, MOCK_TOKEN);
    await api.getComments(1);
  });
});
