/** Everything the public site says, in one place, so pages stay consistent and short. */
import { BRAND } from "@/constants/brand";
import { PRICING } from "@/constants/pricing";
import {
  AdminMock,
  HealthMock,
  ImportMock,
  LiveMock,
  PaymentsMock,
  ScheduleMock,
  StatsMock,
  TrainingMock,
  VideoMock,
} from "./mocks";

export type Feature = {
  slug: string;
  icon: string;
  name: string;
  /** One line for menus and cards. */
  line: string;
  title: string;
  body: string;
  points: string[];
  /** Three short "what you get" groups for the feature's own page. */
  details: { title: string; text: string }[];
  Mock: () => React.JSX.Element;
};

export const FEATURES: Feature[] = [
  {
    slug: "live-scoring",
    icon: "⚾",
    name: "Live scoring",
    line: "Score pitch by pitch; parents watch live.",
    title: "Score from the dugout. Parents watch it live.",
    body: "Tap each pitch and play. The score, count, runners and play-by-play reach every parent's phone in under a second.",
    points: [
      "Pitch counts and box scores fill in by themselves",
      "Spray charts from where the ball went",
    ],
    details: [
      {
        title: "Built for one hand",
        text: "Five pitch buttons under the field. In play asks how it was hit, where it went and what happened.",
      },
      {
        title: "Your lineup, their lineup",
        text: "Positions on the field, their batting order by number or name, substitutions and pitching changes.",
      },
      {
        title: "Everyone's in the stands",
        text: "A live score bar, runners moving on the field and a play-by-play for players and parents.",
      },
    ],
    Mock: LiveMock,
  },
  {
    slug: "player-health",
    icon: "💪",
    name: "Player health",
    line: "Pitch Smart, check-ins, injuries and medical cards.",
    title: "Know every arm before the first pitch.",
    body: "Pitch Smart limits, rest days and one-tap check-ins on one board. Log injuries, follow a return-to-play plan and keep each player's medical card handy on game day.",
    points: [
      "Alerts for pain, soreness and workload spikes",
      "Injuries and suspected concussions held out until cleared",
      "Allergies and emergency contacts one tap away",
    ],
    details: [
      {
        title: "Today, at a glance",
        text: "Who needs a look, who's out or limited, who can't pitch today and who's ready, with pitches left.",
      },
      {
        title: "One tap a day",
        text: "Players check in on their arm from their home screen. Coaches see who has and who hasn't.",
      },
      {
        title: "Back on the field safely",
        text: "Injuries, concussion steps and return-to-throw plans the player and parents can follow, step by step. Only coaches and the family see it.",
      },
    ],
    Mock: HealthMock,
  },
  {
    slug: "training",
    icon: "🏋️",
    name: "Training",
    line: "Programs, workouts and exercise diagrams.",
    title: "Programs players actually finish.",
    body: "Build or start from templates. Players see today's workout, log it in seconds and see what they did last time.",
    points: ["Strength, throwing, hitting and arm care", "See who's done it, and who hasn't"],
    details: [
      {
        title: "Start from a template",
        text: "Long toss, bullpen progressions and daily arm care, with 130 baseball exercises to build your own.",
      },
      {
        title: "Shows them how",
        text: "Moving diagrams for lifts and band work, demo videos, and last time's numbers on every set.",
      },
      {
        title: "Practice plans too",
        text: "Stations, times and groups for practice, shared with the team before you get to the field.",
      },
    ],
    Mock: TrainingMock,
  },
  {
    slug: "schedule-messages",
    icon: "📅",
    name: "Schedule & messages",
    line: "Games, practices, RSVPs and team messages.",
    title: "One place for when, where and who's coming.",
    body: "Games, practices and tournaments with RSVPs, directions and calendar links. Messages reach the right players and parents.",
    points: ["Changes notify the whole team", "Groups for teams, age groups or pitchers"],
    details: [
      {
        title: "No more group text",
        text: "Announcements and messages to the whole team or one group, with parents copied when it matters.",
      },
      {
        title: "Know who's coming",
        text: "RSVPs and attendance for every game and practice.",
      },
      {
        title: "Rain-outs handled",
        text: "Postpone, cancel or move a game and everyone is told at once.",
      },
    ],
    Mock: ScheduleMock,
  },
  {
    slug: "registration-payments",
    icon: "💳",
    name: "Registration & payments",
    line: "Sign-ups, waivers and dues, monthly or in full.",
    title: "Sign-ups and dues without the spreadsheet.",
    body: "Share one link. Families register, sign the waiver and pay in full or monthly, by bank account or card.",
    points: [
      "Automatic reminders, never for autopay",
      "No 9D fee on dues; money goes to your account",
      "Every family's to-do in one place: forms, payments, medical info",
    ],
    details: [
      {
        title: "One link per season",
        text: "Player info, emergency contact, medical notes and a signed waiver, collected for you.",
      },
      {
        title: "Monthly payments",
        text: "Families pick in full or up to 12 payments. Autopay if they want it.",
      },
      {
        title: "Chase nobody",
        text: "Reminders go out before and after due dates. You see who's paid at a glance.",
      },
    ],
    Mock: PaymentsMock,
  },
  {
    slug: "video",
    icon: "🎥",
    name: "Video feedback",
    line: "Players upload; coaches draw and comment.",
    title: "Coaching that doesn't end at practice.",
    body: "Players upload a swing or a bullpen. Coaches slow it down, draw on it and leave notes at the exact moment.",
    points: ["Lines, angles and circles on the video", "Voice-over breakdowns"],
    details: [
      {
        title: "Frame by frame",
        text: "Step through frames and slow motion to see exactly what happened.",
      },
      {
        title: "Draw and talk",
        text: "Mark angles and paths, then record a breakdown players can replay.",
      },
      {
        title: "Kept with the player",
        text: "Every clip and note on the player's profile, so progress is easy to see.",
      },
    ],
    Mock: VideoMock,
  },
  {
    slug: "team-admin",
    icon: "🗂️",
    name: "Team admin",
    line: "Forms, coach certifications, staff hours and pay.",
    title: "The office work, handled.",
    body: "Send forms families sign on their phone, keep coach certifications current, and track coach hours and pay without a spreadsheet.",
    points: [
      "Coaches clock in or log a practice; you approve",
      "Hourly, per session, stipend or volunteer, set per team",
      "Export for payroll and mark it paid",
    ],
    details: [
      {
        title: "Forms that come back",
        text: "Waivers, medical releases and team policies signed on any phone. See who's done and nudge who isn't.",
      },
      {
        title: "Staff, covered",
        text: "Background checks, safety training and coaching certifications, with a heads-up before they expire.",
      },
      {
        title: "Staff time and pay",
        text: "Each coach's pay is set per team. Approve timesheets, see what everyone's owed, export a CSV for payroll and record how you paid.",
      },
    ],
    Mock: AdminMock,
  },
  {
    slug: "switching",
    icon: "🔁",
    name: "Easy switching",
    line: "Import from GameChanger, TeamSnap and more.",
    title: "Bring your whole team over in minutes.",
    body: "Upload the export from the app you use now, or a spreadsheet or calendar link. 9D sets up players, parents, schedule and stats for you.",
    points: [
      "GameChanger, TeamSnap, LeagueApps, SportsEngine, Excel and calendars",
      "Parents invited automatically, brothers and sisters in one invite",
      "Undo any import",
    ],
    details: [
      {
        title: "Step-by-step guides",
        text: "Pick the app you're leaving and we show you exactly where its export button is.",
      },
      {
        title: "Your roster, ready",
        text: "Players without an email still join the roster, and parents get one invite for all their kids.",
      },
      {
        title: "Your season, too",
        text: "Games and practices from a schedule file or calendar link, and last season's batting and pitching stats.",
      },
    ],
    Mock: ImportMock,
  },
];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

