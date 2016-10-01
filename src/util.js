export function isPromise(object) {
  return !!(object && typeof object.then === 'function');
}

export function isGenerator(object) {
  return !!(
    object &&
    typeof object.next === 'function' &&
    typeof object.throw === 'function' &&
    typeof object.return === 'function'
  );
}

export function makeCancellablePromise(promise) {
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

export function createMappedGenerator(mapValue, generator) {
  return {
    next(yieldValue) {
      const { value, done } = generator.next(yieldValue);
      return { value: mapValue(value), done };
    },
    return(yieldValue) {
      const { value, done } = generator.return(yieldValue);
      return { value: mapValue(value), done };
    },
    throw(yieldError) {
      const { value, done } = generator.throw(yieldError);
      return { value: mapValue(value), done };
    },
  };
}
