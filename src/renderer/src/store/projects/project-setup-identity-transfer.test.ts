import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  negotiateProjectSetupIdentity,
  redactProjectGitRemoteIdentityForTransfer
} from './project-setup-identity-transfer'

const supportsCapability = vi.hoisted(() => vi.fn())

vi.mock('../../runtime/runtime-rpc-client', () => ({
  runtimeEnvironmentSupportsCapability: supportsCapability
}))

describe('redactProjectGitRemoteIdentityForTransfer', () => {
  it('strips embedded credentials from both remote urls', () => {
    expect(
      redactProjectGitRemoteIdentityForTransfer({
        canonicalKey: 'github.com/TemplateHQ/site-template',
        remoteName: 'upstream',
        remoteUrl: 'https://user:token@github.com/TemplateHQ/site-template.git',
        origin: {
          canonicalKey: 'github.com/alice/site',
          remoteUrl: 'https://token:@github.com/alice/site.git'
        }
      })
    ).toEqual({
      canonicalKey: 'github.com/TemplateHQ/site-template',
      remoteName: 'upstream',
      remoteUrl: 'https://github.com/TemplateHQ/site-template.git',
      origin: {
        canonicalKey: 'github.com/alice/site',
        remoteUrl: 'https://github.com/alice/site.git'
      }
    })
  })

  it('keeps a plain identity unchanged', () => {
    const identity = {
      canonicalKey: 'github.com/alice/site',
      remoteName: 'origin',
      remoteUrl: 'git@github.com:alice/site.git'
    }
    expect(redactProjectGitRemoteIdentityForTransfer(identity)).toEqual(identity)
  })

  it('drops a row missing a part the receiver requires instead of sending a blank', () => {
    expect(
      redactProjectGitRemoteIdentityForTransfer({
        canonicalKey: 'github.com/alice/site',
        remoteName: 'origin',
        remoteUrl: ''
      })
    ).toBeUndefined()
    expect(redactProjectGitRemoteIdentityForTransfer(undefined)).toBeUndefined()
  })

  it('drops an incomplete origin but keeps the identity', () => {
    expect(
      redactProjectGitRemoteIdentityForTransfer({
        canonicalKey: 'github.com/TemplateHQ/site-template',
        remoteName: 'upstream',
        remoteUrl: 'https://github.com/TemplateHQ/site-template.git',
        origin: { canonicalKey: 'github.com/alice/site', remoteUrl: '' }
      })
    ).toEqual({
      canonicalKey: 'github.com/TemplateHQ/site-template',
      remoteName: 'upstream',
      remoteUrl: 'https://github.com/TemplateHQ/site-template.git'
    })
  })
})

describe('negotiateProjectSetupIdentity', () => {
  const templateProject = {
    projectId: 'github:alice/site',
    providerIdentity: { provider: 'github' as const, owner: 'TemplateHQ', repo: 'site-template' },
    gitRemoteIdentity: {
      canonicalKey: 'github.com/TemplateHQ/site-template',
      remoteName: 'upstream',
      remoteUrl: 'https://github.com/TemplateHQ/site-template.git',
      origin: {
        canonicalKey: 'github.com/alice/site',
        remoteUrl: 'https://github.com/alice/site.git'
      }
    }
  }

  beforeEach(() => {
    supportsCapability.mockReset()
  })

  it('carries the checkout identity to the local host', async () => {
    await expect(
      negotiateProjectSetupIdentity({ target: { kind: 'local' }, ...templateProject })
    ).resolves.toMatchObject({
      projectId: 'github:alice/site',
      projectGitRemoteIdentity: { origin: { canonicalKey: 'github.com/alice/site' } }
    })
    expect(supportsCapability).not.toHaveBeenCalled()
  })

  it('carries it to a runtime host that understands checkout-keyed ids', async () => {
    supportsCapability.mockResolvedValue(true)

    await expect(
      negotiateProjectSetupIdentity({
        target: { kind: 'environment', environmentId: 'gpu-vm' },
        ...templateProject
      })
    ).resolves.toMatchObject({
      projectId: 'github:alice/site',
      projectGitRemoteIdentity: { canonicalKey: 'github.com/TemplateHQ/site-template' }
    })
  })

  it('asks an older runtime host for the ancestor-derived id it can still align', async () => {
    supportsCapability.mockResolvedValue(false)

    const negotiated = await negotiateProjectSetupIdentity({
      target: { kind: 'environment', environmentId: 'gpu-vm' },
      ...templateProject
    })

    expect(negotiated).toEqual({
      projectId: 'github:templatehq/site-template',
      projectProviderIdentity: templateProject.providerIdentity
    })
  })

  it('keeps the requested id for an older host when there is no provider identity to fall back to', async () => {
    supportsCapability.mockResolvedValue(false)

    await expect(
      negotiateProjectSetupIdentity({
        target: { kind: 'environment', environmentId: 'gpu-vm' },
        projectId: 'git:gitlab.com/alice/app',
        providerIdentity: undefined,
        gitRemoteIdentity: undefined
      })
    ).resolves.toEqual({ projectId: 'git:gitlab.com/alice/app' })
  })
})
