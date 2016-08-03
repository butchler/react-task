import { connect } from 'react-redux';
import CounterList from '../components/CounterList';
import { addCounter } from '../actions';

function mapState(state) {
  return { counterIds: state.counters.map(counter => counter.id) };
}

function mapDispatch(dispatch) {
  return { onAdd: () => dispatch(addCounter()) };
}

export default connect(mapState, mapDispatch)(CounterList);
