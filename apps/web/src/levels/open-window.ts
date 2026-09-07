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
        "x": 6.4,
        "z": 0.4
      },
      "b": {
        "x": 6.4,
        "z": 2.6
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
          "max": {
            "x": 1.6,
            "z": 3
          },
          "min": {
            "x": 0,
            "z": 0
          }
        },
        {
          "id": 2,
          "max": {
            "x": 3.2,
            "z": 3
          },
          "min": {
            "x": 1.6,
            "z": 0
          }
        },
        {
          "id": 3,
          "max": {
            "x": 4.800000000000001,
            "z": 3
          },
          "min": {
            "x": 3.2,
            "z": 0
          }
        },
        {
          "id": 4,
          "max": {
            "x": 6.4,
            "z": 3
          },
          "min": {
            "x": 4.800000000000001,
            "z": 0
          }
        },
        {
          "id": 5,
          "max": {
            "x": 3.2,
            "z": 5
          },
          "min": {
            "x": 1.6,
            "z": 3
          }
        }
      ],
      "solids": [
        {
          "id": 1,
          "furnishing": {
            "model": "cabinet",
            "quarterTurns": 0
          },
          "min": {
            "x": 0.2,
            "z": 0.15
          },
          "max": {
            "x": 1.4,
            "z": 0.6
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
            "x": 3.4,
            "z": 0.15
          },
          "max": {
            "x": 4.6,
            "z": 0.6
          },
          "height": 0.85
        },
        {
          "id": 3,
          "furnishing": {
            "model": "sofa",
            "quarterTurns": 1
          },
          "min": {
            "x": 1.95,
            "z": 3.05
          },
          "max": {
            "x": 2.8,
            "z": 4.949999999999999
          },
          "height": 0.85
        }
      ],
      "walls": [
        {
          "a": {
            "x": 0,
            "z": 0
          },
          "b": {
            "x": 6.4,
            "z": 0
          }
        },
        {
          "a": {
            "x": 0,
            "z": 0
          },
          "b": {
            "x": 0,
            "z": 3
          }
        },
        {
          "a": {
            "x": 0,
            "z": 3
          },
          "b": {
            "x": 2,
            "z": 3
          }
        },
        {
          "a": {
            "x": 2.8000000000000003,
            "z": 3
          },
          "b": {
            "x": 6.4,
            "z": 3
          }
        },
        {
          "a": {
            "x": 1.6,
            "z": 3
          },
          "b": {
            "x": 1.6,
            "z": 5
          }
        },
        {
          "a": {
            "x": 1.6,
            "z": 5
          },
          "b": {
            "x": 3.2,
            "z": 5
          }
        },
        {
          "a": {
            "x": 3.2,
            "z": 3
          },
          "b": {
            "x": 3.2,
            "z": 5
          }
        },
        {
          "a": {
            "x": 1.6,
            "z": 0
          },
          "b": {
            "x": 1.6,
            "z": 0.4
          }
        },
        {
          "a": {
            "x": 1.6,
            "z": 2.6
          },
          "b": {
            "x": 1.6,
            "z": 3
          }
        },
        {
          "a": {
            "x": 3.2,
            "z": 0
          },
          "b": {
            "x": 3.2,
            "z": 0.4
          }
        },
        {
          "a": {
            "x": 3.2,
            "z": 2.6
          },
          "b": {
            "x": 3.2,
            "z": 3
          }
        },
        {
          "a": {
            "x": 4.800000000000001,
            "z": 0
          },
          "b": {
            "x": 4.800000000000001,
            "z": 0.4
          }
        },
        {
          "a": {
            "x": 4.800000000000001,
            "z": 2.6
          },
          "b": {
            "x": 4.800000000000001,
            "z": 3
          }
        },
        {
          "a": {
            "x": 6.4,
            "z": 0
          },
          "b": {
            "x": 6.4,
            "z": 0.4
          }
        },
        {
          "a": {
            "x": 6.4,
            "z": 2.6
          },
          "b": {
            "x": 6.4,
            "z": 3
          }
        }
      ]
    },
    "id": "open-window",
    "initialReserve": 20,
    "placementRules": {
      "inventory": [
        {
          "count": 2,
          "kind": "fruit"
        },
        {
          "count": 4,
          "kind": "crumbs"
        },
        {
          "kind": "fan",
          "count": 4
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
        "x": 0.25,
        "z": 0.8
      },
      "max": {
        "x": 0.93,
        "z": 2
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
