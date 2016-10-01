import PromiseLibPromise from 'promise';
import { isPromise, isGenerator } from './util';

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

describe('isGenerator', () => {
  it('rejects non-generators', () => {
    const rejects = value => expect(isGenerator(value)).to.be.false;

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

  it('accepts generators', () => {
    function* generatorFunction() {};
    const fakeGenerator = {
      next() {},
      return() {},
      throw() {},
    };

    expect(isGenerator(generatorFunction())).to.be.true;
    expect(isGenerator(fakeGenerator)).to.be.true;
  });
});


