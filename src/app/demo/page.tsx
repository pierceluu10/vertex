import "@/styles/vertex.css";
import { CustomCursor } from "@/components/vertex/custom-cursor";
import { VertexNavbar } from "@/components/vertex/vertex-navbar";
import { MathQuiz } from "@/components/vertex/math-quiz";
import { Grapher } from "@/components/vertex/grapher";
import { VertexFooter } from "@/components/vertex/vertex-footer";

export default function DemoPage() {
  return (
    <div className="vertex-page" style={{ paddingTop: "100px" }}>
      <CustomCursor />
      <VertexNavbar />
      <MathQuiz />
      <Grapher />
      <VertexFooter />
    </div>
  );
}
