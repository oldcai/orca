import { stripCredentialsFromMessage } from '../../../shared/git-remote-error'
import { getCheckoutRemote } from '../../../shared/git-remote-identity'
import type { Project } from '../../../shared/project-types'
import type { Repo } from '../../../shared/repo-types'

/**
 * The clone URL to seed "Clone from URL" with, taken from the project's own
 * remote so the common case is one click.
 *
 * Credentials are stripped: the stored value is the verbatim `git remote` URL
 * and can embed a PAT, while the clone runs on the *target* host and would write
 * that token into its `.git/config` — a credential the user never typed into
 * this flow. Same treatment `getProvisionedRootRecipeRepoUrl` gives the
 * ephemeral-VM recipe URL.
 */
export function resolveProjectCloneUrlPrefill(
  projects: readonly Project[],
  repos: readonly Repo[],
  selectedProjectId: string | null
): string {
  if (!selectedProjectId) {
    return ''
  }
  const sourceRepoIds =
    projects.find((candidate) => candidate.id === selectedProjectId)?.sourceRepoIds ?? []
  const remoteUrl = sourceRepoIds
    .map((sourceId) => {
      const identity = repos.find((repo) => repo.id === sourceId)?.gitRemoteIdentity
      return identity ? getCheckoutRemote(identity).remoteUrl : undefined
    })
    .find((url): url is string => Boolean(url))
  return remoteUrl ? stripCredentialsFromMessage(remoteUrl) : ''
}
