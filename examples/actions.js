export function incrementCounter(id) {
  return { type: 'INCREMENT_COUNTER', payload: id };
}

export function removeCounter(id) {
  return { type: 'REMOVE_COUNTER', payload: id };
}

export function addCounter() {
  return { type: 'ADD_COUNTER' };
}
