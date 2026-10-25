// Everything you see on the site lives here. Replace any remaining [bracketed] placeholders.
// Add an `image: "assets/your-photo.jpg"` to web/project items to swap the placeholder art for a real image.
window.CONTENT = {
  name: "Arush Chirputkar",
  email: "arushchirp@gmail.com",
  socials: [{ label: "Instagram", url: "https://instagram.com/arushxchirp" }],

  heroTag: "Senior @ Irvington HS · Fremont, CA",
  heroName: ["Arush", "Chirputkar"],
  roles: ["PCs", "websites", "beats"],
  intro: "I build things from scratch: gaming rigs, real websites and drum grooves. Scroll and watch it all lock into place.",
  heroStats: [
    { v: "2", k: "PCs built" },
    { v: "1", k: "site live" },
    { v: "17", k: "years old" },
  ],

  settleLines: ["Everything", "I make."],
  settleIntro: "Pick anything to jump straight to it.",

  about: {
    // Add photo: "assets/me.jpg" to swap the monogram for a real picture
    photo: "",
    roles: ["Builder", "Designer", "Drummer"],
    headline: "I'd rather build it than buy it.",
    bio: "I'm Arush, a 17-year-old senior at Irvington High in Fremont. I've hand-built two PCs from the ground up (one of them for my mom), designed and shipped CarAdvisor, a full-stack car research site with AI built in, and I record drum covers on my Mapex Venus kit. If it's broken, I want to fix it. If it doesn't exist yet, I want to make it.",
    meta: ["Fremont, CA", "Irvington High · Class of 2027"],
    stats: [
      { v: 172, k: "commits shipped on CarAdvisor" },
      { v: 2, k: "PCs built by hand" },
      { v: 1, k: "full-stack site live" },
      { v: 17, k: "years old" },
    ],
    // Shown as a typed-out code card
    code: {
      school: "Irvington High · Class of 2027",
      builds: ["Main Rig", "Mom's Build"],
      shipped: ["caradvisorusa.com"],
      stack: ["Next.js", "TypeScript", "Supabase", "Prisma", "Tailwind", "Groq AI"],
      plays: ["drums", "basketball", "ping pong", "tennis"],
    },
    // Real problems from CarAdvisor's commit history
    solved: [
      { problem: "The AI chat could stall forever on some messages.", fix: "Added an 8-second stream timeout and handled off-topic and filtered prompts, so the assistant always answers." },
      { problem: "Logging in didn't take effect until a second refresh.", fix: "Set the session cookie on the redirect response and moved the OAuth callback to the Edge runtime. Login is instant now." },
      { problem: "Google Search Console flagged structured-data errors.", fix: "Fixed the schema markup and added Vehicle schema, a sitemap, robots.txt and llms.txt so search engines and AI answer engines can read the site." },
      { problem: "Reddit owner discussions came from a third-party mirror.", fix: "Moved them onto Reddit's official API." },
      { problem: "Real users left feedback.", fix: "Ran an audit of it and shipped 7 improvements." },
    ],
    toolkit: [
      { group: "Hardware", items: ["PC building", "Part selection", "Cable management", "Troubleshooting"] },
      { group: "Web", items: ["Next.js", "TypeScript", "Supabase", "Prisma", "Tailwind", "Groq AI", "SEO / schema.org"] },
      { group: "Music", items: ["Drums", "Covers", "Mapex Venus"] },
    ],
    sports: ["Basketball", "Ping pong", "Tennis"],
    marquee: ["PC Building", "Next.js", "TypeScript", "Supabase", "Prisma", "Tailwind", "Groq AI", "SEO", "Drums", "Basketball", "Ping Pong", "Tennis", "Fixing Tech"],
  },

  // Each build assembles itself on scroll. `base` parts are already in the case;
  // `install` parts drop in one per scroll step (keys: cpu, ram, ssd, gpu).
  pcBuilds: [
    {
      name: "Main Rig",
      note: "My personal build: gaming, editing, everything.",
      accent: "#8b7cf6",
      // 3D model: "hs420" (dual-chamber, vertical GPU) or "midtower" (classic, horizontal GPU)
      caseModel: "hs420",
      caseColor: "#121216",
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
      caseModel: "midtower",
      caseColor: "#e6e6ea",
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
      tools: ["Next.js", "TypeScript", "Supabase", "Prisma", "Tailwind", "Groq AI"],
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
    blurb: "My cover of \"Beggin'\" on my Mapex Venus kit, played with an extra heavy kick.",
    // A local .mp4 in assets/ or a YouTube embed URL ("https://www.youtube.com/embed/VIDEO_ID")
    video: "assets/beggin-drum-cover.mp4",
    poster: "assets/beggin-poster.jpg",
    videoTitle: "Beggin' — Drum Cover",
    kit: ["Mapex Venus drum kit", "Red finish, chrome hardware"],
    cardTitles: ["Beggin' Cover", "Mapex Venus"],
  },
};
