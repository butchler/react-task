export const
  RESULT_TYPE_NORMAL = 0,
  RESULT_TYPE_ERROR  = 1,
  RESULT_TYPE_RETURN = 2,
  RESULT_TYPE_WAIT   = 3,
  RESULT_TYPE_DONE   = 4;

const CALL = '@@react-task/proc.call';

const INITIAL_STEP_RESULT = { value: undefined, type: RESULT_TYPE_NORMAL };
const STOP_STEP_RESULT = { value: undefined, type: RESULT_TYPE_RETURN };

export function run(generatorFn, ...args) {
  return runProc(generatorFn(...args));
}

export function runProc(generator, onStep) {
  let onCancel;

  const promise = new Promise((resolve, reject) => {
    let currentStep = null;
    let callSyncPromises = [];

    const cancelCallSyncPromises = () => {
      callSyncPromises.forEach(promise => {
        if (typeof promise.cancel === 'function') {
          promise.cancel();
        }
      });
    };

    const loopStep = stepResult => {
      if (isPromise(stepResult.value)) {
        // Normally, stepProc waits on the promise if a `call()` returns a
        // promise. However, stepProc can return a promise if the proc yields a
        // call to callSync with a function that returns a promise.
        //
        // Save all promises returned by either of these methods so that we can
        // call their `cancel` method (if they have one) when the proc ends.
        //
        // For example, this means that if you spawn other procs from one proc:
        //
        // ```
        // function* parentProc() {
        //   const childPromise1 = yield callSync(run, childProc1);
        //   const childPromise2 = yield callSync(run, childProc2);
        //   const first = yield Promise.race([childPromise1, childPromise2]);
        //   yield callMethod(console, 'log', 'First result: ', first);
        // }
        // ```
        //
        // Then childPromise1.cancel() and childPromise2.cancel() will be called
        // when parentProc gets cancelled or ends normally.
        //
        // If you want to account for the fact that promises can have multiple
        // consumers, then you may want to consider using a promise library that
        // has support for cancellation, such as Bluebird:
        //
        // http://bluebirdjs.com/docs/api/cancellation.html#what-about-promises-that-have-multiple-consumers
        callSyncPromises.push(stepResult.value);
      }

      // Call stepProc with the previous step's result until the generator is done.
      if (stepResult.type === RESULT_TYPE_DONE) {
        currentStep = null;
        cancelCallSyncPromises();
        resolve(stepResult.value);
      } else {
        currentStep = stepProcSynchronous(generator, stepResult);

        if (currentStep.type === RESULT_TYPE_WAIT) {
          currentStep.value.then(loopStep, reject);
        } else {
          Promise.resolve(currentStep).then(loopStep);
        }

        if (onStep) {
          onStep(currentStep);
        }
      }
    };

    onCancel = () => {
      // Cancel the promise if we're currently waiting on a promise.
      if (currentStep && currentStep.type === RESULT_TYPE_WAIT) {
        currentStep.value.cancel();
      }

      loopStep(STOP_STEP_RESULT);
    };

    loopStep(INITIAL_STEP_RESULT);
  });

  promise.cancel = () => {
    onCancel();
  };

  return promise;
}

export function stepProc(generator, previousResult = INITIAL_STEP_RESULT) {
  let stepPromise = null;

  const promise = new Promise((resolve, reject) => {
    const stepResult = stepProcSynchronous(generator, previousResult);

    if (stepResult.type === RESULT_TYPE_WAIT) {
      stepPromise = stepResult.value;
      stepPromise.then(resolve, reject);
    } else {
      Promise.resolve(stepResult).then(resolve);
    }
  });

  promise.cancel = () => {
    if (stepPromise) {
      stepPromise.cancel();
    }
  };

  return promise;
}

