// Needed to be able to use generator functions.
import 'babel-polyfill';

import PromiseLibPromise from 'promise';

import {
  isCall,
  isPromise,
  executeCall,
  call, callSync,
  callMethod, callMethodSync,
  apply, applySync,
  stepProc,
  stopProc,
  runProc,
  run,
  RESULT_TYPE_NORMAL,
  RESULT_TYPE_ERROR,
  RESULT_TYPE_RETURN,
  RESULT_TYPE_WAIT,
  RESULT_TYPE_DONE
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
  it('works with babel-polyfill promises', () => {
    expect(isPromise(new Promise((resolve, reject) => undefined))).to.be.true;
  });

  it('works with promise library promises', () => {
    expect(isPromise(new PromiseLibPromise((resolve, reject) => undefined))).to.be.true;
  });

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
  it('rejects with bad generator', (done) => {
    const NUM_REJECTS = 10;
    let rejectedCount = 0;
    const rejects = value => {
      stepProc(value).then().catch(error => {
        expect(error).to.be.an('error');

        rejectedCount += 1;
        if (rejectedCount === NUM_REJECTS) {
          done();
        }
      });
    };

    rejects(undefined);
    rejects(null);
    rejects('');
    rejects('abc');
    rejects(123);
    rejects({ a: 1 });
    rejects([]);
    rejects([1, 2, 3]);
    rejects(new Error('error'));
    rejects({ next: true, throw: true, return: true });
  });

  it('rejects with bad previousResult', (done) => {
    const NUM_REJECTS = 8;
    let rejectedCount = 0;
    const rejects = value => {
      const genFn = function* () {};
      const gen = genFn();

      stepProc(gen, value).then().catch(error => {
        expect(error).to.be.an('error');

        rejectedCount += 1;
        if (rejectedCount === NUM_REJECTS) {
          done();
        }
      });
    };

    rejects(null);
    rejects('');
    rejects('abc');
    rejects(123);
    rejects({ a: 1 });
    rejects([]);
    rejects([1, 2, 3]);
    rejects(new Error('error'));
  });

  it('resolves with result of generator function', (done) => {
    const genFn = function* () { return 123; };

    stepProc(genFn()).then(result => {
      expect(result).to.contain.keys({ value: 123, type: RESULT_TYPE_DONE });
      done();
    });
  });

  it('makes a call when a call object is yielded', (done) => {
    const add = (x, y) => x + y;
    const genFn = function* () { yield call(add, 1, 2); };
    const gen = genFn();

    stepProc(gen).then(result => {
      expect(result.value).to.equal(3);
      stepProc(gen, result).then(result => {
        expect(result.type).to.equal(RESULT_TYPE_DONE);
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
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0].value).to.equal(123);
        done();
      }, 10);
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
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0].value).to.equal(123);
        done();
      }, 10);
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
      expect(result.value).to.equal(promise);
      done();
    });
  });

  it('rejects if generator yields anything other than a promise or call object', (done) => {
    const NUM_REJECTS = 10;
    let rejectedCount = 0;
    const rejects = value => {
      const genFn = function* () { yield value; };
      const gen = genFn();

      stepProc(gen).then().catch(error => {
        expect(error).to.be.an('error');

        rejectedCount += 1;
        if (rejectedCount === NUM_REJECTS) {
          done();
        }
      });
    };

    rejects(undefined);
    rejects(null);
    rejects('');
    rejects('abc');
    rejects(123);
    rejects({ a: 1 });
    rejects([]);
    rejects([1, 2, 3]);
    rejects(new Error('error'));
    rejects({ then: 'not a promise' });
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
      expect(result).to.contain.keys({ value: 'error', type: RESULT_TYPE_ERROR });
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

  it('executes finally block when cancel is called', (done) => {
    const genFn = function* () {
      try {
        return 'try';
      } finally {
        return 'finally';
      }
    };
    const gen = genFn();

    const step = stepProc(gen);
    step.then(result => {
      expect(result).to.contain.keys({ value: 'finally', type: RESULT_TYPE_DONE });
      done();
    });
    step.cancel();
  });

  it('cancels the current promise when cancel is called', () => {
    const cancellablePromise = new Promise((resolve, reject) => undefined);
    cancellablePromise.cancel = sinon.spy();

    const genFn = function* () { yield cancellablePromise; };
    const gen = genFn();

    const step = stepProc(gen);
    step.cancel();
    expect(cancellablePromise.cancel.calledOnce).to.be.true;
  });

  it('cancels the promise for the current call when cancel is called', () => {
    const cancellablePromise = new Promise((resolve, reject) => undefined);
    cancellablePromise.cancel = sinon.spy();

    const returnsCancellablePromise = () => cancellablePromise;

    const genFn = function* () { yield call(returnsCancellablePromise); };
    const gen = genFn();

    const step = stepProc(gen);
    step.cancel();
    expect(cancellablePromise.cancel.calledOnce).to.be.true;
  });

  it("only cancels promise once if you call cancel multiple times", () => {
    const cancellablePromise = Promise.resolve(true);
    cancellablePromise.cancel = sinon.spy();

    const genFn = function* () { yield cancellablePromise; };
    const gen = genFn();

    const step = stepProc(gen);
    step.cancel();
    step.cancel();
    step.cancel();
    expect(cancellablePromise.cancel.calledOnce).to.be.true;
  });
});

