/**
 * Pure descriptive rhythm statistics derived from the existing Pulse 0–100
 * timeline. These are NOT extra scores or estimates of technical quality.
 *
 * Each non-null value represents one sampled match minute while on pitch.
 * A quiet replacement or a sent-off player is never counted outside play.
 */
export function pulsePresence(timeline, threshold=50, hotThreshold=75) {
  if (!Array.isArray(timeline)) return {played:0,above:0,share:0,strong:0,longest:0,longestStart:null,longestEnd:null};
  let played=0,above=0,strong=0,longest=0,longestStart=null,longestEnd=null;
  let current=0,currentStart=null,lastMinute=null;
  for (let index=0;index<timeline.length;index++) {
    const point=timeline[index];
    const minute=Number.isInteger(point?.minute)?point.minute:index;
    const value=point?.activity;
    if (value!=null && Number.isFinite(value)) {
      played++;
      if(value>hotThreshold)strong++;
    }
    // Only contiguous recorded minutes form a continuous sequence.
    if(value!=null && Number.isFinite(value) && value>threshold) {
      above++;
      if(current===0 || lastMinute!==minute-1) {current=0;currentStart=minute;}
      current++;
      if(current>longest) {
        longest=current;
        longestStart=currentStart;
        longestEnd=minute;
      }
      lastMinute=minute;
    } else {
      current=0;
      currentStart=null;
      lastMinute=null;
    }
  }
  return {
    played, above,
    share: played?Math.round(above/played*100):0,
    strong, longest,longestStart,longestEnd
  };
}
