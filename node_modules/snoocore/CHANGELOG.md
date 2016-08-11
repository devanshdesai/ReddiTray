# Changelog

View the [Migration Guide](http://snoocore.readme.io/v3.0.0/docs/migration-guide) for instructions on how to deal with breaking changes.

## 3.2.1

Fix for request errors from @donasaur

PR: https://github.com/trevorsenior/snoocore/pull/147

## 3.2.0

- PR from [@empyrical](https://github.com/empyrical) adds the ability to upload files
- Fix for CORS. Only use `X-User-Agent` when in cookie mode

## 3.1.2

Fix for bloated npm package. Caught by [@a9io](https://github.com/a9io).

- Ignore dist directory
- Remove lingering _site directory on npm

## 3.1.1

Add in new alias' for changing the servers:

serverOAuth -> apiServerUri
serverWWW -> authServerUri

https://github.com/trevorsenior/snoocore/pull/137#issuecomment-118185064

## 3.1.0

PR from [@empyrical](https://github.com/empyrical) adds a new feature to use browser cookies for authentication.

The documentation for this can be found here: http://snoocore.readme.io/v3.0.0/docs/using-existing-browser-cookies

## 3.0.2

- Expose application only auth function to prevent unecessary access token requests (broguht up by https://github.com/saiichihashimoto)


## 3.0.1

Bug fixes & enhancements.

Thanks to https://github.com/saiichihashimoto for reporting all of these!

- Issues #123, #124: Speed up fetching of access tokens
- Issue #125: Handle json.error HTTP 200 response from reddit
- Issue #126: Ensure that the given device_id is between 20-30 characters

## 3.0.0

**Breaking Changes**
- Removal of Cookie based authentication
- Removal of reddit.raw
- Removal of OAuth types web & installed
- New OAuth configuration
consumerKey → key
consumerSecret → secret
login.username → oauth.username
login.password → oauth.password


**Bug Fixes**
- Retry initial authentication when it fails
- Remove 'identity' as the default scope when no scopes provided


**New Features**
- Support for rate limit headers ("burst requests")
- Application only OAuth
- Requests time out after 20 seconds to prevent unresolved promises.
