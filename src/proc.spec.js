// Needed to be able to use generator functions.
import 'babel-polyfill';
import {
  isCall, executeCall, call, callMethod, apply,
  runSync, runAsync, PROC_RETURN, PROC_STOP, mockCalls
} from './proc';

describe('isCall', () => {
  it('works with call', () => {
    const fn = x => x;
    expect(isCall(call(fn, 1, 2, 3))).to.be.true;
  });

  it('works with invalid calls', () => {
    expect(isCall(call())).to.be.true;
    expect(isCall(call(null))).to.be.true;
    expect(isCall(call({}))).to.be.true;
    expect(isCall(call([1, 2, 3]))).to.be.true;
  });

  it('works with apply', () => {
    const fn = x => x;
    const object = {};
    expect(isCall(apply(object, fn, [1, 2, 3]))).to.be.true;
  });

  it('works with invalid applies', () => {
    expect(isCall(apply())).to.be.true;
    expect(isCall(apply(null))).to.be.true;
    expect(isCall(apply({}))).to.be.true;
    expect(isCall(apply([1, 2, 3]))).to.be.true;
  });

  it('fails for anything other than call/apply', () => {
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

describe('executeCall', () => {
  it('returns result of call', () => {
    const fn1 = () => true;
    expect(executeCall(call(fn1))).to.be.true;

    const fn2 = (x, y) => x + y;
    expect(executeCall(call(fn2, 1, 2))).to.be.three;
  });

  it('returns result of callMethod', () => {
    const object = {
      x: 1,
      method1: () => true,
      method2: function (y) { return this.x + y; },
    };
    expect(executeCall(callMethod(object, 'method1'))).to.be.true;
    expect(executeCall(callMethod(object, 'method2', 2))).to.be.three;
  });

  it('returns result of apply', () => {
    const fn1 = () => true;
    expect(executeCall(apply(null, fn1))).to.be.true;

    const fn2 = (x, y) => x + y;
    expect(executeCall(apply('', fn2, [1, 2]))).to.be.three;

    // Have to use non-arrow functions because this is replaced inside of arrow functions.
    const fn3 = function (y) { return this.x + y };
    const context = { x: 1 };
    expect(executeCall(apply(context, fn3, [2]))).to.be.three;
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

describe('runSync', () => {
  it('returns result of generator function', () => {
    const procFn = function* () { return 'result'; };
    expect(runSync(procFn)).to.equal('result');
  });

  it('passes arguments to generator function', () => {
    const procFn = function* (x, y, z) { return { x, y, z }; }
    expect(runSync(procFn, 1, 2, 3)).to.eql({ x: 1, y: 2, z: 3 });
  });

  it('returns yielded results to generator', () => {
    const spy = sinon.spy();

    const procFn = function* () {
      spy(yield 1);
      spy(yield 'test');
    };

    runSync(procFn);

    expect(spy.calledWith(1)).to.be.true;
    expect(spy.calledWith('test')).to.be.true;
  });

  it('executes calls', () => {
    const spy = sinon.spy();

    const procFn = function* () {
      spy(yield call(() => 1));
      spy(yield call(x => x + 1, 1));
    };

    runSync(procFn);

    expect(spy.calledWith(1)).to.be.true;
    expect(spy.calledWith(2)).to.be.true;
  });

  it('throws the error if generator throws an error', () => {
    const procFn = function* () { throw new Error('error'); };
    expect(() => runSync(procFn)).to.throw('error');
  });

  it('executes finally block when PROC_RETURN is yielded', () => {
    let finallyExecuted = false;
    const procFn = function* () {
      try {
        yield PROC_RETURN;
        return 'try';
      } finally {
        finallyExecuted = true;
      }
    };
    expect(runSync(procFn)).to.not.equal('try');
    expect(finallyExecuted).to.be.true;
  });
});

describe('runAsync', () => {
  it('returns yielded results to generator', (done) => {
    const spy = sinon.spy();

    const procFn = function* () {
      spy(yield 1);
      spy(yield 'test');
    };

    runAsync(procFn).then(result => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('test')).to.be.true;
      done();
    });
  });

  it('waits for yielded promises', (done) => {
    const spy = sinon.spy();

    const procFn = function* () {
      spy(yield Promise.resolve(1));
      spy(yield new Promise((resolve, reject) => setTimeout(() => resolve('test'), 100)));
    };

    runAsync(procFn).then(result => {
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

    const procFn = function* () {
      spy(yield Promise.resolve(1));
      spy(yield call(delay, 100));
    };

    runAsync(procFn).then(result => {
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

    const procFn = function* () {
      spy(yield 1);
      spy(yield call(delay, 100));
    };

    const promise = runAsync(procFn);

    setTimeout(promise.return, 10);

    promise.then(() => {
      expect(spy.calledWith(1)).to.be.true;
      expect(spy.calledWith('done')).to.be.false;
      done();
    });
  });

  it('resolves with result of generator', (done) => {
    const procFn = function* () { return 'done' };
    runAsync(procFn).then(result => {
      expect(result).to.equal('done');
      done();
    });
  });

  it('rejects if a yielded call has an unhandled execption', (done) => {
    const reject = () => { throw 'error'; };
    const procFn = function* () { yield call(reject); };
    runAsync(procFn).catch(error => {
      expect(error).to.equal('error');
      done();
    });
  });

  it('rejects if a yielded promise rejects', () => {
    const procFn = function* () { yield Promise.reject('error'); };
    runAsync(procFn).catch(error => {
      expect(error).to.equal('error');
      done();
    });
  });

  it('rejects if an promise returned by a yielded call rejects', (done) => {
    const reject = () => Promise.reject('error');
    const procFn = function* () { yield call(reject); };
    runAsync(procFn).catch(error => {
      expect(error).to.equal('error');
      done();
    });
  });

  it('executes next finally block every time return() is called', (done) => {
    const spy = sinon.spy();

    // Returns a promise that never resolves or rejects.
    const forever = () => new Promise((resolve, reject) => undefined);

    const procFn = function* () {
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

    const proc = runAsync(procFn);
    proc.return();
    proc.return();
    proc.return();
    proc.then(result => {
      expect(result).to.equal(undefined);

      expect(spy.callCount).to.equal(3);
      expect(spy.firstCall.args).to.eql(['try']);
      expect(spy.secondCall.args).to.eql(['inner finally']);
      expect(spy.thirdCall.args).to.eql(['outer finally']);

      done();
    });
  });

  it('works with callMethod() and apply()', (done) => {
    const object = {
      x: 1,
      method: function (y) { return this.x + y; },
    };
    const procFn = function* () {
      const result = [];

      result.push(yield call(() => 123));

      result.push(yield callMethod(object, 'method', 2));

      result.push(yield apply(
        object,
        function (y, z) { return this.x + y + z; },
        [2, 3]
      ));

      return result;
    };

    runAsync(procFn).then(result => {
      expect(result).to.eql([
        123,
        3,
        6,
      ]);
      done();
    });
  });

  it('cancels the current promise when return() is called', (done) => {
    const promise = new Promise(() => null);
    promise.cancel = done;

    const procFn = function* () { yield promise; };

    const proc = runAsync(procFn);

    proc.return();
  });

  it('cancels the promise for the current call when return() is called', (done) => {
    const getPromise = () => {
      const promise = new Promise(() => null);
      promise.cancel = done;

      return promise;
    };

    const procFn = function* () { yield call(getPromise); };

    const proc = runAsync(procFn);

    proc.return();
  });

  it("only cancels promise once if you call return() multiple times", (done) => {
    const promise = new Promise(() => null);
    promise.cancel = sinon.spy();

    const procFn = function* () { yield promise; };

    const proc = runAsync(procFn);

    proc.return();
    proc.return();
    proc.return();

    expect(promise.cancel.calledOnce).to.be.true;
    done();
  });
});

describe('mockCalls', () => {
  it('mocks calls', () => {
    const onePlusOne = () => 2;

    const procFn = function* () {
      return yield call(onePlusOne);
    };

    const mockedProcFn = mockCalls(procFn, { onePlusOne: () => 3 });

    expect(runSync(mockedProcFn)).to.equal(3);
  });
});
