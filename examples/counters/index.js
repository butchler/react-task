import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import ReactTestUtils from 'react-addons-test-utils';
import deepEqual from 'deep-equal';

import { Task, call, callSync, callMethod } from 'src';
import { delay } from 'src/promises';
import TaskTester from 'src/test';

const state = { counters: [] };
const appContainer = document.getElementById('app-container');
const taskContainer = document.createElement('div');

render();
tests();

function render() {
  ReactDOM.render(<App state={state} />, appContainer);

  // Render the tasks in an unattached element so that they don't modify the visible DOM.
  ReactDOM.render(<AppTasks state={state} />, taskContainer);
}

function App({ state }) {
  const counterList = state.counters.map((counter, index) => {
    return <li key={index}>Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button></li>;
  });

  return <div>
  <p><button onClick={addCounter}>Add Counter</button></p>

  <ul>{counterList}</ul>

  {/*
    * NOTE: You could just render your tasks alongside regular components like this:
    *

    <AppTasks state={state} />

    *
    * But it's probably a bad idea, because then you won't be able to render
    * on the client without causing side effects.
    *
    * Instead it's probably better to render all of your tasks separately
    * from your UI, like in render() above.
    *
    */}
  </div>;
}

function AppTasks({ state }) {
  const counterTasks = state.counters.map((counter, index) => <CounterTask key={index} id={index} />);

  return <div>{counterTasks}</div>;
}

function* counterTask(getProps) {
  try {
    const { id } = yield call(getProps);

    // It's okay to have an infinite loop inside a task as long as it yields
    // inside the loop. The Proc running the task will be stopped when the Task
    // component gets unmounted.
    while (true) {
      yield call(delay, 1000);
      yield call(incrementCounter, id);
    }
  } finally {
    // Use a finally block to perform clean up when a Task gets stopped.
    yield callMethod(console, 'log', 'Task was unmounted and stopped.');
  }
}

function *counterTaskSync(getProps) {
  const { id } = yield call(getProps);

  while (true) {
    // You can also use callSync to call a function and get the promise directly
    // instead of automatically waiting on the promise.
    const promise = yield callSync(delay, 1000);
    // Then you can do other things while waiting on that promise.
    yield callMethod(console, 'log', 'Started delay');
    // And then wait for the promise to resolve later.
    yield promise;
    yield call(incrementCounter, id);
  }
}

// If you want you can make a helper stateless component to render the task.
function CounterTask({ id }) {
  return <Task generator={counterTask} id={id} />;
}

function addCounter() {
  state.counters.push({ count: 0 });

  render();
}

function incrementCounter(id) {
  state.counters[id].count += 1;

  render();
};

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
};

function tests() {
  // To test a single Task, you can iterate through its generator and compare
  // against the call objects it yields, just like Redux Sagas, but simpler
  // because Proc only supports call/apply effects:
  //
  // We can just pass a fake getProps function in since we'll fake its results
  // using Generator.next() anyway.
  const getProps = () => undefined;
  const gen = counterTask(getProps);
  // Get the first call object, which should be a call to getProps.
  assert(deepEqual(gen.next().value, call(getProps)));
  // Pass the initial props to the generator and skip the first iteration of
  // the loop.
  gen.next({ id: 123 });
  gen.next();

  for (let i = 0; i < 10; i++) {
    assert(deepEqual(gen.next().value, call(delay, 1000)));
    assert(deepEqual(gen.next(undefined).value, call(incrementCounter, 123)));
  }

  // The same test using a helper for testing tasks:
  const task = new TaskTester(counterTask);

  task.calls(task.getProps).returns({ id: 123 });

  for (let i = 0; i < 10; i++) {
    task.calls(delay, 1000).calls(incrementCounter, 123);
  }

  // Another test for counterTaskSync:
  const taskSync = new TaskTester(counterTaskSync);

  taskSync.calls(taskSync.getProps).returns({ id: 123 });

  for (let i = 0; i < 10; i++) {
    taskSync
      .calls(delay, 1000).returns(Promise.resolve(true))
      .applies(console, console.log, ['Started delay'])
      .yieldsPromise()
      .calls(incrementCounter, 123);
  }

  // You can also just ignore the yield to the promise using skip().
  for (let i = 0; i < 10; i++) {
    taskSync
      .calls(delay, 1000)
      .applies(console, console.log, ['Started delay'])
      .skip()
      .calls(incrementCounter, 123);
  }

  // To test whether or not the correct tasks are being run for the given
  // state, you can just use shallow rendering to make sure the correct Task
  // components are being rendered:
  const renderer = ReactTestUtils.createRenderer();
  renderer.render(<AppTasks state={{ counters: [{ count: 123 }] }} />);
  const tasks = renderer.getRenderOutput().props.children;

  assert(deepEqual(tasks, [<CounterTask key={0} id={0} />]));
}

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}
