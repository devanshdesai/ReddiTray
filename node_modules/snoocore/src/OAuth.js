import events from 'events';
import querystring from 'querystring';
import util from 'util';
import urlLib from 'url';

import when from 'when';

import * as u from './utils';

import Endpoint from './Endpoint';
import ResponseError from './ResponseError';

/*
   Various OAuth types
 */
export const TOKEN = {
  EXPLICIT: 'explicit',
  IMPLICIT: 'implicit',
  SCRIPT: 'script',
  APP_ONLY: 'app_only',
  REFRESH: 'refresh',
  INVALID: 'invalid_token' // Represents an unset/invalid token
};

/*
   Represents a single OAuth instance. Used primarily for internal
   use within the Snoocore class to manage two OAuth instances -
   Applicaton Only and an Authenticated Session.

 */
export default class OAuth extends events.EventEmitter {

  constructor(userConfig, request) {
    super();

    this._userConfig = userConfig;

    this._request = request;

    this.accessToken = TOKEN.INVALID;
    this.refreshToken = TOKEN.INVALID;
    this.tokenType = 'bearer';

    this.scope = this.normalizeScope();
  }

  /*
     Takes a given scope, and normalizes it to a proper string.
   */
  normalizeScope() {
    let scope;
    // Set to empty string if the scope if not set
    if (typeof this._userConfig.oauth.scope === 'undefined') {
      scope = '';
    }
    // convert an array into a string
    else if (util.isArray(this._userConfig.oauth.scope)) {
      scope = this._userConfig.oauth.scope.join(',');
    }
    return scope;
  }

  /*
     Do we have a refresh token defined?
   */
  hasRefreshToken() {
    return this.refreshToken !== TOKEN.INVALID;
  }

  /*
     Do we have an access token defined?
   */
  hasAccessToken() {
    return this.accessToken !== TOKEN.INVALID;
  }

  /*
     Get the current refresh token used for this instance.
   */
  getRefreshToken() {
    if (this.refreshToken === TOKEN.INVALID) {
      return undefined;
    }
    return this.refreshToken;
  }

  /*
     Get the current access token used for this instance.
   */
  getAccessToken() {
    if (this.accessToken === TOKEN.INVALID) {
      return undefined;
    }
    return this.accessToken;
  }

  /*
     Set the current refresh token used for this instance.
   */
  setRefreshToken(refreshToken) {
    this.refreshToken = refreshToken;
  }

  /*
     Set the current access token used for this instance.
   */
  setAccessToken(accessToken) {
    this.accessToken = accessToken;
  }

  getAuthorizationHeader() {
    return `${this.tokenType} ${this.accessToken}`;
  }

  /*
     Can we refresh our access token without user intervention?
   */
  canRefreshAccessToken() {
    return (this._userConfig.oauth.type === 'script') ||
           (this._userConfig.oauth.type === 'explicit' &&
             this._userConfig.oauth.duration === 'permanent' &&
             this.hasRefreshToken());
  }

  /*
     Get the Explicit Auth Url.
   */
  getExplicitAuthUrl(state) {

    let query = {};

    query.client_id = this._userConfig.oauth.key;
    query.state = u.thisOrThat(state, Math.ceil(Math.random() * 1000));
    query.redirect_uri = this._userConfig.oauth.redirectUri;
    query.duration = this._userConfig.oauth.duration;
    query.response_type = 'code';
    query.scope = this.scope;

    let baseUrl = `https://${this._userConfig.serverWWW}/api/v1/authorize`;

    if (this._userConfig.mobile) {
      baseUrl += '.compact';
    }

    return baseUrl + '?' + querystring.stringify(query);
  }

  /*
     Get the Implicit Auth Url.
   */
  getImplicitAuthUrl(state) {

    let query = {};

    query.client_id = this._userConfig.oauth.key;
    query.state = u.thisOrThat(state, Math.ceil(Math.random() * 1000));
    query.redirect_uri = this._userConfig.oauth.redirectUri;
    query.response_type = 'token';
    query.scope = this.scope;

    let baseUrl = `https://${this._userConfig.serverWWW}/api/v1/authorize`;

    if (this._userConfig.mobile) {
      baseUrl += '.compact';
    }

    return baseUrl + '?' + querystring.stringify(query);
  }

