const FLAWS = {
  "Limited Degree": {
    name: "Limited Degree",
    data: {
      description: "<p>Your Affliction is limited to no more than two degrees of effect. With two applications of this modifier, it is limited to no more than one degree of effect.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Activation": {
    name: "Activation",
    data: {
      description: "<p>A power with this flaw requires an action to prepare or activate before any of its effects are usable. Move action is –1 point, standard action is –2 points.</p><p>Flat -1 or -2 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Instant Recovery": {
    name: "Instant Recovery",
    data: {
      description: "<p>The target of an Affliction effect with this modifier recovers automatically, no check required, at the end of the round in which the duration ends.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Check Required": {
    name: "Check Required",
    data: {
      description: "<p>An effect with this flaw requires a check of some sort—usually a skill check—with a base difficulty of 10, +1 for each additional rank in Check Required.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Concentration": {
    name: "Concentration",
    data: {
      description: "<p>Using a Concentration effect requires more concentration than normal. If you are unable to maintain your concentration, the effect ends.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Diminished Range": {
    name: "Diminished Range",
    data: {
      description: "<p>Each rank of this flaw reduces the effect’s range increments by one step.</p><p>Flat -1 point per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Distracting": {
    name: "Distracting",
    data: {
      description: "<p>Using a Distracting effect requires so much concentration or effort that you are vulnerable until the start of your next turn.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Grab-Based": {
    name: "Grab-Based",
    data: {
      description: "<p>An attack with this flaw requires you to successfully grab and hold a target before the effect can be used.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Increased Action": {
    name: "Increased Action",
    data: {
      description: "<p>Each rank of this flaw increases the action required to use an effect by one step (Free to Move, Move to Standard, etc.).</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Limited": {
    name: "Limited",
    data: {
      description: "<p>An effect with this flaw only works under certain circumstances, or has a significant restriction on its use.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Noticeable": {
    name: "Noticeable",
    data: {
      description: "<p>A continuous or permanent effect with this flaw is very noticeable (glows, makes a loud noise, etc.).</p><p>Flat -1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Quirk": {
    name: "Quirk",
    data: {
      description: "<p>A Quirk is a minor flaw, often something specific to a character or power, that doesn’t quite rise to the level of a full -1 cost per rank flaw.</p><p>Flat -1 point.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Reduced Range": {
    name: "Reduced Range",
    data: {
      description: "<p>Each rank of this flaw reduces the range of an effect (Ranged to Close, etc.).</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Resistible": {
    name: "Resistible",
    data: {
      description: "<p>An effect with this flaw allows an additional resistance check, or is resisted by a different defense than usual.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Sense-Dependent": {
    name: "Sense-Dependent",
    data: {
      description: "<p>The target must be able to perceive the effect with a particular sense for it to work.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Side Effect": {
    name: "Side Effect",
    data: {
      description: "<p>If you fail to use the effect properly, or even if you succeed, you suffer a negative side effect.</p><p>–1 or –2 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Tiring": {
    name: "Tiring",
    data: {
      description: "<p>Using the effect is physically or mentally taxing, causing you to become fatigued.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Uncontrolled": {
    name: "Uncontrolled",
    data: {
      description: "<p>You have no control over when the effect activates or what it does; the GM decides.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Unreliable": {
    name: "Unreliable",
    data: {
      description: "<p>An Unreliable effect only works some of the time (5 uses, or requires a check each time).</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Feedback": {
    name: "Feedback",
    data: {
      description: "<p>You suffer damage when a manifestation of your effect is damaged.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Inaccurate": {
    name: "Inaccurate",
    data: {
      description: "<p>An effect with this flaw is hard to control or wildly inaccurate. Each rank gives you a –2 penalty to attack checks.</p><p>Flat -1 point per rank.</p>",
      cout: { fixe: true, rang: true, value: 1 }
    }
  },
  "Permanent": {
    name: "Permanent",
    data: {
      description: "<p>A continuous effect with this flaw becomes permanent in duration. It cannot be turned off and cannot be improved using extra effort.</p><p>–1 cost per rank.</p>",
      cout: { fixe: false, rang: true, value: 1 }
    }
  },
  "Removable": {
    name: "Removable",
    data: {
      description: "<p>Removable applies to the power as a whole. The flaw is worth –1 point per 5 total power points.</p><p>Flat -1 point per 5 points.</p>",
      cout: { fixe: true, rang: false, value: 1 }
    }
  },
  "Easily Removable": {
    name: "Easily Removable",
    data: {
      description: "<p>An easily removable power can be taken away with a disarm or grab action. The flaw is worth –2 points per 5 total power points.</p><p>Flat -2 points per 5 points.</p>",
      cout: { fixe: true, rang: false, value: 2 }
    }
  }
};

module.exports = FLAWS;
