import CompoundInventoryPage from "@/app/compound-inventory/page";

export default async function CompoundInventoryCisPage({ searchParams }: { searchParams: Promise<{ inwardId?: string; partId?: string }> }) {
  const params = await searchParams;
  return <CompoundInventoryPage initialTab="cis" initialInwardId={params.inwardId} initialPartId={params.partId} />;
}
