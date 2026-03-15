import { CustomCursor } from "@/components/vertex/custom-cursor";

export default function KidDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vertex-page" style={{ minHeight: "100vh" }}>
      <CustomCursor />
      {children}
    </div>
  );
}
