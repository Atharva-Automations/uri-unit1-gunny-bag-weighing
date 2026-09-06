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

export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type WeighingHistory = typeof weighingHistory.$inferSelect;
export type NewWeighingHistory = typeof weighingHistory.$inferInsert;
