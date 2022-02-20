const player = {
  "name": "Drake Batherson",
  "team": "OTT",
  "positions": [
    "RW"
  ],
  "injuryStatus": "IR",
  "expandedData": {
    "image": "https://d26bvpybnxg29h.cloudfront.net/nhl/4555.png",
    "proTeam": {
      "abbreviation": "OTT",
      "location": "Ottawa",
      "name": "Senators"
    },
    "rankFantasy": {
      "ordinal": 131,
      "positions": [
        {
          "position": {
            "label": "RW",
            "group": "START",
            "eligibility": [
              "RW"
            ],
            "colors": [
              "DRAFT_BOARD_GREEN"
            ]
          },
          "ordinal": 62,
          "formatted": "62",
          "rating": "RATING_VERY_BAD"
        }
      ],
      "season": 2021
    }
  }
}

const fullPlayerWithInjury = {
  "proPlayer": {
    "id": 4555,
    "nameFull": "Drake Batherson",
    "nameShort": "D. Batherson",
    "proTeamAbbreviation": "OTT",
    "position": "RW",
    "headshotUrl": "https://d26bvpybnxg29h.cloudfront.net/nhl/4555.png",
    "injury": {
      "typeAbbreviaition": "IR",
      "description": "Ankle",
      "severity": "OUT",
      "typeFull": "Injured Reserve"
    },
    "sport": "NHL",
    "nameFirst": "Drake",
    "nameLast": "Batherson",
    "proTeam": {
      "abbreviation": "OTT",
      "location": "Ottawa",
      "name": "Senators"
    },
    "positionEligibility": [
      "RW"
    ]
  },
  "eligibleFor": [
    {
      "label": "RW",
      "group": "START",
      "eligibility": [
        "RW"
      ],
      "min": 2,
      "max": 18,
      "start": 2,
      "colors": [
        "DRAFT_BOARD_GREEN"
      ]
    },
    {
      "label": "F",
      "group": "START",
      "eligibility": [
        "C",
        "LW",
        "RW"
      ],
      "start": 1,
      "colors": [
        "DRAFT_BOARD_GREEN",
        "DRAFT_BOARD_PURPLE"
      ]
    },
    {
      "label": "F/D",
      "group": "START",
      "eligibility": [
        "C",
        "LW",
        "RW",
        "D"
      ],
      "start": 1,
      "colors": [
        "DRAFT_BOARD_GREEN",
        "DRAFT_BOARD_BLUE",
        "DRAFT_BOARD_PURPLE"
      ]
    },
    {
      "label": "IR",
      "group": "INJURED",
      "eligibility": [
        "C",
        "LW",
        "RW",
        "D",
        "G"
      ],
      "start": 2,
      "colors": [
        "DRAFT_BOARD_GREEN",
        "DRAFT_BOARD_BLUE",
        "DRAFT_BOARD_RED",
        "DRAFT_BOARD_PURPLE"
      ]
    },
    {
      "label": "BN",
      "max": 4
    }
  ],
  "viewingActualPoints": {
    "value": 168.40001,
    "formatted": "168.4"
  },
  "viewingActualStats": [
    {
      "category": {
        "id": 1,
        "abbreviation": "G",
        "nameSingular": "Goal",
        "namePlural": "Goals"
      },
      "value": {
        "value": 13,
        "formatted": "13"
      }
    },
    {
      "category": {
        "id": 5,
        "abbreviation": "Ast",
        "nameSingular": "Assist",
        "namePlural": "Assists"
      },
      "value": {
        "value": 21,
        "formatted": "21"
      }
    }
  ],
  "transactionStatus": {
    "actionable": {
      "add": true
    }
  },
  "requestedGamesPeriod": {
    "duration": "DAY",
    "ordinal": 130,
    "startEpochMilli": "1645182000000",
    "isNow": true
  },
  "viewingActualPointsAverage": {
    "value": 5.432258,
    "formatted": "5.43"
  },
  "viewingFormat": "TOTAL",
  "viewingRange": {
    "low": 1,
    "high": 200
  },
  "displayGroup": "SKATER",
  "rankFantasy": {
    "ordinal": 131,
    "positions": [
      {
        "position": {
          "label": "RW",
          "group": "START",
          "eligibility": [
            "RW"
          ],
          "colors": [
            "DRAFT_BOARD_GREEN"
          ]
        },
        "ordinal": 62,
        "formatted": "62",
        "rating": "RATING_VERY_BAD"
      }
    ],
    "season": 2021
  },
  "lastX": [
    {
      "value": {
        "value": 5,
        "formatted": "5"
      },
      "duration": 1
    },
    {
      "value": {
        "value": 4.71,
        "formatted": "4.71"
      },
      "duration": 5
    },
    {
      "value": {
        "value": 3.55,
        "formatted": "3.55"
      },
      "duration": 10
    }
  ],
  "seasonTotal": {
    "value": 164.90001,
    "formatted": "164.9"
  },
  "seasonAverage": {
    "value": 5.319355,
    "formatted": "5.32"
  },
  "seasonsStandartDeviation": {
    "value": 4.52077,
    "formatted": "4.52"
  },
  "seasonConsistency": "RATING_BAD",
  "numGamesInSchedulePeriod": 2
}

