import urlLib from 'url';

import * as u from './utils';

export default class Endpoint {

  constructor(userConfig,
              hostname, method, path, headers={},
              givenArgs={}, givenContextOptions={}, port=80)
  {
    this._userConfig = userConfig;

    this.hostname = hostname;
    this.port = port;
    this.method = method;
    this.path = path;
    this.headers = headers;

    this.contextOptions = this.normalizeContextOptions(givenContextOptions);

    this.givenArgs = givenArgs;
    this.args = this.buildArgs();
    this.url = this.buildUrl();
    this.computedPath = urlLib.parse(this.url).path;
  }

  setHeaders(headers) {
    this.headers = headers;
  }

  /*
     Returns a set of options that effect how each call to reddit behaves.
   */
  normalizeContextOptions(givenContextOptions) {

    let cOptions = givenContextOptions || {};

    // by default we do not bypass authentication
    cOptions.bypassAuth = u.thisOrThat(cOptions.bypassAuth, false);

    // decode html enntities for this call?
    cOptions.decodeHtmlEntities = u.thisOrThat(cOptions.decodeHtmlEntities,
                                               this._userConfig.decodeHtmlEntities);

    // how many attempts left do we have to retry an endpoint?

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // context options if not specified
    cOptions.retryAttemptsLeft = u.thisOrThat(cOptions.retryAttemptsLeft,
                                              cOptions.retryAttempts);

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // user configuration
    cOptions.retryAttemptsLeft = u.thisOrThat(cOptions.retryAttemptsLeft,
                                              this._userConfig.retryAttempts);

    // delay between retrying an endpoint
    cOptions.retryDelay = u.thisOrThat(cOptions.retryDelay,
                                       this._userConfig.retryDelay);

    // milliseconds before a request times out
    cOptions.requestTimeout = u.thisOrThat(cOptions.requestTimeout,
                                           this._userConfig.requestTimeout);

    // how many reauthentication attempts do we have left?
    cOptions.reauthAttemptsLeft = u.thisOrThat(cOptions.reauthAttemptsLeft,
                                               cOptions.retryAttemptsLeft);

    return cOptions;
  }

  /*
     Build the arguments that we will send to reddit in our
     request. These customize the request that we send to reddit
   */
  buildArgs() {
    let args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (let key in this.givenArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = this.givenArgs[key];
      }
    }

    let apiType = u.thisOrThat(this.contextOptions.api_type,
                               this._userConfig.apiType);

    if (apiType) {
      args.api_type = apiType;
    }

    return args;
  }

  /*
     Builds the URL that we will query reddit with.
   */
  buildUrl() {
    let url = this.hostname;

    if (this.port !== 80) {
      url += ':' + this.port;
    }

    let path = this.path;
    if (path.substring(0, 1) !== '/') {
      path = '/' + path;
    }

    url += path;

    url = replaceUrlParams(url, this.givenArgs);
    url = url.replace('//', '/');
    url = 'https://' + url;
    return url;
  }

}


/*
   Takes an url, and an object of url parameters and replaces
   them, e.g.

   endpointUrl:
   'http://example.com/$foo/$bar/test.html'

   this.givenArgs: { $foo: 'hello', $bar: 'world' }

   would output:

   'http://example.com/hello/world/test.html'
 */
export function replaceUrlParams(endpointUrl, givenArgs) {
  // nothing to replace!
  if (endpointUrl.indexOf('$') === -1) {
    return endpointUrl;
  }

  // pull out variables from the url
  let params = endpointUrl.match(/\$[\w\.]+/g);

  // replace with the argument provided
  params.forEach(param => {
    if (typeof givenArgs[param] === 'undefined') {
      throw new Error('missing required url parameter ' + param);
    }
    endpointUrl = endpointUrl.replace(param, givenArgs[param]);
  });

  return endpointUrl;
}
