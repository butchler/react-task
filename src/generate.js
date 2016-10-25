import Observable from 'zen-observable';

export default function generate(inputObservables, generatorFunction) {
  if (typeof generatorFunction === 'undefined') {
    return generate([], (nextInputs, nextOutput) => inputObservables(nextOutput));
  }

  return new Observable(observer => {
    const observerStreams = inputObservables.map(() => new ObserverStream());
    const inputSubscriptions = inputObservables.map((observable, index) =>
      Observable.from(observable).subscribe(observerStreams[index]));
    const nextInputs = observerStreams.map(stream => () => stream.getNextObservable());
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
        // Stop execution when the generator is done.
        observer.complete();
        return;
      }

      const nextValue = result.value;

      if (isObservable(nextValue)) {
        // If an observable is yielded, wait until it completes or throws an error and return its
        // last value or the error to the generator.
        let lastValue = undefined;
        Observable.from(nextValue).subscribe({
          start(subscription) { yieldSubscription = subscription; },
          next(value) { lastValue = value; },
          error(error) { yieldSubscription.unsubscribe(); continueGenerator(error, true); },
          complete() { yieldSubscription.unsubscribe(); continueGenerator(lastValue, false); },
        });
      } else {
        // For all other values, just send the value back to the generator and keep on executing
        // immediately.
        continueGenerator(nextValue, false);
      }
    };

    // Start executing the generator.
    continueGenerator(undefined, false);

    return () => {
      // Allow the generator to execute its finally block if it has one.
      generator.return();

      inputSubscriptions.forEach(subscription => subscription.unsubscribe());

      if (yieldSubscription) {
        yieldSubscription.unsubscribe();
      }
    };
  });
}

// An observer that exposes a getNextObservable() method that returns an observable that just
// returns the next value of the observable that it subscribes to.
class ObserverStream {
  constructor() {
    this.onNext = null;
    this.onError = null;
    this.onComplete = null;
  }

  getNextObservable() {
    return new Observable(observer => {
      this.onNext = value => { observer.next(value); observer.complete(); };
      this.onError = error => observer.error(error);
      this.onComplete = () => { observer.next(COMPLETE); observer.complete(); };
    });
  }

  next(value) {
    this.onNext && this.onNext(value);
  }

  error(error) {
    this.onError && this.onError(error);
  }

  complete() {
    this.onComplete && this.onComplete();
  }
}

export const COMPLETE = Object.freeze({});

function isObservable(object) {
  return Boolean(object && typeof (
    (typeof Symbol === 'function' && object[Symbol.observable]) ||
      object['@@observable'] ||
      object.subscribe
  ) === 'function');
}
