import 'babel-polyfill';
import React from 'react';

function throwIfHasChildren(children) {
  if (React.Children.count(children) !== 0) {
    throw new TypeError('Task components should not have any children. If you ' +
        'want to organize tasks in a hierarchy, use normal elements like <div>, ' +
        '<span>, etc.');
  }
}

export default class Task extends React.Component {
  // Start a Proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the
  // proc when it gets unmounted.
  componentDidMount() {
    // Allow just passing in a generator function to a generic Task component
    // instead of always having to make a new class that extends Task.
    const generatorFn = this.props.generator || this.run.bind(this);

    this.proc = new Proc(generatorFn, this.props);
    this.proc.start();
  }

  componentWillUnmount() {
    // TODO: Find out if componentWillUnmount is called on server environments.
    this.proc.stop();

    this.taskWasStopped();
  }

  // Never allow Tasks components to have children.
  componentWillMount() {
    throwIfHasChildren(this.props.children);
  }

  componentWillReceiveProps(nextProps) {
    throwIfHasChildren(nextProps.children);
  }

  // Task components never render anything by default.
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }

  // Methods that should be overriden by child classes:

  // Generator method that performs side effects by yielding calls to Proc.call/apply.
  *run() {
    throw new Error('Task: run() method must be overriden by subclasses, or a ' +
        'generator={...} prop must be passed to the Task component.');
  }

  // Called when the Task is stopped/unmounted.
  taskWasStopped() { }
}

Task.propTypes = {
  generator: React.PropTypes.func,
};

export class Proc {
  constructor(generatorFn, ...args) {
    this.generatorFn = generatorFn;
    this.args = args;
  }

  start() {
    // Don't do anything if already started.
    if (this.generator) {
      return;
    }

    this.generator = this.generatorFn(...this.args);

    // Make sure that the function is actually a generator function, or at
    // least something that pretends to be one.
    if (!(this.generator &&
          typeof this.generator.next === 'function' &&
          typeof this.generator.throw === 'function' &&
          typeof this.generator.return === 'function')) {
      throw new TypeError(`Proc: function supplied did not return a generator: ${this.generator}`);
    }

    this.continueExecution(undefined, false);
  }

  continueExecution(returnedValue, isError) {
    // Send the previous call's return value to the generator and get the next
    // value that the generator yields, which should be a call object.
    const generatorResult = isError ?
      this.generator.throw(returnedValue) :
      this.generator.next(returnedValue);

    // Stop execution if the generator has finished.
    if (generatorResult.done) {
      this.generator = null;
      return;
    }

    // Stop and throw an error if the value returned by the generator was not a
    // valid call object.
    if (!Proc.isCall(generatorResult.value)) {
      this.stop();
      throw new TypeError(`Proc: value yielded by generator was not a valid call object: ${generatorResult.value}`);
    }

    // Actually call the function and make the generator handle any errors.
    let callResult;

    try {
      callResult = Proc.doCall(generatorResult.value);
    } catch (error) {
      this.continueExecution(error, true);
      return;
    }

    // Wrapping the return value in Promise.resolve will allow us to treat it
    // like a promise even if it is just a normal value, while still allowing
    // promises to work normally.
    const promise = Promise.resolve(callResult);
    promise.then(result => {
      this.continueExecution(result, false);
    }).catch(error => {
      this.continueExecution(error, true);
    });

    // Save the returned promise's cancel method if it has one.
    if (callResult && typeof callResult[Proc.CANCEL_PROMISE] === 'function') {
      promise[Proc.CANCEL_PROMISE] = callResult[Proc.CANCEL_PROMISE];
    }

    this.lastPromise = promise;
  }

  stop() {
    // Don't do anything if already stopped.
    if (!this.generator) {
      return;
    }

    // The will cause all future calls to this.generator.next() to return {
    // value: undefined, done: true }, which will let continueExecution know
    // that it should stop.
    this.generator.return();
    this.generator = null;

    // If the most recent promise has a cancel method, call it when the proc
    // gets stopped.
    if (this.lastPromise && typeof this.lastPromise[Proc.CANCEL_PROMISE] === 'function') {
      this.lastPromise[Proc.CANCEL_PROMISE]();
      this.lastPromise = null;
    }
  }

  restart() {
    this.stop();
    this.start();
  }
}

// Helper functions to create and execute call objects.
Proc.CALL   = 'Proc/call';
Proc.call   = (fn, ...args) => Proc.apply(undefined, fn, args);
Proc.apply  = (context, fn, args) => ({ [Proc.CALL]: { context, fn, args } });
Proc.doCall = call => {
  const { context, fn, args } = call[Proc.CALL];

  return fn.apply(context, args);
};
Proc.isCall = call => {
  if (!(call && call[Proc.CALL])) {
    return false;
  }

  const { context, fn, args } = call[Proc.CALL];

  return typeof fn === 'function' && Array.isArray(args);
};

