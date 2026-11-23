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

  settleLines: ["Built, shipped,", "played."],
  settleIntro: "Two custom PCs, a live web platform and a drum cover. Choose one to see how it came together.",

  about: {
    bio: "I'm Arush, a senior at Irvington High in Fremont, and I learn by building. I like to take a system apart until I understand it, then make something of my own. That curiosity has led me to hand-build two PCs, one for my mom, and to design and ship CarAdvisor, a full-stack car research platform with an AI assistant that I've refined across 172 commits. When I'm not at a keyboard, I'm behind a drum kit or on the court playing basketball, ping pong or tennis.",
    facts: [
      { k: "Age", v: "17" },
      { k: "School", v: "Irvington High · Class of 2027" },
      { k: "Based in", v: "Fremont, CA" },
      { k: "Shipped", v: "CarAdvisor · Next.js, TypeScript, AI" },
      { k: "Built", v: "2 custom PCs" },
      { k: "Plays", v: "Drums · Basketball · Ping pong · Tennis" },
    ],
    sports: ["Basketball", "Ping pong", "Tennis"],
  },

  // Each build assembles itself on scroll. `base` parts are already in the case;
  // `install` parts drop in one per scroll step (keys: cpu, ram, ssd, gpu).
  pcBuilds: [
    {
      name: "Main Rig",
      note: "My personal build: gaming, editing, everything.",
      accent: "#2bff88",
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
      name: "2nd Build",
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

  courses: [
    {
      title: "embARC: Architectural Engineering",
      org: "UC Berkeley · Summer",
      desc: "I took a building from an empty site to a finished concept: analyzing light, circulation and context, translating sketches into physical models, and reasoning through how loads move through a structure. Presenting to architects in critiques taught me to defend every decision with a reason, not a preference.",
      tags: ["Architecture", "Structural reasoning", "Model making"],
    },
    {
      title: "Electrical Engineering & Sustainable Energy",
      org: "Johns Hopkins · Summer",
      desc: "I studied energy as a systems problem: how power is generated, stored and moved across a grid, and where efficiency is lost along the way. I applied circuit fundamentals to renewable sources like solar and wind and weighed the tradeoffs engineers face in making clean energy reliable at scale.",
      tags: ["Electrical Engineering", "Energy systems", "Sustainability"],
    },
    {
      title: "Design Studio",
      org: "California College of the Arts · SF · Summer",
      desc: "In a fast-paced studio at one of the West Coast's top design schools, I learned to treat design as problem-solving. I moved from rough sketches through rounds of critique and revision to finished work where every choice of form, composition and hierarchy had a purpose. It's the same discipline I now bring to the interfaces I build.",
      tags: ["Visual design", "Iteration", "Design thinking"],
    },
  ],

  drumming: {
    blurb: "",
    // A local .mp4 in assets/ or a YouTube embed URL ("https://www.youtube.com/embed/VIDEO_ID")
    video: "assets/beggin-drum-cover.mp4",
    poster: "assets/beggin-poster.jpg",
    videoTitle: "Beggin' — Drum Cover",
    kit: ["Mapex Venus drum kit", "Red finish, chrome hardware"],
    cardTitles: ["Beggin' Cover", "Mapex Venus"],
  },

  art: {
    title: "Living Landscapes",
    medium: "Preserved moss & resin · handmade frames",
    image: "assets/moss-art.jpg",
    desc: "A pair of preserved-moss landscapes seen from above: a forest canopy, and a lake with an island at its center. The project took two years, from planning, sketching and sourcing the moss to cutting and shaping every piece by hand. I built both frames myself.",
    process: ["Planning & sketching", "Sourcing the moss", "Cutting & shaping", "Resin water", "Handmade frames"],
  },
};
