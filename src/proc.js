import Promise from 'promise';
import { isPromise, isGenerator, makeCancellablePromise, createMappedGenerator } from './util';

export const RESULT_TYPE_NORMAL = 'normal';
export const RESULT_TYPE_ERROR  = 'error';
export const RESULT_TYPE_RETURN = 'return';
export const RESULT_TYPE_STOP   = 'stop';

export const PROC_STOP = {};
export const PROC_RETURN = {};

const CALL = '@@react-task/proc.call';

const INITIAL_RESULT = { result: undefined, type: RESULT_TYPE_NORMAL };

// Functions for creating and running procs.
export function runSync(procGeneratorFunction, ...args) {
  const generator = procGeneratorFunction(...args);
  return runProcSync(createProcGenerator(generator));
}

export function runAsync(procGeneratorFunction, ...args) {
  const generator = procGeneratorFunction(...args);
  return runProcAsync(createProcGenerator(generator));
}

/**
 * Takes a generator function and a hash of function names to mock functions and returns a new
 * generator function that replaces all calls for the given function names with the the
 * corresponding mock function.
 */
export function mockCalls(procGeneratorFunction, callMappings) {
  return (...args) => {
    const generator = procGeneratorFunction(...args);
    const mapValues = value => mapCalls(callMappings, value);
    return createMappedGenerator(mapValues, generator);
  };
}

export function createProcGenerator(generator) {
  return createMappedGenerator(mapProcValues, generator);
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
  let currentPromise;
  let loop;

  const procPromise = new Promise((resolve, reject) => {
    if (!isGenerator(procGenerator)) {
      throw new TypeError('runAsync expected a generator instance (not a generator function).');
    }

    loop = ({ result, type }) => {
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
          // If a yielded promise rejects, call procGenerator.throw(error) so that the generator
          // function has a change to handle the error.
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

        let stepResult;

        try {
          stepResult = step(result);
        } catch (error) {
          reject(error);
          return;
        }

        const { value, done } = stepResult;

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

// Helper functions.
function createCall(context, fn, args) {
  return { [CALL]: { context, fn, args } };
}

function mapProcValues(value) {
  if (isCall(value)) {
    // Execute calls and return their result or error.
    try {
      const result = executeCall(value);

      return createNormalResult(result);
    } catch (error) {
      return {
        result: error,
        type: RESULT_TYPE_ERROR,
      };
    }
  } else {
    return createNormalResult(value);
  }
}

function createNormalResult(value) {
  if (value === PROC_STOP) {
    return {
      result: undefined,
      type: RESULT_TYPE_STOP,
    };
  } else if (value === PROC_RETURN) {
    return {
      result: undefined,
      type: RESULT_TYPE_RETURN,
    };
  } else {
    return {
      result: value,
      type: RESULT_TYPE_NORMAL,
    };
  }
}

function mapCalls(callMappings, value) {
  if (isCall(value)) {
    const { context, fn, args } = getCallInfo(value);

    const functionName = fn.name || fn.displayName;

    if (callMappings.hasOwnProperty(functionName)) {
      return createCall(context, callMappings[functionName], args);
    } else {
      return value;
    }
  } else {
    return value;
  }
}
