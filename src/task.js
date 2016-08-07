import React from 'react';

import { runProc } from './proc';

/**
 * <Task generator={...} ... />
 *
 * A Task component starts a Proc (which is basically a background process that
 * runs a generator function) when it gets mounted, and stops the Proc when it
 * gets unmounted (or when the value of the generator prop gets changed).
 *
 * The generator function will get passed a `getProps` function, which returns a
 * promise that resolves with the component's current props. If you pass a
 * function to the getProps function, the props will be passed to that function
 * and the promise returned by getProps will only resolve once that function
 * returns a truthy value.
 *
 * NOTE: A Task will only stop its Proc when it gets unmounted or the generator
 * prop is changed. To restart a Task with new props, pass a unique "key" prop,
 * which will force React to unmount the Task when the key changes.
 *
 * Alternatively, you can use the this.getProps() method (which is also passed
 * as the second argument to he generator function) to get the current state of
 * the Task's props in the middle of the Task's execution.
 */
export default class Task extends React.Component {
  constructor() {
    super();

    // Private variables.
    this._onPropsReceived = null;
    this._stopProc = null;
    this._getProps = this.getProps.bind(this);
    this._onCall = this.onCall.bind(this);
  }

  /**
   * Returns a promise that resolves with the props when they match the given
   * filter, or resolves with the current props immediately if no filter
   * function is provided.
   */
  getProps(filterFn = (() => true)) {
    return new Promise((resolve, reject) => {
      // Check and resolve immediately if the props already match the filter.
      if (filterFn(this.props)) {
        resolve(this.props);
        return;
      }

      if (this._onPropsReceived !== null) {
        throw new Error('Cannot call getProps more than once at a time.');
      }

      // Check if the props match the filter whenever they change.
      this._onPropsReceived = (nextProps) => {
        if (filterFn(nextProps)) {
          resolve(nextProps);
          this._onPropsReceived = null;
        }
      };
    });
  }

  /**
   * Updates the state with the result of the last call for debugging purposes.
   */
  onCall(call, callResult) {
    this.setState({ lastCall: call, lastCallResult: callResult });
  }

  start() {
    const procPromise = runProc(this.props.generator(this._getProps), this._onCall);
    this._stopProc = procPromise.cancel;
  }

  stop() {
    if (this._stopProc) {
      this._stopProc();
      this._stopProc = null;
    }
  }

  // React lifecycle methods
  // -----------------------
  //
  // Starts a proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the proc
  // when it gets unmounted.
  //

  componentDidMount() {
    this.start(this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.generator !== nextProps.generator) {
      // If the generator has changed, stop the old Proc and start a new one.
      this.stop();
      this.start();
    } else {
      if (this._onPropsReceived !== null) {
        this._onPropsReceived(nextProps);
      }
    }
  }

  componentWillUnmount() {
    this.stop();
  }

  // Task components never render anything by default.
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }
}

Task.propTypes = {
  generator: React.PropTypes.func.isRequired,
  children: (props, propName, componentName) => {
    if (props.children) {
      return new Error('Task components should not have any children. To organize ' +
          'tasks in a hierarchy, use normal elements like <div>, <span>, etc.');
    }
  },
};
