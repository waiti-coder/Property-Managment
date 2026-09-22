import { BaseLayout } from "@/components/layouts/base-layout";
import { PropertyListing } from "@/app/properties/components/property-list";

export default function PropertyList() {
  return (
    <BaseLayout
      title="Properties"
      description="Browse available houses and apply for the one you like"
    >
      <div className="px-4 lg:px-6">
        <PropertyListing />
      </div>
    </BaseLayout>
  );
}
