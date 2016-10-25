import Observable from 'zen-observable';

export function task(getObservable, props = {}, options = {}) {
  return {
    getObservable,
    props,
    key: options.key || getObservable.name || 'unnamed function',
    shouldRestart: options.shouldRestart || (() => false),
  };
}

export default class Task {
  constructor(taskDefinition) {
    this.definition = taskDefinition;

    this.getProps = () => this.definition.props;

    // Make a subscriber that can be used to make an observable of the props.
    this.propsObservers = {};
    const nextObserverId = 0;
    this.prop$ = new Observable(observer => {
      const observerId = nextObserverId;
      nextObserverId += 1;

      this.propsObservers[observerId] = observer;

      // Immediately send the current props, and send new props every time update() is called.
      observer.next(this.getProps());

      return () => { delete this.propsObservers[observerId]; }
    });

    this.start();
  }

  start() {
    const observable = this.definition.getObservable(this.getProps, this.prop$);

    // Just subscribe to the observable for its side effects, don't actually do anything with the
    // outputs.
    this.subscription = observable.subscribe({});
  }

  update(nextDefinition) {
    const previousDefinition = this.definition;
    this.definition = nextDefinition;

    if (this.definition.shouldRestart(previousDefinition.props, this.definition.props)) {
      // Restart the task.
      this.stop();
      this.start();
    } else {
      // Send the new props to subscribers.
      Object.keys(this.propsObservers).forEach(key => {
        this.propsObservers[key].next(this.getProps());
      });
    }
  }

  stop() {
    // Clean up observable.
    this.subscription.unsubscribe();
  }
}
