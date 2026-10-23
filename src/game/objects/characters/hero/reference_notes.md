# Ladder hand animation references

Viewed 2026-10-23. Reference footage is viewed only; no third-party media is packaged with the game.

- [Florida Firefighter PO: Climb a ladder](https://www.youtube.com/watch?v=hhqKC7og9TY), approximately 0:24–0:32: rear three-quarter climbing sequence. The upper hand takes an overhand grip across a horizontal rung; the lower hand remains planted as the knee lifts. Palm faces down, fingers cross the rung and the thumb opposes them. This informs the procedural hand orientation, thumb closure and alternating contact.
- [Essential Craftsman: How to Climb A Ladder, Dismount, & More Tips](https://www.youtube.com/watch?v=2z99pLPenL0), approximately 2:20 and 4:40: side views show the body held away from the ladder and the hand wrapping a rail during the transfer. Used as a body-clearance and transfer analogue, not as a rung-grip reference.

The game has stylized short fingers and rectangular wooden planks. Palm-anchor offsets are fitted to that geometry rather than copied as measurements from perspective footage. Climbing pauses finish the current reach so an open hand is not held indefinitely beside the rung.

The same climbing sequence informs foot contact: the ball of each boot rests on a rung's top face, the other foot lifts clear, and knees bend toward the ladder. Dynamic corrections follow the map-scaled rung positions without stretching either leg. The embedded `Climb` clip must retain hip translations at X ±0.2, Y 0.71 in glTF coordinates; zeroed hip origins collapse the leg attachments and make valid rung contacts unreachable.
