# react-task

react-task is an experimental alternative to redux-thunk and redux-saga, except
it doesn't depend on Redux at all and instead depends on React.

It is very similar to sagas, except that instead of starting sagas/background
processes when certain actions are dispatched, processes are started/stopped
when certain things become true/cease to be true about the state.

For example, instead of saying "start a loading process when a `LOAD_ITEM`
action is dispatched," you would say "start a loading process when an item
satisfies `item.isLoading === true` and stop the loading process for that item
when that is no longer true."

## Advantages of State-based Side Effects

1. Saving and loading of Redux state also properly saves/loads the side effect
   state. For example, if you save the app state in the middle of loading a
   resource, before the resource finishes loading, the process to load the resource
   will be automatically restarted when you restore the state. To do the same thing
   with action-based side effects you would have to inspect the state or action
   history to see which resources should have been loading and dispatch new actions
   to start the appropriate loading processes.
2. It is easy to test which side effect processes are running for a given state.
   You can say "when the app is in this state, these side effect processes
   should be running." With action-based side effects, you might have dispatch many
   actions to get your app into the right state to test a particular side effect.
   More importantly, you can organize your side effects into a hierarchy and test
   different parts of the app's side effects modularly, just like you can with UI
   components.

## Tasks as Components

react-task actually uses React components to represent the side effect
processes that should currently be running. Task components basically
just do two things:

1. When the component is mounted, it starts a background process that
   runs the generator function you give it. When the component gets
   unmounted/stops being rendered, it stops the background process if it
   hasn't ended already.
2. Passes a `getProps` function as an argument to the generator function
   that it can call to get the current state of the props.

It may seem really strange to use React components to represent
processes, but this actually has several advantages:

1. Reuses React's existing reconciliation algorithm instead of making a
   custom algorithm for starting/stopping of processes.
2. Let's you organize your side effect tasks in a hierarchy of reusable components.
3. Because they're just regular React components, you can use react-redux's
   `connect` to connect your side effects to your Redux state just like with UI
   components. This allows the side effect handling code to be very reusable.
4. As React components, tasks can also be inspected using React's existing
   devtools to see what side effect processes are currently running. As an
   additional debugging tool, the Task component stores information about the
   current "step" in the execution of the background process to the component's
   state, and it could probably be extended to add more debugging info.
5. Tasks can be tested using React component testing tools like shallow
   rendering, to test that the correct tasks are run for a given state.
6. You can add propTypes to your task components.
7. You can render tasks inside of your UI components if there are side
   effects that should be tied to a particular UI component, or render them
   completely separately from your UI, whichever way is more appropriate
   for your use case.

Ultimately, however, React is a UI rendering library, so it is possible that it
could add UI-specific optimizations in the future that would break use cases
like this. However, I think the risk of this happening is currently outweighed
by the above benefits.

## API Reference

### `task(function* (getProps) { ... })` => Stateless React component

Takes a generator function and returns a stateless React component that will
start the process described by the generator function when the component is
mounted and stop it when the component is unmounted.

The generator function should yield calls to `call`/`apply`/etc instead of
calling the function directly when calling any function that performs side
effects, similar to sagas. This allows the functionality of the process to be
tested without actually performing side effects and without complicated mocking.

It also allows you to easily wait on promises very similar to ES7 async/await.
The generator function will wait on a promise and continue execution with the
value that the promise resolved with when the promise resolves (or continue
execution in the next `catch {}` block with the value that the promise rejected
with if the promise rejects).

When the task component gets unmounted, the generator function's process will be
stopped by calling `Generator.return()` on it. This means that it will continue
execution at the next `finally {}` block if it has one, which can be used to
perform clean up when a process ends. You may still yield promises and `call`s
normally inside of a `finally {}` block. In addition, if the task was waiting on
a promise when it got cancelled and the promise has a `cancel` method, the
promise's `cancel` method will be called.

The generator function will get passed a single argument, a `getProps` function.
When called with no arguments, `getProps` returns a promise that immediately
resolves with the current props passed to the component. (Tasks do not get
restarted when their props are updated, only when they get mounted/unmounted, so
`getProps` must be used to get the props.)

If you pass a function as the first argument to `getProps`, the function will be
called with the current props and whenever the props get updated. `getProps`
will return a promise that resolves with the current props as soon as the
function returns a value that coerces to true.

Example:

