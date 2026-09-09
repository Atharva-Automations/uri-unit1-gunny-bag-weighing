import CompoundInventoryPage from "@/app/compound-inventory/page";

export default async function CompoundInventoryOutwardPage({ searchParams }: { searchParams: Promise<{ cisId?: string; partId?: string }> }) {
  const params = await searchParams;
  return <CompoundInventoryPage initialTab="outward" initialCisId={params.cisId} initialPartId={params.partId} />;
}
