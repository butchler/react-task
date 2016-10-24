import generate from './generate';

function delay(ms) {
  return new Observable(observer => {
    const timeout = setTimeout(() => {
      observer.next(ms);
      observer.complete();
    }, ms);

    return () => clearTimeout(timeout);
  });
}

function promiseDelay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(ms), ms);
  });
}

function interval(ms) {
  return new Observable(observer => {
    const interval = setInterval(() => {
      observer.next(ms);
    }, ms);

    return () => {
      clearInterval(interval);
      console.log('cleared interval');
    };
  });
}

describe.only('generate', () => {
  it('works', (done) => {
    generate(function* (output) {
      output(1);
      output(yield delay(500));
      output(3);
      output(yield promiseDelay(500));
      done();
    }).subscribe(value => console.log(value));
  });

  it.only('works', (done) => {
    generate([interval(500)], function* ([nextInterval], output) {
      output(1);
      output(yield nextInterval());
      output(2);
      output(yield nextInterval());
      output(3);
      done();
    }).subscribe(value => console.log(value));
  });
});
