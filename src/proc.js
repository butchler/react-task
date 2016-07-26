export default class Proc {
  constructor(generatorFn, ...args) {
    this.generatorFn = generatorFn;
    this.args = args;
  }

  start() {
    // Don't do anything if already started.
    if (this.generator) {
      return;
    }

    this.generator = this.generatorFn(...this.args);

    // Make sure that the function is actually a generator function, or at
    // least something that pretends to be one.
    if (!(this.generator &&
          typeof this.generator.next === 'function' &&
          typeof this.generator.throw === 'function' &&
          typeof this.generator.return === 'function')) {
      throw new Error(`Function supplied to Proc did not return a generator: ${this.generator}`);
    }

    this._continueExecution(undefined, false);
  }

  _continueExecution(returnedValue, isError) {
    // Send the previous call's return value to the generator and get the next
    // value that the generator yields, which should be a call object.
    const generatorResult = isError ?
      this.generator.throw(returnedValue) :
      this.generator.next(returnedValue);

    // Stop execution if the generator has finished.
    if (generatorResult.done) {
      this.generator = null;
      return;
    }

    // Stop and throw an error if the value returned by the generator was not a
    // valid call object.
    if (!Proc.isCall(generatorResult.value)) {
      this.stop();
      throw new Error(`Value yielded by generator was not a valid Proc.call object: ${generatorResult.value}`);
    }

    // Actually call the function and make the generator handle any errors.
    let callResult;

    try {
      callResult = Proc.doCall(generatorResult.value);
    } catch (error) {
      this._continueExecution(error, true);
      return;
    }

    // Wrapping the return value in Promise.resolve will allow us to treat it
    // like a promise even if it is just a normal value, while still allowing
    // promises to work normally.
    const promise = Promise.resolve(callResult);
    promise.then(result => {
      this._continueExecution(result, false);
    }).catch(error => {
      this._continueExecution(error, true);
    });

    // Save the returned promise's cancel method if it has one.
    if (callResult && typeof callResult[Proc.CANCEL_PROMISE] === 'function') {
      promise[Proc.CANCEL_PROMISE] = callResult[Proc.CANCEL_PROMISE];
    }

    this.lastPromise = promise;
  }

  stop() {
    // Don't do anything if already stopped.
    if (!this.generator) {
      return;
    }

    // The will cause all future calls to this.generator.next() to return {
    // value: undefined, done: true }, which will let _continueExecution know
    // that it should stop.
    this.generator.return();
    this.generator = null;

    // If the most recent promise has a cancel method, call it when the proc
    // gets stopped.
    if (this.lastPromise && typeof this.lastPromise[Proc.CANCEL_PROMISE] === 'function') {
      this.lastPromise[Proc.CANCEL_PROMISE]();
      this.lastPromise = null;
    }
  }
}

// Helper functions to create and execute call objects.
Proc.CALL   = 'Proc/call';
Proc.call   = (fn, ...args) => Proc.apply(undefined, fn, args);
Proc.apply  = (context, fn, args) => ({ [Proc.CALL]: { context, fn, args } });
Proc.doCall = call => {
  const { context, fn, args } = call[Proc.CALL];

  return fn.apply(context, args);
};
Proc.isCall = call => {
  if (!(call && call[Proc.CALL])) {
    return false;
  }

  const { context, fn, args } = call[Proc.CALL];

  return typeof fn === 'function' && Array.isArray(args);
};
