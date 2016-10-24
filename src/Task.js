export default class Task {
  constructor(taskDefinition) {
    this.definition = taskDefinition;
    this.unsubscribe = null;
    this.propsObservers = {};
    this.lastObserverId = 0;

    this.getProps = () => this.definition.props;
    // Make a subscriber that can be used to make an observable of the props.
    this.subscribeProps = observer => {
      const observerId = this.lastObserverId;
      this.lastObserverId += 1;

      this.propsObservers[observerId] = observer;

      observer.next(this.getProps());

      return () => { delete this.propsObservers[observerId]; }
    };

    this.start();
  }

  start() {
    const observable = this.definition.getObservable(this.getProps, this.subscribeProps);

    const unsubscriber = this.definition.observable.subscribe(
      () => null,
      error => throw error,
      () => { this.unsubscribe = null }
    );

    if (unsubscriber && typeof unsubscriber.unsubscribe === 'function') {
      this.unsubscribe = unsubscriber.unsubscribe;
    } else if (typeof unsubscribe === 'function') {
      this.unsubscribe = unsubscriber;
    } else if (unsubscriber !== null && unsubscriber !== undefined) {
      throw new TypeError('Expected Observable.subscribe to return a Subscription, an unsubscribe function, or null/undefined.');
    }
  }

  update(nextDefinition) {
    const previousDefinition = this.definition;
    this.definition = nextDefinition;

    if (nextDefinition.shouldRestart(previousDefinition.props, this.definition.props)) {
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
    // Clean up props subscribers.
    Object.keys(this.propsObservers).forEach(key => {
      this.propsObservers[key].complete();
      delete this.propsObservers[key];
    });
    this.lastObserverId = 0;

    // Clean up observable.
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
