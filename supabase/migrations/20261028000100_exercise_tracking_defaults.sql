-- =============================================================================
-- Phase 7: default tracking types for the global exercise library
--
-- Sprints and conditioning are logged as time / distance instead of weight × reps.
-- Only touches global exercises (org_id is null); custom exercises are set by
-- their coach in the exercise form. Idempotent. The same statements are
-- appended to supabase/seed/exercises.sql because local resets seed after migrating.
-- =============================================================================

-- Timed efforts: sprints, agility, shuttles, intervals and holds (lower is better for sprints).
update public.exercises set tracking_type = 'time'
where org_id is null and name in (
  '10-Yard Sprint', '60-Yard Sprint', 'Flying 10s', 'Home to First Sprint',
  'Pro Agility (5-10-5)', 'Shuttle Run', 'Tempo Runs', 'Assault Bike Intervals',
  'Jump Rope', 'Copenhagen Plank', 'Deep Squat Hold', 'Hip Flexor Stretch',
  'Couch Stretch', 'Sleeper Stretch', 'Cross-Body Stretch', 'Foam Roll Thoracic Extension',
  'Foam Roll Lats', 'Rice Bucket', 'Plate Pinch Hold', 'Rhythmic Stabilization'
);

-- Measured by how far: carries, sleds, crawls, shuffles, long toss.
update public.exercises set tracking_type = 'distance'
where org_id is null and name in (
  'Farmer Carry', 'Suitcase Carry', 'Sled Push', 'Sled Drag', 'Bear Crawl',
  'Lateral Shuffle', 'A-Skip', 'Long Toss'
);

-- Distance covered and the time it took (e.g. 500 m row).
update public.exercises set tracking_type = 'distance_time'
where org_id is null and name in ('Rowing Machine Intervals');

-- Reps only: bodyweight work, plyos, med ball throws, band arm care, mobility drills,
-- throwing and hitting volume.
update public.exercises set tracking_type = 'reps'
where org_id is null and name in (
  'Push-Up', 'Pull-Up', 'Chin-Up', 'Inverted Row', 'Glute Bridge', 'Nordic Hamstring Curl',
  'Med Ball Rotational Scoop Toss', 'Med Ball Shotput Throw', 'Med Ball Overhead Slam',
  'Med Ball Chest Pass', 'Med Ball Step-Behind Rotational Throw', 'Med Ball Overhead Throw',
  'Med Ball Backward Toss',
  'Box Jump', 'Broad Jump', 'Lateral Bound', 'Heiden Skater Hop', 'Depth Jump', 'Pogo Hops',
  'Single-Leg Box Jump', 'Split Squat Jump', 'Plyo Push-Up', 'Rotational Hop',
  'Worlds Greatest Stretch', '90/90 Hip Switch', 'Open Book T-Spine Rotation',
  'Quadruped T-Spine Rotation', 'Cat-Cow', 'Adductor Rock Back', 'Wall Slide',
  'Thread the Needle', 'Hamstring Floss', 'Ankle Rocker',
  'Band Pull-Apart', 'Band External Rotation', 'Band Internal Rotation',
  '90/90 Band External Rotation', 'Jaeger Band Forward Fly', 'Jaeger Band Reverse Fly',
  'Jaeger Band Throwing Deceleration', 'Jaeger Band Throwing Acceleration',
  'Prone Y Raise', 'Prone T Raise', 'Prone W Raise', 'Scap Push-Up', 'Serratus Wall Slide',
  'Weighted Ball Wall Dribble', 'Base Stealing Starts',
  'Flat Ground Throwing', 'Bullpen Session', 'Catch Play Progression', 'Pivot Pickoff Drill',
  'Reverse Throw', 'Rocker Throw', 'Walking Windup', 'Wrist Flicks',
  'Infield Throws Across the Diamond', 'Outfield Crow Hop Throws',
  'Tee Work', 'Front Toss', 'Side Toss', 'Batting Practice', 'Machine Velocity Training',
  'One-Hand Drill (Top Hand)', 'One-Hand Drill (Bottom Hand)', 'High Tee',
  'Overload/Underload Bat Swings', 'Dry Swings', 'Pitch Recognition Drill', 'Bunting Practice'
);

-- Everything else (barbell / dumbbell / kettlebell / cable / machine lifts) keeps the
-- default 'weight_reps'.