```javascript
import { task } from 'react-task';
import { playSound } from './playSound';
import React, { Component, PropTypes } from 'react';

const AnimationTask = task(function* (getProps) {
  const { setAnimationState } = yield call(getProps);

  try {
    // This might dispatch an action that causes a class with a transition style
    // to be set on some UI component.
    yield call(setAnimationState, 'fade-in');
    // Wait until the transition is done using an onTransitionEnd callback to
    // that dispatches an action to update the animation state.
    yield getProps(props => props.animationState === 'fade-in-end');
    // Play a sound and wait for it to be done (assuming that playSound returns
    // a promise that resolves when the sound is done playing).
    yield call(playSound, '/path/to/sound.mp3');
    // Start the fade out transition.
    yield call(setAnimationState, 'fade-out');
  } finally {
    yield callMethod(console, 'log', 'task stopped');
  }
});

AnimationTask.displayName = 'AnimationTask';

AnimationTask.propTypes ={
  setAnimationState: PropTypes.func.isRequired,
  animationState: PropTypes.string.isRequired,
};

export default class AnimationComponent extends Component {
  constructor() {
    super();

    this.state = { animationState: 'hidden' };
  }

  render() {
    <div
      className={this.state.animationState}
      onTransitionEnd={() => if (this.state. animationState === 'fade-in') this.setState({ animationState: 'fade-in-end' })}
    >
      This component will be faded in and out.
      <AnimationTask
        setAnimationState={animationState => this.setState({ animationState })}
        animationState={this.state.animationState}
      />
    </div>
  }
}

// CSS:
.hidden {
  opacity: 0;
}
.fade-in {
  opacity: 1;
  transition: opacity 1s;
}
.fade-out {
  opacity: 0;
  transition: opacity 1s;
}
```

### `call(sideEffectFunction, ...args)` => 'call' object

Call takes a function and a list of arguments for the function and returns an
object that can be used to actually execute the function call later. It is
analogous to redux-saga's declarative effects.

`call` and all of the other call object creator functions should always be used
in combination with a `yield` statement inside of a task's generator function.
The process runner for the task will receive the yielded calls and actually
execute them.

If the result of the function call is a promise, the process runner will wait
until the promis resolves before returning the resolved value to the generator
function and continuing execution.

### `apply(thisContext, sideEffectFunction, argsArray)` => call object

Similar to `call`, but allows you to set the value of `this` within the function
call, and let's you specify the arguments as an array.

### `callMethod(object, methodName, ...arts)` => 'call' object

Convenience function that is equivalent to `apply(object, object[methodName], args)`.

### `callSync/applySync/callMethodSync` => 'call' object

The synchronous version of each of the call creator functions has the same
signature as the asynchronous version. However, if the result of the function
call is a promise, it will just return the value of the promise and continue
execution instead of waiting for the promise to resolve/reject.

You can save a reference to the returned promise and yield it later in the
generator function to wait until the promise resolves.

If the returned promise has a `cancel` method, it will be called when the task's
process ends or is cancelled.

### `run(generatorFunction, ...args)` => Promise

This is the public API for the process runner that backs task components. It
takes a generator function that yields calls to `call`/`apply`/etc and a list of
arguments for the generator function, and returns a promise that resolves with
the final return value of the generator function (or rejects if there is an
error during the execution of the function).

The returned promise has a `cancel` method which can be used to trigger stopping
of the process. The process might not immediately finish after being cancelled
if it has a `finally {}` block that waits promises or `call`s. You can call
`cancel` multiple times to break out to the next finally block repeatedly until
the generator function ends.

In addition to calling `cancel` directly, `cancel` will also be called when the
parent process ends if `run` is called inside of another process via
`call`/`callSync`/etc. This means you can do something like:

```javascript
import { run, callSync } from 'react-task';
import childProc from './childProc';

function *parentProc() {
  const child1 = yield callSync(run, childProc, 1);
  const child2 = yield callSync(run, childProc, 2);
  return yield Promise.race([child1, child2]);
}

run(parentProc).then(result => console.log(result));
```

And both of the child processes will be stopped when the parent process ends or
gets cancelled.

If you need to account for the fact that promises can have multiple consumers
when cancelling promises, then you might want to consider using a promise
library that has support for cancelable promises such as Bluebird:
http://bluebirdjs.com/docs/api/cancellation.html#what-about-promises-that-have-multiple-consumers

`run` is more generic process abstraction than sagas because it doesn't know
anything about Redux or actions. It is also doesn't need to have forking
mechanics since most use cases of forking can probably be handled
by mounting/unmounting of task components to start/stop processes.
