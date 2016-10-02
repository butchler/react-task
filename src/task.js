import React, { PropTypes } from 'react';
import ReactDOM from 'react-dom';
import Promise from 'promise';
import { runAsync, runProcAsync, createProcGenerator, isCall, getCallInfo } from './proc';
import { getFunctionName, createMappedGenerator } from './util';

/**
 * Returns an instance of Task with a key based on the function name so you don't have to set the
 * key for every Task element yourself if you have multiple sibling Task elements.
 */
export function task(generatorFunction, props) {
  const proc = generatorFunction;
  const name = getFunctionName(proc);
  const key = props.key ? `task(${name}, ${props.key})` : `task(${name})`;
  return React.createElement(Task, Object.assign({}, props, { key, proc }));
}

/**
 * Takes a function that takes props and returns a list of Task elements, and returns a function
 * that takes a function that takes a component and returns a component that renders that component
 * and starts the given tasks, without actually inserting the Task elements into the DOM.
 */
export function withTasks(mapPropsToTasks) {
  return component => {
    const wrapper = class WithTasks extends React.Component {
      constructor() {
        super();

        this.container = null;
      }

      componentDidMount() {
        this.container = document.createElement('div');
        updateTasks(this.props);
      }

      componentDidUpdate() {
        updateTasks(this.props);
      }

      componentWillUnmount() {
        ReactDOM.unmountComponentAtNode(this.container);
      }

      updateTasks() {
        ReactDOM.render(
          <div>
            {mapPropsToTasks(props)}
          </div>,
          this.container
        );
      }

      render() {
        return <component {...this.props} />;
      }
    };

    wrapper.displayName = `WithTasks(${component.displayName || component.name || 'Component'})`;

    return wrapper;
  };
}

/**
 * <Task proc={...} ... />
 *
 * A Task component starts a Proc (which is basically a background process that
 * runs a generator function) when it gets mounted, and stops the Proc when it
 * gets unmounted (or when the value of the proc prop gets changed).
 *
 * The generator function will get passed a `getProps` function, which returns a
 * promise that resolves with the component's current props.
 *
 * NOTE: A Task will only stop its Proc when it gets unmounted or the proc prop
 * is changed. To restart a Task with new props, pass a unique "key" prop, which
 * will force React to unmount the Task when the key changes.
 *
 * Alternatively, you can use the this.getProps() method (which is also passed
 * as the second argument to the generator function) to get the current state of
 * the Task's props in the middle of the Task's execution.
 */
export class Task extends React.Component {
  constructor() {
    super();

    this.getProps = this.getProps.bind(this);
    this.waitProps = this.waitProps.bind(this);
    this.onProcDone = this.onProcDone.bind(this);
    this.logCalls = this.logCalls.bind(this);
    this.logResults = this.logResults.bind(this);

    this.onPropsReceived = null;
    this.proc = null;
    this.wasUnmounted = false;
    this.isProcDone = false;

    if (process.env.NODE_ENV !== 'production') {
      this.state = {
        log: [],
      };
    }
  }

  /**
   * Returns a promise that resolves with the props when they match the given filter.
   */
  waitProps(filterFn = (() => true)) {
    if (this.onPropsReceived !== null) {
      throw new Error('Cannot call waitProps more than once at a time.');
    }

    const promise = new Promise((resolve, reject) => {
      // Check and resolve immediately if the props already match the filter.
      if (filterFn(this.props)) {
        resolve(this.props);
        return;
      }

      // Check if the props match the filter whenever they change.
      this.onPropsReceived = nextProps => {
        if (filterFn(nextProps)) {
          resolve(nextProps);
          this.onPropsReceived = null;
        }
      };
    });

    promise.cancel = () => this.onPropsReceived = null;

    return promise;
  }

  getProps() {
    return this.props;
  }

  onProcDone(result) {
    this.props.onProcDone && this.props.onProcDone(result);

    this.isProcDone = true;
  }

  onProcError(error) {
    this.props.onProcError && this.props.onProcError(error);

    this.isProcDone = true;
  }

  logCalls(value) {
    if (isCall(value)) {
      const { context, fn, args } = getCallInfo(value);

      const message = `called: ${getFunctionName(fn)}(${args.map(JSON.stringify).join(', ')})`;

      this.state.log.push(message);
    }

    return value;
  }

  logResults(value) {
    this.state.log.push(value.result);

    return value;
  }

  // React lifecycle methods
  // -----------------------
  //
  // Starts a proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the proc
  // when it gets unmounted.
  //

  componentDidMount() {
    if (process.env.NODE_ENV === 'production') {
      this.procPromise = runAsync(this.props.proc, this.getProps, this.waitProps);
    } else {
      // On non-production environments, wrap the generator so that we can log all of its calls and
      // yields in the component state for debugging purposes.
      let generator = this.props.proc(this.getProps, this.waitProps);
      generator = createMappedGenerator(this.logCalls, generator);
      generator = createProcGenerator(generator);
      generator = createMappedGenerator(this.logResults, generator);

      this.procPromise = runProcAsync(generator);
    }

    // Ensure that uncaught rejections get logged as errors.
    this.procPromise.done(this.onProcDone, this.onProcError);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.proc !== nextProps.proc) {
      console.warn('Changing the proc property of the Task component will not ' +
        'cause the process to restart. Use the task() helper function instead of ' +
        'using the Task component directly, or set a key prop on the Task ' +
        'component to make it mount a new component when the proc changes.');
    } else {
      if (this.onPropsReceived) {
        this.onPropsReceived(nextProps);
      }
    }
  }

  componentWillUnmount() {
    this.procPromise.return();

    // Log a warning if the proc doesn't end within 10 seconds.
    if (process.env.NODE_ENV !== 'production') {
      setTimeout(() => {
        if (!this.isProcDone) {
          const name = getFunctionName(this.props.proc);
          console.warn(`Proc "${name} did not finish within 10 seconds after Task unmounted.`);
        }
      }, 10 * 1000);
    }

    this.wasUnmounted = true;
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }
}

Task.propTypes = {
  proc: PropTypes.func.isRequired,
  onProcDone: PropTypes.func,
  onProcError: PropTypes.func,
  children: (props, propName, componentName) => {
    if (props.children) {
      return new Error('Task components should not have any children. To organize ' +
          'tasks in a hierarchy, use normal elements like <div>, <span>, etc.');
    }
  },
};
