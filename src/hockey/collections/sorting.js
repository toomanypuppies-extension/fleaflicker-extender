export const MAX_SORTS = 2;

// The first click on a column sorts it the way people usually want to read it:
// numbers highest first, text A to Z, and ranks and times lowest first. All are shown as "desc".
const compareValues = {
  number: (a, b) => b - a,
  numberLowFirst: (a, b) => a - b,
  string: (a, b) => a.localeCompare(b),
};

const isEmpty = (value) => value === undefined || value === null || value === "";

/**
 * Returns a sorted copy of the players. Players without a value for a sorted column
 * always go last, in either direction.
 * @param {Array} players
 * @param {Array<{ key: string, direction: 'desc' | 'asc' }>} sorts primary sort first
 * @param {Object} sortTypes column key to 'number' or 'string', or to { type, field } to sort a column
 *   by another field, like today's game by its start time
 */
export const sortPlayers = (players, sorts, sortTypes) => {
  const specFor = (key) => {
    const spec = sortTypes[key];
    return typeof spec === 'string' ? { type: spec, field: key } : spec;
  };

  const comparators = sorts
    .filter(sort => compareValues[specFor(sort.key)?.type])
    .map(({ key, direction }) => {
      const { type, field } = specFor(key);
      const compare = compareValues[type];
      return (a, b) => {
        const aEmpty = isEmpty(a[field]);
        const bEmpty = isEmpty(b[field]);
        if (aEmpty || bEmpty) {
          return aEmpty - bEmpty;
        }
        const result = compare(a[field], b[field]);
        return direction === "asc" ? -result : result;
      };
    });

  if (comparators.length === 0) {
    return players.slice();
  }

  return players.slice().sort((a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
};

/**
 * The sorts after clicking a column header. A click cycles the column through
 * desc, asc and unsorted. Without addSort the column becomes the only sort; with addSort
 * (shift-click) it's added as the next sort, replacing the last one once there are MAX_SORTS.
 */
export const toggleSort = (sorts, key, addSort = false) => {
  const existing = sorts.find(sort => sort.key === key);

  if (existing) {
    if (existing.direction === "desc") {
      return sorts.map(sort => (sort.key === key ? { key, direction: "asc" } : sort));
    }
    return sorts.filter(sort => sort.key !== key);
  }

  const added = { key, direction: "desc" };
  if (!addSort) {
    return [added];
  }
  return [...sorts.slice(0, MAX_SORTS - 1), added];
};
