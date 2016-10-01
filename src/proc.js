import Promise from 'promise';

export const RESULT_TYPE_NORMAL = 'normal';
export const RESULT_TYPE_ERROR  = 'error';
export const RESULT_TYPE_RETURN = 'return';
export const RESULT_TYPE_STOP   = 'stop';

const CALL = '@@react-task/proc.call';

const INITIAL_RESULT = { result: undefined, type: RESULT_TYPE_NORMAL };

// Functions for running procs.
export function runSync(procGeneratorFunction, ...args) {
  return runProcSync(proc(procGeneratorFunction(...args)));
}

export function runAsync(procGeneratorFunction, ...args) {
  return runProcAsync(proc(procGeneratorFunction(...args)));
}

export function runProcSync(procGenerator, initialResult = INITIAL_RESULT) {
  if (!isGenerator(procGenerator)) {
    throw new TypeError('runSync expected a generator instance (not a generator function).');
  }

  const loop = ({ result, type }) => {
    if (type === RESULT_TYPE_STOP) {
      return result;
    }

    const step = (
      type === RESULT_TYPE_ERROR ? procGenerator.throw :
      type === RESULT_TYPE_RETURN ? procGenerator.return :
      procGenerator.next
    );

    const { value, done } = step(result);

    if (done) {
      // Return the final result of the generator.
      return value.result;
    } else {
      return loop(value);
    }
  };

  return loop(initialResult);
}

export function runProcAsync(procGenerator, initialResult = INITIAL_RESULT) {
  if (!isGenerator(procGenerator)) {
    throw new TypeError('runAsync expected a generator instance (not a generator function).');
  }

  let currentPromise;
  let loop;

  const procPromise = new Promise((resolve, reject) => {
    loop = ({ result, type }) => {
      console.log('loop', { result, type });

      // Make sure any promises we might have been waiting on are cleaned up.
      if (currentPromise) {
        currentPromise.cancel();
        currentPromise = undefined;
      }

      if (type === RESULT_TYPE_STOP) {
        resolve(result);
      } else if (type === RESULT_TYPE_NORMAL && isPromise(result)) {
        currentPromise = makeCancellablePromise(result);

        currentPromise.then(
          promiseResult => loop({
            result: promiseResult,
            type: RESULT_TYPE_NORMAL,
          }),
          error => loop({
            result: error,
            type: RESULT_TYPE_ERROR,
          })
        );
      } else {
        const step = (
          type === RESULT_TYPE_ERROR ? procGenerator.throw :
          type === RESULT_TYPE_RETURN ? procGenerator.return :
          procGenerator.next
        );

        const { value, done } = step(result);

        if (done) {
          // Resolve with the final result of the generator.
          resolve(value.result);
        } else {
          loop(value);
        }
      }
    };

    loop(initialResult);
  });

  procPromise.return = () => {
    loop({ result: undefined, type: RESULT_TYPE_RETURN });
  };

  procPromise.stop = () => {
    loop({ result: undefined, type: RESULT_TYPE_STOP });
  };

  return procPromise;
}

// Function to create procs.
export function proc(generatorFunction, handleCall = defaultHandleCall) {
  return {
    next(result) {
      return wrapProcValue(generatorFunction.next(result), handleCall);
    },
    throw(result) {
      return wrapProcValue(generatorFunction.throw(result), handleCall);
    },
    return(result) {
      return wrapProcValue(generatorFunction.return(result), handleCall);
    },
  };
}

function wrapProcValue({ value, done }, handleCall) {
  return {
    value: isCall(value) ? handleCall(value) : {
      result: value,
      type: RESULT_TYPE_NORMAL,
    },
    done,
  };
}

export function defaultHandleCall(call) {
  try {
    const result = executeCall(call);

    return {
      result,
      type: RESULT_TYPE_NORMAL,
    };
  } catch (error) {
    return {
      result: error,
      type: RESULT_TYPE_ERROR,
    };
  }
}

// Functions for creating/working with call objects.
export function call(fn, ...args) {
  return createCall(undefined, fn, args, false);
}

export function callMethod(object, methodName, ...args) {
  return createCall(object, object[methodName], args, false);
}

export function apply(context, fn, args) {
  // TODO: Throw an error in non-production environments if you pass any more
  // than three arguments (just to make sure someone doesn't accidentally use
  // apply like call.
  return createCall(context, fn, args, false);
}

export function isCall(object) {
  return !!(object && object[CALL]);
}

export function getCallInfo(callObject) {
  return callObject[CALL];
}

export function executeCall(object) {
  const call = getCallInfo(object);

  // Same as doing call.fn.apply(call.context, call.args), but will still work
  // even if someone mucks with the properties/prototype of call.fn.
  return Function.prototype.apply.call(call.fn, call.context, call.args);
}

// Helper functions
function createCall(context, fn, args) {
  return { [CALL]: { context, fn, args } };
}

function isPromise(object) {
  return !!(object && typeof object.then === 'function');
}

function isGenerator(object) {
  return !!(
    object &&
    typeof object.next === 'function' &&
    typeof object.throw === 'function' &&
    typeof object.return === 'function'
  );
}

function makeCancellablePromise(promise) {
  let wasCancelled = false, wasResolved = false;

  const cancellablePromise = new Promise((resolve, reject) => {
    promise.then(
      result => {
        wasResolved = true;
        !wasCancelled && resolve(result);
      },
      error => {
        wasResolved = true;
        !wasCancelled && reject(error);
      }
    );
  });

  cancellablePromise.cancel = () => {
    // If the promise has a cancel method, call it, and make sure it is only called once.
    if (!wasCancelled && !wasResolved && typeof promise.cancel === 'function') {
      promise.cancel();
    }

    wasCancelled = true;
  };

  return cancellablePromise;
}
