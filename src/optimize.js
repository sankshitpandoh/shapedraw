// Hill climbing over any state that implements energy(), doMove(),
// undoMove(undo) and copy(). Lower energy is better.

export function hillClimb(state, maxAge) {
  state = state.copy();
  let bestState = state.copy();
  let bestEnergy = state.energy();
  for (let age = 0; age < maxAge; age++) {
    const undo = state.doMove();
    const energy = state.energy();
    if (energy >= bestEnergy) {
      state.undoMove(undo);
    } else {
      bestEnergy = energy;
      bestState = state.copy();
      age = -1;
    }
  }
  return bestState;
}

// Simulated annealing. The Go package ships this too but the CLI only uses
// hill climbing; it's kept for library users.
export function anneal(state, maxTemp, minTemp, steps, rnd = Math) {
  const factor = -Math.log(maxTemp / minTemp);
  state = state.copy();
  let bestState = state.copy();
  let bestEnergy = state.energy();
  let previousEnergy = bestEnergy;
  for (let step = 0; step < steps; step++) {
    const pct = step / (steps - 1);
    const temp = maxTemp * Math.exp(factor * pct);
    const undo = state.doMove();
    const energy = state.energy();
    const change = energy - previousEnergy;
    const random = rnd.float ? rnd.float() : rnd.random();
    if (change > 0 && Math.exp(-change / temp) < random) {
      state.undoMove(undo);
    } else {
      previousEnergy = energy;
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestState = state.copy();
      }
    }
  }
  return bestState;
}
