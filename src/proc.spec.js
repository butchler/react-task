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
  //it('throws for anything other than a call object', () => {
    //expect(executeCall({})).to.throw(TypeError);
  //});
});
