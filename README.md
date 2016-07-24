# React Task

This is an experimental approach to managing side effects I came up with while
trying to think of alternatives to redux-thunk and redux-saga. However, it is
not dependent on Redux at all and can be used with any React code.

In short, the approach is to render Task components that represent side
effects, and let the Task components start/stop Procs (which are very
simplified versions of sagas) based on which Tasks got rendered.

## State-based side effects

This means that side effects are not started/stopped when actions get
dispatched, like in redux-thunk and redux-saga, but when the state changes.

In most cases, this doesn't change things that much, because the actions
already make changes to the state. For example, if you have a `LOAD_RESOURCE`
action that triggers an AJAX request, you probably also want it to update the
state to set an `isLoading` flag so that the UI can show a loading icon.

With this approach, you would just render a Task component for each resource
where `isLoading === true`.