const fullPlayerWithNews = {
  "proPlayer": {
    "id": 960,
    "nameFull": "Corey Perry",
    "nameShort": "C. Perry",
    "proTeamAbbreviation": "TB",
    "position": "RW",
    "headshotUrl": "https://d26bvpybnxg29h.cloudfront.net/nhl/960.png",
    "sport": "NHL",
    "news": [
      {
        "timeEpochMilli": "1644989031000",
        "contents": "Perry had two assists in Tuesday's 6-3 win over the Devils.",
        "analysis": "The Lightning got some notable contributions from the fourth line, as Perry, Patrick Maroon and Pierre-Edouard Bellemare chipped in two points apiece. Perry has been the most reliable source of offense among that trio throughout the season, as he's on pace to surpass the 40-point mark with 13 goals and 13 assists through 49 games.",
        "title": "Two points in Tuesday's win"
      }
    ],
    "nameFirst": "Corey",
    "nameLast": "Perry",
    "proTeam": {
      "abbreviation": "TB",
      "location": "Tampa Bay",
      "name": "Lightning"
    },
    "positionEligibility": [
      "RW"
    ]
  },
  "eligibleFor": [
    {
      "label": "RW",
      "group": "START",
      "eligibility": [
        "RW"
      ],
      "min": 2,
      "max": 18,
      "start": 2,
      "colors": [
        "DRAFT_BOARD_GREEN"
      ]
    },
    {
      "label": "F",
      "group": "START",
      "eligibility": [
        "C",
        "LW",
        "RW"
      ],
      "start": 1,
      "colors": [
        "DRAFT_BOARD_GREEN",
        "DRAFT_BOARD_PURPLE"
      ]
    },
    {
      "label": "F/D",
      "group": "START",
      "eligibility": [
        "C",
        "LW",
        "RW",
        "D"
      ],
      "start": 1,
      "colors": [
        "DRAFT_BOARD_GREEN",
        "DRAFT_BOARD_BLUE",
        "DRAFT_BOARD_PURPLE"
      ]
    },
    {
      "label": "BN",
      "max": 4
    }
  ],
  "viewingActualPoints": {
    "value": 147.65002,
    "formatted": "147.65"
  },
  "viewingActualStats": [
    {
      "category": {
        "id": 1,
        "abbreviation": "G",
        "nameSingular": "Goal",
        "namePlural": "Goals"
      },
      "value": {
        "value": 13,
        "formatted": "13"
      }
    },
    {
      "category": {
        "id": 5,
        "abbreviation": "Ast",
        "nameSingular": "Assist",
        "namePlural": "Assists"
      },
      "value": {
        "value": 13,
        "formatted": "13"
      }
    }
  ],
  "transactionStatus": {
    "actionable": {
      "add": true
    }
  },
  "requestedGamesPeriod": {
    "duration": "DAY",
    "ordinal": 130,
    "startEpochMilli": "1645182000000",
    "isNow": true
  },
  "viewingActualPointsAverage": {
    "value": 3.0132658,
    "formatted": "3.01"
  },
  "viewingFormat": "TOTAL",
  "viewingRange": {
    "low": 1,
    "high": 200
  },
  "displayGroup": "SKATER",
  "rankFantasy": {
    "ordinal": 183,
    "positions": [
      {
        "position": {
          "label": "RW",
          "group": "START",
          "eligibility": [
            "RW"
          ],
          "colors": [
            "DRAFT_BOARD_GREEN"
          ]
        },
        "ordinal": 81,
        "formatted": "81",
        "rating": "RATING_VERY_BAD"
      }
    ],
    "season": 2021
  },
  "lastX": [
    {
      "value": {
        "value": 6.3,
        "formatted": "6.3"
      },
      "duration": 1,
      "overPerforming": true
    },
    {
      "value": {
        "value": 4.46,
        "formatted": "4.46"
      },
      "duration": 5
    },
    {
      "value": {
        "value": 2.91,
        "formatted": "2.91"
      },
      "duration": 10
    }
  ],
  "seasonTotal": {
    "value": 147.65002,
    "formatted": "147.65"
  },
  "seasonAverage": {
    "value": 3.0132658,
    "formatted": "3.01"
  },
  "seasonsStandartDeviation": {
    "value": 2.6079495,
    "formatted": "2.61"
  },
  "seasonConsistency": "RATING_VERY_BAD"
}

