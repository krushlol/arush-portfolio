// Everything you see on the site lives here. Replace any remaining [bracketed] placeholders.
// Add an `image: "assets/your-photo.jpg"` to web/project items to swap the placeholder art for a real image.
window.CONTENT = {
  name: "Arush Chirputkar",
  email: "arushchirp@gmail.com",
  socials: [{ label: "Instagram", url: "https://instagram.com/arushxchirp" }],

  heroLines: ["I build PCs,", "websites", "& beats."],
  intro:
    "Senior at Irvington High School in Fremont, CA. I like building things from scratch and fixing tech. Scroll to watch it all fall into place.",

  settleLines: ["Four things", "I love making."],
  settleIntro: "Every card is something I've built, designed or played. Pick a column to dig in.",

  about: {
    bio: "I'm Arush, a 17-year-old senior at Irvington High School in Fremont. I love building things from scratch, whether that's a PC, a website or a fix for some broken tech. When I'm not at a desk, I'm playing basketball, ping pong or tennis, or hanging out with family and friends.",
    facts: [
      { k: "Age", v: "17" },
      { k: "School", v: "Senior, Irvington High" },
      { k: "Based in", v: "Fremont, CA" },
      { k: "Plays", v: "Basketball · Ping pong · Tennis" },
    ],
  },

  // Each build assembles itself on scroll. `base` parts are already in the case;
  // `install` parts drop in one per scroll step (keys: cpu, ram, ssd, gpu).
  pcBuilds: [
    {
      name: "Main Rig",
      note: "My personal build: gaming, editing, everything.",
      accent: "#8b7cf6",
      gpuMount: "vertical",
      base: [
        { type: "Case", name: "HAVN HS 420 VGPU" },
        { type: "Motherboard", name: "[Motherboard]" },
        { type: "PSU", name: "[Power supply]" },
        { type: "Cooling", name: "[CPU cooler]" },
      ],
      install: [
        { key: "cpu", type: "CPU", name: "Intel Core i7-14700K", short: "i7-14700K" },
        { key: "ram", type: "RAM", name: "32GB DDR5", short: "DDR5" },
        { key: "ssd", type: "Storage", name: "1TB SSD", short: "1TB" },
        { key: "gpu", type: "GPU", name: "NVIDIA GeForce RTX 5070", short: "RTX 5070" },
      ],
    },
    {
      name: "Mom's Build",
      note: "Built this one for my mom.",
      accent: "#ef5a4c",
      gpuMount: "horizontal",
      base: [
        { type: "Case", name: "[Case]" },
        { type: "Motherboard", name: "[Motherboard]" },
        { type: "PSU", name: "[Power supply]" },
        { type: "Cooling", name: "[CPU cooler]" },
      ],
      install: [
        { key: "cpu", type: "CPU", name: "Intel Core Ultra 7 270K Plus", short: "Ultra 7" },
        { key: "ram", type: "RAM", name: "32GB DDR5", short: "DDR5" },
        { key: "ssd", type: "Storage", name: "1TB SSD", short: "1TB" },
        { key: "gpu", type: "GPU", name: "AMD Radeon RX 9070 XT", short: "RX 9070 XT" },
      ],
    },
  ],

  webDesign: [
    {
      title: "CarAdvisor",
      role: "Designed & built: research, compare and find your next car",
      tools: ["Next.js", "Tailwind", "Prisma", "Claude API"],
      link: "https://caradvisorusa.com",
      image: "assets/caradvisor.jpg",
    },
  ],

  projects: [
    { title: "[Project One]", desc: "One or two lines about what it does and why you made it.", tags: ["Code"], link: "#" },
    { title: "[Project Two]", desc: "One or two lines about what it does and why you made it.", tags: ["Hardware"], link: "#" },
    { title: "[Project Three]", desc: "One or two lines about what it does and why you made it.", tags: ["Design"], link: "#" },
  ],

  drumming: {
    blurb: "[How long you've played, your style, bands or covers you love.]",
    // Paste a YouTube embed URL, e.g. "https://www.youtube.com/embed/VIDEO_ID"
    video: "",
    kit: ["[Kit / shell pack]", "[Snare]", "[Cymbals]", "[Pedal]"],
    cardTitles: ["[Cover #1]", "[Groove practice]", "[Live set]", "[Drum kit]"],
  },
};
