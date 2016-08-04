import React from 'react';
import CounterTask from 'examples/redux-counters/containers/CounterTask';

export default function CounterTasks({ counterIds }) {
  return (
    <div>
      {counterIds.map(id => <CounterTask key={id} id={id} />)}
    </div>
  );
}