export function stepProcSynchronous(generator, previousResult = INITIAL_STEP_RESULT) {
  if (!isGenerator(generator)) {
    throw new TypeError('First argument to stepProc must be a generator ' +
      '(not a generator function).');
  }

  if (!(previousResult.hasOwnProperty('value') &&
        previousResult.type >= RESULT_TYPE_NORMAL &&
        previousResult.type <= RESULT_TYPE_DONE)) {
    throw new TypeError('stepProc got bad previousResult.');
  }

  let generatorResult;

  switch (previousResult.type) {
    case RESULT_TYPE_ERROR:
      generatorResult = generator.throw(previousResult.value);
      break;
    case RESULT_TYPE_RETURN:
      generatorResult = generator.return(previousResult.value);
      break;
    default:
      generatorResult = generator.next(previousResult.value);
      break;
  }

  if (generatorResult.done) {
    // If the generator is done, finish the step with the final result.
    return { value: generatorResult.value, type: RESULT_TYPE_DONE };
  } else if (isPromise(generatorResult.value)) {
    // If the generator yielded a promise, finish the step when the promise resolves.
    return { value: stepProcWrapPromise(generatorResult.value), type: RESULT_TYPE_WAIT };
  } else if (isCall(generatorResult.value)) {
    // If the generator yielded a call object, call the function contained in
    // the call object and resolve the result.
    const call = generatorResult.value;
    const callInfo = call[CALL];
    let callResult;

    try {
      callResult = executeCall(call);
    } catch (error) {
      // If there was an error while executing the call, send the error to the
      // next step so the generator can handle it.
      return { value: error, call: callInfo, type: RESULT_TYPE_ERROR };
    }

    if (isPromise(callResult) && !callInfo.isSync) {
      // If the call returned a promise and it wasn't a synchronous call,
      // finish the step when the promise resolves.
      return { value: stepProcWrapPromise(callResult), call: callInfo, type: RESULT_TYPE_WAIT };
    } else {
      // Otherwise, just finish the step immediately with the result of the call.
      return { value: callResult, call: callInfo, type: RESULT_TYPE_NORMAL };
    }
  } else {
    // Throw an error if the generator yields anything else.
    throw new Error('Procs should only yield promises or call objects ' +
      '(returned by call/callSync/apply/applySync).');
  }
}

export function stopProc(generator) {
  // Tells stepProc to call .return() on the given generator and continue
  // execution from there. A proc might need to continue execution in order to
  // do clean up inside of a finally {} block, so you should continue execution
  // of a proc even aftering calling stopProc() on it.
  return stepProc(generator, STOP_STEP_RESULT);
}

export function stopProcSynchronous(generator) {
  return stepProcSynchronous(generator, STOP_STEP_RESULT);
}

/**
 * Helper function to resolve/reject with a result object when the given
 * promise resolves/rejects.
 *
 * If the step gets cancelled before the waiting promise resolves or
 * rejects, then the step will never resolve/reject even if its waiting
 * promise does.
 */
function stepProcWrapPromise(promise) {
  let wasCancelled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      result => {
        if (!wasCancelled) {
          promise = null;
          resolve({ value: result, type: RESULT_TYPE_NORMAL });
        }
      },
      error => {
        if (!wasCancelled) {
          promise = null;
          reject({ value: error, type: RESULT_TYPE_ERROR });
        }
      }
    );
  });

  wrappedPromise.cancel = () => {
    if (!wasCancelled) {
      wasCancelled = true;

      if (promise && typeof promise.cancel === 'function') {
        promise.cancel();
      }
    }
  };

  return wrappedPromise;
}

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
export function callMethod(object, methodName, ...args) {
  return createCall(object, object[methodName], args, false);
}
export function callMethodSync(object, methodName, ...args) {
  return createCall(object, object[methodName], args, true);
}
export function apply(context, fn, args) {
  // TODO: Throw an error in non-production environments if you pass any more
  // than three arguments (just to make sure someone doesn't accidentally use
  // apply like call.
  return createCall(context, fn, args, false);
}
export function applySync(context, fn, args) {
  return createCall(context, fn, args, true);
}

export function isCall(object) {
  return !!(object && object[CALL]);
}

export function executeCall(object) {
  const call = object[CALL];

  // Same as doing call.fn.apply(call.context, call.args), but will still work
  // even if someone mucks with the properties/prototype of call.fn.
  return Function.prototype.apply.call(call.fn, call.context, call.args);
}

// Checks if an object is a Promise, using the loosest definition of promise
// possible so that the library will work with non-standard Promises.
export function isPromise(object) {
  return !!(object && typeof object.then === 'function');
}

export function isGenerator(object) {
  return !!(object &&
    typeof object.next === 'function' &&
    typeof object.throw === 'function' &&
    typeof object.return === 'function');
}
