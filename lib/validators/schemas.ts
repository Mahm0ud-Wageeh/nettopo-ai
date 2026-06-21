import { z } from "zod";

export const deviceTypeSchema = z.enum(["ROUTER", "SWITCH", "SERVER", "PC", "FIREWALL", "AP"]);

export const deviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: deviceTypeSchema,
  meta: z.record(z.unknown()).optional(),
});

export const connectionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  meta: z.record(z.unknown()).optional(),
});

export const topologySchema = z.object({
  devices: z.array(deviceSchema).max(500, "Too many devices"),
  connections: z.array(connectionSchema).max(2000),
});

export const parseInputSchema = z.object({
  text: z.string().min(2, "Describe your network").max(4000),
  lang: z.enum(["ar", "en", "auto"]).default("auto"),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  source: z.enum(["PROMPT", "IMAGE", "MANUAL"]).default("MANUAL"),
  prompt: z.string().max(4000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const exportSchema = z.object({
  projectId: z.string(),
  format: z.enum(["png", "pdf", "json"]),
});
