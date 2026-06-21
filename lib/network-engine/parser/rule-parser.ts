import type { DeviceType, ParsedIntent } from "@/lib/network-engine/types";

// English + Arabic number words -> value
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  "واحد": 1, "اثنين": 2, "اثنان": 2, "ثلاث": 3, "ثلاثة": 3,
  "اربع": 4, "اربعة": 4, "خمس": 5, "خمسة": 5, "ست": 6, "ستة": 6,
  "سبع": 7, "سبعة": 7, "ثمان": 8, "ثمانية": 8, "تسع": 9, "تسعة": 9,
  "عشر": 10, "عشرة": 10, "عشرين": 20, "ثلاثين": 30,
};

// device keywords (lowercased); Arabic forms included.
// IMPORTANT: order longer/plural forms first so they win when both could match.
const DEVICE_KEYWORDS: { type: DeviceType; words: string[] }[] = [
  { type: "ROUTER", words: ["routers", "router", "راوتر", "روتر", "موجه"] },
  { type: "SWITCH", words: ["switches", "switch", "سويتشات", "سويتش", "مبدل"] },
  { type: "SERVER", words: ["servers", "server", "سيرفر", "خادم", "خوادم"] },
  { type: "PC", words: ["pcs", "pc", "computers", "computer", "hosts", "host", "جهاز", "اجهزة", "حاسوب", "كمبيوتر"] },
  { type: "FIREWALL", words: ["firewalls", "firewall", "جدار حماية", "فايروول"] },
  { type: "AP", words: ["access points", "access point", "ap", "نقطة وصول", "اكسس بوينت"] },
];

function wordToNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUM_WORDS[token] ?? null;
}

/**
 * Find the count that appears just before a device keyword, else 1.
 * The trailing (?![\p{L}]) guard stops a singular form (e.g. "router")
 * from also matching inside a plural one ("routers"), which would double count.
 */
function countBefore(text: string, keyword: string): number | null {
  const re = new RegExp(`(\\d+|[\\p{L}]+)\\s+(?:[\\p{L}]+\\s+){0,2}?${keyword}(?![\\p{L}])`, "giu");
  let count: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = wordToNumber(m[1].toLowerCase());
    if (n !== null) count = (count ?? 0) + n;
  }
  if (count === null && new RegExp(`(?<![\\p{L}])${keyword}(?![\\p{L}])`, "iu").test(text)) return 1;
  return count;
}

export function ruleParse(input: string): ParsedIntent {
  const text = input.toLowerCase();
  const devices: ParsedIntent["devices"] = [];
  const claimed = new Set<DeviceType>();

  for (const { type, words } of DEVICE_KEYWORDS) {
    if (claimed.has(type)) continue;
    let total = 0;
    let matched = false;
    // Only the first (longest) keyword that matches counts, to avoid
    // summing singular + plural forms of the same device.
    for (const w of words) {
      const c = countBefore(text, w);
      if (c !== null) { total += c; matched = true; break; }
    }
    if (matched && total > 0) {
      devices.push({ type, count: total });
      claimed.add(type);
    }
  }

  const vlan = /\bvlan|segment|segmentation|فلان|تقسيم|عزل\b/iu.test(text);
  let routingProtocol: string | undefined;
  for (const p of ["ospf", "eigrp", "rip", "bgp", "static"]) {
    if (text.includes(p)) { routingProtocol = p.toUpperCase(); break; }
  }

  return { devices, options: { vlan, routingProtocol } };
}