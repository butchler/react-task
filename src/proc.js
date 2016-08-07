export const
  RESULT_TYPE_NORMAL = 0,
  RESULT_TYPE_ERROR  = 1,
  RESULT_TYPE_RETURN = 2;

const CALL = '@@react-task/proc.call';

const INITIAL_STEP_RESULT = { value: undefined, done: false, type: RESULT_TYPE_NORMAL };

export function run(generatorFn, ...args) {
  return runProc(generatorFn(...args));
}

export function runProc(generator, onCall) {
  let onCancel = null;

  const promise = new Promise((resolve, reject) => {
    let currentStep = null;
    let returnedPromises = [];

    const cancelReturnedPromises = () => {
      returnedPromises.forEach(promise => {
        if (typeof promise.cancel === 'function') {
          promise.cancel();
        }
      });
    };

    const loopStep = stepResult => {
      if (isPromise(stepResult.value)) {
        // Normally, stepProc waits on the promise if a `call()` returns a
        // promise. However, stepProc could return a promise if the promise
        // returned by a function called with `call()` resolves with another
        // promise, or if someone uses `callSync()` to return a promise without
        // waiting on it.
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
        returnedPromises.push(stepResult.value);
      }

      // Call stepProc with the previous step's result until the generator is done.
      if (stepResult.done) {
        onCancel = null;
        cancelReturnedPromises();
        resolve(stepResult.value);
      } else {
        currentStep = stepProc(generator, stepResult, onCall);
        currentStep.then(loopStep, reject);

        onCancel = () => {
          currentStep.cancel();
          currentStep = stopProc(generator);
          currentStep.then(loopStep, reject);
        };
      }
    };

    loopStep(INITIAL_STEP_RESULT);
  });

  promise.cancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  promise.getCancel = () => onCancel;

  return promise;
}

export function stepProc(generator, previousResult = INITIAL_STEP_RESULT, onCall) {
  let waitingPromise = null;
  let wasCancelled = false;

  const promise = new Promise((resolve, reject) => {
    if (!isGenerator(generator)) {
      throw new TypeError('First argument to stepProc must be a generator ' +
        '(not a generator function).');
    }

    if (!(previousResult.hasOwnProperty('value') &&
          typeof previousResult.done === 'boolean' &&
          (previousResult.type === RESULT_TYPE_NORMAL ||
           previousResult.type === RESULT_TYPE_ERROR ||
           previousResult.type === RESULT_TYPE_RETURN))) {
      throw new TypeError('stepProc got bad previousResult.');
    }

    // Helper function to resolve/reject with a result object when the given
    // promise resolves/rejects.
    //
    // If the step gets cancelled before the waiting promise resolves or
    // rejects, then the step will never resolve/reject even if its waiting
    // promise does.
    const waitOnPromise = (promise, call) => {
      waitingPromise = promise;

      promise.then(
        promiseResult => {
          if (!wasCancelled) {
            resolve({
              value: promiseResult,
              call,
              done: false,
              type: RESULT_TYPE_NORMAL,
            });
            waitingPromise = null;
          }
        },
        error => {
          if (!wasCancelled) {
            resolve({
              value: promiseResult,
              call,
              done: false,
              type: RESULT_TYPE_ERROR,
            });
            waitingPromise = null;
          }
        });
    };

    // Actually do the step.
    let generatorResult;
    switch (previousResult.type) {
      case RESULT_TYPE_NORMAL:
        generatorResult = generator.next(previousResult.value);
        break;
      case RESULT_TYPE_ERROR:
        generatorResult = generator.throw(previousResult.value);
        break;
      case RESULT_TYPE_RETURN:
        generatorResult = generator.return(previousResult.value);
        break;
    }

    handleGeneratorResult(generatorResult, waitOnPromise, onCall, resolve, reject);
  });

  promise.cancel = () => {
    if (!wasCancelled) {
      wasCancelled = true;

      if (waitingPromise && typeof waitingPromise.cancel === 'function') {
        waitingPromise.cancel();
      }
    }
  };

  return promise;
}

function handleGeneratorResult(generatorResult, waitOnPromise, onCall, resolve, reject) {
  if (generatorResult.done) {
    // If the generator is done, finish the step with the final result.
    resolve({ value: generatorResult.value, done: true, type: RESULT_TYPE_NORMAL });
  } else if (isPromise(generatorResult.value)) {
    // If the generator yielded a promise, finish the step when the promise resolves.
    waitOnPromise(generatorResult.value);
  } else if (isCall(generatorResult.value)) {
    // If the generator yielded a call object, call the function contained in
    // the call object and resolve the result.
    const call = generatorResult.value;
    let callResult, callError = false;

    try {
      callResult = executeCall(call);
    } catch (error) {
      // If there was an error while executing the call, send the error to the
      // next step so the generator can handle it.
      resolve({ value: error, done: false, type: RESULT_TYPE_ERROR });
      callError = true;
    }

    if (onCall) {
      onCall(call[CALL], callResult);
    }

    if (callError) {
      return;
    }

    if (isPromise(callResult) && !call[CALL].isSync) {
      // If the call returned a promise and it wasn't a synchronous call,
      // finish the step when the promise resolves.
      waitOnPromise(callResult, call[CALL]);
    } else {
      // Otherwise, just finish the step immediately with the result of the call.
      resolve({
        value: callResult,
        call: call[CALL],
        done: false,
        type: RESULT_TYPE_NORMAL,
      });
    }
  } else {
    // Throw an error if the generator yields anything else.
    reject(new Error('Procs should only yield promises or call objects ' +
      '(returned by call/callSync/apply/applySync).'));
  }
};

export function stopProc(generator) {
  // Tells stepProc to call .return() on the given generator and continue
  // execution from there. A proc might need to continue execution in order to
  // do clean up inside of a finally {} block, so you should continue execution
  // of a proc even aftering calling stopProc() on it.
  return stepProc(generator, { value: undefined, done: false, type: RESULT_TYPE_RETURN });
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
