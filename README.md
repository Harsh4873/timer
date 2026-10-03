# Timer

A focus timer for harsh.bet/timer. Pick a category, a length, and a scene, then leave it up.

Categories: Pomodoro (25 minutes, then a 5 minute break, with a 15 minute break after four), deep work (50), meditation (10), reading (25), and a plain break (10). Lengths can also be 5, 15, 90, or any custom value from 1 to 180 minutes.

Scenes are drawn on a canvas: forest, birds, rain, ocean, night, meadow, embers, and snow. Move the pointer to stir them. Click empty space for a ripple, a scatter, or a gust. The gear collapses the setup panel for a bigger clock, the controls hide on their own after a few idle seconds and return on click, and Screensaver hides every control at once and asks the screen to stay awake.

The clock stores an end time, so switching apps does not drift the countdown. A chime and a notification fire when a block ends. Pomodoro blocks continue into the next phase while the tab stays open. Ambient sound is optional and follows the scene (stream, bright, rain, ocean, dark, balanced, fire, wind), all synthesized locally with no audio files.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Dev server: http://localhost:5173/timer/
