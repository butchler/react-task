export default function task(getObservable, props, options) {
  return {
    getObservable,
    props,
    key: options.key || getObservable.name || 'unnamed function',
    shouldRestart: options.shouldRestart || () => false,
  };
}
