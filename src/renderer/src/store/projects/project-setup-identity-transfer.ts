import { stripCredentialsFromMessage } from '../../../../shared/git-remote-error'
import type { GitRemoteIdentity } from '../../../../shared/git-remote-identity'
import { getProjectIdForProviderIdentity } from '../../../../shared/project-host-setup-projection'
import type { ProjectProviderIdentity } from '../../../../shared/project-types'
import { PROJECT_HOST_SETUP_CHECKOUT_IDENTITY_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import {
  runtimeEnvironmentSupportsCapability,
  type RuntimeClientTarget
} from '../../runtime/runtime-rpc-client'

function trimmedString(value: unknown): string {
  // Why typed here: a persisted row, or a peer on another version, can deliver a non-string where
  // the type promises one — and `.trim()` on it would throw before any fallback could run.
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The selected project's remote identity as it should travel to another host with a setup request:
 * embedded credentials stripped, and dropped entirely when a row (persisted JSON, or a peer on a
 * different version) is missing a part the receiver requires — sending a blank would fail the whole
 * request's validation instead of letting it fall back to the provider identity.
 */
export function redactProjectGitRemoteIdentityForTransfer(
  identity: GitRemoteIdentity | undefined
): GitRemoteIdentity | undefined {
  if (!identity) {
    return undefined
  }
  const canonicalKey = trimmedString(identity.canonicalKey)
  const remoteName = trimmedString(identity.remoteName)
  const remoteUrl = stripCredentialsFromMessage(trimmedString(identity.remoteUrl))
  if (!canonicalKey || !remoteName || !remoteUrl) {
    return undefined
  }
  const originCanonicalKey = trimmedString(identity.origin?.canonicalKey)
  const originRemoteUrl = stripCredentialsFromMessage(trimmedString(identity.origin?.remoteUrl))
  return {
    canonicalKey,
    remoteName,
    remoteUrl,
    ...(originCanonicalKey && originRemoteUrl
      ? { origin: { canonicalKey: originCanonicalKey, remoteUrl: originRemoteUrl } }
      : {})
  }
}

/**
 * The identity a setup request should carry to `target`, and the project id to ask it for.
 *
 * A host that predates `project-host-setup.checkout-identity.v1` aligns an existing folder only
 * through the provider identity, and drops the unknown checkout field. Asking it for a project id
 * derived from the checkout's own remote would make it reject every fork or template setup, so ask
 * such a host for the ancestor-derived id instead — exactly what it received before checkout keying
 * existed. The two ids converge again once that host's own identity probe resolves.
 */
export async function negotiateProjectSetupIdentity(input: {
  target: RuntimeClientTarget
  projectId: string
  providerIdentity: ProjectProviderIdentity | undefined
  gitRemoteIdentity: GitRemoteIdentity | undefined
}): Promise<{
  projectId: string
  projectProviderIdentity?: ProjectProviderIdentity
  projectGitRemoteIdentity?: GitRemoteIdentity
}> {
  const projectGitRemoteIdentity = redactProjectGitRemoteIdentityForTransfer(
    input.gitRemoteIdentity
  )
  const carriesCheckoutIdentity =
    input.target.kind !== 'environment' ||
    (await runtimeEnvironmentSupportsCapability(
      input.target.environmentId,
      PROJECT_HOST_SETUP_CHECKOUT_IDENTITY_RUNTIME_CAPABILITY,
      15_000
    ))
  if (carriesCheckoutIdentity) {
    return {
      projectId: input.projectId,
      ...(input.providerIdentity ? { projectProviderIdentity: input.providerIdentity } : {}),
      ...(projectGitRemoteIdentity ? { projectGitRemoteIdentity } : {})
    }
  }
  return {
    projectId: input.providerIdentity
      ? getProjectIdForProviderIdentity(input.providerIdentity)
      : input.projectId,
    ...(input.providerIdentity ? { projectProviderIdentity: input.providerIdentity } : {})
  }
}
