# Enemy wave director

Generated maps author an `EnemyWaveDirector` in `objects[]`. The object owns its economy, controller, spawned creatures and PlayCanvas HUD. The renderer has no creature-specific spawning branches. `MapObjectFactory.spawnObject` adds a normal object definition, preserves its full runtime/map context, initializes it, registers it for interactions, and removes its transient definition/registry entry when destroyed.

Defaults are in `src/game/waves/wave-config.js`: 5,000 starting coins; one offer, `LatchSlug`, at 15 coins with three seconds of preparation. AI purchases three per wave, initially after five seconds and then at 20-second intervals, with at most 12 live creatures and 12 reserved orders. Preparation is serial at each gate and parallel across gates. Busy gates retain their orders; removed gates and failed construction refund them. A single tick creates at most one actor.

The AI rotates across gates with a live route toward the castle. Arrival uses the production gate membrane/ghost/spray effect and native Ammo travel. Unaccompanied slugs follow their selected gate's centerline until a person or closed door takes priority.

## Controller boundary

`WaveDirectorState` is the authoritative simulation-side economy. `WaveAiController.commands(snapshot)` merely proposes purchases. `PlayerWaveController` is a bounded inbox implementing the same `commands` interface. `EnemyWaveDirector.usePlayer(playerId)` replaces the AI and returns that inbox; `useAi()` hands control back. Existing purchased orders remain reserved during handoff.

A purchase is plain serializable data:

```json
{"type":"buy","sequence":1,"creature":"LatchSlug","gateId":"gateway-0"}
```

The current snapshot exposes `controllerId`, `nextSequence`, coins, host-owned offers, valid gate IDs, preparation orders, wave number and active count. Controllers must use increasing positive sequence numbers. Replayed/stale requests, unknown creatures or gates, over-budget purchases and full queues are rejected without spending coins. Snapshots are deep copies. Prices, rewards and spawn completion never come from controller payloads.

For networking, keep the state object and spawning on the trusted host. Authenticate the connection and bind its player ID on the host; never trust a player ID supplied inside a client message. Decode/size-limit incoming JSON and either enqueue it in the active player's inbox for snapshot reconciliation, or call `director.submit(command, authenticatedPlayerId)` directly to obtain an immediate purchase acknowledgement. Send results/snapshots back over the chosen transport. Do not expose `recordOutcome`, `reward`, configuration mutation or controller handoff as player commands. No networking service or transport is started by this implementation.

## Combat income

A successful terminal `Enemy.receiveDamage` invokes the attacker's `onTargetDefeated(target, "kill")`; a terminal `Door.receiveDamage(amount, attacker)` invokes the same hook with `"break"`. The owning director verifies actor identity, victim death/break state, rejects self/own-team farming and credits each victim GUID once. Default bounties are 50 coins for a kill and 10 for destruction. Repeated damage, nonlethal hits, scene cleanup and the slug's harmless suicidal splat earn nothing. Newly added damage receivers should emit this hook only on their actual terminal transition and pass the real attacker through damage calls.

The slug remains harmless to other creatures and doors. Attribution tests deliberately call real damage endpoints to verify income; they do not give the slug a new attack.

## Verification

Open `/map/test_enemy-wave-director`. The map starts with AI purchases disabled so its initial 5,000-coin wallet is reviewable. Its PlayCanvas controls start AI waves, hand control to a player inbox, purchase through either gate and test terminal break attribution. Normal generated maps enable AI by default.

Focused checks cover authority/replays, timing, gate backpressure/refunds, queue and active caps, combat credit, controller handoff, generic dynamic registration/cleanup, model/audio discovery and both gate-facing directions. Runtime recordings and economy snapshots are retained beside the director under `src/game/objects/wave-director/evidence/`.
