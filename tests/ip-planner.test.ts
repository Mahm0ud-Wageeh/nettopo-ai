import { describe, it, expect } from "vitest";
import { prefixForHosts, maskFromPrefix, allocateSubnets } from "@/lib/network-engine/ip-planner";

describe("ip-planner", () => {
  it("computes the smallest prefix for a host count", () => {
    expect(prefixForHosts(2)).toBe(30); // 2 usable
    expect(prefixForHosts(20)).toBe(27); // 30 usable
    expect(prefixForHosts(50)).toBe(26); // 62 usable
  });

  it("builds dotted-decimal masks from a prefix", () => {
    expect(maskFromPrefix(24)).toBe("255.255.255.0");
    expect(maskFromPrefix(26)).toBe("255.255.255.192");
  });

  it("allocates VLSM subnets largest-first and contiguous", () => {
    const subnets = allocateSubnets("192.168.0.0", [
      { name: "small", hosts: 2 },
      { name: "big", hosts: 50 },
    ]);
    expect(subnets[0].name).toBe("big");
    expect(subnets[0].cidr).toBe("192.168.0.0/26");
    expect(subnets[1].cidr).toBe("192.168.0.64/30");
  });
});
