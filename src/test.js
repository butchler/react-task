import deepEqual from 'deep-equal';

import Task from './task';
import Proc from './proc';

export default class TaskTester {
  constructor(element) {
    // TODO: Find out why this doesn't work without .prototype
    if (!(element.type.prototype instanceof Task)) {
      throw new Error('Element given to TaskTester was not an instance of Task.');
    }

    this.generator = element.props.generator ?
      element.props.generator(element.props) :
      (new element.type(element.props)).run();
  }

  /**
   * Throws an error if the next call object that the generator yields doesn't
   * match the given function and arguments.
   */
  calls(fn, ...args) {
    return this.applies(undefined, fn, args);
  }

  /**
   * Throws an error if the next call object that the generator yields doesn't
   * match the given context, function, and arguments.
   */
  applies(context, fn, args) {
    const result = this._next();
    const expectedResult = { done: false, value: Proc.apply(context, fn, args) };

    if (!deepEqual(result, expectedResult)) {
      throw new Error('Task did not yield expected value.');
    }

    return this;
  }

  _next() {
    if (this.nextReturnValue) {
      const { value, isError } = this.nextReturnValue;
      this.nextReturnValue = null;

      return isError ?
        this.generator.throw(value) :
        this.generator.next(value);
    } else {
      return this.generator.next();
    }
  }

  /**
   * Causes the given value to be passed to this.generator.next() the next time
   * calls() or applies() is called.
   */
  returns(value) {
    this.nextReturnValue = { value, isError: false };

    return this;
  }

  /**
   * Causes the given value to be passed to this.generator.throw() the next
   * time calls() or applies() is called.
   */
  throws(error) {
    this.nextReturnValue = { value: error, isError: true };

    return this;
  }

  /**
   * Throws an error if the generator yields another value instead of returning
   * or ending.
   */
  ends() {
    const result = this.generator.next();

    if (result.done !== true) {
      throw new Error('Task did not end.');
    }

    return this;
  }
}
