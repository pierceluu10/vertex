import { CustomCursor } from "@/components/vertex/custom-cursor";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="vertex-page" style={{ minHeight: "100vh" }}>
      <CustomCursor />
      {children}
    </div>
  );
}
