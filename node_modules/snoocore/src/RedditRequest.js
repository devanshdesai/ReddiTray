
// node modules
import util from 'util';
import events from 'events';
import urlLib from 'url';

// npm modules
import when from 'when';
import delay from 'when/delay';
import he from 'he';

// our modules
import Request from './Request';
import Endpoint from './Endpoint';
import ResponseError from './ResponseError';

/*
   A collection of functions that deal with requesting data from the
   reddit API.
 */
export default class RedditRequest extends events.EventEmitter {

  constructor(userConfig, request, oauth, oauthAppOnly, modhash) {
    super();
    this._request = request;
    this._userConfig = userConfig;
    this._oauth = oauth;
    this._oauthAppOnly = oauthAppOnly;
    this._modhash = modhash;
  }

  /*
     Currently application only?

     If we do not have an access token and there is no way
     to get a new access token then yes! We are application
     only oauth.
   */
  isApplicationOnly() {
    return !this._oauth.hasAccessToken() && !this._oauth.canRefreshAccessToken();
  }

  /*
     Are we currently authenticated?
   */
  isAuthenticated() {
    return this.isApplicationOnly() ?
           this._oauthAppOnly.hasAccessToken() :
           this._oauth.hasAccessToken();
  }

  /*
     Builds up the headers for an endpoint.
   */
  buildHeaders(contextOptions={}) {
    let headers = {};

    if (this._userConfig.isNode) {
      // Can't set User-Agent in browser
      headers['User-Agent'] = this._userConfig.userAgent;
    }

    if (this._userConfig.useBrowserCookies) {
      headers['X-User-Agent'] = this._userConfig.userAgent;

      if (this._modhash.hasModhash() && !this._modhash.isModhashOld()) {
        headers['X-Modhash'] = this._modhash.getCurrentModhash();
      }
    }

    if (!this._userConfig.useBrowserCookies) {
      if (contextOptions.bypassAuth || this.isApplicationOnly()) {
        headers['Authorization'] = this._oauthAppOnly.getAuthorizationHeader();
      } else {
        headers['Authorization'] = this._oauth.getAuthorizationHeader();
      }
    }

    return headers;
  }

  /*
     Call the reddit api.
   */
  callRedditApi(endpoint) {
    // Authenticate if needed before making a call.
    //
    // Eliminates unwanted 401 errors when making initial calls
    // on Application only OAuth & Script instances where calling
    // `.auth()` isn't required.
    let auth = this.isAuthenticated() ? when.resolve() : (() => {
      return this.authenticate(endpoint).then(() => {
        // rebuild endpoint with new headers
        endpoint = new Endpoint(this._userConfig,
                                 endpoint.hostname,
                                 endpoint.method,
                                 endpoint.path,
                                 this.buildHeaders(
                                   endpoint.contextOptions),
                                 endpoint.givenArgs,
                                 endpoint.contextOptions,
                                 endpoint.port);

      });
    })();

    return auth.then(() => {
      let requestPromise = this._request.https(
        endpoint, this.responseErrorHandler.bind(this));

      return requestPromise.then(response => {
        return this.handleSuccessResponse(response, endpoint);
      });
    });
  }

  /*
     Authenticate with the appropriate OAuth type for a given
     endpoint
   */
  authenticate(endpoint) {
    let authPromise;

    // If we are application only, or are bypassing authentication
    // therefore we're using application only OAuth
    if (this._userConfig.useBrowserCookies) {
      if (endpoint.method === 'post') {
        authPromise = this._modhash.getModhash();
      } else {
        authPromise = when.resolve();
      }
    }
    else if (this.isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
      authPromise = this._oauthAppOnly.applicationOnlyAuth();
    }
    else if (this._oauth.canRefreshAccessToken()) {
      // If we have been authenticated with a permanent refresh token use it
      if (this._oauth.hasRefreshToken()) {
        authPromise = this._oauth.refresh();
      }
      // If we are OAuth type script we can call `.auth` again
      else if (this._userConfig.isOAuthType('script')) {
        authPromise = this._oauth.auth();
      }
    }
    // No way to authenticate
    else {
      return when.reject(new Error('Unable to authenticate'));
    }

    return authPromise;
  }

