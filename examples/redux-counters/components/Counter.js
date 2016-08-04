import React from 'react';

export default function Counter({ count, onRemove }) {
  return (
    <span>
      <span style={{ display: 'inline-block', minWidth: '100px' }}>Count: {count}</span>
      <button onClick={onRemove}>Remove</button>
    </span>
  );
}
