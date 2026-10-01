import CompoundInventoryPage from "@/app/compound-inventory/page";

export default async function CompoundInventoryOutwardPage({
  searchParams,
}: {
  searchParams: Promise<{ inwardId?: string; partId?: string }>;
}) {
  const params = await searchParams;
  return <CompoundInventoryPage initialTab="outward" initialInwardId={params.inwardId} initialPartId={params.partId} />;
}