// If a promise object has a method with this name attached to it, it will be
// called if the promise was being waited on when Proc.stop() got called.
Proc.CANCEL_PROMISE = 'Proc/cancelPromise';



// Simple usage examples
// ---------------------
// Promise canceling:
function delay(timeout) {
  let timeoutId;

  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(resolve, timeout);
  });

  promise[Proc.CANCEL_PROMISE] = () => {
    console.log('Promise cancelled');
    clearTimeout(timeoutId);
  };

  return promise;
}

const p = delay(1000);
p.then(() => console.log('hi'));
p[Proc.CANCEL_PROMISE]();

// Proc:
function *counter(name, timeout) {
  let count = 0;

  while (count < 5) {
    yield Proc.call(delay, timeout);
    count += 1;
    console.log(`${name}: ${count}`);
  }

  console.log(`${name} ended`);
}

const proc1 = new Proc(counter, 'normal', 1000);
proc1.start();

const proc2 = new Proc(counter, 'stopped prematurely', 1000);
proc2.stop();
proc2.start();
delay(1000).then(() => proc2.stop());

const proc3 = new Proc(counter, 'stopped after end', 1000);
proc3.start();
delay(7000).then(() => proc3.stop());

// Task:
import ReactDOM from 'react-dom';

const state = { counters: [] };
const container = document.getElementById('app-container');
const taskContainer = document.createElement('div');

function render() {
  const counterList = state.counters.map((counter, index) => {
    return <li key={index}>Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button></li>;
  });

  // NOTE: You can just render your tasks alongside regular components, but
  // it's probably a bad idea because then you won't be able to do a render
  // without side effects.
  //const counterTasks = state.counters.map((counter, index) => <CounterTask key={index} id={index} />);

  ReactDOM.render(
    <div>
      <ul>{counterList}</ul>

      <p><button onClick={addCounter}>Add</button></p>

      {/*counterTasks*/}
    </div>,
    container
  );

  // Instead it's probably better to make a component to manage all of your tasks
  // and render that separately.
  ReactDOM.render(<TaskManager counters={state.counters} />, taskContainer);
}

function TaskManager({ counters }) {
  const counterTasks = state.counters.map((counter, index) => <CounterTask key={index} id={index} />);

  return <div>{counterTasks}</div>;
}

function addCounter() {
  state.counters.push({ count: 0 });

  render();
}

function incrementCounter(id) {
  state.counters[id].count += 1;

  render();
}

function removeCounter(id) {
  // NOTE: Because we just delete the counter at the given index, the length of
  // the array doesn't decrease so new counters always get a unique id and we
  // don't have to worry about new counters using the same id as an old,
  // removed counter.
  //
  // So in this case it works to just use an array, but in a real app you
  // should really give your tasks proper keys instead of just using an array
  // index.
  delete state.counters[id];

  render();
}

class CounterTask extends Task {
  *run() {
    const { id } = this.props;

    // It's okay to have an infinite loop inside a task as long as it yields
    // inside the loop. The Proc running the task will be stopped when the Task
    // component gets unmounted.
    while (true) {
      yield Proc.call(delay, 1000);
      yield Proc.call(incrementCounter, id);
    }
  }

  taskWasStopped() {
    console.log('taskWasStopped');
  }
}

render();

// Testing Tasks:
// To test a single Task, you can iterate through its generator and compare
// against the call objects it yields, just like Redux Sagas, but simpler
// because Proc only supports call/apply effects.
import deepEqual from 'deep-equal';

const task = new CounterTask({ id: 123 });
const gen = task.run();

for (let i = 0; i < 10; i++) {
  if (!deepEqual(gen.next().value, Proc.call(delay, 1000))) {
    throw new Error('Test failed');
  }
  if (!deepEqual(gen.next().value, Proc.call(incrementCounter, 123))) {
    throw new Error('Test failed');
  }
}
console.log('Tests passed');

// It should also be possible to make some kind of helpers for testing
// tasks/procs, similar to https://github.com/jfairbank/redux-saga-test-plan:
//
// const task = TaskTester(CounterTask, { id: 123 });
//
// for (let i = 0; i < 10; i++) {
//   // These methods would throw an error if the task's yielded calls don't match.
//   task
//   .calls(delay, 1000).returns(undefined)
//   .calls(incrementCounter, 123).returns(undefined);
// }
//
// To test whether or not the correct tasks are being run for the given state,
// you could just use shallow rendering to make sure the Task components are
// being rendered with the correct props:
import ReactTestUtils from 'react-addons-test-utils';

const renderer = ReactTestUtils.createRenderer();
renderer.render(<TaskManager counters={[{ count: 123 }]} />);
// TODO
