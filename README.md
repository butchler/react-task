# React Task

This is an experimental approach to managing side effects I came up with while
trying to think of alternatives to redux-thunk and redux-saga. However, it is
not dependent on Redux at all and can be used with any React code.

In short, the approach is to render Task components that represent side
effects based on your state/store, and let the Task components
start/stop Procs (which are very simplified versions of sagas) based on
which Tasks got rendered.

## State-based Side Effects

This means that side effects are not started/stopped when actions get
dispatched, like in redux-thunk and redux-saga, but when the state changes.

In most cases, this doesn't change things that much, because the actions
already make changes to the state. For example, if you have a `LOAD_RESOURCE`
action that triggers an AJAX request, you probably also want it to update the
state to set an `isLoading` flag so that the UI can show a loading icon.

With this approach, you would just render a Task component for each resource
where `isLoading === true`.

## Simple Example

This example should log the text you input to the console once every
second, and the old process will automatically be stopped when you
change the text (because the key prop for the Task component changed).

```
function render(text) {
  ReactDOM.render(
    <div>
      <input id="text" type="text" placeholder="Enter some text to console.log" />
      <button onClick={() => render(document.getElementById('text').value)}>Update Text</button>
      <Task key={text} generator={logger} text={text} />
    </div>,
    document.getElementById('app-container')
  );
}

function *logger({ text }) {
  if (!text) return;

  while (true) {
    yield proc.call(delay, 1000);
    yield proc.call(() => console.log(text));
  }
}
```

## Advantages

The main advantage of this approach is that it makes saving/loading of
state *including side effects* simpler. For simpler apps that don't have a lot
of side effects this isn't really necessary, but for more side-effect
heavy apps like games it can simplify things a lot.

For example, let's say you wanted to make an online Mario clone with
React/Redux (probably not the best idea, but it's a useful example for
talking about side-effects). Here are some of the side effects that your
Mario clone has:

* Playing background music
* Playing sound effects
* Sending the user's high score to the server when the player beats a
  level
* Starting the countdown timer when the player starts a new level

Let's say you save all of the user's actions during a session of play
and then you want to reload their state on a new computer and start
playing where they left off (you might want to do this for debugging
purpose, or you might want to allow players to save and restore their
game).

You can't just replay all of the actions with side effects, or else
you'll cause the high scores to be sent again (possibly overriding more
recent high scores), and you'll play a whooole bunch of sound effects
all at once.

Since you're using Redux, you can replay all of the actions without side
effects in order to reproduce the state exactly. But if you just start
playing the game from that state in the middle of the level, there will
be no background music playing and the countdown timer won't be counting
down, since those side effects get triggered by actions, not state, and
those actions are probably only dispatched at the beginning of each
level, whereas you just loaded the state in the middle of the level.

The background music is probably different for each level, so to start
playing it again you'll have to look at the state and see what the
current level is and then dispatch an action that starts playing the
correct background music for that level.

I'm proposing a style where you always do this, producing all of your
side effects based on the state rather being triggered than actions.

This means that you can (theoretically, if this actually works) load any
state and be sure that all of the correct side effects for *that* state
will be triggered.

It also makes testing simple, because you can just use shallow rendering
to make sure the correct Tasks/side-effects are being run for a given
state. Procs are just generator functions that yield objects that
represent function calls, and can be tested in the same way as sagas.

## Disadvantages

Trying to enforce some kind of weird declarative abstraction on
something that's inherently imperative (side-effects) might have some
quirks.

The weirdest quirk with this approach I've found so far is that if you
render a Task with the same generator but different props/arguments,
it's not clear if the Proc should be restarted with the new props, or if
it should just keep on running (because the props may have been
mutated). I've added some error checking on non-production environments
to warn about this, but it still might be a bit confusing.

I'm sure there are other disadvantages to this approach, and it might be
fundamentally broken somehow, so I'd really appreciate it if others
could take a look at it and let me know what they thing.
