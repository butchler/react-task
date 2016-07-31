const INITIAL_STEP_RESULT = { value: undefined, done: false, isError: false };

export function runProc(generatorFn, ...args) {
  const generator = generatorFn(...args);
  let cancelCurrentStep;

  const promise = new Promise((resolve, reject) => {
    const loopStep = stepResult => {
      // Call stepProc with the previous step's result until the generator is done.
      if (stepResult.done) {
        resolve(stepResult.value);
      } else {
        const stepPromise = stepProc(generator, stepResult);
        cancelCurrentStep = stepPromise.cancel;
        stepPromise.then(loopStep);
      }
    };

    loopStep(INITIAL_STEP_RESULT);
  });

  // Allow the proc to be cancelled. This can be used directly, but it can also be used with Promise
  // libraries like Bluebird to make it work properly with things like Promise.all.
  promise.cancel = () => {
    return cancelCurrentStep();
  };

  return promise;
}

export function stepProc(generator, previousResult = INITIAL_STEP_RESULT) {
  let waitingPromise = null;

  const waitOnPromise = (promise, resolve) => {
    waitingPromise = promise;

    promise.then(
      promiseResult => {
        resolve({ value: promiseResult, done: false, isError: false });
        waitingPromise = null;
      },
      error => {
        resolve({ value: error, done: false, isError: true });
        waitingPromise = null;
      });
  };

  const promise = new Promise((resolve, reject) => {
    const generatorResult = previousResult.isError ?
      generator.throw(previousResult.value) :
      generator.next(previousResult.value);

    if (generatorResult.done) {
      // If the generator is done, finish the step with the final result.
      resolve({ value: generatorResult.value, done: true, isError: false });
    } else if (isPromise(generatorResult.value)) {
      // If the generator yielded a promise, finish the step when the promise resolves.
      waitOnPromise(generatorResult.value, resolve);
    } else if (isCall(generatorResult.value)) {
      // If the generator yielded a call object, call the function contained in
      // the call object and resolve the result.
      const call = generatorResult.value;
      let callResult;

      try {
        callResult = executeCall(call);
      } catch (error) {
        // If there was an error while executing the call, send the error to the
        // next step so the generator can handle it.
        resolve({ value: error, done: false, isError: true });
        return;
      }

      if (isPromise(callResult) && !call.isSync) {
        // If the call returned a promise and it wasn't a synchronous call,
        // finish the step when the promise resolves.
        waitOnPromise(callResult, resolve);
      } else {
        // Otherwise, just finish the step immediately with the result of the call.
        resolve({ value: callResult, done: false, isError: false });
      }
    } else {
      // Throw an error if the generator yields anything else.
      reject(new Error('Procs should only yield promises or call objects ' +
        '(returned by call/callSync/apply/applySync).'));
    }
  });

  promise.cancel = () => {
    // If we're currently waiting on a promise that is cancellable, cancel it.
    if (waitingPromise && typeof waitingPromise.cancel === 'function') {
      waitingPromise.cancel();
    }

    return generator.return();
  };

  return promise;
}

const CALL = '@@react-task/proc.call';

// Helper functions for creating/working with call objects.
function createCall(context, fn, args, isSync) {
  return { [CALL]: { context, fn, args, isSync } };
}

export function call(fn, ...args) {
  return createCall(undefined, fn, args, false);
}
export function callSync(fn, ...args) {
  return createCall(undefined, fn, args, true);
}
export function apply(context, fn, args) {
  return createCall(context, fn, args, false);
}
export function applySync(context, fn, args) {
  return createCall(context, fn, args, true);
}

export function isCall(object) {
  return object && object[CALL] && typeof object[CALL].fn === 'function';
}

export function executeCall(object) {
  const call = object[CALL];

  return Function.prototype.apply.call(call.fn, call.context, call.args);
}

// Checks if an object is a Promise, using the loosest definition of promise
// possible so that the library will work with non-standard Promises.
export function isPromise(object) {
  return object && typeof object.then === 'function';
}
