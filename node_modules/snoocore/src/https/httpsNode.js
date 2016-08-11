//
// Node requests
//

import httpsLib from 'https';
import urlLib from 'url';

import when from 'when';

import * as form from './form';

// Set to true to print useful http debug information on a lower level
let DEBUG_LOG = false ? console.error : ()=>{};

/*
   Form data can be a raw string, or an object containing key/value pairs
 */
export default function https(options, formData) {
  DEBUG_LOG('\n\n\n\n');
  DEBUG_LOG('>>> request:\n' +
            options.method + ': ' +
            options.hostname +
            options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  let data = form.getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  DEBUG_LOG('\n>>> request headers\n', options.headers);

  // stick the data at the end of the url for GET requests
  if (options.method === 'GET' && data.buffer.toString() !== '') {
    DEBUG_LOG('\n>>> query string:\n', data.buffer.toString());
    options.path += '?' + data.buffer.toString();
  }

  return when.promise(function(resolve, reject) {

    let req = httpsLib.request(options, function(res) {

      res._req = req; // attach a reference back to the request

      res.setEncoding('utf8');
      let body = '';
      res.on('error', error => { return reject(error); });
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        res._body = body; // attach the response body to the object
        res._status = res.statusCode;
        res._headers = res.headers;
        DEBUG_LOG('\n>>> response headers:\n', res._headers);
        DEBUG_LOG('\n>>> response body:\n', String(body).substring(0, 1000));
        DEBUG_LOG('\n>>> status:\n', res.statusCode);
        return resolve(res);
      });
    });

    req.on('error', error => { return reject(error); });

    if (options.method !== 'GET') {
      DEBUG_LOG('\n>>> request body:\n', data.buffer.toString());
      req.write(data.buffer);
    }

    req.end();

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