const fullPlayerWithGameToday = {
  "proPlayer": {
    "id": 4405,
    "nameFull": "Eeli Tolvanen",
    "nameShort": "E. Tolvanen",
    "proTeamAbbreviation": "NSH",
    "position": "W",
    "sport": "NHL",
    "nameFirst": "Eeli",
    "nameLast": "Tolvanen",
    "proTeam": {
      "abbreviation": "NSH",
      "location": "Nashville",
      "name": "Predators"
    },
    "positionEligibility": [
      "LW",
      "RW"
    ]
  },
  "requestedGames": [
    {
      "game": {
        "id": 21682,
        "away": {
          "abbreviation": "NSH",
          "location": "Nashville",
          "name": "Predators"
        },
        "home": {
          "abbreviation": "CAR",
          "location": "Carolina",
          "name": "Hurricanes"
        },
        "startTimeEpochMilli": "1645228800000",
        "status": "IN_PROGRESS",
        "segment": 3,
        "segmentSecondsRemaining": 799,
        "awayScore": 1,
        "homeScore": 3,
        "period": {
          "duration": "DAY",
          "ordinal": 130,
          "startEpochMilli": "1645182000000",
          "isNow": true
        },
        "sport": "NHL"
      },
      "stats": [
        {
          "category": {
            "id": 1,
            "abbreviation": "G",
            "nameSingular": "Goal",
            "namePlural": "Goals"
          },
          "value": {
            "formatted": "0"
          }
        },
        {
          "category": {
            "id": 5,
            "abbreviation": "Ast",
            "nameSingular": "Assist",
            "namePlural": "Assists"
          },
          "value": {
            "formatted": "0"
          }
        }
      ],
      "pointsActual": {
        "value": 1.95,
        "formatted": "1.95"
      },
      "period": {
        "duration": "DAY",
        "ordinal": 130,
        "startEpochMilli": "1645182000000",
        "isNow": true
      }
    }
  ],
  "viewingActualPoints": {
    "value": 139.75,
    "formatted": "139.75"
  },
  "viewingActualStats": [
    {
      "category": {
        "id": 1,
        "abbreviation": "G",
        "nameSingular": "Goal",
        "namePlural": "Goals"
      },
      "value": {
        "value": 7,
        "formatted": "7"
      }
    },
    {
      "category": {
        "id": 5,
        "abbreviation": "Ast",
        "nameSingular": "Assist",
        "namePlural": "Assists"
      },
      "value": {
        "value": 9,
        "formatted": "9"
      }
    }
  ],
  "transactionStatus": {
    "claimable": {
      "lockEpochMilli": "1645264800000",
      "clearEpochMilli": "1645275600000"
    },
    "isLineupStatusLocked": true
  },
  "requestedGamesPeriod": {
    "duration": "DAY",
    "ordinal": 130,
    "startEpochMilli": "1645182000000",
    "isNow": true
  },
  "viewingActualPointsAverage": {
    "value": 2.9734042,
    "formatted": "2.97"
  },
  "viewingFormat": "TOTAL",
  "viewingRange": {
    "low": 1,
    "high": 200
  },
  "displayGroup": "SKATER",
  "rankFantasy": {
    "ordinal": 213,
    "positions": [
      {
        "position": {
          "label": "LW",
          "group": "START",
          "eligibility": [
            "LW"
          ],
          "colors": [
            "DRAFT_BOARD_GREEN"
          ]
        },
        "ordinal": 90,
        "formatted": "90",
        "rating": "RATING_VERY_BAD"
      },
      {
        "position": {
          "label": "RW",
          "group": "START",
          "eligibility": [
            "RW"
          ],
          "colors": [
            "DRAFT_BOARD_GREEN"
          ]
        },
        "ordinal": 91,
        "formatted": "91",
        "rating": "RATING_VERY_BAD"
      }
    ],
    "season": 2021
  },
  "lastX": [
    {
      "value": {
        "value": 1.7,
        "formatted": "1.7"
      },
      "duration": 1,
      "underPerforming": true
    },
    {
      "value": {
        "value": 3.62,
        "formatted": "3.62"
      },
      "duration": 5
    },
    {
      "value": {
        "value": 3.15,
        "formatted": "3.15"
      },
      "duration": 10
    }
  ],
  "seasonTotal": {
    "value": 137.8,
    "formatted": "137.8"
  },
  "seasonAverage": {
    "value": 2.9956522,
    "formatted": "3"
  },
  "seasonsStandartDeviation": {
    "value": 1.9880302,
    "formatted": "1.99"
  },
  "numGamesInSchedulePeriod": 1
}