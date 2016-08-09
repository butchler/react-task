import Promise from 'promise';

/**
 * Returns a promise that resolves after the given number of milliseconds.
 */
export function delay(timeoutMilliseconds) {
  let timeoutId;

  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(resolve, timeoutMilliseconds);
  });

  promise.cancel = () => {
    clearTimeout(timeoutId);
  };

  return promise;
}

// TODO: Make more convenience functions that create promises.