  /*
     Handle a request errors from reddit. This is usually caused when our
     access_token has expired, or reddit servers are under heavy load.

     If we can't renew our access token, we throw an error / emit the
     'access_token_expired' event that users can then handle to
     re-authenticatet clients

     If we can renew our access token, we try to reauthenticate, and call the
     reddit endpoint again.
   */
  responseErrorHandler(response, endpoint) {

    // - - -
    // Check headers for more specific errors.

    let wwwAuth = response._headers['www-authenticate'];

    if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
      return when.reject(new ResponseError(
        'Insufficient scopes provided for this call',
        response,
        endpoint));
    }

    // - - -
    // 404 - Page not found
    if (response._status === 404) {
      let msg = 'Page not found. Is this a valid endpoint?';
      return when.reject(new ResponseError(msg, response, endpoint));
    }

    // - - -
    // Access token has expired
    if (response._status === 401 && !this._userConfig.useBrowserCookies) {

      // Atempt to get a new access token!
      let reauthPromise = this.authenticate(endpoint);

      return reauthPromise.then(() => {
        // refresh the authentication headers for this endpoint
        endpoint.setHeaders(this.buildHeaders(endpoint.contextOptions));

        let modifiedEndpoint = new Endpoint(this._userConfig,
                                            endpoint.hostname,
                                            endpoint.method,
                                            endpoint.path,
                                            this.buildHeaders(
                                              endpoint.contextOptions),
                                            endpoint.givenArgs,
                                            endpoint.contextOptions,
                                            endpoint.port);

        return when.resolve(modifiedEndpoint);
      }).catch(error => {
        this.emit('access_token_expired');

        let msg = 'Access token has expired. Listen for ' +
                   'the "access_token_expired" event to ' +
                     'handle this gracefully in your app.';
        return when.reject(new ResponseError(msg, response, endpoint));
      });
    }

    // - - -
    // Access token has expired and we're trying to authenticate without OAuth
    if (response._status === 401 && !this._userConfig.useBrowserCookies) {
      let msg = 'Access token required to access this endpoint.';
      return when.reject(new ResponseError(msg, response, endpoint));
    }

    // - - -
    // Reddit servers are busy. Can't do much here.

    if (String(response._status).substring(0, 1) === '5') {
      let modifiedEndpoint = new Endpoint(this._userConfig,
                                          endpoint.hostname,
                                          endpoint.method,
                                          endpoint.path,
                                          this.buildHeaders(
                                            endpoint.contextOptions),
                                          endpoint.givenArgs,
                                          endpoint.contextOptions,
                                          endpoint.port);

      return when.resolve(modifiedEndpoint);
    }

