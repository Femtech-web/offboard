import { execFileSync } from "node:child_process";

import { z } from "zod";

const githubName = z.string().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i);

const environmentSchema = z.object({
  GITHUB_REMOVAL_TEST_USER_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[1-9]\d*$/))),
  GITHUB_ACCESS_TOKEN: z.string().trim().min(1),
  GITHUB_ORGANIZATION: githubName,
  GITHUB_TEST_USERNAME: githubName.optional(),
  GITHUB_PROTECTED_USER_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[1-9]\d*$/))),
});

export class WorkerConfigurationError extends Error {
  constructor(public readonly fields: string[]) {
    super(
      `Configure valid values for: ${fields.join(", ")}. See .env.example.`,
    );
    this.name = "WorkerConfigurationError";
  }
}

export function readWorkerConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  useGitHubCli = false,
) {
  let accessToken = environment.GITHUB_ACCESS_TOKEN;

  if (useGitHubCli) {
    try {
      // Capture the existing credential in memory; never print or persist it.
      accessToken = execFileSync(
        "gh",
        ["auth", "token", "--hostname", "github.com"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10_000,
        },
      ).trim();
    } catch {
      throw new WorkerConfigurationError(["GitHub CLI sign-in"]);
    }
  }

  const parsed = environmentSchema.safeParse({
    ...environment,
    GITHUB_ACCESS_TOKEN: accessToken,
    GITHUB_TEST_USERNAME: environment.GITHUB_TEST_USERNAME || undefined,
  });

  if (!parsed.success) {
    throw new WorkerConfigurationError([
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }

  return {
    accessToken: parsed.data.GITHUB_ACCESS_TOKEN,
    organization: parsed.data.GITHUB_ORGANIZATION,
    testUsername: parsed.data.GITHUB_TEST_USERNAME,
    protectedUserIds: parsed.data.GITHUB_PROTECTED_USER_IDS,
    removalTestUserIds: parsed.data.GITHUB_REMOVAL_TEST_USER_IDS,
  };
}
