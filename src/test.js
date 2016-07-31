import Task from './task';
import { apply, applySync, isPromise } from './proc';
// TODO: Allow using the deepEqual function from the testing framework.
import deepEqual from 'deep-equal';

export default class TaskTester {
  constructor(element) {
    // TODO: Throw an error if element isn't a subclass of Task.
    const task = new element.type();

    // Set the props so they can be referenced by the run() method.
    task.props = element.props;

    // Save a reference to the getProps function so that tests can reference
    // calls to it.
    this.getProps = task.getProps.bind(task);

    const generatorFn = task.getGeneratorFunction(element.props);
    this.generator = generatorFn(element.props, this.getProps);
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
    const result = this._step();

    // For testing we don't care if the call was synchronous or not, because we
    // can fake the return value anyway.
    const expectedCall = { done: false, value: apply(context, fn, args) };
    const expectedCallSync = { done: false, value: applySync(context, fn, args) };

    if (!(deepEqual(result, expectedCall) || deepEqual(result, expectedCallSync))) {
      throw new Error('Task did not yield expected value.');
    }

    return this;
  }

  yieldsPromise() {
    const result = this._step();

    if (!isPromise(result.value)) {
      throw new Error('Task yielded something other than a promise.');
    }

    return this;
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
   * Skips over the next value returned by the generator without performing any
   * checks.
   */
  skip() {
    this._step();

    return this;
  }

  /**
   * Throws an error if the generator yields another value instead of returning
   * or ending.
   */
  ends() {
    const result = this._step();

    if (result.done !== true) {
      throw new Error('Task did not end.');
    }

    return this;
  }

  /**
   * Returns the next value returned by the generator.
   */
  _step() {
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
}
