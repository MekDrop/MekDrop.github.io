# Hero buffs and debuffs

`src/game/buffs/BuffSystem.js` owns active effects, stack counts, timers, and
stat modifiers. Each hero owns one instance. Definitions live in
`src/game/config/hero-buffs.js`; IDs, kinds, and stat names live in the game enums.

The first effects are:

| Effect | Stacking and duration | Behavior |
| --- | --- | --- |
| Affection | Up to 5 stacks; 6 seconds after the latest application | Each stack adds 5% movement speed. |
| Overstimulated | 1 stack; 8 seconds of rest | Replaces and blocks Affection. Anger returns directly to calm on expiry. Activity pauses its clock. |

Petting pressure and reaction stages remain in `HeroPatMood`. It applies and
removes effects, but does not tick their timers or calculate speed. The hero
advances its buff system before mood and movement on each fixed simulation step.
The angry escape remains subject to the usual terrain and collision checks.

## Applying effects

Game systems with a hero reference can call:

```js
hero.applyBuff(HERO_BUFF.AFFECTION);
hero.applyBuff(HERO_BUFF.AFFECTION, { stacks: 2 });
hero.removeBuff(HERO_BUFF.AFFECTION);
```

Applications add stacks up to the definition's `maxStacks` and refresh the
whole effect to its configured `duration`, including when already at the cap.
Unknown IDs, non-positive or non-integer stack counts, and effects blocked by
another active effect return `false`. `blockedBy` lists prevent applications;
`replaces` lists remove incompatible active effects after the application is
accepted. Overstimulated blocks Affection until it expires.

`hero.buffs` returns snapshots with IDs, labels, icons, kind, modifiers, stacks,
duration, and remaining time. `hero.stats` returns the resulting walking and
running speeds. Mutating snapshots cannot change active effects. Applying,
removing, or expiring effects updates the hero state notification. Active buffs
are cleared on death/respawn, destruction, and map replacement; they are not
saved with inventory.

## Adding another buff

Add its ID to `HeroBuff.js`, then a definition and localized label. A definition
contains `id`, `kind`, `labelKey`, `icon`, `duration` in seconds, `maxStacks`, and
`modifiers`. These are trusted game configuration; use a positive finite
duration and a positive integer stack cap. Optional `blockedBy` and `replaces`
are arrays of effect IDs. A single-stack effect refreshes without accumulating.
An optional `requiresRest` flag pauses that effect when `advance(dt, { resting: false })`
is called. Other effects continue ticking. The hero supplies whether it is
grounded and idle, without movement, an escape, or an action/reaction underway.

Each modifier names a stat and supplies `flat`, `percent`, or both. Values apply
per stack. Negative values implement penalties. For example:

```js
modifiers: {
  [HERO_STAT.MOVEMENT_SPEED]: { percent: -0.3 },
}
```

The formula is `max(0, (base + sum(flat × stacks)) × (1 + sum(percent × stacks)))`.
Effects therefore combine independently of their application order and never
permanently mutate base stats. Each effect expires independently. Adding a new
stat also requires its consuming gameplay code to call `modifyStat`.

Character facial reactions and overhead mood symbols remain the presentation;
there is no separate buff HUD.
Petting has no instructional tooltip; it is a discoverable interaction.

The editable hero model contains `HappyPat` and `AngryPat` facial shape keys.
Its 1.25-second `PatAnnoyed` clip animates the irritated eyes and frown together
with a head shake and raised-hand wave. Idle irritated heroes play it when
patted. When irritation expires, its pressure clears and the hero returns
directly to calm; the next pat starts a fresh affection stack.
While fully angry, further pats start another escape to a random reachable
destination, including while an escape is already in progress. These pats
do not refresh the debuff or grant Affection. Movement and the angry escape
interrupt the hand reaction. The face keeps its irritated
expression between reactions until the mood cools down. The overhead heart
and exclamation mark grow with pressure within their stage; changing symbols
shrinks the old symbol away and pops in the new one.

The initial escape aims for 3 world units; each further angry pat adds 1.5,
up to 12. A narrow distance band keeps random selection from undoing the
increase. When space is limited, the hero uses the closest available safe
distance instead. The distance resets for the next anger episode. Player
movement, jumping, dodging, and interactions are blocked throughout anger,
including between escapes. Controls resume when anger expires. There is no
intermediate irritated stage or automatic happiness after anger.

Each escape draws a fresh heading from the full circle. Clear ground permits
a direct run at that angle. Otherwise, connected-ground search picks a target
near that heading and removes route corners only when the whole shortcut is
traversable. This keeps initial movement from favoring the grid axes.

Validation: `test/unit/buff-system.test.js` covers generic effect behavior, while
`test/unit/hero-patting.test.js` covers petting with the shared buff clock.