describe('stopProc', () => {
  it('breaks out to the next finally block', (done) => {
    const spy = sinon.spy();

    const genFn = function* () {
      try {
        try {
          yield call(spy, 'try');
          spy('not called');
        } finally {
          yield call(spy, 'inner finally');
          spy('not called');
        }
      } finally {
        yield call(spy, 'outer finally');
        spy('not called');
      }
    };
    const gen = genFn();

    let step = stepProc(gen);
    step.then(result => {
      expect(spy.firstCall.args).to.eql(['try']);

      step = stopProc(gen);
      step.then(result => {
        expect(spy.secondCall.args).to.eql(['inner finally']);

        step = stopProc(gen);
        step.then(result => {
          expect(spy.thirdCall.args).to.eql(['outer finally']);

          done();
        });
      });
    });
  });

  it("doesn't do anything if the proc is already finished executing", (done) => {
    const spy = sinon.spy();
    const genFn = function* () { spy() };
    const gen = genFn();

    let step = stepProc(gen);
    step.then(result => {
      expect(result.type).to.equal(RESULT_TYPE_DONE);
      expect(spy.calledOnce).to.be.true;

      step = stopProc(gen);
      step.then(result => {
        expect(result.type).to.equal(RESULT_TYPE_DONE);
        expect(spy.calledOnce).to.be.true;

        done();
      });
    });
  });
});

describe('run', () => {
  it('passes all of the args to the generator function', (done) => {
    const genFn = function* (a, b, c) {
      return a + b + c;
    };

    run(genFn, 1, 2, 3).then(result => {
      expect(result).to.equal(6);
      done();
    });
  });
});

describe('runProc', () => {
  it('resolves with result of the generator function', (done) => {
    const genFn = function* () {
      yield Promise.resolve(1);
      yield Promise.resolve(2);
      return yield Promise.resolve(3);
    };

    run(genFn).then(result => {
      expect(result).to.equal(3);
      done();
    });
  });

  it('works with all of the call/apply variants', (done) => {
    const object = {
      x: 1,
      method: function (y) { return this.x + y; },
      returnsPromise: function () { return Promise.resolve(this.x); },
    };
    const promise = Promise.resolve(true);
    const returnsPromise = () => promise;
    const genFn = function* () {
      const result = [];

      result.push(yield call(() => 123));

      const callSyncPromise = yield callSync(returnsPromise);
      result.push(yield callSyncPromise);

      result.push(yield callMethod(object, 'method', 2));

      const callMethodSyncPromise = yield callMethodSync(object, 'returnsPromise');
      result.push(yield callMethodSyncPromise);

      result.push(yield apply(
        object,
        function (y, z) { return this.x + y + z; },
        [2, 3]
      ));

      const applySyncPromise = yield applySync(
        { result: 'result' },
        function () { return Promise.resolve(this.result); }
      );
      result.push(yield applySyncPromise);

      return result;
    };

    run(genFn).then(result => {
      expect(result).to.eql([
        123,
        true,
        3,
        1,
        6,
        'result'
      ]);
      done();
    });
  });

  it('cancels the current step when the cancel method is called', () => {
    const cancellablePromise = Promise.resolve(true);
    cancellablePromise.cancel = sinon.spy();

    const genFn = function* () { yield cancellablePromise; };

    run(genFn).cancel();
    expect(cancellablePromise.cancel.calledOnce).to.be.true;
  });

  it("doesn't do anything if you call cancel when the proc is already finished executing", (done) => {
    const proc = run(function* () {});
    proc.then(result => {
      proc.cancel();
      proc.cancel();
      proc.cancel();
      proc.cancel();
      done();
    });
  });

  it('works like stopProc if you call cancel multiple times', (done) => {
    const spy = sinon.spy();

    const genFn = function* () {
      try {
        try {
          spy('try');
          yield forever();
          spy('not called');
        } finally {
          spy('inner finally');
          yield forever();
          spy('not called');
        }
      } finally {
        spy('outer finally');
        yield forever();
        spy('not called');
      }
    };

    const proc = run(genFn);
    proc.cancel();
    proc.cancel();
    proc.cancel();
    proc.then(result => {
      expect(result).to.equal(undefined);

      expect(spy.callCount).to.equal(3);
      expect(spy.firstCall.args).to.eql(['try']);
      expect(spy.secondCall.args).to.eql(['inner finally']);
      expect(spy.thirdCall.args).to.eql(['outer finally']);

      done();
    });
  });

  it('cancels all callSync promises when the proc gets cancelled', (done) => {
    const spy = sinon.spy();

    const childProc = function* () {
      // Promises callSync-ed by child/grandchild/etc processes should also be cancelled.
      const promise = yield callSync(forever, () => spy('child'));
      // The current promise that the child is waiting on should also be cancelled.
      yield call(forever, () => spy('child waiting'));
      yield promise;
      spy('not called');
    };

    const parentProc = function* () {
      const child = yield callSync(run, childProc);
      const promise = yield callSync(forever, () => spy('parent'));
      yield call(forever, () => spy('parent waiting'));
      yield Promise.race([child, promise]);
    };

    const proc = run(parentProc);
    proc.then(result => {
      expect(result).to.equal(undefined);
      expect(spy.callCount).to.equal(4);
      expect(spy.calledWith('child')).to.be.true;
      expect(spy.calledWith('child waiting')).to.be.true;
      expect(spy.calledWith('parent')).to.be.true;
      expect(spy.calledWith('parent waiting')).to.be.true;
      done();
    });
    setTimeout(() => proc.cancel(), 0);
  });

  it('cancels all callSync promises when the proc ends normally', (done) => {
    const spy = sinon.spy();

    const childProc = function* () {
      // Promises callSync-ed by child/grandchild/etc processes should also be cancelled.
      const promise = yield callSync(forever, () => spy('child'));
      // The current promise that the child is waiting on should also be cancelled.
      yield call(forever, () => spy('child waiting'));
      yield promise;
      spy('not called');
    };

    const parentProc = function* () {
      const child = yield callSync(run, childProc);
      const promise = yield callSync(forever, () => spy('parent'));
      return 'done';
    };

    const proc = run(parentProc);
    proc.then(result => {
      expect(result).to.equal('done');
      expect(spy.callCount).to.equal(3);
      expect(spy.calledWith('child')).to.be.true;
      expect(spy.calledWith('child waiting')).to.be.true;
      expect(spy.calledWith('parent')).to.be.true;
      done();
    });
  });
});