export type Audience = {
  slug: "coaches" | "players" | "parents";
  label: string;
  title: string;
  lead: string;
  /** Three things that matter most to them, each with a picture. */
  jobs: { title: string; text: string; Mock: () => React.JSX.Element }[];
  /** A day in their life, five short beats. */
  day: { title: string; beats: [string, string][] };
  faq: [string, string][];
};

export const AUDIENCES: Audience[] = [
  {
    slug: "coaches",
    label: "Coaches & clubs",
    title: "Run your program, not a group chat.",
    lead: "Registration, practice, game day, arm care and the office work in one place, for one team or a whole club.",
    jobs: [
      {
        title: "Before the season",
        text: "One registration link collects player info, waivers and dues, monthly or in full.",
        Mock: PaymentsMock,
      },
      {
        title: "Game day",
        text: "Set the lineup, score pitch by pitch, and every parent follows along live.",
        Mock: LiveMock,
      },
      {
        title: "Every day",
        text: "Know who can pitch, who's sore and who's coming back, before you make the call.",
        Mock: HealthMock,
      },
    ],
    day: {
      title: "A game day with " + BRAND.name,
      beats: [
        ["7:30", "Check the health board: two arms resting, one sore, flagged."],
        ["8:00", "Rain moves the start time. One tap tells every family."],
        ["9:45", "Lineup and positions set; their batting order typed in."],
        ["10:00", "Score each pitch. Parents watch live from work."],
        ["12:30", "Final. Box score, pitch counts and rest days are already done."],
      ],
    },
    faq: [
      [
        "What does it cost?",
        `Every team starts with a ${PRICING.trialDays}-day free trial, no card needed. After that, the Team plan is $${PRICING.team.monthly} a month (or $${PRICING.team.yearly} a year) per team. Players and parents are always free.`,
      ],
      [
        "Do you take a cut of our dues?",
        `No. Payments go straight to your team's own Stripe account. Families pay the standard processing fee, and bank payments cost far less than cards.`,
      ],
      [
        "Can a club run several teams?",
        "Yes. Organize by team or age group, with schedules, messages and registration for each, and switch between teams in one account.",
      ],
      [
        "Can I bring my roster and schedule?",
        "Yes. Upload the export from GameChanger, TeamSnap, LeagueApps or SportsEngine, a spreadsheet, or a calendar link. Players, parents, games and stats come across, and you can undo any import.",
      ],
      [
        "Can I track coach hours and pay?",
        "Yes. Turn on Staff time & pay and set how each coach is paid: hourly, per session, a season stipend, or volunteer. Coaches log time, you approve it, then export it for payroll and mark it paid.",
      ],
      [
        "Do my players need to download an app?",
        "No. It works in any phone browser and can be added to the home screen like an app.",
      ],
    ],
  },
  {
    slug: "players",
    label: "Players",
    title: "Your training, your arm, your stats.",
    lead: "Today's workout, your stats and video feedback from your coach, all on your phone.",
    jobs: [
      {
        title: "Today's workout",
        text: "See what to do, how to do it, and what you lifted last time. Log it in seconds.",
        Mock: TrainingMock,
      },
      {
        title: "Your numbers",
        text: "Batting and pitching stats from every game, with your spray chart.",
        Mock: StatsMock,
      },
      {
        title: "Get better between practices",
        text: "Upload a swing or a bullpen; your coach draws on it and leaves notes.",
        Mock: VideoMock,
      },
    ],
    day: {
      title: "A day as a player",
      beats: [
        ["7:00", "Arm check-in: one tap, “Good.”"],
        ["3:30", "Today's workout: lower body and arm care, about 45 minutes."],
        ["5:00", "Upload a bullpen clip for your coach."],
        ["7:00", "Game: your at-bats show up live for your family."],
        ["9:30", "Your stats and spray chart are updated."],
      ],
    },
    faq: [
      ["Is it free for players?", "Yes. Your team adds you; you never pay for the app."],
      [
        "I'm under 13. Can I use it?",
        "Yes, with a parent's OK. We ask for it the first time you sign in.",
      ],
      ["Who sees my health check-ins?", "Your coaches. Your team decides what else is shared."],
    ],
  },
  {
    slug: "parents",
    label: "Parents",
    title: "Never miss a pitch.",
    lead: "Live scores when you can't be there, the schedule in one place, and payments that aren't a hassle.",
    jobs: [
      {
        title: "Live from anywhere",
        text: "The score, the count, the runners and every play, the moment it happens.",
        Mock: LiveMock,
      },
      {
        title: "Always know the plan",
        text: "Games, practices, directions and RSVPs. Changes come straight to your phone.",
        Mock: ScheduleMock,
      },
      {
        title: "Pay your way",
        text: "Register once, sign the waiver and pay in full or monthly by bank or card.",
        Mock: PaymentsMock,
      },
    ],
    day: {
      title: "Game day as a parent",
      beats: [
        ["Mon", "RSVP for Saturday in one tap."],
        ["Fri", "Reminder: bring white pants. Directions saved."],
        ["Sat 10:00", "Stuck at work; the live score is on your phone."],
        ["Sat 10:42", "Your kid doubles to left. You get the play as it happens."],
        ["Sat 12:30", "Final score, with the box score and stats in the app."],
      ],
    },
    faq: [
      [
        "Do I pay for the app?",
        "No. Parents and players are always free. You only pay your team's dues.",
      ],
      [
        "Is my child's information safe?",
        "Only their coaches and linked parents see it. No ads, and we never sell data. Players under 13 need a parent's consent.",
      ],
      [
        "Can I pay dues monthly?",
        "If your team offers it, yes: pick monthly at registration, with autopay if you like.",
      ],
    ],
  },
];

export const audienceBySlug = (slug: string) => AUDIENCES.find((a) => a.slug === slug);

/** Why teams switch: three short, true points. */
export const WHY = [
  ["Scores built in", "No second app for game day. Parents follow live, stats fill in."],
  ["Lower fees on dues", "No 9D fee on payments, and bank transfers cost far less than cards."],
  ["Arms come first", "Pitch Smart, rest days and check-ins on every player."],
  ["Switch in an afternoon", "Import your roster, schedule and stats from the app you use now."],
];
