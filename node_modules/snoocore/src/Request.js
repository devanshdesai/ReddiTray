import querystring from 'querystring';
import events from 'events';

import when from 'when';
import delay from 'when/delay';

import * as u from './utils';

import ResponseError from './ResponseError';

import httpsNode from './https/httpsNode';
import httpsBrowser from './https/httpsBrowser';

const rawHttps = u.isNode() ? httpsNode : httpsBrowser;

export default class Request extends events.EventEmitter {

  constructor (throttle) {
    super();
    this._throttle = throttle;
  }

  /*
     Makes an https call with a given endpoint.

     If an error handler is provided, it will call it in
     the case of a returned status that is not 2xx / success.

     If the errorHandler results in a rejected promise, then we will NOT
     retry the endpoint and reject with the given error.
   */
  https(endpoint, responseErrorHandler) {
    return this._throttle.wait().then(()=> {

      let reqOptions = {
        method: endpoint.method.toUpperCase(),
        hostname: endpoint.hostname,
        path: endpoint.computedPath,
        headers: endpoint.headers,
        useBrowserCookies: endpoint._userConfig.useBrowserCookies
      };

      // @TODO Node.js has issues if you set it to 80?
      if (endpoint.port !== 80) {
        reqOptions.port = endpoint.port;
      }

      let formData = endpoint.args;

      return rawHttps(reqOptions, formData).timeout(
        endpoint.contextOptions.requestTimeout,
        new ResponseError('The request has timed out', {}, endpoint)
      ).then(response => {

        let statusChar = String(response._status).substring(0, 1);
        let success = statusChar === '2';

        // If success we're done!
        if (success) {
          return response;
        }

        // Else, retry the endpoint if we can.
        endpoint.contextOptions.retryAttemptsLeft--;

        let responseError;
        responseError = new ResponseError('Response Error',
                                          response,
                                          endpoint);

        this.emit('response_error', responseError);

        if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
          responseError.message = ('All retry attempts exhausted.\n\n' +
                                   responseError.message);
          return when.reject(responseError);
        }

        // Use the given response error handler, or use a thin wrapper that
        // will return the endpoint without any modifications
        responseErrorHandler = responseErrorHandler || function(response, endpoint) {
          return when.resolve(endpoint);
        };

        // Call the error handler. If not rejected, retry the endpoint
        // with any modifications made by the responseErrorHandler
        return responseErrorHandler(response, endpoint).then(modifiedEndpoint => {

          // Only have a retry delay if the endpoint had an HTTP 5xx status
          let retryDelay = (statusChar === '5') ?
                           modifiedEndpoint.contextOptions.retryDelay :
                           0;

          return delay(retryDelay).then(()=> {
            return this.https(modifiedEndpoint, responseErrorHandler);
          });
        });
      });

    });
  }
}
