import type { CampaignLevel } from "../campaign";
const content: Pick<CampaignLevel, "level" | "tuning"> = {
  "level": {
    "bodyConfig": {
      "reserveCapacity": 30,
      "idleCost": 0.2,
      "walkingCost": 0.4,
      "flyingCost": 0.8,
      "feedingRate": 3,
      "maxBoutSeconds": 3,
      "bodyRadius": 0.002632,
      "walkSpeed": 0.12,
      "flightSpeed": 0.24,
      "turnGain": 8,
      "takeoffThreshold": 0.2,
      "landingThreshold": 0.2,
      "landingDwellSeconds": 1,
      "proboscisThreshold": 0.2
    },
    "durationTicks": 800,
    "exit": {
      "a": {
        "x": 9.6,
        "z": 1.8
      },
      "b": {
        "x": 9.6,
        "z": 2.7
      },
      "outward": {
        "x": 1,
        "z": 0
      }
    },
    "exitCue": null,
    "fieldConfig": {
      "antennaOffset": 0.00020207253103162883,
      "baselineBrightness": 1,
      "cellSize": 0.2,
      "decay": 0.1,
      "diffusion": 0.5,
      "fans": [],
      "wind": {
        "x": 0,
        "z": 0
      },
      "antennaForward": 0.0014145078816978176
    },
    "food": [],
    "geometry": {
      "rooms": [
        {
          "id": 1,
          "min": {
            "x": 0,
            "z": 0
          },
          "max": {
            "x": 4.8,
            "z": 4.5
          }
        },
        {
          "id": 2,
          "min": {
            "x": 4.8,
            "z": 0
          },
          "max": {
            "x": 9.6,
            "z": 4.5
          }
        },
        {
          "id": 3,
          "min": {
            "x": 0,
            "z": 4.5
          },
          "max": {
            "x": 9.6,
            "z": 6
          }
        },
        {
          "id": 4,
          "min": {
            "x": 0,
            "z": 6
          },
          "max": {
            "x": 3.3,
            "z": 10.4
          }
        },
        {
          "id": 5,
          "min": {
            "x": 3.3,
            "z": 6
          },
          "max": {
            "x": 6.3,
            "z": 10.4
          }
        },
        {
          "id": 6,
          "min": {
            "x": 6.3,
            "z": 6
          },
          "max": {
            "x": 9.6,
            "z": 10.4
          }
        }
      ],
      "walls": [
        {
          "a": {
            "x": 0,
            "z": 0
          },
          "b": {
            "x": 0,
            "z": 10.4
          }
        },
        {
          "a": {
            "x": 4.8,
            "z": 0
          },
          "b": {
            "x": 4.8,
            "z": 2.1
          }
        },
        {
          "a": {
            "x": 4.8,
            "z": 3.0
          },
          "b": {
            "x": 4.8,
            "z": 4.5
          }
        },
        {
          "a": {
            "x": 0,
            "z": 0
          },
          "b": {
            "x": 9.6,
            "z": 0
          }
        },
        {
          "a": {
            "x": 0,
            "z": 4.5
          },
          "b": {
            "x": 1.8,
            "z": 4.5
          }
        },
        {
          "a": {
            "x": 2.7,
            "z": 4.5
          },
          "b": {
            "x": 6.0,
            "z": 4.5
          }
        },
        {
          "a": {
            "x": 6.9,
            "z": 4.5
          },
          "b": {
            "x": 9.6,
            "z": 4.5
          }
        },
        {
          "a": {
            "x": 9.6,
            "z": 0
          },
          "b": {
            "x": 9.6,
            "z": 1.8
          }
        },
        {
          "a": {
            "x": 9.6,
            "z": 2.7
          },
          "b": {
            "x": 9.6,
            "z": 10.4
          }
        },
        {
          "a": {
            "x": 0,
            "z": 6
          },
          "b": {
            "x": 1.2,
            "z": 6
          }
        },
        {
          "a": {
            "x": 2.1,
            "z": 6
          },
          "b": {
            "x": 4.35,
            "z": 6
          }
        },
        {
          "a": {
            "x": 5.25,
            "z": 6
          },
          "b": {
            "x": 6.9,
            "z": 6
          }
        },
        {
          "a": {
            "x": 7.8,
            "z": 6
          },
          "b": {
            "x": 9.6,
            "z": 6
          }
        },
        {
          "a": {
            "x": 3.3,
            "z": 6
          },
          "b": {
            "x": 3.3,
            "z": 10.4
          }
        },
        {
          "a": {
            "x": 0,
            "z": 10.4
          },
          "b": {
            "x": 9.6,
            "z": 10.4
          }
        },
        {
          "a": {
            "x": 6.3,
            "z": 6
          },
          "b": {
            "x": 6.3,
            "z": 10.4
          }
        }
      ],
      "solids": [
        {
          "id": 1,
          "furnishing": {
            "model": "sofa",
            "quarterTurns": 0
          },
          "min": {
            "x": 0.3,
            "z": 0.25
          },
          "max": {
            "x": 2.2,
            "z": 1.1
          },
          "height": 0.85
        },
        {
          "id": 2,
          "furnishing": {
            "model": "cabinet",
            "quarterTurns": 0
          },
          "min": {
            "x": 6,
            "z": 0.2
          },
          "max": {
            "x": 7.2,
            "z": 0.65
          },
          "height": 0.85
        },
        {
          "id": 3,
          "furnishing": {
            "model": "cabinet",
            "quarterTurns": 0
          },
          "min": {
            "x": 0.2,
            "z": 9.75
          },
          "max": {
            "x": 1.4,
            "z": 10.2
          },
          "height": 0.85
        },
        {
          "id": 4,
          "furnishing": {
            "model": "cabinet",
            "quarterTurns": 0
          },
          "min": {
            "x": 6.8,
            "z": 9.75
          },
          "max": {
            "x": 8.0,
            "z": 10.2
          },
          "height": 0.85
        }
      ]
    },
    "id": "turn-the-corner",
    "initialReserve": 20,
    "placementRules": {
      "inventory": [
        {
          "kind": "fruit",
          "count": 2
        },
        {
          "kind": "crumbs",
          "count": 4
        },
        {
          "kind": "fan",
          "count": 6
        }
      ],
      "reserved": []
    },
    "sources": [],
    "starThresholds": [
      1,
      8,
      15
    ],
    "zappers": [],
    "spawn": {
      "kind": "cluster",
      "min": {
        "x": 0.9,
        "z": 7.2
      },
      "max": {
        "x": 1.55,
        "z": 7.85
      },
      "flyingCount": 10
    }
  },
  "tuning": {
    "cues": [
      {
        "gain": 2,
        "pathway": "inhibitoryOdor"
      }
    ],
    "silencedNeurons": [],
    "tasteGain": 1
  }
};
export default content;
