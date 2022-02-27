export const FLEA_API_BASE = 'https://www.fleaflicker.com/api';
export const NHL_API_BASE = 'https://statsapi.web.nhl.com/api/v1';

export const DOBBER_PLAYER_BASE = 'https://frozenpool.dobbersports.com/players/';

export const SPORT_HOCKEY = 'hockey';

export const DATE_MAP = {
  0: 'Mo',
  1: 'Tu',
  2: 'We',
  3: 'Th',
  4: 'Fr',
  5: 'Sa',
  6: 'Su'
}

export const SORT_OPTIONS = {
  total: 'SORT_SEASON_TOTAL',
}

export const POSITION_OPTIONS = [
  'G',
  'C',
  'LW',
  'RW',
  'W',
  'F',
  'D',
]

export const INJURY_LIST = [
  'HEALTHY',
  'DTD',
  'OUT',
  'SUS',
  'IR',
]

export const TEAM_LIST = [
  "Anaheim Ducks",
  "Arizona Coyotes",
  "Boston Bruins",
  "Buffalo Sabres",
  "Calgary Flames",
  "Carolina Hurricanes",
  "Chicago Blackhawks",
  "Colorado Avalanche",
  "Columbus Blue Jackets",
  "Dallas Stars",
  "Detroit Red Wings",
  "Edmonton Oilers",
  "Florida Panthers",
  "Los Angeles Kings",
  "Minnesota Wild",
  "Montreal Canadiens",
  "Nashville Predators",
  "New Jersey Devils",
  "New York Islanders",
  "New York Rangers",
  "Ottawa Senators",
  "Philadelphia Flyers",
  "Pittsburgh Penguins",
  "San Jose Sharks",
  "Seattle Kraken",
  "St. Louis Blues",
  "Tampa Bay Lightning",
  "Toronto Maple Leafs",
  "Vancouver Canucks",
  "Vegas Golden Knights",
  "Washington Capitals",
  "Winnipeg Jets",
  "Free Agent"
]

export const TEAM_NAME_TO_ABBR = {
  "Anaheim Ducks": "ANA",
  "Arizona Coyotes": "ARI",
  "Boston Bruins": "BOS",
  "Buffalo Sabres": "BUF",
  "Calgary Flames": "CGY",
  "Carolina Hurricanes": "CAR",
  "Chicago Blackhawks": "CHI",
  "Colorado Avalanche": "COL",
  "Columbus Blue Jackets": "CBJ",
  "Dallas Stars": "DAL",
  "Detroit Red Wings": "DET",
  "Edmonton Oilers": "EDM",
  "Florida Panthers": "FLA",
  "Los Angeles Kings": "LA",
  "Minnesota Wild": "MIN",
  "Montreal Canadiens": "MTL",
  // Second entry for Montreal for NHL API
  "Montréal Canadiens": "MTL",
  "Nashville Predators": "NSH",
  "New Jersey Devils": "NJ",
  "New York Islanders": "NYI",
  "New York Rangers": "NYR",
  "Ottawa Senators": "OTT",
  "Philadelphia Flyers": "PHI",
  "Pittsburgh Penguins": "PIT",
  "San Jose Sharks": "SJ",
  "Seattle Kraken": "SEA",
  "St. Louis Blues": "STL",
  "Tampa Bay Lightning": "TB",
  "Toronto Maple Leafs": "TOR",
  "Vancouver Canucks": "VAN",
  "Vegas Golden Knights": "VGK",
  "Washington Capitals": "WSH",
  "Winnipeg Jets": "WPG",
  "Free Agent": "FA"
}

