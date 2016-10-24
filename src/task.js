export default function task(getObservable, props, options) {
  return {
    getObservable,
    props,
    key: options.key || getObservable.name,
    shouldRestart: options.shouldRestart || () => false,
  };
}
