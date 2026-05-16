/**
 * Centralized Slovak UI copy. Keep all user-facing strings here.
 * Praise effort, not outcome ("Bravo, urobil si to!" not "Si super!").
 */
export const sk = {
  app: {
    title: "Domáce úlohy",
    description: "Aplikácia pre rodinu — splň úlohy, získaj čas na obrazovke.",
  },
  home: {
    tagline: "Vyber si, kto si",
    adminCta: "Rodič — prihlásiť sa",
    pickKid: "Vyber si svoj profil",
  },
  admin: {
    loginTitle: "Prihlásenie rodiča",
    passwordLabel: "Heslo",
    loginButton: "Prihlásiť sa",
    logout: "Odhlásiť sa",
    wrongPassword: "Nesprávne heslo. Skús to znova.",
    nav: {
      today: "Dnes",
      kids: "Deti",
      chores: "Úlohy",
      log: "Zaznamenať",
      calendar: "Kalendár",
      settings: "Nastavenia",
    },
  },
  chore: {
    type: {
      family_duty: "Rodinná povinnosť",
      earning_daily: "Denná úloha",
      earning_weekly_quest: "Týždenná výzva",
    },
    rewardMinutes: "minút za splnenie",
    done: "Hotovo!",
    praise: [
      "Bravo, urobil si to!",
      "Skvelá práca!",
      "Si šikovný!",
      "Výborne, pokračuj!",
    ],
  },
  kid: {
    todayLabel: "Dnes máš k dispozícii",
    bankLabel: "V banke",
    minutes: "minút",
    pickChore: "Vyber si úlohu",
    noChores: "Dnes už nie sú žiadne úlohy. Bav sa!",
  },
  calendar: {
    legend: {
      green: "Splnené",
      red: "Nesplnené alebo prečerpané",
      neutral: "Víkend / voľný deň",
    },
    months: [
      "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
      "Júl", "August", "September", "Október", "November", "December",
    ],
    weekdaysShort: ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"],
  },
  units: {
    min: "min",
  },
} as const;
