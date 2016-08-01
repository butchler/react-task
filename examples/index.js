import 'babel-polyfill';

import { Task, call, callSync } from '../src';
import { runProc } from '../src/proc';
import TaskTester from '../src/test';
import { delay } from '../src/promises';

// Examples
// --------
import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import ReactTestUtils from 'react-addons-test-utils';
import deepEqual from 'deep-equal';

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}

const log = console.log.bind(console);

// Proc:
function procExample() {
  const counter = function *(timeout) {
    let count = 0;

    try {
      while (count < 5) {
        yield call(delay, timeout);
        count += 1;
        yield call(log, `Count: ${count}`);
      }
    } finally {
      if (count < 5) {
        yield call(log, 'Counter was cancelled before it ended.');
      }

      yield call(log, 'delaying end');
      yield call(delay, 1000);
      yield call(log, 'actual end');
    }
  };

  runProc(counter, 500).then(() => {
    console.log('First counter ended.');

    const proc = runProc(counter, 500);
    delay(1000).then(proc.cancel);
  });
}

// Task:
function taskExample() {
  const state = { counters: [] };
  const appContainer = document.getElementById('app-container');
  const taskContainer = document.createElement('div');

  const render = () => {
    ReactDOM.render(<App state={state} />, appContainer);

    // Render the tasks in an unattached element so that they don't modify the visible DOM.
    ReactDOM.render(<AppTasks state={state} />, taskContainer);
  };

  const App = ({ state }) => {
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
  };

  const AppTasks = ({ state }) => {
    const counterTasks = state.counters.map((counter, index) => <CounterTask key={index} id={index} />);

    return <div>{counterTasks}</div>;
  };

  const CounterTask = class CounterTask extends Task {
    *run() {
      try {
        const { id } = this.props;

        // It's okay to have an infinite loop inside a task as long as it yields
        // inside the loop. The Proc running the task will be stopped when the Task
        // component gets unmounted.
        while (true) {
          yield call(delay, 1000);
          yield call(incrementCounter, id);
        }
      } finally {
        // Use a finally block to perform clean up when a Task gets stopped.
        console.log('Task was unmounted and stopped.');
      }
    }
  };

  //
  // Instead of making a subclass of Task, you can just pass a generator function directly to the
  // generic Task component:
  //
  // function *CounterGenerator({ id }) {
  //   while (true) {
  //     yield call(delay, 1000);
  //     yield call(incrementCounter, id);
  //   }
  // }
  //
  // ...
  //
  // <Task generator={CounterGenerator} id={id} />
  //

  const addCounter = () => {
    state.counters.push({ count: 0 });

    render();
  };

  const incrementCounter = (id) => {
    state.counters[id].count += 1;

    render();
  };

  const removeCounter = (id) => {
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

  // Testing Tasks:
  function testTaskExample() {
    // To test a single Task, you can iterate through its generator and compare
    // against the call objects it yields, just like Redux Sagas, but simpler
    // because Proc only supports call/apply effects:
    const task = new CounterTask();
    task.props = { id: 123 };
    const gen = task.run();

    for (let i = 0; i < 10; i++) {
      assert(deepEqual(gen.next().value, call(delay, 1000)));
      assert(deepEqual(gen.next(undefined).value, call(incrementCounter, 123)));
    }

    // The same test using a helper for testing tasks:
    const taskTester = new TaskTester(<CounterTask id={123} />);

    for (let i = 0; i < 10; i++) {
      taskTester.calls(delay, 1000).calls(incrementCounter, 123);
    }

    // To test whether or not the correct tasks are being run for the given
    // state, you can just use shallow rendering to make sure the correct Task
    // components are being rendered:
    const renderer = ReactTestUtils.createRenderer();
    renderer.render(<AppTasks state={{ counters: [{ count: 123 }] }} />);
    const tasks = renderer.getRenderOutput().props.children;

    assert(deepEqual(tasks, [<CounterTask key={0} id={0} />]));
  }

  render();
  testTaskExample();

  function *CounterTaskSync({ id }) {
    // It's okay to have an infinite loop inside a task as long as it yields
    // inside the loop. The Proc running the task will be stopped when the Task
    // component gets unmounted.
    while (true) {
      const promise = yield callSync(delay, 1000);
      yield promise;
      yield call(incrementCounter, id);
    }
  }

  function testSync() {
    const task = new TaskTester(<Task generator={CounterTaskSync} id={123} />);

    for (let i = 0; i < 1; i++) {
      task
        .calls(delay, 1000).returns(Promise.resolve(true))
        .yieldsPromise()
        .calls(incrementCounter, 123);
    }

    for (let i = 0; i < 1; i++) {
      task
        .calls(delay, 1000)
        .skip()
        .calls(incrementCounter, 123);
    }
  }

  testSync();
}

// Server rendering:
function serverRenderTest() {
  // Server rendering of tasks should work without causing side effects because
  // only componentWillMount gets called during server rendering.
  const ServerTaskTest = (props) => {
    const fail = function *(props) {
      throw new Error('This should fail');
    };

    return <Task generator={fail} />;
  };

  // This shouldn't throw an error:
  assert(ReactDOMServer.renderToStaticMarkup(<ServerTaskTest />) === '');

  // This should throw an error:
  ReactDOM.render(<ServerTaskTest />, document.createElement('div'));
}

procExample();
taskExample();
serverRenderTest();
