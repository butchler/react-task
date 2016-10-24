import Observable from 'zen-observable';

export default function generate(inputObservables, generatorFunction) {
  if (typeof generatorFunction === 'undefined') {
    return generate([], (nextInputs, nextOutput) => inputObservables(nextOutput));
  }

  return new Observable(observer => {
    const promiseStreams = inputObservables.map(() => new PromiseStream());
    const inputSubscriptions = inputObservables.map((observable, index) =>
      Observable.from(observable).subscribe(promiseStreams[index]));
    const nextInputs = promiseStreams.map(stream => stream.nextPromise);
    const nextOutput = value => observer.next(value);
    const generator = generatorFunction(nextInputs, nextOutput);
    let yieldSubscription = null;

    const continueGenerator = (previousValue, isError) => {
      let result;

      try {
        if (isError) {
          // Pass errors from yielded observables back to the generator.
          result = generator.throw(previousValue);
        } else {
          result = generator.next(previousValue);
        }
      } catch (error) {
        // Stop execution if there is an uncaught error in the generator.
        observer.error(error);
        return;
      }

      if (result.done) {
        // Allow the generator to execute its finally block if it has one.
        // TODO: Is this really needed?
        generator.return();
        // Stop execution after sending the last value when the generator is done.
        observer.complete();
        return;
      }

      const nextValue = result.value;

      if (isObservable(nextValue)) {
        // If an observable is yielded, wait until it completes or throws an error and return its
        // last value or the error to the generator.
        let lastValue;
        yieldSubscription = Observable.from(nextValue).subscribe({
          next(value) { lastValue = value; },
          error(error) { yieldSubscription.unsubscribe(); continueGenerator(error, true); },
          complete() { yieldSubscription.unsubscribe(); continueGenerator(lastValue, false); },
        });
      } else if (isPromise(nextValue)) {
        // If a promise is yielded, wait until it completes and return the value or throw the
        // error.
        nextValue.then(
          value => continueGenerator(value, false),
          error => continueGenerator(error, true)
        );
      } else {
        // For all other values, just send the value back to the generator and keep on executing
        // immediately.
        continueGenerator(nextValue, false);
      }
    };

    // Start executing the generator.
    continueGenerator(undefined, false);

    return () => {
      inputSubscriptions.forEach(subscription => subscription.unsubscribe());

      if (yieldSubscription) {
        yieldSubscription.unsubscribe();
      }
    };
  });
}

// An observer that exposes a nextPromise() method that returns a promise that will resolve or
// reject the next time the observable it is subscribed to returns a value or error.
class PromiseStream {
  constructor() {
    this.resolve = null;
    this.reject = null;

    this.nextPromise = this.nextPromise.bind(this);
  }

  nextPromise() {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  reset() {
    this.resolve = null;
    this.reject = null;
  }

  next(value) {
    if (this.resolve) {
      this.resolve({ value, done: false });
      this.reset();
    }
  }

  error(error) {
    if (this.reject) {
      this.reject(error);
      this.reset();
    }
  }

  complete() {
    if (this.resolve) {
      this.resolve({ value: undefined, done: true });
      this.reset();
    }
  }
}

function isObservable(object) {
  return object && typeof (
    (typeof Symbol === 'function' && object[Symbol.observable]) ||
      object['@@observable'] ||
      object.subscribe
  ) === 'function';
}

function isPromise(object) {
  return object && typeof object.then === 'function';
}
