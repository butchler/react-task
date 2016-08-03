export default function counterList(state = { counters: [], nextId: 0 }, action) {
  const { counters, nextId } = state;

  switch (action.type) {
    case 'INCREMENT_COUNTER':
      return {
        counters: counters.map(counter => {
          if (counter.id === action.payload) {
            return { id: counter.id, count: counter.count + 1 };
          } else {
            return counter;
          }
        }),
        nextId,
      };

    case 'REMOVE_COUNTER':
      return {
        counters: counters.filter(counter => counter.id !== action.payload),
        nextId,
      };

    case 'ADD_COUNTER':
      return {
        counters: [].concat(counters, [{ id: state.nextId, count: 0 }]),
        nextId: nextId + 1,
      };
  }

  return state;
}
