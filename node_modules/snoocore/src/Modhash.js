import events from 'events';

import when from 'when';

import * as u from './utils';

import Endpoint from './Endpoint';
import ResponseError from './ResponseError';

export default class Modhash extends events.EventEmitter {

  constructor(userConfig, request) {
    super();

    this._userConfig = userConfig;

    this._request = request;

    this.modhash = '';
    this.modhashRefreshed = 0;
  }

  isModhashOld() {
    // 10 minutes by default
    let timeout = 10 * 60 * 1000;

    return (Date.now() - this.modhashRefreshed) > timeout;
  }

  setModhash(modhash) {
    this.modhash = modhash;
    this.modhashRefreshed = Date.now();
  }

  hasModhash() {
    return !!this.modhash.length;
  }

  /*
     Get the current cached modhash.
   */
  getCurrentModhash() {
    if (!this.hasModhash()) {
      return undefined;
    }
    return this.modhash;
  }

  refreshModhash() {
    let endpoint = new Endpoint(this._userConfig,
                                this._userConfig.serverWWW,
                                'get',
                                '/api/me.json',
                                {},
                                {},
                                {},
                                this._userConfig.serverWWWPort);

    let responseErrorHandler = (response, endpoint) => {
      if (String(response._status).indexOf('4') === 0) {
        return when.reject(new ResponseError(
          'Invalid refreshModhash request', response, endpoint));
      }
      // else return the endpoint to try again
      return when.resolve(endpoint);
    };
    
    return this._request.https(endpoint, responseErrorHandler).then(res => {
      let response = JSON.parse(res._body);

      if (!response.data) {
        throw new ResponseError(
          'Invalid refreshModhash response. Are you logged in?', response, endpoint);
      } else {
        this.setModhash(response.data.modhash);

        return {
          modhash: response.data.modhash
        };
      }
    });
  }

  getModhash() {
    if (!this.isModhashOld()) {
      return when.resolve({
        modhash: this.modhash
      });
    } else {
      return this.refreshModhash();
    }
  }
}