// Returns a promise that never resolves or rejects.
function forever(onCancel) {
  const promise = new Promise((resolve, reject) => undefined);
  if (onCancel) {
    promise.cancel = onCancel;
  }
  return promise;
}

import { runSync, runAsync, mockCalls } from './proc';

describe.only('runSync', () => {
  it('returns yielded results to generator', () => {
    const spy = sinon.spy();

    const simpleProc = function* () {
      spy(yield 1);
      spy(yield 'test');
    };

    runSync(simpleProc);

    expect(spy.calledWith(1)).to.be.true;
    expect(spy.calledWith('test')).to.be.true;
  });

  it('executes calls', () => {
    const spy = sinon.spy();

    const simpleProc = function* () {
      spy(yield call(() => 1));
      spy(yield call(x => x + 1, 1));
    };

    runSync(simpleProc);

    expect(spy.calledWith(1)).to.be.true;
    expect(spy.calledWith(2)).to.be.true;
  });
});

describe.only('runAsync', () => {
  it('returns yielded results to generator', (done) => {
    const spy = sinon.spy();

    const simpleProc = function* () {
      spy(yield 1);
      spy(yield 'test');
    };

    runAsync(simpleProc).then(result => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('test')).to.be.true;
      done();
    });
  });

  it('waits for yielded promises', (done) => {
    const spy = sinon.spy();

    const simpleProc = function* () {
      spy(yield Promise.resolve(1));
      spy(yield new Promise((resolve, reject) => setTimeout(() => resolve('test'), 100)));
    };

    runAsync(simpleProc).then(result => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('test')).to.be.true;
      done();
    });
  });

  it('waits for calls that return promises', (done) => {
    const spy = sinon.spy();
    const delay = ms => {
      return new Promise((resolve, reject) => {
        setTimeout(() => resolve('done'), ms);
      });
    };

    const simpleProc = function* () {
      spy(yield Promise.resolve(1));
      spy(yield call(delay, 100));
    };

    runAsync(simpleProc).then(result => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('done')).to.be.true;
      done();
    });
  });

  it('can be return()ed', (done) => {
    const spy = sinon.spy();
    const onDone = sinon.spy();
    const delay = ms => {
      return new Promise((resolve, reject) => {
        setTimeout(() => resolve('done'), ms);
      });
    };

    const simpleProc = function* () {
      spy(yield 1);
      spy(yield call(delay, 100));
    };

    const promise = runAsync(simpleProc);

    setTimeout(promise.return, 10);

    promise.then(() => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('done')).to.be.false;
      done();
    });
  });
});

describe.only('mockCalls', () => {
  it('mocks calls', () => {
    const onePlusOne = () => 2;

    const simpleProc = function* () {
      return yield call(onePlusOne);
    };

    const proc = mockCalls(simpleProc, [[onePlusOne, () => 3]]);

    expect(runSync(proc)).to.equal(3);
  });
});
