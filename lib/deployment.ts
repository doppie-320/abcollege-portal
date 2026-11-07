const TAGS_URL = "https://api.github.com/repos/doppie-320/abcollege-portal/tags?per_page=100";

type GitHubTag = {
  name: string;
  commit: { sha: string };
};

/** The tag on this commit, or the newest tag while this commit's release is still being written. */
export function pickReleaseTag(tags: GitHubTag[], sha: string): string | null {
  const exact = tags.find((tag) => tag.commit.sha === sha);
  if (exact) return exact.name;

  const [newest] = tags
    .map((tag) => tag.name)
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  return newest ?? null;
}

// Looked up per request, not at build time: a release is published after its merge
// commit has already been built, so the tag doesn't exist yet during the build.
async function fetchReleaseTag(sha: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;

  try {
    // The fetch cache, not "use cache": on Vercel, "use cache" entries live in the memory
    // of a single instance, so most requests would reach GitHub's rate limit instead.
    const response = await fetch(TAGS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;

    return pickReleaseTag(await response.json(), sha);
  } catch {
    return null;
  }
}

/**
 * What the home page shows beside the date: the release tag on main, or the branch type
 * and commit elsewhere. Null means show nothing, including when GitHub can't be reached.
 */
export async function getDeploymentLabel(): Promise<string | null> {
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;

  if (!branch || !sha) return process.env.NODE_ENV === "development" ? "dev: local" : null;
  if (branch === "main") return fetchReleaseTag(sha);
  return `${branch === "development" ? "dev" : "exp"}: ${sha.slice(0, 7)}`;
}
