// Needed to be able to use generator functions.
import 'babel-polyfill';

import {
  isCall,
  isPromise,
  executeCall,
  call, callSync,
  callMethod, callMethodSync,
  apply, applySync,
  stepProc,
  runProc,
} from './proc';

describe('isCall', () => {
  it('works with call/callSync', () => {
    const fn = x => x;
    expect(isCall(call(fn, 1, 2, 3))).to.be.true;
    expect(isCall(callSync(fn, 1, 2, 3))).to.be.true;
  });

  it('works with invalid calls', () => {
    expect(isCall(call())).to.be.true;
    expect(isCall(call(null))).to.be.true;
    expect(isCall(call({}))).to.be.true;
    expect(isCall(call([1, 2, 3]))).to.be.true;
  });

  it('works with apply/applySync', () => {
    const fn = x => x;
    const object = {};
    expect(isCall(apply(object, fn, [1, 2, 3]))).to.be.true;
    expect(isCall(applySync(object, fn, [1, 2, 3]))).to.be.true;
  });

  it('works with invalid applies', () => {
    expect(isCall(apply())).to.be.true;
    expect(isCall(apply(null))).to.be.true;
    expect(isCall(apply({}))).to.be.true;
    expect(isCall(apply([1, 2, 3]))).to.be.true;
  });

  it('fails for anything other than call/callSync/apply/applySync', () => {
    expect(isCall()).to.be.false;
    expect(isCall({})).to.be.false;
    expect(isCall({ call: x => x })).to.be.false;
    expect(isCall([])).to.be.false;
    expect(isCall([1, 2, 3])).to.be.false;
    expect(isCall(100)).to.be.false;
    expect(isCall('string')).to.be.false;
    expect(isCall(new Error('error'))).to.be.false;
  });
});

describe('isPromise', () => {
  // PhantomJS does not have native promises yet.
  //it('works with native promises', () => {
    //expect(isPromise(new Promise((resolve, reject) => undefined))).to.be.true;
  //});

  // TODO: Make sure it works with a Promise library.

  it('works with plain object style Promises', () => {
    expect(isPromise({ then: x => x })).to.be.true;
    expect(isPromise({ then: x => x, catch: x => x })).to.be.true;
  });

  it('fails with anything else', () => {
    expect(isPromise({ then: null })).to.be.false;
    expect(isPromise({ then: true })).to.be.false;
    expect(isPromise({ then: 1 })).to.be.false;
    expect(isPromise({ then: [] })).to.be.false;
    expect(isPromise({ then: {} })).to.be.false;
    expect(isPromise({ then: 'string' })).to.be.false;
    expect(isPromise({ then: new Error('error') })).to.be.false;

    expect(isPromise(null)).to.be.false;
    expect(isPromise(true)).to.be.false;
    expect(isPromise(1)).to.be.false;
    expect(isPromise([])).to.be.false;
    expect(isPromise({})).to.be.false;
    expect(isPromise('string')).to.be.false;
    expect(isPromise(new Error('error'))).to.be.false;
  });
});

describe('executeCall', () => {
  it('returns result of call/callSync', () => {
    const fn1 = () => true;
    expect(executeCall(call(fn1))).to.be.true;
    expect(executeCall(callSync(fn1))).to.be.true;

    const fn2 = (x, y) => x + y;
    expect(executeCall(call(fn2, 1, 2))).to.be.three;
    expect(executeCall(callSync(fn2, 1, 2))).to.be.three;
  });

  it('returns result of callMethod/callMethodSync', () => {
    const object = {
      x: 1,
      method1: () => true,
      method2: function (y) { return this.x + y; },
    };
    expect(executeCall(callMethod(object, 'method1'))).to.be.true;
    expect(executeCall(callMethod(object, 'method2', 2))).to.be.three;
  });

  it('returns result of apply/applySync', () => {
    const fn1 = () => true;
    expect(executeCall(apply(null, fn1))).to.be.true;
    expect(executeCall(applySync(null, fn1))).to.be.true;

    const fn2 = (x, y) => x + y;
    expect(executeCall(apply('', fn2, [1, 2]))).to.be.three;
    expect(executeCall(applySync('', fn2, [1, 2]))).to.be.three;

    // Have to use non-arrow functions because this is replaced inside of arrow functions.
    const fn3 = function (y) { return this.x + y };
    const context = { x: 1 };
    expect(executeCall(apply(context, fn3, [2]))).to.be.three;
    expect(executeCall(applySync(context, fn3, [2]))).to.be.three;
  });

  // TODO: Find out why this doesn't work.
  it('throws for anything other than a call object', () => {
    expect(() => executeCall()).to.throw(TypeError);
    expect(() => executeCall({})).to.throw(TypeError);
    expect(() => executeCall([])).to.throw(TypeError);
    expect(() => executeCall('')).to.throw(TypeError);
    expect(() => executeCall(1)).to.throw(TypeError);
    expect(() => executeCall(null)).to.throw(TypeError);
  });
});

