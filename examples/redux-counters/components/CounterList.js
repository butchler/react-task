import React from 'react';
import Counter from 'examples/redux-counters/containers/Counter';

export default function CounterList({ counterIds, onAdd }) {
  return (
    <div>
      <p><button onClick={onAdd}>Add counter</button></p>

      <ul>
        {counterIds.map(id => <li key={id}><Counter id={id} /></li>)}
      </ul>
    </div>
  );
}