  getAuthUrl(state) {
    switch(this._userConfig.oauth.type) {
      case TOKEN.EXPLICIT:
        return this.getExplicitAuthUrl(state);
      case TOKEN.IMPLICIT:
        return this.getImplicitAuthUrl(state);
      default:
        throw new Error(
          `The oauth type of ${oauthType} does not require an url`);
    }
  }

  /*
     Returns the data needed to request an Applicaton Only
     OAuth access token.
   */
  getAppOnlyTokenData() {
    let params = {};

    params.scope = this.scope;

    // From the reddit documentation:
    //
    // - - -
    // "client_credentials"
    //
    // Confidential clients (web apps / scripts) not acting on
    // behalf of one or more logged out users.
    //
    // - - -
    // "https://oauth.reddit.com/grants/installed_client"
    //
    // * Installed app types (as these apps are considered
    // "non-confidential", have no secret, and thus, are
    // ineligible for client_credentials grant.
    //
    // * Other apps acting on behalf of one or more "logged out" users.
    //
    switch(this._userConfig.oauth.type) {
      case TOKEN.SCRIPT:
      case TOKEN.EXPLICIT:
        params.grant_type = 'client_credentials';
        break;
        // Also covers case TOKEN.IMPLICIT:
      default:
        params.grant_type = 'https://oauth.reddit.com/grants/installed_client';
        params.device_id = this._userConfig.oauth.deviceId;
    }

    return params;
  }

  /*
     Returns the data needed to request an authenticated OAuth
     access token.
   */
  getAuthenticatedTokenData(authorizationCode) {
    let params = {};

    params.scope = this.scope;

    switch (this._userConfig.oauth.type) {
      case TOKEN.SCRIPT:
        params.grant_type = 'password';
        params.username = this._userConfig.oauth.username;
        params.password = this._userConfig.oauth.password;
        break;
      case TOKEN.EXPLICIT:
        params.grant_type = 'authorization_code';
        params.client_id = this._userConfig.oauth.key;
        params.redirect_uri = this._userConfig.oauth.redirectUri;
        params.code = authorizationCode;
        break;
      default:
        return when.reject(new Error(
          'Invalid OAuth type specified (Authenticated OAuth).'));
    }

    return params;
  }

  /*
     Returns the data needed to request a refresh token.
   */
  getRefreshTokenData(refreshToken) {
    let params = {};
    params.scope = this.scope;
    params.grant_type = 'refresh_token';
    params.refresh_token = refreshToken;
    return params;
  }

  /*
     A method that sets up a call to receive an access/refresh token.
   */
  getToken(tokenEnum, options={}) {

    let params;

    switch(tokenEnum) {
      case TOKEN.REFRESH:
        params = this.getRefreshTokenData(options.refreshToken);
        break;
      case TOKEN.APP_ONLY:
        params = this.getAppOnlyTokenData();
        break;
      case TOKEN.SCRIPT:
      case TOKEN.EXPLICIT:
        params = this.getAuthenticatedTokenData(options.authorizationCode);
        break;
    }

    let headers = {};
    let buff = new Buffer(this._userConfig.oauth.key + ':' +
                          this._userConfig.oauth.secret);
    let base64 = (buff).toString('base64');
    let auth = `Basic ${base64}`;

    headers['Authorization'] = auth;

    let endpoint = new Endpoint(this._userConfig,
                                this._userConfig.serverWWW,
                                'post',
                                '/api/v1/access_token',
                                headers,
                                params,
                                {},
                                this._userConfig.serverWWWPort);

    let responseErrorHandler = (response, endpoint) => {
      if (String(response._status).indexOf('4') === 0) {
        return when.reject(new ResponseError(
          'Invalid getToken request', response, endpoint));
      }
      // else return the endpoint to try again
      return when.resolve(endpoint);
    };
    
    return this._request.https(endpoint, responseErrorHandler).then(res => {
      return JSON.parse(res._body);
    });
  }

