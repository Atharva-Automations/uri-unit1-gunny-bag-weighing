import {
  pgTable,
  serial,
  varchar,
  numeric,
  integer,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

// Master parts list
export const parts = pgTable("parts", {
  id: serial("id").primaryKey(),
  partNumber: varchar("part_number", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 500 }).notNull(),
  minWeight: numeric("min_weight", { precision: 10, scale: 3 }).notNull(),
  maxWeight: numeric("max_weight", { precision: 10, scale: 3 }).notNull(),
  quantity: integer("quantity").notNull(),
  actualWeight: numeric("actual_weight", { precision: 10, scale: 3 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Weighing history records
export const weighingHistory = pgTable("weighing_history", {
  id: serial("id").primaryKey(),
  partId: integer("part_id")
    .notNull()
    .references(() => parts.id, { onDelete: "cascade" }),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  actualWeight: numeric("actual_weight", { precision: 10, scale: 3 }).notNull(),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // OK | UNDERWEIGHT | OVERWEIGHT
  operatorName: varchar("operator_name", { length: 200 }),
  remarks: text("remarks"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const compoundInwards = pgTable("compound_inwards", {
  id: serial("id").primaryKey(),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  inwardNumber: varchar("inward_number", { length: 60 }).notNull().unique(),
  labelCode: varchar("label_code", { length: 100 }).notNull().unique(),
  quantity: integer("quantity").notNull(),
  supplier: varchar("supplier", { length: 200 }),
  batchNumber: varchar("batch_number", { length: 100 }),
  operatorName: varchar("operator_name", { length: 200 }),
  remarks: text("remarks"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

export const compoundCis = pgTable("compound_cis", {
  id: serial("id").primaryKey(),
  inwardId: integer("inward_id").notNull().references(() => compoundInwards.id, { onDelete: "cascade" }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  cisNumber: varchar("cis_number", { length: 60 }).notNull().unique(),
  labelCode: varchar("label_code", { length: 100 }).notNull().unique(),
  quantity: integer("quantity").notNull(),
  operatorName: varchar("operator_name", { length: 200 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const compoundOutwards = pgTable("compound_outwards", {
  id: serial("id").primaryKey(),
  cisId: integer("cis_id").notNull().references(() => compoundCis.id, { onDelete: "cascade" }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  outwardNumber: varchar("outward_number", { length: 60 }).notNull().unique(),
  labelCode: varchar("label_code", { length: 100 }).unique(),
  quantity: integer("quantity").notNull(),
  destination: varchar("destination", { length: 200 }),
  operatorName: varchar("operator_name", { length: 200 }),
  remarks: text("remarks"),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const compoundReturns = pgTable("compound_returns", {
  id: serial("id").primaryKey(),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  outwardId: integer("outward_id").references(() => compoundOutwards.id, { onDelete: "set null" }),
  cisId: integer("cis_id").references(() => compoundCis.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  batchNumber: varchar("batch_number", { length: 100 }),
  supplier: varchar("supplier", { length: 200 }),
  inwardNumber: varchar("inward_number", { length: 60 }),
  qualityGrade: varchar("quality_grade", { length: 100 }),
  operatorName: varchar("operator_name", { length: 200 }),
  remarks: text("remarks"),
  addToInventory: integer("add_to_inventory").notNull().default(1),
  returnedAt: timestamp("returned_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type WeighingHistory = typeof weighingHistory.$inferSelect;
export type NewWeighingHistory = typeof weighingHistory.$inferInsert;
export type CompoundInward = typeof compoundInwards.$inferSelect;
export type CompoundCis = typeof compoundCis.$inferSelect;
export type CompoundOutward = typeof compoundOutwards.$inferSelect;
export type CompoundReturn = typeof compoundReturns.$inferSelect;
