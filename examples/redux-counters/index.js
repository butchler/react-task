import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import CounterList from 'examples/redux-counters/containers/CounterList';
import CounterTasks from 'examples/redux-counters/containers/CounterTasks';

import counterList from 'examples/redux-counters/reducers/counterList';

// Set up saving/loading/deleting of state.
const SAVED_STATE = 'saved-state';

document.getElementById('save-state-button').addEventListener('click', e => {
  localStorage.setItem(SAVED_STATE, JSON.stringify(store.getState()));
});
document.getElementById('delete-state-button').addEventListener('click', e => {
  localStorage.removeItem(SAVED_STATE);
});

let initialState = undefined;
if (localStorage.getItem(SAVED_STATE)) {
  initialState = JSON.parse(localStorage.getItem(SAVED_STATE));
}

// Set up the store.
const store = createStore(counterList, initialState);

// Render the UI.
const appContainer = document.getElementById('app-container');
ReactDOM.render(
  <Provider store={store}>
    <CounterList />
  </Provider>,
  appContainer
);

// Render the tasks in an invisible element so they don't actually show up in the DOM.
const taskContainer = document.createElement('div');
ReactDOM.render(
  <Provider store={store}>
    <CounterTasks />
  </Provider>,
  taskContainer
);
