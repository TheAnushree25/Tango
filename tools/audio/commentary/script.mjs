// The commentary, one entry per goal, in the same order as PLAYS in tools/render/web/match.js.
// All of it is placeholder copy about a fictional player, like the rest of the site.
//
// Each goal has two takes, because the clip loops: `live` is the first call and `replay` plays on the next pass.
//
// Where a line goes:
//   at: a time in seconds from the start of the clip, or 'net' for the moment the ball crosses the line
//   end: 'strike' makes the line finish as the ball is struck, so the flight of the ball stays quiet
// ex is the model's emotion setting: about 0.5 is calm, and above 1.5 is a full shout.
//
// Lines run at about 3 to 4 words a second when calm, and 2 to 3 when shouted, with each mid-line "!" adding
// a short pause. tools/audio/synth.mjs prints where every line lands and flags any that overlap.
export const COMMENTARY = [
  {
    live: [
      { at: 0.5, ex: 0.7, text: 'Nineteen minutes gone.' },
      { at: 1.85, ex: 1.0, text: "It's Lorem! He's away, cutting inside!" },
      { end: 'strike', ex: 1.3, text: "He's going to shoot!" },
      { at: 'net', ex: 1.8, text: 'Oh, what a goal! Lorem!' },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: "Let's see that one again." },
      { at: 2.7, ex: 0.7, text: 'Look at the run from Lorem, nobody goes with him.' },
      { at: 6.1, ex: 1.0, text: 'And look at that finish! Right into the corner!' },
    ],
  },
  {
    live: [
      { at: 0.5, ex: 0.7, text: 'Fifty-eight minutes, and they want a second.' },
      { end: 'strike', ex: 1.1, text: "The ball comes in, Lorem's waiting!" },
      { at: 'net', ex: 1.8, text: 'First time! Oh, what a finish!' },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'Watch the movement here.' },
      { at: 2.6, ex: 0.7, text: "He drifts away from his marker, he's all alone." },
      { at: 5.8, ex: 1.0, text: "And first time! He doesn't even need a touch!" },
    ],
  },
  {
    live: [
      { at: 0.5, ex: 0.7, text: 'Seventy-four minutes, and Lorem already has two.' },
      { at: 3.4, ex: 1.0, text: "He's got it again." },
      { end: 'strike', ex: 1.3, text: 'Surely not from there!' },
      { at: 'net', ex: 1.9, text: "Oh, you beauty! That's his hat-trick!" },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'You have to see this again.' },
      { at: 3.0, ex: 0.7, text: "Twenty-seven metres out, and he simply doesn't care." },
      { at: 6.4, ex: 1.1, text: 'Just watch it dip! Top corner! Unstoppable!' },
    ],
  },
  {
    live: [
      { at: 0.5, ex: 0.7, text: 'Still goalless here at Ipsum Park.' },
      { at: 2.45, ex: 1.0, text: "Oh, lovely ball through, Lorem's onto it!" },
      { end: 'strike', ex: 1.4, text: 'One on one!' },
      { at: 'net', ex: 1.8, text: "It's there! Oh, ice cold, Lorem!" },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'Look at the timing of this run.' },
      { at: 3.0, ex: 0.7, text: "He's gone before the defender can even turn." },
      { at: 5.7, ex: 0.9, text: 'And the finish, so calm, right into the corner.' },
    ],
  },
  {
    live: [
      { at: 0.5, ex: 0.8, text: "We're into stoppage time here at Ipsum Park." },
      { at: 3.2, ex: 1.1, text: 'One last chance!' },
      { end: 'strike', ex: 1.4, text: 'The cross comes in!' },
      { at: 'net', ex: 1.9, text: "It's in! Oh, at the death, Lorem!" },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'Ninety-two minutes on the clock, look at this.' },
      { at: 3.4, ex: 0.7, text: 'He never stops running, he keeps on believing.' },
      { at: 6.0, ex: 0.9, text: 'And there he is, right where a goalscorer should be.' },
    ],
  },
  {
    live: [
      { at: 0.5, ex: 0.7, text: 'Free kick, twenty-four metres out.' },
      { end: 'strike', ex: 0.9, text: 'Lorem steps up, the stadium holds its breath.' },
      { at: 'net', ex: 1.9, text: 'Oh, that is magnificent! Top corner! Three-one!' },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'Watch the technique on this free kick.' },
      { at: 3.2, ex: 0.7, text: 'He takes his time, he picks his spot.' },
      { at: 5.5, ex: 1.1, text: 'Up and over the wall, and right into the top corner!' },
    ],
  },
  {
    live: [
      { at: 0.4, ex: 0.7, text: 'Thirty-three minutes gone.' },
      { at: 2.0, ex: 1.1, text: 'Lorem on the ball, past one, past two!' },
      { end: 'strike', ex: 1.4, text: "He's still going!" },
      { at: 'net', ex: 1.9, text: "He's scored! Oh, you genius, Lorem!" },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: "Let's watch that run one more time." },
      { at: 2.8, ex: 0.7, text: "They can't get near him, the ball is glued to his foot." },
      { at: 6.1, ex: 1.0, text: 'And the finish is every bit as good! What a player!' },
    ],
  },
  {
    live: [
      { at: 0.4, ex: 0.8, text: 'Eighty-five minutes in the final, Lorem from his own half.' },
      { at: 3.2, ex: 1.0, text: "He's still running, past one, past another!" },
      { at: 5.4, ex: 1.3, text: 'Nobody can stop him!' },
      { at: 6.9, ex: 1.5, text: "Oh, he wouldn't!" },
      { at: 'net', ex: 2.0, text: 'He has! Oh, my word! Lorem!' },
    ],
    replay: [
      { at: 0.7, ex: 0.6, text: 'This is the moment. Watch it again, and just enjoy it.' },
      { at: 3.9, ex: 0.7, text: 'From his own half, with the ball at his feet.' },
      { at: 7.2, ex: 1.1, text: 'And then that finish, from thirty metres! Just sensational!' },
    ],
  },
];
