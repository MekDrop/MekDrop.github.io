# Mushroom Brute

Registered enemy with a Tripo-derived model, editable Blender source, 16-bone rig, 17 embedded clips, Yuka behavior, Ammo contact and a saved test map. Only `enemy-mushroom-brute.json` spawns it; normal maps and waves are unchanged.

## Asset and provenance

Assets live in `src/game/models/enemies/mushroom-brute/`. `mushroom-brute.blend` is the editable source; adjacent `.glb` is the runtime export. `tripo-original.zip` preserves the exact provider GLB. `tripo-reference.png` is the clean portrait uploaded to Studio. `tripo-status.json` records hashes, settings and charge evidence.

[Tripo Studio job](https://studio.tripo3d.ai/workspace/generate/3afe4823-f4e0-4779-80ab-b3b7051e387e) used H3.1 Best Quality, geometry and texture, private visibility, one submission, no replacement. Studio quoted **30 credits**. Per-job billing was unavailable; the shared account balance delta cannot establish this job's actual charge. The initial API profile had zero credits; browser Studio generation succeeded.

The broad red cap, ivory spots, angry eyes, cream stem, red cuffs/knees, brown boots and studded wooden club follow the main portrait in `info.png`. Rear anatomy is inferred. Refinement separated fused cap/club bridges, closed seams, applied matte faceted shading, weighted short limbs, kept boot soles rigid and grounded sampled poses. Height is about 1.72 m. The model wrapper turns 180 degrees to match semantic -Z forward.

## Animation and behavior

Embedded clips: idle, heavy_walk, run, turn, club_windup, club_swing, club_recover, door_bash, hit, stun, recover, snort, stomp, enraged_swing, reject_pickup, death, knockback. `animations.json` separates fresh-import, visual-pose and actual-engine checks. Swing contact runs from 0.12 to 0.36 s; door impact is at 0.6 s. The club stays attached to its grip bone.

Real Yuka states implement royal pursuit, windup/swing/recovery, door bashing, anger, external stun/recovery, hit, knockback and death. Towers and castles are not attack targets. Ammo rays sweep a 160-degree right-to-left arc, damage eligible enemies once per swing and apply impulses. Nearest colliders shield actors. Royals use their damage capability or existing game-over performance. The real King's contact and subsequent performance movement passed the staged runtime check.

Three distinct primary bell events in six seconds cause seven seconds of anger toward their source. Duplicate/secondary events do not accumulate anger. The brute never becomes bell-confused or emits bell events. Pickup and launch are rejected; pickup attempts anger it without canceling external stun.

Door hits revalidate the closed leaf and line of sight. Each impact applies 16 damage through the production Door API; three impacts exhaust its 48 health. The door owns removal of moving leaves and their colliders while preserving the frame. `Verify castle contact` stages the real production door and royal and exports a separate acceptance report.

## Review and evidence

Open `/en-US/map/test_enemy-mushroom-brute`. The isolated full application used for review runs at `http://127.0.0.1:9024/en-US/map/test_enemy-mushroom-brute`. Saved PlayCanvas HUD controls provide all clips, pursuit, doors, bells, stun, pickup/throw rejection, damage/death, a wide-swing fixture, model camera, transparent preview capture and fixed-step verification.

`asset-validation.json` records fresh-import mesh, UV, rig and all-clip pose samples bound to the runtime GLB's SHA256. Front, side, rear and game-camera renders plus critical attack/death poses were visually reviewed. Loop seams were numerically sampled. Runtime evidence is separate; Blender sampling does not prove PlayCanvas binding or foreground pacing.

`preview.png` came from the actual game's isolated transparent render target. `preview-evidence.json` verifies RGBA, 41,284 visible pixels, 220,860 fully transparent pixels and margins around the complete object.

Focused checks:

```text
node --test test/unit/game/objects/enemies/mushroom-brute/mushroom-brute.test.js
npx eslint src/game/objects/enemies/mushroom-brute --quiet
```

All 16 focused tests passed using real Ammo and PlayCanvas NullGraphicsDevice. They cover arc order, multiple friendly-fire recipients, shielding, impulse, long-step recovery, royal capabilities, bells, stun, rejection, door reach, the real Door class's leaf breakage and frame preservation, death cleanup and saved HUD dispatch. Empty test animation tracks provide no asset playback evidence. The saved fixture's castle-ground check passed: one castle, zero collisions, zero canopy overlaps and zero errors.

`runtime-playback-evidence.json` passed all 17 real embedded clips, 0.5x/1x/2x time scales, heavy_walk/run/idle transitions, 32 points of actual friendly-fire damage, pickup and throw rejection, external stun/recovery and death/body removal. It advances the real engine at 1/60-second steps and renders sampled poses. This does not measure background-tab RAF pacing. Reload the fixture before rerunning: the check deliberately kills the second brute. `runtime-result.png` shows the actual game after verification.

`runtime-castle-evidence.json` passed the remaining staged integration checks. The actual bash state applied impacts at 0.617, 2.433 and 4.250 seconds, reducing production door health 48 → 32 → 16 → 0. Active door bodies fell from 86 to 78; the frame stayed attached and Ammo reported a clear passage. The real King accepted club contact and advanced about 2.84 m through his production game-over movement. The fixture includes a Servant because the castle connects resident activity and royal performance hooks only when both residents exist. Reload before repeating this destructive check.

These are staged contact and performance checks, not navigation coverage from arbitrary spawn positions or foreground RAF pacing measurements. The isolated review app uses the production renderer and physics with temporary preFetch disabled and only this enemy selected in its factory; port 9000 was not used as the acceptance environment.
