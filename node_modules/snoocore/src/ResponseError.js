/*
   A uniform way to report response errors.
*/
export default class ResponseError extends Error {
  constructor(message, response, endpoint) {
    super();

    this.message = [
      message,
      '>>> Response Status: ' + response._status,
      '>>> Endpoint URL: '+ endpoint.url,
      '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2),
      '>>> Response Body:',
      response._body
    ].join('\n\n');

    this.url = endpoint.url;
    this.args = endpoint.args;
    this.status = response._status;
    this.body = response._body;
    this.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;
    this.endpoint = endpoint;
  }
}
