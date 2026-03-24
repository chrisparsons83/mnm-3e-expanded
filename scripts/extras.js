const EXTRAS = {
  "Concentration": {
    name: "Concentration",
    data: {
      description: "<p>Once you have hit with a Concentration Affliction, so long as you continue to take a standard action each turn to maintain the effect, the target must make a new resistance check against it, with no attack check required.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Alternate Resistance": {
    name: "Alternate Resistance",
    data: {
      description: "<p>Some Afflictions may be initially resisted by Dodge, representing the need for quick reaction time or reflexes to avoid the effect. In this case, the later resistance checks to remove the Affliction’s conditions are typically still based on Fortitude or Will.</p><p>+0 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 0 }
    }
  },
  "Cumulative": {
    name: "Cumulative",
    data: {
      description: "<p>A Cumulative Affliction adds any further degrees to the existing degrees on the target. For example, if you hit a target and impose a vulnerable condition (one degree), then attack again and get one degree on the effect, you impose the Affliction’s second degree condition.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Progressive": {
    name: "Progressive",
    data: {
      description: "<p>This modifier causes an Affliction to increase incrementally without any effort from you. If the target fails a resistance check to end the Affliction, it not only persists, but increases in effect by one degree!</p><p>+2 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 2 }
    }
  },
  "Accurate": {
    name: "Accurate",
    data: {
      description: "<p>An effect with this extra is especially accurate; you get +2 per Accurate rank to attack checks made with it.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Affects Corporeal": {
    name: "Affects Corporeal",
    data: {
      description: "<p>An incorporeal being can use an effect with this extra on the corporeal world. When an effect is used against a corporeal target, the effect’s rank is equal to the rank of this extra, up to a maximum of the effect’s full rank.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Affects Insubstantial": {
    name: "Affects Insubstantial",
    data: {
      description: "<p>An effect with this extra works on insubstantial targets, in addition to having its normal effect on corporeal targets. Rank 1 allows the effect to work at half its normal rank; rank 2 allows it to function at full rank.</p><p>Flat 1 or 2 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Affects Objects": {
    name: "Affects Objects",
    data: {
      description: "<p>This modifier allows effects normally resisted by Fortitude to work on non-living objects (those with no Stamina).</p><p>+0 or +1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Affects Others": {
    name: "Affects Others",
    data: {
      description: "<p>This extra allows you to give someone else use of a personal effect. You must touch the subject as a standard action, and they have control over their use of the effect.</p><p>+0 or +1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Alternate Effect": {
    name: "Alternate Effect",
    data: {
      description: "<p>This modifier allows you to “swap-out” the effect for an entire other, alternate, effect!</p><p>Flat 1 or 2 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Area": {
    name: "Area",
    data: {
      description: "<p>This extra allows an effect that normally works on a single target to affect an area. No attack check is needed; potential targets are permitted a Dodge resistance check (DC 10 + effect rank) to reduce the effect.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Burst Area": {
    name: "Burst Area",
    data: {
      description: "<p>The effect fills a sphere with a 30-foot radius (distance rank 0).</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Cloud Area": {
    name: "Cloud Area",
    data: {
      description: "<p>The effect fills a sphere with a 15-foot radius (distance rank –1) that lingers for one round.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Cone Area": {
    name: "Cone Area",
    data: {
      description: "<p>The effect fills a cone with a length, width, and height of 60 feet (distance rank 1).</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Cylinder Area": {
    name: "Cylinder Area",
    data: {
      description: "<p>The effect fills a cylinder 30 feet in radius and height (distance rank 0).</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Line Area": {
    name: "Line Area",
    data: {
      description: "<p>The effect fills a path 6 feet wide and 30 feet long (distance ranks -2 and 0) in a straight line.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Perception Area": {
    name: "Perception Area",
    data: {
      description: "<p>The effect works on anyone able to perceive the target point with a particular sense. Targets get a Dodge resistance check to avoid the effect entirely.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Contagious": {
    name: "Contagious",
    data: {
      description: "<p>Contagious effects work on both the target and anyone coming into contact with the target. New targets resist the effect normally.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Dimensional": {
    name: "Dimensional",
    data: {
      description: "<p>This modifier allows an effect to work on targets in other dimensions. Rank 1 affects one dimension, Rank 2 a related group, Rank 3 any dimension.</p><p>Flat 1-3 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Extended Range": {
    name: "Extended Range",
    data: {
      description: "<p>Each rank of Extended Range doubles all of the effect’s range categories.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Feature": {
    name: "Feature",
    data: {
      description: "<p>Adds some minor additional capability or benefit to a basic effect.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Homing": {
    name: "Homing",
    data: {
      description: "<p>This modifier grants a ranged effect an additional opportunity to hit if it misses.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Impervious": {
    name: "Impervious",
    data: {
      description: "<p>A defense with this modifier ignores any effect with a resistance difficulty modifier equal to or less than half the Impervious rank.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Increased Mass": {
    name: "Increased Mass",
    data: {
      description: "<p>Each rank of this extra increases the mass rank you can carry or move with the effect by 1.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Incurable": {
    name: "Incurable",
    data: {
      description: "<p>Effects such as Healing and Regeneration cannot heal the damage caused by an effect with this modifier.</p><p>Flat 1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Indirect": {
    name: "Indirect",
    data: {
      description: "<p>A ranged effect with this modifier can originate from a point other than the user, ignoring cover.</p><p>Flat 1-4 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Innate": {
    name: "Innate",
    data: {
      description: "<p>An effect with this modifier is an innate part of your nature and unaffected by Nullify.</p><p>Flat 1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Insidious": {
    name: "Insidious",
    data: {
      description: "<p>This modifier makes the result of an effect harder to detect (DC 20 skill check).</p><p>Flat 1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Penetrating": {
    name: "Penetrating",
    data: {
      description: "<p>Your effect overcomes Impervious Resistance to a degree.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Precise": {
    name: "Precise",
    data: {
      description: "<p>You can use a Precise effect to perform tasks requiring delicacy and fine control.</p><p>Flat 1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Reach": {
    name: "Reach",
    data: {
      description: "<p>Each rank of this modifier to a close range effect extends its reach by 5 feet.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Reaction": {
    name: "Reaction",
    data: {
      description: "<p>Changes an effect’s required action to a reaction, occurring automatically when a triggering event occurs.</p><p>+1 or +3 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Reversible": {
    name: "Reversible",
    data: {
      description: "<p>You can remove conditions caused by a Reversible effect at will as a free action.</p><p>Flat 1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Ricochet": {
    name: "Ricochet",
    data: {
      description: "<p>You can ricochet or bounce an attack effect off of a solid surface to change its direction.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Secondary Effect": {
    name: "Secondary Effect",
    data: {
      description: "<p>An instant duration effect with this modifier affects the target once immediately and then once again on the following round.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Selective": {
    name: "Selective",
    data: {
      description: "<p>A resistible effect with this extra is discriminating, allowing you to decide who is and is not affected by it.</p><p>+1 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Sleep": {
    name: "Sleep",
    data: {
      description: "<p>The effect leaves targets asleep whenever it would normally render them incapacitated.</p><p>+0 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 0 }
    }
  },
  "Split": {
    name: "Split",
    data: {
      description: "<p>A resistible effect that works on one target can be split between two or more targets.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Subtle": {
    name: "Subtle",
    data: {
      description: "<p>Subtle effects are not as noticeable. Rank 1 is difficult to notice, Rank 2 is undetectable.</p><p>Flat 1-2 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Sustained": {
    name: "Sustained",
    data: {
      description: "<p>Applied to a permanent duration effect, this modifier makes it sustained duration.</p><p>+0 cost per rank.</p>",
      cout: { fixe: true, rang: true, value: 0 }
    }
  },
  "Triggered": {
    name: "Triggered",
    data: {
      description: "<p>You can “set” an instant duration effect to activate under particular circumstances.</p><p>Flat 1 point per rank.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Variable Descriptor": {
    name: "Variable Descriptor",
    data: {
      description: "<p>You can change the descriptors of an effect with this modifier as a free action.</p><p>Flat 1-2 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  }
};

module.exports = EXTRAS;
