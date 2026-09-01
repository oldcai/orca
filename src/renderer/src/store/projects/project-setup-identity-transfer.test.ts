import { describe, expect, it } from 'vitest'
import { redactProjectGitRemoteIdentityForTransfer } from './project-setup-identity-transfer'

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
