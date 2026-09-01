import { stripCredentialsFromMessage } from '../../../../shared/git-remote-error'
import type { GitRemoteIdentity } from '../../../../shared/git-remote-identity'

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
  const canonicalKey = identity.canonicalKey?.trim() ?? ''
  const remoteName = identity.remoteName?.trim() ?? ''
  const remoteUrl = stripCredentialsFromMessage(identity.remoteUrl?.trim() ?? '')
  if (!canonicalKey || !remoteName || !remoteUrl) {
    return undefined
  }
  const originCanonicalKey = identity.origin?.canonicalKey?.trim() ?? ''
  const originRemoteUrl = stripCredentialsFromMessage(identity.origin?.remoteUrl?.trim() ?? '')
  return {
    canonicalKey,
    remoteName,
    remoteUrl,
    ...(originCanonicalKey && originRemoteUrl
      ? { origin: { canonicalKey: originCanonicalKey, remoteUrl: originRemoteUrl } }
      : {})
  }
}
