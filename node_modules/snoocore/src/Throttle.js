/*
   A basic throttle manager. Exposes 1 functoin `wait` that
   will return a promise that resolves once we've waited the proper
   amount of time, e.g.

   var throttle = new Throttle();

   throttle.wait() // resolves after 1ms
   throttle.wait() // resolves after 10001ms
   throttle.wait() // resolves after 2001ms

 */

import when from 'when';
import delay from 'when/delay';

export default class Throttle {

  constructor(throttleMs=1000) {

    this._throttleMs = throttleMs;

    /*
       The current throttle delay before a request will go through
       increments every time a call is made, and is reduced when a
       call finishes.

       Time is added & removed based on the throttle variable.
     */
    this._throttleDelay = 1;
  }

  wait() {
    // resolve this promise after the current throttleDelay
    let delayPromise = delay(this._throttleDelay);

    // add throttleMs to the total throttleDelay
    this._throttleDelay += this._throttleMs;

    // after throttleMs time, subtract throttleMs from
    // the throttleDelay
    setTimeout(()=> {
      this._throttleDelay -= this._throttleMs;
    }, this._throttleMs);

    return delayPromise;
  }

  /*
     Time in milliseconds to add to the throttle delay
  */
  addTime(timeMs) {
    this._throttleDelay += timeMs;
  }
}
