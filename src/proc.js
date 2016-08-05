const INITIAL_STEP_RESULT = { value: undefined, done: false, isError: false };

export function runProc(generatorFn, ...args) {
  const generator = generatorFn(...args);
  let cancelCurrentStep;

  const promise = new Promise((resolve, reject) => {
    const loopStep = stepResult => {
      cancelCurrentStep = undefined;

      // Call stepProc with the previous step's result until the generator is done.
      if (stepResult.done) {
        resolve(stepResult.value);
      } else {
        const stepPromise = stepProc(generator, stepResult);
        cancelCurrentStep = stepPromise.cancel;
        stepPromise.then(loopStep, reject);
      }
    };

    loopStep(INITIAL_STEP_RESULT);
  });

  // Allow the proc to be cancelled. This can be used directly, but it can also be used with Promise
  // libraries like Bluebird to make it work properly with things like Promise.all.
  promise.cancel = () => {
    if (cancelCurrentStep) {
      cancelCurrentStep();
    }
  };

  return promise;
}

export function stepProc(generator, previousResult = INITIAL_STEP_RESULT) {
  let onCancel;

  const promise = new Promise((resolve, reject) => {
    // Helper functions.
    let waitingPromise;
    const waitOnPromise = (promise) => {
      waitingPromise = promise;

      promise.then(
        promiseResult => {
          resolve({ value: promiseResult, done: false, isError: false });
          waitingPromise = undefined;
        },
        error => {
          resolve({ value: error, done: false, isError: true });
          waitingPromise = undefined;
        });
    };

    const stopGenerator = () => {
      let generatorResult;

      try {
        // Stop the generator by calling return() on it, which will cause it to
        // jump to its finally {} block if it has one, or simply cause it to
        // stop execution if it doesn't.
        generatorResult = generator.return();
      } catch (error) {
        // If there was an error during the execution of the finally {} block,
        // send it to the next promise manually (since stopGenerator's call
        // chain won't be inside the promise, even though its definition is.)
        reject(error);
      }

      // Even though we're stopping the generator, we need to continue the
      // execution of the generator in case the proc has to yield some more
      // calls in order to finish cleaning up. This means it's actually possible
      // for a generator to never stop executing even after being cancelled if
      // it starts an inifinite loop of yields in its finally {} block or yields
      // a promise that never returns, for example.
      //
      // TODO: Add a kill method to forcefully stop a bad process.
      handleGeneratorResult(generatorResult, resolve, reject);
    };

    const handleGeneratorResult = generatorResult => {
      if (generatorResult.done) {
        // If the generator is done, finish the step with the final result.
        resolve({ value: generatorResult.value, done: true, isError: false });
      } else if (isPromise(generatorResult.value)) {
        // If the generator yielded a promise, finish the step when the promise resolves.
        waitOnPromise(generatorResult.value);
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

        if (isPromise(callResult) && !call[CALL].isSync) {
          // If the call returned a promise and it wasn't a synchronous call,
          // finish the step when the promise resolves.
          waitOnPromise(callResult);
        } else {
          // Otherwise, just finish the step immediately with the result of the call.
          resolve({ value: callResult, done: false, isError: false });
        }
      } else {
        // Throw an error if the generator yields anything else.
        reject(new Error('Procs should only yield promises or call objects ' +
          '(returned by call/callSync/apply/applySync).'));
      }
    }

    // This is what will happen when stepProc(...).cancel() is called.
    onCancel = () => {
      // If we're currently waiting on a promise that is cancellable, cancel it.
      if (waitingPromise && typeof waitingPromise.cancel === 'function') {
        waitingPromise.cancel();
      }
      waitingPromise = undefined;

      stopGenerator();
    };

    // Actually do the step.
    const generatorResult = previousResult.isError ?
      generator.throw(previousResult.value) :
      generator.next(previousResult.value);

    handleGeneratorResult(generatorResult);
  });

  promise.cancel = () => {
    onCancel();
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
