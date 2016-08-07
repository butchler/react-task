var React = require('react');
var ReactDOMServer = require('react-dom/server');

var Task = require('../').Task;

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}

// Server rendering:
function serverRenderTest() {
  // Server rendering of tasks should work without causing side effects because
  // only componentWillMount gets called during server rendering.
  var ServerTaskTest = function (props) {
    const fail = function (getProps) {
      throw new Error('This should fail');
    };

    return React.createElement(Task, { proc: fail });
  };

  // This shouldn't throw an error:
  assert(ReactDOMServer.renderToStaticMarkup(React.createElement(ServerTaskTest)) === '');
}

serverRenderTest();

console.log('Server render worked!');
