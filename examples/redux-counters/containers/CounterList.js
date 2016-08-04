import { connect } from 'react-redux';
import CounterList from 'examples/redux-counters/components/CounterList';
import { addCounter } from 'examples/redux-counters/actions';

function mapState(state) {
  return { counterIds: state.counters.map(counter => counter.id) };
}

function mapDispatch(dispatch) {
  return { onAdd: () => dispatch(addCounter()) };
}

export default connect(mapState, mapDispatch)(CounterList);
