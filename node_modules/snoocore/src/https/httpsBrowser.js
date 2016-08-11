//
// Browser requests, mirrors the syntax of the node requests
//

import urlLib from 'url';

import when from 'when';

import * as form from './form';

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#getAllResponseHeaders()

// Set to true to print useful http debug information on a lower level
let DEBUG_LOG = false ? console.error : ()=>{};

/**
 * Modified from https://gist.github.com/monsur/706839
 *
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  let headers = {};
  if (!headerStr) {
    return headers;
  }
  let headerPairs = headerStr.split('\u000d\u000a');
  for (let i = 0, len = headerPairs.length; i < len; i++) {
    let headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    let index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      // make all keys lowercase
      let key = headerPair.substring(0, index).toLowerCase();
      let val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

export default function https(options, formData) {

  DEBUG_LOG('>> browser https call');

  options = options || {};
  options.headers = options.headers || {};

  var data;

  if (formData.file) {
    data = form.getFormData(formData);
  } else {
    data = form.getData(formData);
    options.headers['Content-Type'] = data.contentType;
  }

  return when.promise((resolve, reject) => {

    try {
      if (options.method === 'GET' && data instanceof FormData) {
        return reject(new Error(
          'Cannot make a GET request while handling a file!'));
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new window.XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      DEBUG_LOG('>> url: ', url);

      // append the form data to the end of the url
      if (options.method === 'GET') {
        url += '?' + data.buffer.toString();
      }

      x.open(options.method, url, true);

      if (options.useBrowserCookies) {
        x.withCredentials = true;
      }

      Object.keys(options.headers).forEach(headerKey => {
        x.setRequestHeader(headerKey, options.headers[headerKey]);
      });

      x.onreadystatechange = () => {
        if (x.readyState > 3) {
          // Normalize the result to match how requestNode.js works

          DEBUG_LOG('finished...', x.status);

          return resolve({
            _body: x.responseText,
            _status: x.status,
            _headers: parseResponseHeaders(x.getAllResponseHeaders())
          });
        }
      };

      if (data instanceof FormData) {
        x.send(data);
      } else {
        x.send(options.method === 'GET' ? null : data.buffer.toString());
      }

    } catch (e) {
      return reject(e);
    }

  }).then(res => {
    let canRedirect = (String(res._status).substring(0, 1) === '3' &&
      typeof res._headers.location !== 'undefined');

    if (canRedirect) {
      // Make the call again with the new hostname, path, and form data
      let parsed = urlLib.parse(res._headers.location);
      options.hostname = parsed.hostname;
      options.path = parsed.pathname;
      return https(options, parsed.query);
    }

    return res;
  });
}
