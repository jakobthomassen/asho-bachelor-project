export type Slide =
  | {
      id: string;
      type: "bullets";
      title: string;
      subtitle: string;
      question: string;
      bullets: string[];
      audioLabel: string;
      buttonLabel: string;
    }
  | {
      id: string;
      type: "text";
      title: string;
      body: string;
      buttonLabel: string;
    }
  | {
      id: string;
      type: "audioList";
      title: string;
      subtitle: string;
      audioButtons: string[];
      buttonLabel: string;
    }
  | {
      id: string;
      type: "story";
      title: string;
      paragraphs: string[];
      buttonLabel: string;
    }
  | {
      id: string;
      type: "choices";
      title: string;
      choiceButtons: string[];
    }
  | {
      id: string;
      type: "aboutMethod";
      title: string;
      paragraphs: string[];
      readMoreLabel: string;
      buttonLabel: string;
    }
    | {
    id: string;
    type: "learningOptions";
    title: string;
    optionButtons: string[];
    footerText: string;
    buttonLabel: string;
  }
| {
    id: string;
    type: "subscription";
    title: string;
    subtitle: string;
    bullets: string[];
    secondaryButtonLabel: string;
    primaryButtonLabel: string;
  };

export const introSlides: Slide[] = [
  {
    id: "1",
    type: "bullets",
    title: "ASHO Din urolærer",
    subtitle: "Uro-metoden - en portal til frihet og balanse",
    question: "Kan du kjenne deg igjen i noe av dette?",
    bullets: [
      "Uro i relasjoner",
      "Vanskelig kommunikasjon med barn eller partner",
      "Stress og overveldelse i hverdagen",
      "Sosial uro eller ubehag blant andre",
      "Følelse av ikke å være bra nok",
      "Sinne, frustrasjon eller å miste kontroll",
      "Tanker og følelser som tar over",
    ],
    audioLabel: "Lydfil - introduksjon + hvordan ASHO jobber",
    buttonLabel: "Gå videre",
  },
  {
    id: "2",
    type: "text",
    title: "ASHO er ikke en quick fix",
    body: "ASHO hjelper deg å være sammen med virkeligheten slik den er",
    buttonLabel: "Gå videre",
  },
  {
    id: "3",
    type: "audioList",
    title: "Erfaringer fra andre",
    subtitle: "Lydfiler - korte erfaringer fra brukere",
    audioButtons: ["▶ Lyd 1", "▶ Lyd 2", "▶ Lyd 3"],
    buttonLabel: "Gå videre",
  },
  {
  id: "4",
  type: "story",
  title: "Forståelse",
  paragraphs: [
    "En reaktiv handling\nEn helt vanlig ettermiddag",

    "Du kommer hjem\nkanskje litt sliten",

    "Barnet ditt gjør noe lite\nsøler, roter, svarer litt tilbake",

    "Og med én gang skjer det noe",

    "En stramming i kroppen\nen varme\nen uro",

    "Før du rekker å tenke\nhar stemmen din allerede blitt hard",

    "Og etterpå kommer det:\n\n“Hva er det som skjer med meg?”\n“Det er noe galt med meg”\n“Jeg trenger hjelp”",

    "Det er som om noe tok over\n\n(pause)",

    "Det er ikke noe galt med deg",

    "I Uro-metoden handler det om å bli kjent\nmed det som trigger mønsteret ditt",

    "slik at du kan møte det som er trigget\nmed en større bevissthet",

    "På denne måten kan du møte barnet ditt\nfra et sted som er i kontakt\nmed dine dypeste ressurser",

    "Og barnet ditt vil merke forskjellen",
  ],
  buttonLabel: "Gå videre",
},
  {
    id: "5",
    type: "choices",
    title: "Hva ønsker du å gjøre nå?",
    choiceButtons: ["Les mer om Uro-metoden", "Gå videre til utforskning"],
  },
  {
    id: "6",
    type: "aboutMethod",
    title: "Om Uro-metoden",
    paragraphs: [
      "Uro-metoden handler om å bli kjent med det som skjer i deg i øyeblikket",
      "Oppmerksomheten flyttes fra tanker til det som kan sanses i kroppen",
    ],
    readMoreLabel: "Les mer",
    buttonLabel: "Gå videre",
  },
    {
    id: "7",
    type: "learningOptions",
    title: "Hva du vil lære?",
    optionButtons: [
        "Hva uro er",
        "Hvordan reaksjoner oppstår",
        "Hvordan kroppen er inngangen",
    ],
    footerText: 'Metoden er omtalt i bestselgeren\n"Kampen mot uroen", utgitt av\nGyldendal',
    buttonLabel: "Gå videre",
    },
    {
    id: "8",
    type: "subscription",
    title: "Start din utforskning",
    subtitle: "Du får tilgang til:",
    bullets: [
        "Samtale med ASHO",
        "Lydbibliotek",
        "Case og erfaringer",
        "En personlig vei over tid",
    ],
    secondaryButtonLabel: "Opprett konto",
    primaryButtonLabel: "Start abonnement",
    }
];