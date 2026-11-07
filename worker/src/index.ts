import { readWorkerConfiguration, WorkerConfigurationError } from "./config";
import {
  GitHubProviderError,
  GitHubReadOnlyClient,
} from "./providers/github/client";
import { scanGitHubAccess } from "./providers/github/scan";
import { pollJobs } from "./poll";

const usage =
  "Usage: npm run worker -- <doctor|scan-github|poll> [--github-cli-auth]";

async function main() {
  const [command = "doctor", ...options] = process.argv.slice(2);
  if (command === "--help") {
    console.info(usage);
    return;
  }

  if (
    !["doctor", "scan-github", "poll"].includes(command) ||
    options.some((option) => option !== "--github-cli-auth") ||
    options.length > 1
  ) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  try {
    if (command === "poll") {
      await pollJobs(options.includes("--github-cli-auth"));
      return;
    }
    const configuration = readWorkerConfiguration(
      process.env,
      options.includes("--github-cli-auth"),
    );
    const client = new GitHubReadOnlyClient(
      configuration.accessToken,
      configuration.organization,
    );

    if (command === "doctor") {
      const { authenticatedUser, organization, membership } =
        await client.inspectConnection();
      console.info(
        JSON.stringify(
          {
            status: "connected",
            mode: "read_only",
            organization: {
              id: String(organization.id),
              login: organization.login,
            },
            authenticatedIdentity: {
              id: String(authenticatedUser.id),
              login: authenticatedUser.login,
            },
            organizationRole: membership.role,
            checkedAt: new Date().toISOString(),
            coverage:
              "Connection and administrator membership only; access inventory has not been checked by this command.",
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!configuration.testUsername)
      throw new WorkerConfigurationError(["GITHUB_TEST_USERNAME"]);

    const result = await scanGitHubAccess(
      client,
      configuration.testUsername,
      configuration.protectedUserIds,
    );
    console.info(JSON.stringify(result, null, 2));
  } catch (error) {
    const message =
      error instanceof WorkerConfigurationError ||
      error instanceof GitHubProviderError
        ? error.message
        : "Worker check failed unexpectedly. No successful result has been recorded.";
    console.error(JSON.stringify({ status: "unresolved", error: message }));
    process.exitCode = 1;
  }
}

await main();