describe('stepProc', () => {
  it.skip('throws with bad generator', () => {
  });

  it.skip('throws with bad previousResult', () => {
  });

  it('resolves with result of generator function', (done) => {
    const genFn = function* () { return 123; };

    stepProc(genFn()).then(result => {
      expect(result).to.eql({ value: 123, done: true, isError: false });
      done();
    });
  });

  it('makes a call when a call object is yielded', (done) => {
    const add = (x, y) => x + y;
    const genFn = function* () { yield call(add, 1, 2); };
    const gen = genFn();

    stepProc(gen).then(result => {
      expect(result).to.eql({ value: 3, done: false, isError: false });
      stepProc(gen, result).then(result => {
        expect(result).to.eql({ value: undefined, done: true, isError: false });
        done();
      });
    });
  });

  it('waits for the promise when a promise is yielded', (done) => {
    let resolvePromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = () => resolve(123);
    });
    const genFn = function* () { yield promise; };
    const gen = genFn();
    const spy = sinon.spy();

    stepProc(gen).then(spy);

    setTimeout(() => {
      expect(spy.called).to.be.false;
      resolvePromise();
      setTimeout(() => {
        expect(spy.args).to.eql([[{ value: 123, done: false, isError: false }]]);
        done();
      }, 0);
    }, 0);
  });

  it('waits on the promise when a yielded call returns a promise', (done) => {
    let resolvePromise;
    const getPromise = () => {
      return new Promise((resolve, reject) => {
        resolvePromise = () => resolve(123);
      });
    };
    const genFn = function* () { yield call(getPromise); };
    const gen = genFn();
    const spy = sinon.spy();

    stepProc(gen).then(spy);

    setTimeout(() => {
      expect(spy.called).to.be.false;
      resolvePromise();
      setTimeout(() => {
        expect(spy.args).to.eql([[{ value: 123, done: false, isError: false }]]);
        done();
      }, 0);
    }, 0);
  });

  it("doesn't wait on the promise when using callSync", (done) => {
    let promise;
    const getPromise = () => {
      promise = Promise.resolve(true);
      return promise;
    };
    const genFn = function* () { yield callSync(getPromise); };
    const gen = genFn();

    stepProc(gen).then(result => {
      expect(result).to.eql({ value: promise, done: false, isError: false });
      done();
    });
  });

  it('rejects if generator yields anything other than a promise or call object', (done) => {
    const NUM_THROWS = 10;
    let threwCount = 0;
    const yieldThrows = value => {
      const genFn = function* () { yield value; };
      const gen = genFn();
      const resolve = sinon.spy(), reject = sinon.spy();

      stepProc(gen).then(resolve, reject);

      setTimeout(() => {
        expect(resolve.called).to.be.false;
        expect(reject.called).to.be.true;

        threwCount += 1;
        if (threwCount === NUM_THROWS) {
          done();
        }
      }, 0);
    };

    yieldThrows(undefined);
    yieldThrows(null);
    yieldThrows('');
    yieldThrows('abc');
    yieldThrows(123);
    yieldThrows({ a: 1 });
    yieldThrows([]);
    yieldThrows([1, 2, 3]);
    yieldThrows(new Error('error'));
    yieldThrows({ then: 'not a promise' });
  });

  it('rejects if generator throws an error', (done) => {
    const genFn = function* () { throw 'error'; };
    const gen = genFn();

    stepProc(gen).then().catch(error => {
      expect(error).to.equal('error');
      done();
    });
  });

  it('resolves with isError === true when the yielded call throws an error', (done) => {
    const throwsError = () => { throw 'error'; };
    const genFn = function* () { yield call(throwsError); };
    const gen = genFn();

    stepProc(gen).then(result => {
      expect(result).to.eql({ value: 'error', done: false, isError: true });
      done();
    });
  });

  it('rejects if an error from a yielded call is unhandled', (done) => {
    const throwsError = () => { throw 'error'; };
    const genFn = function* () { yield call(throwsError); };
    const gen = genFn();

    stepProc(gen).then(result => {
      stepProc(gen, result).then().catch(error => {
        expect(error).to.equal('error');
        done();
      });
    });
  });

  it.skip('executes finally block when cancel is called', (done) => {
  });

  it.skip('cancels the current promise when cancel is called', (done) => {
  });
});
