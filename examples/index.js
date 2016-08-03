import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import CounterList from './containers/CounterList';
import CounterTasks from './containers/CounterTasks';

import counterList from './reducers/counterList';

const store = createStore(counterList);

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
