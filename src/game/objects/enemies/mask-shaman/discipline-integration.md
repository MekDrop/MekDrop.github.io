# Pending discipline integration

The aura is implemented, but the other enemies do not query it yet. These changes
require expanding the original ownership restriction on sibling and shared files.

Proposed contract: a shared Enemy getter queries living actors with
`source.suppressesGrudgesFor?.(this)`. It never clears revenge targets, territorial
claims, anger timers or remembered grudges. Multiple active sources compose with
`some`; interruption or departure releases only that source.

Required consumers:

| Consumer | Change while suppressed |
| --- | --- |
| CinderImp.chooseTarget | Prefer the actual royal over revenge and Frost rivals. |
| CinderRivalAttackState | Cancel a pending rival contact before damage. |
| FrostPuffCombat shot selection | Exclude deliberate Cinder shots; preserve ordinary defender targeting and incidental splash. |
| CrownCrab pursuit/rival/queue selection | Bypass revenge, anger and rival challenges without deleting their records. |
| CrownCrabClawState | Cancel intentional enemy contact; retain royal and obstruction attacks. |
| WireGremlin.dispute | Suspend territorial rival damage while preserving the claim. |

Verification should stage the actual enemy classes in an authored test map and
record targeting/contact results before, during and after discipline. Include
bell interruption, range exit and two overlapping shamans. Confirm that grudges
resume after suppression ends and that an already winding-up rival attack cannot
land a disciplined hit.

No changes to these consumers have been applied by the Mask Shaman task.
