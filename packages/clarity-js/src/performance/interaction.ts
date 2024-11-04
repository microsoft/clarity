import { PerformanceEventTiming, Interaction } from '@clarity-types/data';

// Estimate variables to keep track of interactions
let interactionCountEstimate = 0;
let minKnownInteractionId = Infinity;
let maxKnownInteractionId = 0;

let prevInteractionCount = 0; // Used to track interaction count between pages

const MAX_INTERACTIONS_TO_CONSIDER = 10; // Maximum number of interactions we consider for INP
const DEFAULT_DURATION_THRESHOLD = 40; // Threshold to ignore very short interactions

// List to store the longest interaction events
const longestInteractionList: Interaction[] = [];
// Map to track interactions by their ID, ensuring we handle duplicates
const longestInteractionMap: Map<number, Interaction> = new Map();

/**
 * Update the approx number of interactions estimate count if the interactionCount is not supported.
 * The difference between `maxKnownInteractionId` and `minKnownInteractionId` gives us a rough range of how many interactions have occurred.
 * Dividing by 7 helps approximate the interaction count more accurately, since interaction IDs are spread out across a large range.
 */
const countInteractions = (entry: PerformanceEventTiming) => {
  if ('interactionCount' in performance) {
    interactionCountEstimate = performance.interactionCount as number;
    return;
  }

  if (entry.interactionId) {
    minKnownInteractionId = Math.min(
      minKnownInteractionId,
      entry.interactionId
    );
    maxKnownInteractionId = Math.max(
      maxKnownInteractionId,
      entry.interactionId
    );

    interactionCountEstimate = maxKnownInteractionId
      ? (maxKnownInteractionId - minKnownInteractionId) / 7 + 1
      : 0;
  }
};

const getInteractionCount = () => {
  return interactionCountEstimate || 0;
};

const getInteractionCountForNavigation = () => {
  return getInteractionCount() - prevInteractionCount;
};

/**
 * Estimates the 98th percentile (P98) of the longest interactions by selecting
 * the candidate interaction based on the current interaction count.
 * Dividing by 50 is a heuristic to estimate the 98th percentile (P98) interaction.
 * This assumes one out of every 50 interactions represents the P98 interaction.
 * By dividing the total interaction count by 50, we get an index to approximate 
 * the slowest 2% of interactions, helping identify a likely P98 candidate.
 */
export const estimateP98LongestInteraction = () => {
  if(!longestInteractionList.length){
    return -1;
  }

  const candidateInteractionIndex = Math.min(
    longestInteractionList.length - 1,
    Math.floor(getInteractionCountForNavigation() / 50)
  );

  return longestInteractionList[candidateInteractionIndex].latency;
};

/**
 * Resets the interaction tracking, usually called after navigation to a new page.
 */
export const resetInteractions = () => {
  prevInteractionCount = getInteractionCount();
  longestInteractionList.length = 0;
  longestInteractionMap.clear();
};

/**
 * Processes a PerformanceEventTiming entry by updating the longest interaction list.
 */
export const processInteractionEntry = (entry: PerformanceEventTiming) => {
  // Ignore entries with 0 interactionId or very short durations
  if (!entry.interactionId || entry.duration < DEFAULT_DURATION_THRESHOLD) {
    return;
  }

  countInteractions(entry);

  const minLongestInteraction =
    longestInteractionList[longestInteractionList.length - 1];

  const existingInteraction = longestInteractionMap.get(entry.interactionId!);

  // Either update existing, add new, or replace shortest interaction if necessary
  if (
    existingInteraction ||
    longestInteractionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
    entry.duration > minLongestInteraction?.latency
  ) {
    if (!existingInteraction) {
      const interaction = {
        id: entry.interactionId,
        latency: entry.duration,
      };
      longestInteractionMap.set(interaction.id, interaction);
      longestInteractionList.push(interaction);
    } else if (entry.duration > existingInteraction.latency) {
      existingInteraction.latency = entry.duration;
    }

    longestInteractionList.sort((a, b) => b.latency - a.latency);

    // Trim the list to the maximum number of interactions to consider
    if (longestInteractionList.length > MAX_INTERACTIONS_TO_CONSIDER) {
      longestInteractionList
        .splice(MAX_INTERACTIONS_TO_CONSIDER)
        .forEach((i) => longestInteractionMap.delete(i.id));
    }
  }
};