export const TEAM_ABBR_TO_NAME = {
  "ANA": "Anaheim Ducks",
  "ARI": "Arizona Coyotes",
  "BOS": "Boston Bruins",
  "BUF": "Buffalo Sabres",
  "CGY": "Calgary Flames",
  "CAR": "Carolina Hurricanes",
  "CHI": "Chicago Blackhawks",
  "COL": "Colorado Avalanche",
  "CBJ": "Columbus Blue Jackets",
  "DAL": "Dallas Stars",
  "DET": "Detroit Red Wings",
  "EDM": "Edmonton Oilers",
  "FLA": "Florida Panthers",
  "LA": "Los Angeles Kings",
  "MIN": "Minnesota Wild",
  "MTL": "Montreal Canadiens",
  "NSH": "Nashville Predators",
  "NJ": "New Jersey Devils",
  "NYI": "New York Islanders",
  "NYR": "New York Rangers",
  "OTT": "Ottawa Senators",
  "PHI": "Philadelphia Flyers",
  "PIT": "Pittsburgh Penguins",
  "SJ": "San Jose Sharks",
  "SEA": "Seattle Kraken",
  "STL": "St. Louis Blues",
  "TB": "Tampa Bay Lightning",
  "TOR": "Toronto Maple Leafs",
  "VAN": "Vancouver Canucks",
  "VGK": "Vegas Golden Knights",
  "WSH": "Washington Capitals",
  "WPG": "Winnipeg Jets",
  "FA": "Free Agent"
}

export const TEAM_ABBR_TO_COLORS = {
  "ANA": {
    primary: '#B9975B',
    secondary: '#F47A38',
  },
  "ARI": {
    primary: '#8C2633',
    secondary: '#E2D6B5',
  },
  "BOS": {
    primary: '#000000',
    secondary: '#FFB81C',
  },
  "BUF": {
    primary: '#002654',
    secondary: '#FCB514',
  },
  "CGY": {
    primary: '#F1BE48',
    secondary: '#C8102E',
  },
  "CAR": {
    primary: '#000000',
    secondary: '#CC0000',
  },
  "CHI": {
    primary: '#D18A00',
    secondary: '#CF0A2C',
  },
  "COL": {
    primary: '#236192',
    secondary: '#6F263D',
  },
  "CBJ": {
    primary: '#002654',
    secondary: '#CE1126',
  },
  "DAL": {
    primary: '#006847',
    secondary: '#8F8F8C',
  },
  "DET": {
    primary: '#FFFFFF',
    secondary: '#CE1126',
  },
  "EDM": {
    primary: '#041E42',
    secondary: '#FF4C00',
  },
  "FLA": {
    primary: '#041E42',
    secondary: '#C8102E',
  },
  "LA": {
    primary: '#111111',
    secondary: '#A2AAAD',
  },
  "MIN": {
    primary: '#154734',
    secondary: '#A6192E',
  },
  "MTL": {
    primary: '#192168',
    secondary: '#AF1E2D',
  },
  "NSH": {
    primary: '#041E42',
    secondary: '#FFB81C',
  },
  "NJ": {
    primary: '#000000',
    secondary: '#CE1126',
  },
  "NYI": {
    primary: '#00539B',
    secondary: '#F47D30',
  },
  "NYR": {
    primary: '#0038A8',
    secondary: '#CE1126',
  },
  "OTT": {
    primary: '#C52032',
    secondary: '#C2912C',
  },
  "PHI": {
    primary: '#000000',
    secondary: '#F74902',
  },
  "PIT": {
    primary: '#000000',
    secondary: '#FCB514',
  },
  "SJ": {
    primary: '#006D75',
    secondary: '#EA7200',
  },
  "SEA": {
    primary: "#001628",
    secondary: "#99D9D9",
  },
  "STL": {
    primary: '#002F87',
    secondary: '#FCB514',
  },
  "TB": {
    primary: '#002868',
    secondary: '#FFFFFF',
  },
  "TOR": {
    primary: '#00205B',
    secondary: '#FFFFFF',
  },
  "VAN": {
    primary: '#00205B',
    secondary: '#00843D',
  },
  "VGK": {
    primary: '#B4975A',
    secondary: '#333F42',
  },
  "WSH": {
    primary: '#041E42',
    secondary: '#C8102E',
  },
  "WPG": {
    primary: '#041E42',
    secondary: '#7B303E',
  },
}