  /*
     Sets the auth data from the oauth module to allow OAuth calls.

     This method can authenticate with:

     - Script based OAuth (no parameter)
     - Raw authentication data
     - Authorization Code (request_type = "code")
     - Access Token (request_type = "token") / Implicit OAuth
     - Application Only. (void 0, true);
   */
  auth(authCodeOrAccessToken, isApplicationOnly) {
    let tokenData;

    if (isApplicationOnly) {
      tokenData = this.getToken(TOKEN.APP_ONLY);
    } else {

      let token = this._userConfig.oauth.type;

      switch(token) {
        case TOKEN.SCRIPT:
          tokenData = this.getToken(token);
          break;

        case TOKEN.EXPLICIT:
          // auth code in this case
          tokenData = this.getToken(token, {
            authorizationCode: authCodeOrAccessToken
          });
          break;

        case TOKEN.IMPLICIT:
          // access token in this case
          tokenData = {
            access_token: authCodeOrAccessToken,
            token_type: 'bearer',
            expires_in: 3600,
            scope: this._userConfig.oauth.scope
          };
          break;

        default:
          throw new Error('Setting the auth data is no longer supported.');
      }
    }

    return when(tokenData).then(data => {

      if (typeof data !== 'object') {
        let str = String(data);
        return when.reject(new Error(
          `There was a problem authenticating:\n${str}`));
      }

      this.accessToken = data.access_token;
      this.tokenType = data.token_type;

      // If the explicit app used a perminant duration, send
      // back the refresh token that will be used to re-authenticate
      // later without user interaction.
      if (data.refresh_token) {
        // set the internal refresh token for automatic expiring
        // access_token management
        this.refreshToken = data.refresh_token;
        return this.refreshToken;
      }
    });
  }

  /*
     Only authenticates with Application Only OAuth
   */
  applicationOnlyAuth() {
    return this.auth(void 0, true);
  }

  /*
     Authenticate with a refresh token.
   */
  refresh(refreshToken) {

    // use the provided refresh token, or the current
    // one that we have for this class
    refreshToken = u.thisOrThat(refreshToken, this.refreshToken);

    return this.getToken(TOKEN.REFRESH, {
      refreshToken: refreshToken
    }).then(data => {
      // only set the internal refresh token if reddit
      // agrees that it was OK and sends back authData
      this.refreshToken = refreshToken;

      this.accessToken = data.access_token;
      this.tokenType = data.token_type;

      this.emit('access_token_refreshed', this.accessToken);
    });
  }

  /*
     Clears any authentication data & removes OAuth authentication

     By default it will only remove the "access_token". Specify
     the users refresh token to revoke that token instead.
   */
  deauth(refreshToken) {

    // no need to deauth if not authenticated
    if (!this.hasAccessToken()) {
      return when.resolve();
    }

    let isRefreshToken = typeof refreshToken === 'string';

    let token = isRefreshToken ? refreshToken : this.accessToken;

    let tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';

    let params = {
      token: token,
      token_type_hint: tokenTypeHint
    };

    let auth = 'Basic ' + (new Buffer(
      this._userConfig.oauth.key + ':' +
      this._userConfig.oauth.secret)).toString('base64');

    let headers = {
      'Authorization': auth
    };

    let endpoint = new Endpoint(this._userConfig,
                                this._userConfig.serverWWW,
                                'post',
                                '/api/v1/revoke_token',
                                headers,
                                params,
                                {},
                                this._userConfig.serverWWWPort);

    return this._request.https(endpoint).then(response => {
      // If we did not get back a 204 this then it did not sucessfully
      // revoke the token
      if (response._status !== 204) {
        return when.reject(new Error('Unable to revoke the given token'));
      }

      // clear the data for this OAuth object
      this.accessToken = TOKEN.INVALID;
      this.tokenType = TOKEN.INVALID;

      // only clear the refresh token if one was provided
      if (isRefreshToken) {
        this.refreshToken = TOKEN.INVALID;
      }
    });
  }

}