    // - - -
    // At the end of the day, we just throw an error stating that there
    // is nothing we can do & give general advice
    return when.reject(new ResponseError(
      ('This call failed. ' +
       'Does this call require a user? ' +
       'Is the user missing reddit gold? ' +
       'Trying to change a subreddit that the user does not moderate? ' +
       'This is an unrecoverable error. Check the rest of the ' +
       'error message for more information.'),
      response,
      endpoint));
  }

  /*
     Handle reddit response status of 2xx.

     Finally return the data if there were no problems.
   */
  handleSuccessResponse(response, endpoint) {

    let data = response._body || '';

    if (endpoint.contextOptions.decodeHtmlEntities) {
      data = he.decode(data);
    }

    // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
    try {
      data = JSON.parse(data);

      // Reddit isn't always honest in their response status. Check for
      // any errors in 2xx http statuses

      // data.json.errors
      if (data.json && data.json.errors && data.json.errors.length > 0) {
        return when.reject(new ResponseError('', response, endpoint));
      }

      // data.json.error
      if (data.json && data.json.error) {
        return when.reject(new ResponseError('', response, endpoint));
      }

    } catch(e) {}


    let rateLimitRemaining = response._headers['x-ratelimit-remaining'];
    let rateLimitUsed = response._headers['x-ratelimit-used'];
    let rateLimitReset = response._headers['x-ratelimit-reset'];

    let rateLimitData = {
      rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : void 0,
      rateLimitUsed: rateLimitUsed ? Number(rateLimitUsed) : void 0,
      rateLimitReset: rateLimitReset ? Number(rateLimitReset) : void 0
    };

    if (typeof rateLimitData.rateLimitUsed !== 'undefined') {
      this.emit('rate_limit', rateLimitData);
    }

    // Using a test variable
    // this._userConfig.__test.rateLimitRemainingCutoff
    // it's default value is "0", however in the tests cases this
    // would take too long.
    let cutoff = this._userConfig.__test.rateLimitRemainingCutoff;

    if (typeof rateLimitData.rateLimitRemaining !== 'undefined' &&
      Number(rateLimitRemaining) <= cutoff)
    {
      this.emit('rate_limit_reached', rateLimitData);
    }

    if (this._userConfig.useBrowserCookies && data.data &&
        data.data.modhash && data.data.modhash.length) {
      this._modhash.setModhash(data.data.modhash);
    }

    return when.resolve(data);
  }

  /*
     Listing support.
   */
  getListing(endpoint) {

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    let count = 0;
    let limit = endpoint.args.limit || 25;
    // keep a reference to the start of this listing
    let start = endpoint.args.after || null;

    let getSlice = (endpoint) => {

      return this.callRedditApi(endpoint).then((result={}) => {

        let slice = {};
        let listing = result;

        slice.get = result;

        if (result instanceof Array) {
          if (typeof endpoint.contextOptions.listingIndex === 'undefined') {
            throw new Error('Must specify a `listingIndex` for this listing.');
          }

          listing = result[endpoint.contextOptions.listingIndex];
        }

        slice.count = count;

        slice.before = listing.data.before || null;
        slice.after = listing.data.after || null;
        slice.allChildren = listing.data.children || [];

        slice.empty = slice.allChildren.length === 0;

        slice.children = slice.allChildren.filter(function(child) {
          child.data = child.data || {};
          return !child.data.stickied;
        });

        slice.stickied = slice.allChildren.filter(function(child) {
          child.data = child.data || {};
          return child.data.stickied;
        });

        slice.next = () => {
          count += limit;

          let newArgs = endpoint.givenArgs;
          newArgs.before = null;
          newArgs.after = slice.children[slice.children.length - 1].data.name;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.hostname,
                                       endpoint.method,
                                       endpoint.path,
                                       this.buildHeaders(endpoint.contextOptions),
                                       newArgs,
                                       endpoint.contextOptions,
                                       endpoint.port));
        };

        slice.previous = () => {
          count -= limit;

          let newArgs = endpoint.givenArgs;
          newArgs.before = slice.children[0].data.name;
          newArgs.after = null;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.hostname,
                                       endpoint.method,
                                       endpoint.path,
                                       this.buildHeaders(endpoint.contextOptions),
                                       newArgs,
                                       endpoint.contextOptions,
                                       endpoint.port));
        };

        slice.start = () => {
          count = 0;

          let newArgs = endpoint.givenArgs;
          newArgs.before = null;
          newArgs.after = start;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.hostname,
                                       endpoint.method,
                                       endpoint.path,
                                       this.buildHeaders(endpoint.contextOptions),
                                       newArgs,
                                       endpoint.contextOptions,
                                       endpoint.port));
        };

        slice.requery = () => {
          return getSlice(endpoint);
        };

        return slice;
      });

    };

    return getSlice(endpoint);
  }

  /*
     Enable path syntax support, e.g. this.path('/path/to/$endpoint/etc')

     Can take an url as well, but the first part of the url is chopped
     off because it is not needed. We will always use the server oauth
     to call the API...

     e.g. https://www.example.com/api/v1/me

     will only use the path: /api/v1/me
   */
  path(urlOrPath) {

    let parsed = urlLib.parse(urlOrPath);
    let path = parsed.pathname;

    let calls = {};

    ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(verb => {
      calls[verb] = (userGivenArgs, userContextOptions) => {
        return this.callRedditApi(new Endpoint(this._userConfig,
                                               this._userConfig.serverOAuth,
                                               verb,
                                               path,
                                               this.buildHeaders(userContextOptions),
                                               userGivenArgs,
                                               userContextOptions,
                                               this._userConfig.serverOAuthPort));
      };
    });

    // Add listing support
    calls.listing = (userGivenArgs, userContextOptions) => {
      return this.getListing(new Endpoint(this._userConfig,
                                          this._userConfig.serverOAuth,
                                          'get',
                                          path,
                                          this.buildHeaders(userContextOptions),
                                          userGivenArgs,
                                          userContextOptions,
                                          this._userConfig.serverOAuthPort));
    };

    return calls;
  }

}
