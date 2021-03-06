import { connect } from 'react-redux';
import Counter from 'examples/redux-counters/components/Counter';
import { removeCounter } from 'examples/redux-counters/actions';

function mapState(state, { id }) {
  return { count: state.counters.find(counter => counter.id === id).count };
}

function mapDispatch(dispatch, { id }) {
  return { onRemove: () => dispatch(removeCounter(id)) };
}

export default connect(mapState, mapDispatch)(Counter);
