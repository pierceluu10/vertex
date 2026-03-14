import "@/styles/vertex.css";
import { CustomCursor } from "@/components/vertex/custom-cursor";
import { VertexNavbar } from "@/components/vertex/vertex-navbar";
import { VertexFooter } from "@/components/vertex/vertex-footer";

export default function MissionPage() {
  return (
    <div className="vertex-page" style={{ paddingTop: "100px" }}>
      <CustomCursor />
      <VertexNavbar />

      <div className="vtx-section-wrap">
        <section className="vtx-demo-section" style={{ gridTemplateColumns: "1fr" }}>
          <div className="vtx-demo-copy" style={{ maxWidth: "680px" }}>
            <span className="vtx-section-num">Our Mission</span>
            <h2>Learning that<br/>feels like <em>play</em></h2>
            <p style={{ maxWidth: "600px" }}>
              Vertex pairs adaptive AI with curriculum-aligned content to meet every child exactly where
              they are. Our system learns how your child thinks — and teaches in the way they learn best.
            </p>
            <p style={{ maxWidth: "600px", marginTop: "24px" }}>
              We believe every child deserves a personal tutor that adapts to their pace, celebrates their
              progress, and never loses patience. Vertex makes that possible — powered by AI, designed for kids,
              and built in Toronto.
            </p>
          </div>
        </section>
      </div>

      <VertexFooter />
    </div>
  );
}
