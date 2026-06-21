import { describe, it, expect } from "vitest";
import { ruleParse } from "@/lib/network-engine/parser/rule-parser";
import { buildTopology } from "@/lib/network-engine/topology-builder";
import { planNetwork } from "@/lib/network-engine/planner";

describe("topology + planning engine", () => {
  it("expands an intent into the right number of devices and infers links", () => {
    const topo = buildTopology(ruleParse("2 routers, 3 switches, 1 server, 20 pcs, vlan"));
    expect(topo.devices).toHaveLength(26); // 2 + 3 + 1 + 20
    expect(topo.connections.length).toBeGreaterThan(0);
    expect(topo.layout).toBeDefined();
  });

  it("uses STATIC routing for a single router", () => {
    const plan = planNetwork(buildTopology(ruleParse("1 router, 5 pcs")));
    expect(plan.routing.protocol).toBe("STATIC");
  });

  it("uses OSPF and VLANs when servers and PCs coexist with many routers", () => {
    const plan = planNetwork(buildTopology(ruleParse("2 routers, 1 server, 10 pcs")));
    expect(plan.routing.protocol).toBe("OSPF");
    expect(plan.vlanPlan.length).toBeGreaterThan(0);
  });

  it("always returns security notes", () => {
    const plan = planNetwork(buildTopology(ruleParse("1 router, 2 pcs")));
    expect((plan.notes ?? []).length).toBeGreaterThan(0);
  });
});
