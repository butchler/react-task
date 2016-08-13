import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import ReactTestUtils from 'react-addons-test-utils';
import deepEqual from 'deep-equal';

import { task, call, callSync, callMethod } from 'src';
import { delay } from 'src/promises';
import TaskTester from 'src/test';

const state = { counters: [] };
const appContainer = document.getElementById('app-container');

function render() {
  ReactDOM.render(<App state={state} />, appContainer);
}

function App({ state }) {
  const counterList = state.counters.map((counter, index) => {
    return (
      <li key={index}>
        Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button>

        {/**
          * NOTE: In this example, the Task component is rendered alongside the UI components. In
          * the redux-counters example, the Tasks and UI are rendered completely independently.
          *
          * In many cases, it's nice to keep the UI rendering and Task rendering separate, so that
          * the UI code doesn't have to be concerened with side effects.
          *
          * In some cases it might make sense for the Tasks to be tied to a particular UI component.
          * For example, on one page you might have the same form in two different locations on the
          * page, but on another page you might have only one form or no form. How many copies of
          * the form are currently being rendered is probably difficult to determine from the state
          * alone. However, if you want each copy of the form to handle the side effects related to
          * submitting the form independently, you should probably have the Task components rendered
          * inside of the form UI component.
          *
          * Another case where it might be a good idea to couple the UI and side effects is UI
          * animations, because the Task that handles the animation sequence might need to depend on
          * one of the UI component's onTransitionEnd callbacks, for example. However, you might
          * also decide that it makes more sense to keep the animation sequence decoupled from the
          * UI, because the same animation sequence could potentially be used to manage the
          * animation of several completely separate parts of the UI.
          *
          * It's up to you to decide which approach is more appropriate for each Task: whether the
          * Task should be tied to a particular component in the UI, or tied to a particular piece
          * of your app's state.
          */}
        <CounterTask id={index} />
      </li>
    );
  });

  return (
    <div>
      <p><button onClick={addCounter}>Add Counter</button></p>

      <ul>{counterList}</ul>
    </div>
  );
}

function* counterProc(getProps) {
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

// Creates a stateless React component that just renders the Task component with
// the given generator function.
const CounterTask = task(counterProc);

function *counterProcSync(getProps) {
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
  const gen = counterProc(getProps);
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
  const task = new TaskTester(counterProc);

  task.calls(task.getProps).returns({ id: 123 });

  for (let i = 0; i < 10; i++) {
    task.calls(delay, 1000).calls(incrementCounter, 123);
  }

  // Another test for counterProcSync:
  const taskSync = new TaskTester(counterProcSync);

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
  renderer.render(<App state={{ counters: [{ count: 123 }] }} />);
  // NOTE: Testing is one reason that it's nice to keep the Task rendering separate from the UI
  // rendering: you don't have to filter through the UI components to look for the Task components.
  // On the other hand, you should probably use a library like enzyme to help out with this kind of
  // thing, anyway.
  const ul = renderer.getRenderOutput().props.children[1];
  const tasks = ul.props.children.map(li => li.props.children.find(element => element.type === CounterTask));

  assert(deepEqual(tasks, [<CounterTask id={0} />]));
}

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}

render();
tests();
