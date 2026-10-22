export const divecapClips = [
  {
    "name": "idle",
    "duration": 2.0,
    "loop": true,
    "events": {},
    "states": [
      "DivecapPursueState",
    ],
  },
  {
    "name": "walk",
    "duration": 0.8,
    "loop": true,
    "events": {},
    "states": [
      "DivecapPursueState",
      "DivecapQueueState",
    ],
  },
  {
    "name": "run",
    "duration": 0.5,
    "loop": true,
    "events": {},
    "states": [
      "DivecapPursueState",
      "DivecapQueueState",
    ],
  },
  {
    "name": "turn",
    "duration": 0.5,
    "loop": false,
    "events": {},
    "states": [
      "DivecapPursueState",
    ],
  },
  {
    "name": "eager_hop",
    "duration": 0.7,
    "loop": false,
    "events": {},
    "states": [
      "DivecapPursueState",
      "DivecapQueueState",
    ],
  },
  {
    "name": "volunteer_wave",
    "duration": 1.0,
    "loop": false,
    "events": {},
    "states": [
      "DivecapQueueState",
    ],
  },
  {
    "name": "queue_wait",
    "duration": 1.6,
    "loop": true,
    "events": {},
    "states": [
      "DivecapQueueState",
    ],
  },
  {
    "name": "carried_ready",
    "duration": 1.0,
    "loop": true,
    "events": {},
    "states": [
      "DivecapCarriedState",
    ],
  },
  {
    "name": "launch",
    "duration": 0.3,
    "loop": false,
    "events": {
      "release": 0,
    },
    "states": [
      "DivecapFlightState",
    ],
  },
  {
    "name": "airborne_fly",
    "duration": 0.8,
    "loop": true,
    "events": {},
    "states": [
      "DivecapFlightState",
    ],
  },
  {
    "name": "dive_pose",
    "duration": 0.3333333333333333,
    "loop": false,
    "events": {},
    "states": [
      "DivecapFlightState",
    ],
  },
  {
    "name": "dive_loop",
    "duration": 0.6,
    "loop": true,
    "events": {},
    "states": [
      "DivecapFlightState",
    ],
  },
  {
    "name": "impact",
    "duration": 0.3333333333333333,
    "loop": false,
    "events": {
      "splash": 0,
      "contact": 0,
    },
    "states": [
      "DivecapLandingState",
    ],
  },
  {
    "name": "land_recover",
    "duration": 0.6666666666666666,
    "loop": false,
    "events": {},
    "states": [
      "DivecapLandingState",
    ],
  },
  {
    "name": "missed_land_stun",
    "duration": 1.2,
    "loop": false,
    "events": {},
    "states": [
      "DivecapLandingState",
    ],
  },
  {
    "name": "helmet_bonk",
    "duration": 0.7,
    "loop": false,
    "events": {
      "contact": 0.2,
    },
    "states": [
      "DivecapBonkState",
    ],
  },
  {
    "name": "hit",
    "duration": 0.4,
    "loop": false,
    "events": {},
    "states": [
      "DivecapPursueState",
      "DivecapQueueState",
    ],
  },
  {
    "name": "stun",
    "duration": 1.0,
    "loop": true,
    "events": {},
    "states": [
      "DivecapStunState",
    ],
  },
  {
    "name": "recover",
    "duration": 0.5,
    "loop": false,
    "events": {},
    "states": [
      "DivecapRecoverState",
    ],
  },
  {
    "name": "knockback",
    "duration": 0.6,
    "loop": false,
    "events": {},
    "states": [
      "DivecapPursueState",
    ],
  },
  {
    "name": "death",
    "duration": 1.0,
    "loop": false,
    "events": {
      "cleanup": 1,
    },
    "states": [
      "DivecapDeathState",
    ],
  },
];
